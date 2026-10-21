// Vesper relayer core: checks a user's ready-made transaction and submits it with
// the relayer's own wallet, so the user never sends a transaction from an address
// linked to them. The relayer pays gas in ETH and is paid `fee` in the pool asset;
// the proof binds fee + relayer address, so nobody can redirect the fee or the
// withdrawal.
//
// The relayer can't steal or change anything: if it alters any field the proof
// fails. The worst it can do is refuse to relay (users can then pick another
// relayer or submit themselves).
const { ethers } = require("ethers");

const BYTES32 = /^0x[0-9a-fA-F]{64}$/;
const PROOF_HEX_LEN = 2 + 2 * 32 * 8; // abi.encode(uint256[2], uint256[2][2], uint256[2])
const MAX_ENCRYPTED_BYTES = 256; // a real note is 156 bytes; caps calldata griefing

class RelayError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const POOL_ABI = [
  "function transact((bytes proof,bytes32 root,bytes32[2] inputNullifiers,bytes32[2] outputCommitments,uint256 publicAmount,bytes32 extDataHash,uint256 newLabel,uint256 aspRoot,uint256 exitLabel) args,(address recipient,int256 extAmount,address relayer,uint256 fee,bytes encryptedOutput1,bytes encryptedOutput2) extData,address asset)",
  "function isKnownRoot(bytes32 root) view returns (bool)",
  "function isSpent(bytes32 nullifier) view returns (bool)",
  "function hashExtData((address recipient,int256 extAmount,address relayer,uint256 fee,bytes encryptedOutput1,bytes encryptedOutput2) extData,address asset) view returns (bytes32)",
  "function calculatePublicAmount(int256 extAmount,uint256 fee) pure returns (uint256)",
  "error AssetNotEnabled()",
  "error DepositsArePaused()",
  "error DepositTooLarge()",
  "error UnknownRoot()",
  "error NullifierAlreadySpent()",
  "error BadExtDataHash()",
  "error BadPublicAmount()",
  "error InvalidProof()",
  "error BadRecipient()",
  "error FeeOnTransferNotSupported()",
  "error IsPaused()",
  "error BadLabel()",
  "error NotApproved()",
  "error BadExit()",
];

class Relayer {
  /**
   * @param {object} opts
   * @param {ethers.Signer} opts.signer      relayer wallet (pays gas, receives fees)
   * @param {string} opts.pool               VesperPool address
   * @param {Object<string, bigint>} opts.minFees  asset address -> minimum fee in raw units.
   *        Only listed assets are relayed. (v0.1: fixed fees; a price feed comes later.)
   * @param {number} [opts.confirmations=1]
   */
  /**
   * @param {boolean} [opts.sponsorExits=false]  relay exits (unapproved money going back
   *        to its depositor) for free, so the holder needn't use a wallet of their own
   */
  constructor({ signer, pool, minFees, confirmations = 1, sponsorExits = false }) {
    if (!signer || !pool || !minFees) throw new Error("signer, pool and minFees are required");
    this.signer = signer;
    this.pool = new ethers.Contract(pool, POOL_ABI, signer);
    this.minFees = new Map(Object.entries(minFees).map(([a, f]) => [ethers.getAddress(a), BigInt(f)]));
    this.confirmations = confirmations;
    this.sponsorExits = sponsorExits;
    this.jobs = new Map(); // id -> { status, txHash?, error? }
    this.pendingNullifiers = new Set();
    this.queue = Promise.resolve(); // one submission at a time keeps nonces simple
  }

  async info() {
    const address = await this.signer.getAddress();
    const fees = {};
    for (const [a, f] of this.minFees) fees[a] = f.toString();
    return {
      relayer: address,
      pool: await this.pool.getAddress(),
      chainId: Number((await this.signer.provider.getNetwork()).chainId),
      minFees: fees,
      sponsorsExits: this.sponsorExits,
    };
  }

