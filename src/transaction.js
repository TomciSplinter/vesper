// Runs in Node and in the browser. In the browser pass `wasm` and `zkey` URLs.
const snarkjs = require("snarkjs");
const { AbiCoder, keccak256, toBeHex, ZeroAddress } = require("ethers");
const { FIELD_SIZE, MERKLE_TREE_HEIGHT } = require("./constants");
const { MerkleTree } = require("./merkleTree");
const { Utxo } = require("./utxo");
const { Keypair } = require("./keypair");
const { queryAll } = require("./events");

// Node defaults: the files scripts/build-circuit.sh writes. (__dirname doesn't exist in browsers.)
const BUILD = typeof __dirname === "string" ? `${__dirname}/../build` : null;
const DEFAULT_WASM = BUILD && `${BUILD}/transaction2_js/transaction2.wasm`;
const DEFAULT_ZKEY = BUILD && `${BUILD}/transaction2.zkey`;

const coder = AbiCoder.defaultAbiCoder();
const EXT_DATA_TYPE =
  "tuple(address recipient,int256 extAmount,address relayer,uint256 fee,bytes encryptedOutput1,bytes encryptedOutput2)";

const toBytes32 = (n) => toBeHex(BigInt(n), 32);

/** Must equal VesperPool.hashExtData. */
function hashExtData({ chainId, pool, asset, extData }) {
  const encoded = coder.encode(
    ["uint256", "address", "address", EXT_DATA_TYPE],
    [chainId, pool, asset, [extData.recipient, extData.extAmount, extData.relayer, extData.fee, extData.encryptedOutput1, extData.encryptedOutput2]]
  );
  return BigInt(keccak256(encoded)) % FIELD_SIZE;
}

/** Must equal VesperPool.calculatePublicAmount. */
function publicAmountField(extAmount, fee) {
  const v = BigInt(extAmount) - BigInt(fee);
  return v >= 0n ? v : FIELD_SIZE + v;
}

/** Rebuild the pool's tree from its NewCommitment events. */
async function fetchCommitments(pool, fromBlock = 0) {
  const events = await queryAll(pool, pool.filters.NewCommitment(), fromBlock);
  return events
    .map((e) => ({ commitment: BigInt(e.args.commitment), index: Number(e.args.index), encryptedOutput: e.args.encryptedOutput }))
    .sort((a, b) => a.index - b.index);
}

async function buildTree(pool, levels = MERKLE_TREE_HEIGHT, fromBlock = 0) {
  const commitments = await fetchCommitments(pool, fromBlock);
  return new MerkleTree(levels, commitments.map((c) => c.commitment));
}

/** Find this keypair's unspent notes in the pool. Works with a view-only keypair for viewing. */
/** Every nullifier the pool has seen, from its NewNullifier events. */
async function fetchSpentNullifiers(pool, fromBlock = 0) {
  const events = await queryAll(pool, pool.filters.NewNullifier(), fromBlock);
  return new Set(events.map((e) => BigInt(e.args.nullifier)));
}

/**
 * Find this keypair's unspent notes in the pool. Works with a view-only keypair.
 * Spent status is checked LOCALLY against all NewNullifier events, never by asking
 * the RPC about specific nullifiers, which would tell the RPC operator which future
 * spends are yours (self-audit F7).
 */
async function scanNotes(pool, keypair, { includeSpent = false, fromBlock = 0 } = {}) {
  const [commitments, spent] = await Promise.all([
    fetchCommitments(pool, fromBlock),
    !includeSpent && keypair.nk ? fetchSpentNullifiers(pool, fromBlock) : Promise.resolve(null),
  ]);
  const notes = [];
  for (const c of commitments) {
    const utxo = Utxo.decrypt(keypair, c.encryptedOutput, c.index, c.commitment);
    if (!utxo || utxo.amount === 0n) continue;
    // Needs the nullifier key, which spend keys and view keys both have.
    if (spent && spent.has(utxo.getNullifier())) continue;
    notes.push(utxo);
  }
  return notes;
}

/**
 * Builds the proof and contract args for any transaction.
 *  deposit:   inputs [],          outputs [note]       -> extAmount > 0  (needs `depositor`)
 *  transfer:  inputs [notes],     outputs [to, change] -> extAmount = -fee
 *  withdraw:  inputs [notes],     outputs [change?], recipient set -> extAmount < 0
 *
 * Compliance, for anything that pays out of the pool (a withdrawal, or any fee):
 *  - asp: the current association set (from fetchAssociationSet). If the notes' label is
 *    in it, the proof shows that privately. If it isn't, this throws NotApprovedError.
 *  - exit: true to send unapproved money back to its original depositor instead
 *    (public, no fee, recipient must be the depositor).
 * Every new note inherits the label of the notes spent (or the new deposit's label).
 */
class NotApprovedError extends Error {
  constructor(label) {
    super("This money comes from a deposit that hasn't been approved yet. It can only be withdrawn back to the wallet that deposited it.");
    this.label = label;
  }
}

