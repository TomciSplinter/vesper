// Everything the UI needs, with no UI code: wallet, account, scanning and the three actions.
import { BrowserProvider, JsonRpcProvider, Contract, getAddress, formatUnits, parseUnits, toBeHex, isAddress, ZeroAddress } from "ethers";
import {
  initPoseidon,
  Keypair,
  Utxo,
  signInTypedData,
  prepareTransaction,
  buildTree,
  scanNotes,
  selectNotes,
  getRelayerInfo,
  relayTransaction,
  fetchAssociationSet,
  linkKeypair,
  encodeLinkSecret,
  decodeLinkSecret,
  readLink,
  scanLinks,
} from "../../src/index.js";

const POOL_ABI = [
  "event NewCommitment(bytes32 indexed commitment, uint256 index, bytes encryptedOutput)",
  "event AssociationSetUpdated(uint256 root, uint256[] added, uint256[] removed, string uri)",
  "function transact((bytes proof,bytes32 root,bytes32[2] inputNullifiers,bytes32[2] outputCommitments,uint256 publicAmount,bytes32 extDataHash,uint256 newLabel,uint256 aspRoot,uint256 exitLabel) args,(address recipient,int256 extAmount,address relayer,uint256 fee,bytes encryptedOutput1,bytes encryptedOutput2) extData,address asset)",
  "function nextDepositLabel(address depositor) view returns (uint256)",
  "function depositorOf(uint256 label) view returns (address)",
  "function aspRoot() view returns (uint256)",
  "event NewNullifier(bytes32 indexed nullifier)",
  "function isSpent(bytes32 nullifier) view returns (bool)",
  "function isFull() view returns (bool)",
  "function isKnownAspRoot(uint256 root) view returns (bool)",
  "function aspRootReplacedAt(uint256 root) view returns (uint256)",
  "function ASP_GRACE() view returns (uint256)",
  "function assetConfig(address) view returns (bool depositsEnabled, uint256 maxDepositAmount)",
  "function depositsPaused() view returns (bool)",
];
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function uiMultiplier() view returns (uint256)",
];

const DECIMALS = 18; // Stock Tokens are 18-decimal
export const fmt = (raw, dp = 4) => {
  const s = formatUnits(raw, DECIMALS);
  const [i, f = ""] = s.split(".");
  const frac = f.slice(0, dp).replace(/0+$/, "");
  return frac ? `${i}.${frac}` : i;
};
export const parseAmount = (s) => {
  // Accept a decimal comma (European keyboards type "0,07") and stray spaces.
  const t = String(s).trim().replace(/\s/g, "").replace(",", ".");
  if (!/^(\d+\.?\d*|\.\d+)$/.test(t || "0")) throw new Error("Enter a number, like 0.5");
  const v = parseUnits(t || "0", DECIMALS);
  if (v <= 0n) throw new Error("Enter an amount above zero.");
  return v;
};

const sum = (notes) => notes.reduce((s, n) => s + n.amount, 0n);

export class Vesper {
  constructor(config) {
    this.config = config;
    this.read = new JsonRpcProvider(config.rpcUrl, config.chainId, { staticNetwork: true });
    this.pool = new Contract(config.pool, POOL_ABI, this.read);
    this.assets = config.assets.map((a) => ({ ...a, address: getAddress(a.address) }));
    this.circuit = { wasm: config.wasmUrl || "circuit/transaction2.wasm", zkey: config.zkeyUrl || "circuit/transaction2.zkey" };
    this.keypair = null;
    this.signer = null;
    this.account = null;
  }

  static async load(configUrl = "config.json") {
    const res = await fetch(configUrl, { cache: "no-store" });
    if (!res.ok) throw new Error("Couldn't load config.json");
    await initPoseidon();
    return new Vesper(await res.json());
  }

  asset(address) {
    return this.assets.find((a) => a.address === getAddress(address));
  }

  explorerTx(hash) {
    return this.config.explorer ? `${this.config.explorer.replace(/\/$/, "")}/tx/${hash}` : null;
  }

  // ------------------------------------------------------------ wallet