  /** Validates and parses a JSON request body into contract-ready values. Throws RelayError. */
  async check(body) {
    const { args, extData, asset: rawAsset } = parseRequest(body);
    const asset = ethers.getAddress(rawAsset);
    const me = await this.signer.getAddress();

    const minFee = this.minFees.get(asset);
    if (minFee === undefined) throw new RelayError("this relayer doesn't handle that asset");
    if (extData.extAmount > 0n) throw new RelayError("deposits can't be relayed; send them from your own wallet");
    if (args.exitLabel !== 0n) {
      // Exits pay no fee (the contract enforces it); a relayer may sponsor the gas.
      if (!this.sponsorExits) throw new RelayError("this relayer doesn't sponsor exits; send it from your own wallet");
      if (extData.fee !== 0n) throw new RelayError("exits can't pay a fee");
    } else {
      if (extData.fee < minFee) throw new RelayError(`fee too low: minimum is ${minFee} raw units`);
      if (ethers.getAddress(extData.relayer) !== me) throw new RelayError(`extData.relayer must be ${me}`);
    }
    if (extData.extAmount < 0n && extData.recipient === ethers.ZeroAddress) throw new RelayError("withdrawal needs a recipient");

    for (const n of args.inputNullifiers) {
      if (this.pendingNullifiers.has(n)) throw new RelayError("this note is already being relayed", 409);
    }

    // Cheap reads first, then a full simulation so we never pay gas for a failing tx.
    if (!(await this.pool.isKnownRoot(args.root))) throw new RelayError("unknown or too old Merkle root; rebuild the proof");
    for (const n of args.inputNullifiers) {
      if (await this.pool.isSpent(n)) throw new RelayError("note already spent", 409);
    }
    if ((await this.pool.hashExtData(extData, asset)) !== args.extDataHash) throw new RelayError("extDataHash doesn't match extData");
    if ((await this.pool.calculatePublicAmount(extData.extAmount, extData.fee)) !== args.publicAmount) {
      throw new RelayError("publicAmount doesn't match extAmount and fee");
    }
    try {
      await this.pool.transact.staticCall(args, extData, asset);
    } catch (err) {
      const reason = revertName(this.pool, err);
      // Can happen if the same note landed on-chain between the reads above and this simulation.
      if (reason === "NullifierAlreadySpent") throw new RelayError("note already spent", 409);
      throw new RelayError(`transaction would fail: ${reason}`);
    }
    return { args, extData, asset };
  }

  /** Checks, then queues the submission. Returns a job id immediately. */
  async submit(body) {
    const tx = await this.check(body);
    // check() awaits network reads, so re-check: another request may have claimed the note meanwhile.
    for (const n of tx.args.inputNullifiers) {
      if (this.pendingNullifiers.has(n)) throw new RelayError("this note is already being relayed", 409);
    }
    const id = ethers.hexlify(ethers.randomBytes(16));
    for (const n of tx.args.inputNullifiers) this.pendingNullifiers.add(n);
    this.jobs.set(id, { status: "queued" });

    const done = this.queue.then(() => this._send(id, tx));
    this.queue = done.catch(() => {});
    return { id, done };
  }

  async _send(id, { args, extData, asset }) {
    const job = this.jobs.get(id);
    try {
      job.status = "sending";
      const sent = await this.pool.transact(args, extData, asset);
      job.txHash = sent.hash;
      job.status = "sent";
      const receipt = await sent.wait(this.confirmations);
      job.status = receipt.status === 1 ? "confirmed" : "failed";
      job.gasUsed = receipt.gasUsed.toString();
    } catch (err) {
      job.status = "failed";
      job.error = revertName(this.pool, err);
    } finally {
      for (const n of args.inputNullifiers) this.pendingNullifiers.delete(n);
    }
    return job;
  }

