// Runs in Node and in the browser. In the browser pass `wasm` and `zkey` URLs.
const snarkjs = require("snarkjs");
const { AbiCoder, keccak256, toBeHex, ZeroAddress } = require("ethers");
const { FIELD_SIZE, MERKLE_TREE_HEIGHT } = require("./constants");
const { MerkleTree } = require("./merkleTree");
const { Utxo } = require("./utxo");
const { Keypair } = require("./keypair");

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

/**
 * Rebuild the pool's tree from its NewCommitment events. If the RPC refuses a big
 * block range, the range is split in half until it accepts.
 */
async function queryRange(pool, from, to, depth = 0) {
  try {
    return await pool.queryFilter(pool.filters.NewCommitment(), from, to);
  } catch (err) {
    if (from >= to || depth > 20) throw err;
    const mid = Math.floor((from + to) / 2);
    return [...(await queryRange(pool, from, mid, depth + 1)), ...(await queryRange(pool, mid + 1, to, depth + 1))];
  }
}

async function fetchCommitments(pool, fromBlock = 0) {
  const provider = pool.runner.provider || pool.runner;
  const latest = await provider.getBlockNumber();
  const events = await queryRange(pool, Number(fromBlock), latest);
  return events
    .map((e) => ({ commitment: BigInt(e.args.commitment), index: Number(e.args.index), encryptedOutput: e.args.encryptedOutput }))
    .sort((a, b) => a.index - b.index);
}

async function buildTree(pool, levels = MERKLE_TREE_HEIGHT, fromBlock = 0) {
  const commitments = await fetchCommitments(pool, fromBlock);
  return new MerkleTree(levels, commitments.map((c) => c.commitment));
}

/** Find this keypair's unspent notes in the pool. Works with a view-only keypair for viewing. */
async function scanNotes(pool, keypair, { includeSpent = false, fromBlock = 0 } = {}) {
  const commitments = await fetchCommitments(pool, fromBlock);
  const notes = [];
  for (const c of commitments) {
    const utxo = Utxo.decrypt(keypair, c.encryptedOutput, c.index, c.commitment);
    if (!utxo || utxo.amount === 0n) continue;
    // Needs the nullifier key, which spend keys and (new-style) view keys both have.
    if (!includeSpent && keypair.nk) {
      if (await pool.isSpent(toBytes32(utxo.getNullifier()))) continue;
    }
    notes.push(utxo);
  }
  return notes;
}

/**
 * Builds the proof and contract args for any transaction.
 *  deposit:   inputs [],          outputs [note]       -> extAmount > 0
 *  transfer:  inputs [notes],     outputs [to, change] -> extAmount = -fee
 *  withdraw:  inputs [notes],     outputs [change?], recipient set -> extAmount < 0
 */
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
  wasm = DEFAULT_WASM,
  zkey = DEFAULT_ZKEY,
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
    inputNullifier: inputs.map((u) => u.getNullifier()),
    inAmount: inputs.map((u) => u.amount),
    inPrivateKey: inputs.map((u) => u.keypair.privkey),
    inBlinding: inputs.map((u) => u.blinding),
    inPathIndices,
    inPathElements,
    outputCommitment: outputs.map((u) => u.getCommitment()),
    outAmount: outputs.map((u) => u.amount),
    outPubkey: outputs.map((u) => u.keypair.pubkey),
    outBlinding: outputs.map((u) => u.blinding),
  };

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
  };

  return { args, extData, outputs };
}

/**
 * Pick at most 2 notes that cover `amount`: the smallest single note that's big
 * enough, otherwise the two largest. Returns null if 2 notes can't cover it.
 */
function selectNotes(notes, amount) {
  amount = BigInt(amount);
  const sorted = [...notes].sort((a, b) => (a.amount < b.amount ? -1 : a.amount > b.amount ? 1 : 0));
  const single = sorted.find((n) => n.amount >= amount);
  if (single) return [single];
  const two = sorted.slice(-2);
  return two.length === 2 && two[0].amount + two[1].amount >= amount ? two : null;
}

/** Raw stock-token units -> underlying shares, per ERC-8056. */
function toShares(rawAmount, uiMultiplier) {
  return (BigInt(rawAmount) * BigInt(uiMultiplier)) / 10n ** 18n;
}

module.exports = { prepareTransaction, hashExtData, publicAmountField, buildTree, scanNotes, fetchCommitments, selectNotes, toShares, toBytes32 };