  /** Connects an EIP-1193 wallet (an extension, or a phone wallet through WalletConnect). */
  async connect(eth) {
    eth = eth || (typeof window !== "undefined" ? window.ethereum : null);
    if (!eth) throw new Error("No wallet found. Pick a wallet app, or install a wallet extension in this browser.");
    this.eth = eth;
    await eth.request({ method: "eth_requestAccounts" });
    const want = toBeHex(this.config.chainId);
    const current = await eth.request({ method: "eth_chainId" }).catch(() => null);
    if (!current || BigInt(current) !== BigInt(this.config.chainId)) {
      try {
        await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: want }] });
      } catch (err) {
        const code = err?.code ?? err?.data?.originalError?.code;
        if (code !== 4902 && !/unrecognized|not added|unsupported chain/i.test(err?.message || "")) throw err;
        await eth.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: want,
            chainName: this.config.chainName,
            rpcUrls: [this.config.rpcUrl],
            nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
            blockExplorerUrls: this.config.explorer ? [this.config.explorer] : [],
          }],
        });
      }
    }
    const provider = new BrowserProvider(eth);
    this.signer = await provider.getSigner();
    this.account = await this.signer.getAddress();
    return this.account;
  }

  /**
   * One free signature turns the wallet into its Vesper account. If this wallet
   * produced a DIFFERENT account here before, its wallet doesn't sign the same way
   * twice and funds could look lost: warn instead of silently switching accounts.
   */
  async unlock(eth) {
    if (eth || !this.signer) await this.connect(eth);
    const { domain, types, value } = signInTypedData(this.config.chainId);
    const sig = await this.signer.signTypedData(domain, types, value);
    this.keypair = Keypair.fromSignature(sig);
    this.accountWarning = null;
    const key = `vesper:account:${this.config.chainId}:${this.account.toLowerCase()}`;
    try {
      const before = localStorage.getItem(key);
      if (before && before !== this.keypair.address()) {
        this.accountWarning = "This wallet opened a different Vesper account last time. Your wallet may not sign the same way twice. Don't deposit until this is sorted out.";
      } else if (!before) localStorage.setItem(key, this.keypair.address());
    } catch {}
    return this.keypair;
  }

  openViewKey(viewKeyString) {
    this.keypair = Keypair.fromExportedViewKey(viewKeyString);
    return this.keypair;
  }

  lock() {
    this.keypair = null;
    this.signer = null;
    this.account = null;
  }

  get viewOnly() {
    return !!this.keypair && this.keypair.privkey === null;
  }

  // ---------------------------------------------------------- balances

  /** Approved deposit labels (null if the screener hasn't published a list yet). */
  async associationSet() {
    return fetchAssociationSet(this.pool, this.config.deployBlock || 0);
  }

  /**
   * { notes, byAsset: [{ asset, total, approved, pending, notes, uiMultiplier, walletBalance }] }
   * approved = can be withdrawn privately; pending = waiting for approval (can only
   * be returned to the wallet that deposited it, or sent privately without a relayer).
   */
  async balances() {
    const [notes, asp] = await Promise.all([
      scanNotes(this.pool, this.keypair, { fromBlock: this.config.deployBlock || 0 }),
      this.associationSet().catch(() => null),
    ]);
    const status = await this._labelStatus(asp, notes.map((n) => n.label));
    const byAsset = [];
    for (const a of this.assets) {
      const mine = notes.filter((n) => n.asset === BigInt(a.address));
      const token = new Contract(a.address, ERC20_ABI, this.read);
      let uiMultiplier = 10n ** 18n;
      try {
        uiMultiplier = await token.uiMultiplier();
      } catch {}
      const walletBalance = this.account && !this.viewOnly ? await token.balanceOf(this.account) : null;
      const total = sum(mine);
      const of = (st) => mine.filter((n) => status.get(n.label)?.status === st);
      const expiringNotes = of("expiring");
      const expiringBy = expiringNotes.length ? Math.min(...expiringNotes.map((n) => status.get(n.label).until)) : null;
      byAsset.push({
        asset: a,
        total,
        approved: sum(of("approved")) + sum(expiringNotes), // can be withdrawn privately now
        expiring: sum(expiringNotes), // removed from the list: withdraw privately before expiringBy
        expiringBy,
        pending: sum(of("pending")),
        notes: mine,
        uiMultiplier,
        walletBalance,
      });
    }
    return { notes, byAsset, asp };
  }

  /**
   * label -> { status: "approved" | "expiring" | "pending", until? (ms) }.
   * expiring = dropped from the current list, but still in a set the pool accepts
   * for its grace period, so it can still be withdrawn privately until `until`.
   */
  async _labelStatus(asp, labels) {
    const out = new Map();
    let grace = null;
    for (const l of new Set(labels)) {
      if (asp?.has(l)) out.set(l, { status: "approved" });
      else {
        const older = asp ? await asp.forLabel(l) : null;
        if (older) {
          grace ??= Number(await this.pool.ASP_GRACE());
          const replaced = Number(await this.pool.aspRootReplacedAt(older.root));
          out.set(l, { status: "expiring", until: (replaced + grace) * 1000 });
        } else out.set(l, { status: "pending" });
      }
    }
    return out;
  }

  /** USD value of one token per asset address, or null when prices aren't available. */
  async prices() {
    if (!this.config.pricesUrl) return null;
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 8000);
      const res = await fetch(this.config.pricesUrl, { signal: ctl.signal });
      clearTimeout(t);
      if (!res.ok) return null;
      const { prices } = await res.json();
      const out = {};
      for (const [k, v] of Object.entries(prices || {})) out[getAddress(k)] = Number(v);
      return out;
    } catch {
      return null;
    }
  }

  async relayer() {
    const url = this.config.relayers?.[0];
    if (!url) return null;
    const info = await getRelayerInfo(url);
    if (info.chainId !== this.config.chainId || getAddress(info.pool) !== getAddress(this.config.pool)) {
      throw new Error("The relayer is set up for a different pool.");
    }
    return { url, ...info };
  }

  async relayerFee(asset) {
    const r = await this.relayer();
    if (!r) return null;
    const fee = r.minFees[getAddress(asset)];
    return fee === undefined ? null : { relayer: r, fee: BigInt(fee) };
  }

  // ----------------------------------------------------------- actions
  // Each takes onStep(text) so the UI can show progress.

  async _prepare(opts) {
    const tree = await buildTree(this.pool, undefined, this.config.deployBlock || 0);
    return prepareTransaction({ pool: this.pool, chainId: this.config.chainId, tree, ...this.circuit, ...opts });
  }

  async _sendOwn(prepared, asset, onStep) {
    onStep("Confirm the transaction in your wallet…");
    const tx = await this.pool.connect(this.signer).transact(prepared.args, prepared.extData, asset);
    onStep("Waiting for the network…");
    const r = await tx.wait();
    return r.hash;
  }

  async _sendRelayed(prepared, asset, relayerUrl, onStep) {
    onStep("Sending through the relayer…");
    const job = await relayTransaction(relayerUrl, prepared, asset, { pollMs: 1500 });
    return job.txHash;
  }

  async deposit(assetAddr, amount, onStep = () => {}) {
    this._needSpender();
    const asset = getAddress(assetAddr);
    const token = new Contract(asset, ERC20_ABI, this.signer);
    const have = await token.balanceOf(this.account);
    if (have < amount) throw new Error(`Your wallet only has ${fmt(have)} ${this.asset(asset).symbol}.`);
    const [enabled, max] = await this.pool.assetConfig(asset);
    if (!enabled) throw new Error("Deposits of this stock aren't open yet.");
    if (await this.pool.depositsPaused()) throw new Error("New deposits are paused right now. Withdrawals still work.");
    if (amount > max) throw new Error(`The most you can deposit at once is ${fmt(max)}.`);

    if ((await token.allowance(this.account, this.config.pool)) < amount) {
      onStep("Approve Vesper to move your tokens (one time)…");
      await (await token.approve(this.config.pool, amount)).wait();
    }
    onStep("Creating your private proof…");
    const prepared = await this._prepare({ asset, depositor: this.account, outputs: [new Utxo({ amount, keypair: this.keypair, asset })] });
    const hash = await this._sendOwn(prepared, asset, onStep);
    await this._requestApproval(onStep);
    return hash;
  }

  /** Asks the screener to review new deposits (testnet: runs right away). Best effort. */
  async _requestApproval(onStep) {
    if (!this.config.aspUpdateUrl) return;
    onStep("Checking your deposit for approval…");
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 45_000);
      await fetch(this.config.aspUpdateUrl, { method: "POST", signal: ctl.signal });
      clearTimeout(t);
    } catch {}
  }

  /** Private send to a Vesper address. useRelayer keeps your wallet out of it. */
  async send(assetAddr, amount, toVesperAddress, { useRelayer = true } = {}, onStep = () => {}) {
    this._needSpender();
    const asset = getAddress(assetAddr);
    const recipient = Keypair.fromAddress(toVesperAddress);
    const asp = await this.associationSet();
    const { fee, relayer } = await this._feeFor(asset, useRelayer);
    // A relayer fee leaves the pool, so relayed sends need approved money.
    const inputs = await this._pickNotes(asset, amount + fee, { asp, approvedOnly: !!relayer });
    const change = inputs.reduce((s, n) => s + n.amount, 0n) - amount - fee;
    onStep("Creating your private proof…");
    const prepared = await this._prepare({
      asset,
      inputs,
      outputs: [new Utxo({ amount, keypair: recipient, asset }), new Utxo({ amount: change, keypair: this.keypair, asset })],
      fee,
      relayer: relayer ? relayer.relayer : ZeroAddress,
      asp,
    });
    return relayer ? this._sendRelayed(prepared, asset, relayer.url, onStep) : this._sendOwn(prepared, asset, onStep);
  }

  /** Withdraw `amount` of APPROVED money to any 0x address (it receives exactly `amount`). */
  async withdraw(assetAddr, amount, toAddress, { useRelayer = true } = {}, onStep = () => {}) {
    this._needSpender();
    if (!isAddress(toAddress)) throw new Error("That isn't a valid 0x address.");
    const asset = getAddress(assetAddr);
    const asp = await this.associationSet();
    const { fee, relayer } = await this._feeFor(asset, useRelayer);
    const inputs = await this._pickNotes(asset, amount + fee, { asp, approvedOnly: true });
    const change = inputs.reduce((s, n) => s + n.amount, 0n) - amount - fee;
    onStep("Creating your private proof…");
    const prepared = await this._prepare({
      asset,
      inputs,
      outputs: change > 0n ? [new Utxo({ amount: change, keypair: this.keypair, asset })] : [],
      fee,
      recipient: getAddress(toAddress),
      relayer: relayer ? relayer.relayer : ZeroAddress,
      asp,
    });
    return relayer ? this._sendRelayed(prepared, asset, relayer.url, onStep) : this._sendOwn(prepared, asset, onStep);
  }

  /**
   * Returns money that's waiting for approval to the wallet that deposited it.
   * Public (anyone can link it to that deposit), no fee, sent from your own wallet.
   * Returns up to two notes from one deposit at a time.
   */
  async returnToDepositor(assetAddr, onStep = () => {}) {
    this._needSpender();
    const asset = getAddress(assetAddr);
    const asp = await this.associationSet();
    const all = await this._notes(asset);
    const status = await this._labelStatus(asp, all.map((n) => n.label));
    const notes = all.filter((n) => status.get(n.label).status === "pending");
    if (!notes.length) throw new Error("Nothing is waiting for approval.");
    const groups = new Map();
    for (const n of notes) groups.set(n.label, [...(groups.get(n.label) || []), n]);
    const [label, group] = [...groups.entries()].sort((a, b) => (sum(b[1]) > sum(a[1]) ? 1 : -1))[0];
    const inputs = [...group].sort((a, b) => (a.amount < b.amount ? 1 : -1)).slice(0, 2);
    const depositor = await this.pool.depositorOf(label);
    onStep(`Creating your proof to return it to ${depositor.slice(0, 6)}…${depositor.slice(-4)}…`);
    // A relayer that sponsors exits sends it for free, so no wallet of yours appears.
    let relayer = null;
    try {
      relayer = await this.relayer();
    } catch {}
    const prepared = await this._prepare({ asset, inputs, recipient: depositor, exit: true });
    if (relayer?.sponsorsExits) return this._sendRelayed(prepared, asset, relayer.url, onStep);
    if (!this.signer) throw new Error("Connect a wallet to do this.");
    return this._sendOwn(prepared, asset, onStep);
  }

  /** Combine your two biggest notes from the same deposit into one. */
  async combine(assetAddr, { useRelayer = true } = {}, onStep = () => {}) {
    this._needSpender();
    const asset = getAddress(assetAddr);
    const asp = await this.associationSet();
    const notes = await this._notes(asset);
    const groups = new Map();
    for (const n of notes) groups.set(n.label, [...(groups.get(n.label) || []), n]);
    const best = [...groups.entries()].filter(([, g]) => g.length >= 2).sort((a, b) => (sum(b[1]) > sum(a[1]) ? 1 : -1))[0];
    if (!best) throw new Error("Nothing to combine: notes from different deposits can't be merged.");
    const [label, group] = best;
    // A relayer fee needs approved money; otherwise send it yourself.
    const { fee, relayer } = await this._feeFor(asset, useRelayer && !!asp?.has(label));
    const two = [...group].sort((a, b) => (a.amount < b.amount ? 1 : -1)).slice(0, 2);
    const total = sum(two);
    if (total <= fee) throw new Error("Nothing to combine.");
    onStep("Creating your private proof…");
    const prepared = await this._prepare({
      asset,
      inputs: two,
      outputs: [new Utxo({ amount: total - fee, keypair: this.keypair, asset })],
      fee,
      relayer: relayer ? relayer.relayer : ZeroAddress,
      asp,
    });
    return relayer ? this._sendRelayed(prepared, asset, relayer.url, onStep) : this._sendOwn(prepared, asset, onStep);
  }

  // -------------------------------------------------------- claim links
  // A link holds stock like cash: whoever opens it can claim it. The claim always goes
  // through the relayer (so the person claiming needs no ETH), and its fee is added on top
  // when the link is made, so the receiver gets the full amount.

  linkUrl(kp) {
    const base = typeof location !== "undefined" ? `${location.origin}${location.pathname}` : "https://vesper.markets/";
    return `${base}#claim=${encodeLinkSecret(kp)}`;
  }

  /** Makes a link worth `amount` of the stock. Returns { url, txHash }. */
  async createLink(assetAddr, amount, { useRelayer = true } = {}, onStep = () => {}) {
    this._needSpender();
    const asset = getAddress(assetAddr);
    const claim = await this.relayerFee(asset);
    if (!claim) throw new Error("Links need the relayer, which isn't available for this stock right now.");
    onStep("Finding a fresh link…");
    const { nextIndex } = await scanLinks(this.pool, this.keypair, { fromBlock: this.config.deployBlock || 0 });
    const kp = linkKeypair(this.keypair, nextIndex);
    const linkAmount = amount + claim.fee;
    const asp = await this.associationSet();
    const { fee, relayer } = await this._feeFor(asset, useRelayer);
    // The claim pays a relayer fee, so the link must hold approved money.
    const inputs = await this._pickNotes(asset, linkAmount + fee, { asp, approvedOnly: true });
    const change = sum(inputs) - linkAmount - fee;
    onStep("Creating your private proof…");
    const prepared = await this._prepare({
      asset,
      inputs,
      outputs: [new Utxo({ amount: linkAmount, keypair: kp, asset }), new Utxo({ amount: change, keypair: this.keypair, asset })],
      fee,
      relayer: relayer ? relayer.relayer : ZeroAddress,
      asp,
    });
    const txHash = relayer ? await this._sendRelayed(prepared, asset, relayer.url, onStep) : await this._sendOwn(prepared, asset, onStep);
    return { url: this.linkUrl(kp), txHash, amount, asset };
  }

  /** The links this account made: [{ index, url, asset, amount, claimed }], newest first. */
  async myLinks() {
    this._needSpender();
    const [{ links }, relayer] = await Promise.all([
      scanLinks(this.pool, this.keypair, { fromBlock: this.config.deployBlock || 0 }),
      this.relayer().catch(() => null),
    ]);
    return links
      .map((l) => {
        const notes = l.notes.length ? l.notes : [];
        const asset = notes[0] ? this.assets.find((a) => BigInt(a.address) === notes[0].asset) : null;
        const amount = sum(notes);
        // What the receiver gets: the link holds the amount plus their claim fee.
        const fee = asset && relayer?.minFees?.[asset.address] !== undefined ? BigInt(relayer.minFees[asset.address]) : 0n;
        return { index: l.index, url: this.linkUrl(l.keypair), keypair: l.keypair, claimed: l.claimed, asset, amount, receive: amount > fee ? amount - fee : amount };
      })
      .reverse();
  }

  /** Opens a link (no wallet needed): { keypair, items: [{ asset, amount, fee, receive }] }. */
  async openLink(secretOrUrl) {
    const kp = decodeLinkSecret(secretOrUrl);
    const { notes, claimed } = await readLink(this.pool, kp, { fromBlock: this.config.deployBlock || 0 });
    const items = [];
    for (const a of this.assets) {
      const mine = notes.filter((n) => n.asset === BigInt(a.address));
      if (!mine.length) continue;
      const r = await this.relayerFee(a.address).catch(() => null);
      const fee = r ? r.fee : null;
      const amount = sum(mine);
      items.push({ asset: a, amount, fee, receive: fee !== null && amount > fee ? amount - fee : 0n });
    }
    return { keypair: kp, items, claimed };
  }

  /**
   * Claims a link through the relayer, either into this account's private balance
   * (to = "private", needs unlock) or out to a 0x wallet address.
   */
  async claimLink(linkKp, assetAddr, to, onStep = () => {}) {
    const asset = getAddress(assetAddr);
    const { notes } = await readLink(this.pool, linkKp, { fromBlock: this.config.deployBlock || 0 });
    const mine = notes.filter((n) => n.asset === BigInt(asset)).sort((a, b) => (a.amount < b.amount ? 1 : -1)).slice(0, 2);
    if (!mine.length) throw new Error("This link has already been claimed.");
    const { fee, relayer } = await this._feeFor(asset, true);
    const total = sum(mine);
    if (total <= fee) throw new Error("This link holds less than the relayer fee.");
    const asp = await this.associationSet();
    onStep("Creating the proof…");
    let prepared;
    if (to === "private") {
      this._needSpender();
      prepared = await this._prepare({ asset, inputs: mine, outputs: [new Utxo({ amount: total - fee, keypair: this.keypair, asset })], fee, relayer: relayer.relayer, asp });
    } else {
      if (!isAddress(to)) throw new Error("That isn't a valid 0x address.");
      prepared = await this._prepare({ asset, inputs: mine, recipient: getAddress(to), fee, relayer: relayer.relayer, asp });
    }
    return this._sendRelayed(prepared, asset, relayer.url, onStep);
  }

  async _feeFor(asset, useRelayer) {
    if (!useRelayer) {
      if (!this.signer) throw new Error("Connect a wallet to send it yourself.");
      return { fee: 0n, relayer: null };
    }
    const r = await this.relayerFee(asset);
    if (!r) throw new Error("No relayer is available for this stock. Turn off the relayer to send it from your own wallet.");
    // Never pay a relayer more than the app's own limit, whatever it asks (self-audit F9).
    const cap = this.config.maxRelayerFees?.[getAddress(asset)];
    if (cap !== undefined && r.fee > parseUnits(String(cap), DECIMALS)) {
      throw new Error(`The relayer asks ${fmt(r.fee)}, more than this app's limit of ${cap}. Turn off the relayer or try later.`);
    }
    return r;
  }

  async _notes(asset) {
    return (await scanNotes(this.pool, this.keypair, { fromBlock: this.config.deployBlock || 0 })).filter((n) => n.asset === BigInt(asset));
  }

  async _pickNotes(asset, needed, { asp = null, approvedOnly = false } = {}) {
    const all = await this._notes(asset);
    const status = await this._labelStatus(asp, all.map((n) => n.label));
    const usable = approvedOnly ? all.filter((n) => status.get(n.label).status !== "pending") : all;
    const total = sum(all);
    const usableTotal = sum(usable);
    if (total < needed) throw new Error(`Not enough private balance: you need ${fmt(needed)} including fees, and have ${fmt(total)}.`);
    if (usableTotal < needed) {
      throw new Error(
        `Only ${fmt(usableTotal)} of your balance is approved so far; the rest is waiting for approval. ` +
          "You can wait, send it privately without the relayer, or return it to the wallet that deposited it."
      );
    }
    // Approved money (including money in its grace period) before anything else.
    const rank = (l) => ({ expiring: 2, approved: 1 })[status.get(l)?.status] || 0;
    const picked = selectNotes(usable, needed, (l) => rank(l) > 0);
    if (!picked) throw new Error("Your balance is split across too many notes (or deposits) for one transaction. Tap “Combine notes” first.");
    return picked;
  }

  _needSpender() {
    if (!this.keypair || this.viewOnly) throw new Error("Unlock your account first.");
  }
}