async function prepareTransaction({
  pool,
  asset,
  chainId,
  tree,
  inputs = [],
  outputs = [],
  fee = 0n,
  recipient = ZeroAddress,
  relayer = ZeroAddress,
  depositor,
  asp = null,
  exit = false,
  wasm = DEFAULT_WASM,
  zkey = DEFAULT_ZKEY,
  dryRun = false, // tests: return the circuit input instead of proving
}) {
  if (inputs.length > 2 || outputs.length > 2) throw new Error("max 2 inputs and 2 outputs; merge notes first");
  const assetField = BigInt(asset);
  for (const u of inputs) {
    if (u.amount > 0n && !u.keypair.canSpend) throw new Error("this keypair can't spend");
  }
  for (const u of [...inputs, ...outputs]) {
    if (u.asset !== assetField) throw new Error("all notes in a transaction must be the same asset");
  }

  inputs = inputs.slice();
  outputs = outputs.slice();
  while (inputs.length < 2) inputs.push(new Utxo({ asset, amount: 0n }));
  while (outputs.length < 2) outputs.push(new Utxo({ asset, amount: 0n, keypair: new Keypair() }));

  const sumIn = inputs.reduce((s, u) => s + u.amount, 0n);
  const sumOut = outputs.reduce((s, u) => s + u.amount, 0n);
  const extAmount = BigInt(fee) + sumOut - sumIn;
  if (extAmount < 0n && recipient === ZeroAddress) throw new Error("withdrawal needs a recipient");

  // ---- label ----
  let newLabel = 0n;
  let inLabel = 0n;
  const realLabels = [...new Set(inputs.filter((u) => u.amount > 0n).map((u) => u.label))];
  if (realLabels.length > 1) throw new Error("these notes come from different deposits and can't be combined in one transaction");
  if (extAmount > 0n) {
    if (realLabels.length) throw new Error("a deposit can't also spend notes");
    if (!depositor) throw new Error("a deposit needs `depositor` (the wallet sending it)");
    newLabel = BigInt(await pool.nextDepositLabel(depositor));
  } else {
    inLabel = realLabels[0] ?? 0n;
  }
  const label = newLabel || inLabel;
  for (const u of inputs) if (u.amount === 0n) u.label = inLabel; // dummies hash with inLabel in the circuit
  for (const u of outputs) u.label = label;

  // A full pool still pays out, but stores no new notes: change would be lost.
  if (typeof pool.isFull === "function" && (await pool.isFull())) {
    if (extAmount >= 0n) throw new Error("the pool is full: it can only pay out now");
    if (outputs.some((u) => u.amount > 0n)) throw new Error("the pool is full: withdraw whole notes, with no change");
  }

  // ---- compliance ----
  const paysOut = extAmount < 0n || BigInt(fee) > 0n;
  let aspRoot = 0n;
  let exitLabel = 0n;
  const aspLevels = asp?.tree?.levels ?? MERKLE_TREE_HEIGHT;
  let aspPathIndices = 0;
  let aspPathElements = new Array(aspLevels).fill(0n);
  if (paysOut && extAmount <= 0n) {
    if (exit) {
      if (BigInt(fee) !== 0n) throw new Error("an exit to the depositor can't pay a fee");
      exitLabel = label;
    } else if (asp) {
      const set = asp.forLabel ? await asp.forLabel(label) : asp.tree.indexOf(label) >= 0 ? { tree: asp.tree } : null;
      if (!set) throw new NotApprovedError(label);
      const idx = set.tree.indexOf(label);
      const p = set.tree.path(idx);
      aspRoot = set.tree.root();
      aspPathIndices = p.pathIndices;
      aspPathElements = p.pathElements;
    }
  }

  const inPathIndices = [];
  const inPathElements = [];
  for (const u of inputs) {
    if (u.amount > 0n) {
      const idx = tree.indexOf(u.getCommitment());
      if (idx < 0) throw new Error("input note not found in tree");
      u.index = idx;
      const p = tree.path(idx);
      inPathIndices.push(p.pathIndices);
      inPathElements.push(p.pathElements);
    } else {
      inPathIndices.push(0);
      inPathElements.push(new Array(tree.levels).fill(0n));
    }
  }

  const extData = {
    recipient,
    extAmount,
    relayer,
    fee: BigInt(fee),
    encryptedOutput1: outputs[0].encrypt(),
    encryptedOutput2: outputs[1].encrypt(),
  };
  const extDataHash = hashExtData({ chainId, pool: await pool.getAddress(), asset, extData });
  const publicAmount = publicAmountField(extAmount, fee);
  const root = tree.root();

  const input = {
    root,
    publicAmount,
    extDataHash,
    asset: assetField,
    newLabel,
    aspRoot,
    exitLabel,
    inputNullifier: inputs.map((u) => u.getNullifier()),
    outputCommitment: outputs.map((u) => u.getCommitment()),
    inLabel,
    inAmount: inputs.map((u) => u.amount),
    inPrivateKey: inputs.map((u) => u.keypair.privkey ?? 0n),
    inBlinding: inputs.map((u) => u.blinding),
    inPathIndices,
    inPathElements,
    outAmount: outputs.map((u) => u.amount),
    outPubkey: outputs.map((u) => u.keypair.pubkey),
    outBlinding: outputs.map((u) => u.blinding),
    aspPathIndices,
    aspPathElements,
  };

  if (dryRun) return { input, extData, outputs, label };
  const { proof } = await snarkjs.groth16.fullProve(input, wasm, zkey);
  const a = [proof.pi_a[0], proof.pi_a[1]];
  const b = [
    [proof.pi_b[0][1], proof.pi_b[0][0]],
    [proof.pi_b[1][1], proof.pi_b[1][0]],
  ];
  const c = [proof.pi_c[0], proof.pi_c[1]];

  const args = {
    proof: coder.encode(["uint256[2]", "uint256[2][2]", "uint256[2]"], [a, b, c]),
    root: toBytes32(root),
    inputNullifiers: input.inputNullifier.map(toBytes32),
    outputCommitments: input.outputCommitment.map(toBytes32),
    publicAmount,
    extDataHash: toBytes32(extDataHash),
    newLabel,
    aspRoot,
    exitLabel,
  };

  return { args, extData, outputs, label };
}

