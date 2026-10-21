// Everything the UI needs, with no UI code: wallet, account, scanning and the three actions.
import { BrowserProvider, JsonRpcProvider, Contract, getAddress, formatUnits, parseUnits, toBeHex, isAddress, ZeroAddress } from "ethers";
import {
  initPoseidon,
  Keypair,
  Utxo,
  SIGN_IN_MESSAGE,
  prepareTransaction,
  buildTree,
  scanNotes,
  selectNotes,
  getRelayerInfo,
  relayTransaction,
} from "../../src/index.js";

const POOL_ABI = [
  "event NewCommitment(bytes32 indexed commitment, uint256 index, bytes encryptedOutput)",
  "function transact((bytes proof,bytes32 root,bytes32[2] inputNullifiers,bytes32[2] outputCommitments,uint256 publicAmount,bytes32 extDataHash) args,(address recipient,int256 extAmount,address relayer,uint256 fee,bytes encryptedOutput1,bytes encryptedOutput2) extData,address asset)",
  "function isSpent(bytes32 nullifier) view returns (bool)",
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
  const v = parseUnits(String(s).trim() || "0", DECIMALS);
  if (v <= 0n) throw new Error("Enter an amount above zero.");
  return v;
};

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

  hasWallet() {
    return typeof window !== "undefined" && !!window.ethereum;
  }

  async connect() {
    if (!this.hasWallet()) throw new Error("No wallet found. Open this page in your wallet's browser (e.g. MetaMask) or install a wallet extension.");
    const eth = window.ethereum;
    await eth.request({ method: "eth_requestAccounts" });
    const want = toBeHex(this.config.chainId);
    try {
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: want }] });
    } catch (err) {
      if (err.code !== 4902 && err?.data?.originalError?.code !== 4902) throw err;
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
    const provider = new BrowserProvider(eth);
    this.signer = await provider.getSigner();
    this.account = await this.signer.getAddress();
    return this.account;
  }

  /** One free signature turns the wallet into its Vesper account. */
  async unlock() {
    if (!this.signer) await this.connect();
    const sig = await this.signer.signMessage(SIGN_IN_MESSAGE);
    this.keypair = Keypair.fromSignature(sig);
    return this.keypair;
  }

  openViewKey(viewKeyString) {
    this.keypair = Keypair.fromExportedViewKey(viewKeyString);
    return this.keypair;
  }

  lock() {
    this.keypair = null;
  }

  get viewOnly() {
    return !!this.keypair && this.keypair.privkey === null;
  }

  // ---------------------------------------------------------- balances

  /** { notes, byAsset: [{ asset, total, notes, uiMultiplier, walletBalance }] } */
  async balances() {
    const notes = await scanNotes(this.pool, this.keypair, { fromBlock: this.config.deployBlock || 0 });
    const byAsset = [];
    for (const a of this.assets) {
      const mine = notes.filter((n) => n.asset === BigInt(a.address));
      const token = new Contract(a.address, ERC20_ABI, this.read);
      let uiMultiplier = 10n ** 18n;
      try {
        uiMultiplier = await token.uiMultiplier();
      } catch {}
      const walletBalance = this.account && !this.viewOnly ? await token.balanceOf(this.account) : null;
      byAsset.push({ asset: a, total: mine.reduce((s, n) => s + n.amount, 0n), notes: mine, uiMultiplier, walletBalance });
    }
    return { notes, byAsset };
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
    onStep("Creating your private proof (this can take a little while)…");
    const prepared = await this._prepare({ asset, outputs: [new Utxo({ amount, keypair: this.keypair, asset })] });
    return this._sendOwn(prepared, asset, onStep);
  }

  /** Private send to a Vesper address. useRelayer keeps your wallet out of it. */
  async send(assetAddr, amount, toVesperAddress, { useRelayer = true } = {}, onStep = () => {}) {
    this._needSpender();
    const asset = getAddress(assetAddr);
    const recipient = Keypair.fromAddress(toVesperAddress);
    const { fee, relayer } = await this._feeFor(asset, useRelayer);
    const inputs = await this._pickNotes(asset, amount + fee);
    const change = inputs.reduce((s, n) => s + n.amount, 0n) - amount - fee;
    onStep("Creating your private proof (this can take a little while)…");
    const prepared = await this._prepare({
      asset,
      inputs,
      outputs: [new Utxo({ amount, keypair: recipient, asset }), new Utxo({ amount: change, keypair: this.keypair, asset })],
      fee,
      relayer: relayer ? relayer.relayer : ZeroAddress,
    });
    return relayer ? this._sendRelayed(prepared, asset, relayer.url, onStep) : this._sendOwn(prepared, asset, onStep);
  }

  /** Withdraw `amount` to any 0x address (it receives exactly `amount`). */
  async withdraw(assetAddr, amount, toAddress, { useRelayer = true } = {}, onStep = () => {}) {
    this._needSpender();
    if (!isAddress(toAddress)) throw new Error("That isn't a valid 0x address.");
    const asset = getAddress(assetAddr);
    const { fee, relayer } = await this._feeFor(asset, useRelayer);
    const inputs = await this._pickNotes(asset, amount + fee);
    const change = inputs.reduce((s, n) => s + n.amount, 0n) - amount - fee;
    onStep("Creating your private proof (this can take a little while)…");
    const prepared = await this._prepare({
      asset,
      inputs,
      outputs: change > 0n ? [new Utxo({ amount: change, keypair: this.keypair, asset })] : [],
      fee,
      recipient: getAddress(toAddress),
      relayer: relayer ? relayer.relayer : ZeroAddress,
    });
    return relayer ? this._sendRelayed(prepared, asset, relayer.url, onStep) : this._sendOwn(prepared, asset, onStep);
  }

  /** Combine your two biggest notes into one, so later sends can use the full balance. */
  async combine(assetAddr, { useRelayer = true } = {}, onStep = () => {}) {
    this._needSpender();
    const asset = getAddress(assetAddr);
    const { fee, relayer } = await this._feeFor(asset, useRelayer);
    const notes = (await scanNotes(this.pool, this.keypair, { fromBlock: this.config.deployBlock || 0 })).filter((n) => n.asset === BigInt(asset));
    const two = [...notes].sort((a, b) => (a.amount < b.amount ? 1 : -1)).slice(0, 2);
    const total = two.reduce((s, n) => s + n.amount, 0n);
    if (two.length < 2 || total <= fee) throw new Error("Nothing to combine.");
    onStep("Creating your private proof (this can take a little while)…");
    const prepared = await this._prepare({
      asset,
      inputs: two,
      outputs: [new Utxo({ amount: total - fee, keypair: this.keypair, asset })],
      fee,
      relayer: relayer ? relayer.relayer : ZeroAddress,
    });
    return relayer ? this._sendRelayed(prepared, asset, relayer.url, onStep) : this._sendOwn(prepared, asset, onStep);
  }

  async _feeFor(asset, useRelayer) {
    if (!useRelayer) {
      if (!this.signer) throw new Error("Connect a wallet to send it yourself.");
      return { fee: 0n, relayer: null };
    }
    const r = await this.relayerFee(asset);
    if (!r) throw new Error("No relayer is available for this stock. Turn off the relayer to send it from your own wallet.");
    return r;
  }

  async _pickNotes(asset, needed) {
    const notes = (await scanNotes(this.pool, this.keypair, { fromBlock: this.config.deployBlock || 0 })).filter((n) => n.asset === BigInt(asset));
    const total = notes.reduce((s, n) => s + n.amount, 0n);
    if (total < needed) throw new Error(`Not enough private balance: you need ${fmt(needed)} including fees, and have ${fmt(total)}.`);
    const picked = selectNotes(notes, needed);
    if (!picked) throw new Error("Your balance is split across too many notes for one transaction. Tap “Combine notes” first.");
    return picked;
  }

  _needSpender() {
    if (!this.keypair || this.viewOnly) throw new Error("Unlock your account first.");
  }
}