  /**
   * Stateless mode (serverless): check, send right away, and use the transaction
   * hash as the job id. Status is then read from the chain with txStatus(), so
   * nothing has to survive between requests.
   */
  async submitNow(body) {
    const { args, extData, asset } = await this.check(body);
    try {
      const sent = await this.pool.transact(args, extData, asset);
      return { id: sent.hash };
    } catch (err) {
      throw new RelayError(`couldn't send: ${revertName(this.pool, err)}`, 502);
    }
  }

  /** Job status for a transaction hash, read from the chain. */
  async txStatus(hash) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) return null;
    const provider = this.signer.provider;
    const receipt = await provider.getTransactionReceipt(hash);
    if (receipt) return { status: receipt.status === 1 ? "confirmed" : "failed", txHash: hash, gasUsed: receipt.gasUsed.toString() };
    const tx = await provider.getTransaction(hash);
    return tx ? { status: "sent", txHash: hash } : null;
  }

  job(id) {
    return this.jobs.get(id) || null;
  }
}

// ---------------------------------------------------------------- parsing

function parseRequest(body) {
  if (!body || typeof body !== "object") throw new RelayError("body must be JSON");
  const { args, extData, asset } = body;
  if (!args || !extData || typeof asset !== "string" || !ethers.isAddress(asset)) {
    throw new RelayError("need { args, extData, asset }");
  }
  const b32 = (v, name) => {
    if (typeof v !== "string" || !BYTES32.test(v)) throw new RelayError(`${name} must be 32-byte hex`);
    return v.toLowerCase();
  };
  const pair = (v, name) => {
    if (!Array.isArray(v) || v.length !== 2) throw new RelayError(`${name} must have 2 entries`);
    return v.map((x, i) => b32(x, `${name}[${i}]`));
  };
  const int = (v, name) => {
    try {
      return BigInt(v);
    } catch {
      throw new RelayError(`${name} must be an integer`);
    }
  };
  const addr = (v, name) => {
    if (typeof v !== "string" || !ethers.isAddress(v)) throw new RelayError(`${name} must be an address`);
    return ethers.getAddress(v);
  };
  const enc = (v, name) => {
    if (typeof v !== "string" || !ethers.isHexString(v)) throw new RelayError(`${name} must be hex`);
    if (ethers.dataLength(v) > MAX_ENCRYPTED_BYTES) throw new RelayError(`${name} too long`);
    return v;
  };

  if (typeof args.proof !== "string" || !ethers.isHexString(args.proof) || args.proof.length !== PROOF_HEX_LEN) {
    throw new RelayError("bad proof encoding");
  }
  const parsedArgs = {
    proof: args.proof,
    root: b32(args.root, "root"),
    inputNullifiers: pair(args.inputNullifiers, "inputNullifiers"),
    outputCommitments: pair(args.outputCommitments, "outputCommitments"),
    publicAmount: int(args.publicAmount, "publicAmount"),
    extDataHash: b32(args.extDataHash, "extDataHash"),
    newLabel: int(args.newLabel ?? 0, "newLabel"),
    aspRoot: int(args.aspRoot ?? 0, "aspRoot"),
    exitLabel: int(args.exitLabel ?? 0, "exitLabel"),
  };
  const parsedExt = {
    recipient: addr(extData.recipient, "recipient"),
    extAmount: int(extData.extAmount, "extAmount"),
    relayer: addr(extData.relayer, "relayer"),
    fee: int(extData.fee, "fee"),
    encryptedOutput1: enc(extData.encryptedOutput1, "encryptedOutput1"),
    encryptedOutput2: enc(extData.encryptedOutput2, "encryptedOutput2"),
  };
  return { args: parsedArgs, extData: parsedExt, asset };
}

function revertName(contract, err) {
  const data = err?.data ?? err?.info?.error?.data ?? err?.error?.data;
  if (typeof data === "string" && data.length >= 10) {
    try {
      const parsed = contract.interface.parseError(data);
      if (parsed) return parsed.name;
    } catch {}
  }
  return err?.shortMessage || err?.reason || err?.message || "unknown error";
}

module.exports = { Relayer, RelayError, parseRequest, POOL_ABI };