/**
 * Pick at most 2 notes FROM THE SAME DEPOSIT LABEL that cover `amount`: the smallest
 * single note that's big enough, otherwise the two largest. Labels for which
 * `prefer(label)` is true are tried first (e.g. approved ones). Null if none fits.
 */
function selectNotes(notes, amount, prefer = () => false) {
  amount = BigInt(amount);
  const groups = new Map();
  for (const n of notes) {
    const k = n.label ?? 0n;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(n);
  }
  const order = [...groups.keys()].sort((a, b) => Number(!!prefer(b)) - Number(!!prefer(a)));
  for (const k of order) {
    const sorted = [...groups.get(k)].sort((a, b) => (a.amount < b.amount ? -1 : a.amount > b.amount ? 1 : 0));
    const single = sorted.find((n) => n.amount >= amount);
    if (single) return [single];
    const two = sorted.slice(-2);
    if (two.length === 2 && two[0].amount + two[1].amount >= amount) return two;
  }
  return null;
}

/** Replays AssociationSetUpdated events into the ordered label list after each update. */
function replayAssociationSet(events) {
  const snapshots = [];
  let list = [];
  for (const ev of events) {
    const removed = new Set(ev.args.removed.map(BigInt));
    const kept = list.filter((l) => !removed.has(l));
    const keptSet = new Set(kept);
    list = [...kept, ...ev.args.added.map(BigInt).filter((l) => !keptSet.has(l))];
    snapshots.push({ root: BigInt(ev.args.root), labels: list });
  }
  return snapshots;
}

/**
 * The pool's association set (approved deposit labels), rebuilt by replaying every
 * AssociationSetUpdated event and CHECKED against the root the pool holds.
 * Returns null if none has been published yet, else
 *   { root, labels: Set, tree, has(label), forLabel(label) }
 * forLabel finds the newest still-valid set containing the label: normally the
 * current one, or, during the pool's grace period after a removal, an older one.
 */
async function fetchAssociationSet(pool, fromBlock = 0, levels = MERKLE_TREE_HEIGHT) {
  const events = await queryAll(pool, pool.filters.AssociationSetUpdated(), fromBlock);
  if (!events.length) return null;
  const snapshots = replayAssociationSet(events);
  const current = snapshots[snapshots.length - 1];
  const tree = new MerkleTree(levels, current.labels);
  if (tree.root() !== current.root) throw new Error("the published association set doesn't match its root");
  const onChain = BigInt(await pool.aspRoot());
  if (onChain !== current.root) throw new Error("the association set is out of date; try again in a moment");
  const set = new Set(current.labels);
  return {
    root: current.root,
    labels: set,
    tree,
    has: (l) => set.has(BigInt(l)),
    /** { tree, root, current } for the newest valid set holding `label`, or null. */
    async forLabel(label) {
      label = BigInt(label);
      if (set.has(label)) return { tree, root: current.root, current: true };
      for (let i = snapshots.length - 2; i >= 0 && i >= snapshots.length - 64; i--) {
        const snap = snapshots[i];
        if (!snap.labels.includes(label)) continue;
        if (!(await pool.isKnownAspRoot(snap.root))) return null; // older ones are expired too
        const t = new MerkleTree(levels, snap.labels);
        if (t.root() !== snap.root) throw new Error("a published association set doesn't match its root");
        return { tree: t, root: snap.root, current: false };
      }
      return null;
    },
  };
}

/** Raw stock-token units -> underlying shares, per ERC-8056. */
function toShares(rawAmount, uiMultiplier) {
  return (BigInt(rawAmount) * BigInt(uiMultiplier)) / 10n ** 18n;
}

module.exports = { prepareTransaction, NotApprovedError, fetchAssociationSet, replayAssociationSet, fetchSpentNullifiers, hashExtData, publicAmountField, buildTree, scanNotes, fetchCommitments, selectNotes, toShares, toBytes32 };
