// Runs in Node and in the browser (no Node-only APIs).
const nacl = require("tweetnacl");
const { randomBytes, sha256, keccak256, concat, toUtf8Bytes, toBeHex, getBytes, hexlify } = require("ethers");
const { poseidonHash } = require("./poseidon");
const { FIELD_SIZE } = require("./constants");

const strip0x = (h) => h.replace(/^0x/, "");

// Must match the constant in circuits/keypair.circom (NullifierKey).
const NK_DOMAIN = BigInt(keccak256(toUtf8Bytes("vesper-nullifier-key"))) % FIELD_SIZE;
const fromHex = (h) => getBytes("0x" + strip0x(h));

/** The message a wallet signs to derive its Vesper account. Changing it changes every account. */
const SIGN_IN_MESSAGE =
  "Vesper account key\n\nSigning this creates your private Vesper account for this wallet. " +
  "It costs nothing and sends no transaction. Only sign this on the real Vesper app.";

/**
 * A Vesper account.
 *  - spend key (privkey): can spend notes. Never share.
 *  - nullifier key (nk): computes nullifiers, so it can tell which notes are spent. Can't spend.
 *  - view key = encryption secret + nk: sees notes AND which are spent, so it shows the
 *    real balance. Can't spend. This is what you hand an accountant or auditor.
 *  - address: pubkey + encryption pubkey; share it to get paid.
 */
class Keypair {
  constructor(privkey) {
    if (privkey === undefined) {
      // 31 random bytes is always < FIELD_SIZE
      privkey = BigInt(hexlify(randomBytes(31)));
    }
    privkey = BigInt(privkey);
    if (privkey <= 0n || privkey >= FIELD_SIZE) throw new Error("private key out of field");
    this.privkey = privkey;
    this.pubkey = poseidonHash([privkey]);
    this.nk = poseidonHash([privkey, NK_DOMAIN]);
    const viewSecret = sha256(concat([toUtf8Bytes("vesper-view-key"), toBeHex(privkey, 32)]));
    this.encKeypair = nacl.box.keyPair.fromSecretKey(getBytes(viewSecret));
  }

  /**
   * Deterministic account from a wallet signature of SIGN_IN_MESSAGE, so the same
   * wallet always unlocks the same Vesper account and there's nothing extra to back up.
   */
  static fromSignature(signature) {
    const k = BigInt(keccak256(concat([toUtf8Bytes("vesper-spend-key"), getBytes(signature)]))) % FIELD_SIZE;
    return new Keypair(k === 0n ? 1n : k);
  }

  /** A receive-only keypair built from someone's shared address. */
  static fromAddress(address) {
    const hex = strip0x(String(address).trim());
    if (!/^[0-9a-fA-F]{128}$/.test(hex)) throw new Error("bad Vesper address");
    const kp = Object.create(Keypair.prototype);
    kp.privkey = null;
    kp.nk = null;
    kp.pubkey = BigInt("0x" + hex.slice(0, 64));
    kp.encKeypair = { publicKey: fromHex(hex.slice(64)), secretKey: null };
    return kp;
  }

  /** A view-only keypair: decrypts notes and sees which are spent, but cannot spend. */
  static fromViewKey(pubkey, viewSecretHex, nk) {
    const kp = Object.create(Keypair.prototype);
    kp.privkey = null;
    kp.nk = nk === undefined || nk === null ? null : BigInt(nk);
    kp.pubkey = BigInt(pubkey);
    kp.encKeypair = nacl.box.keyPair.fromSecretKey(fromHex(viewSecretHex));
    return kp;
  }

  /** One string an auditor can paste into the app: "vview:" + pubkey(32) + view secret(32) + nk(32). */
  exportViewKey() {
    if (this.nk === null) throw new Error("no nullifier key");
    return "vview:" + strip0x(toBeHex(this.pubkey, 32)) + this.viewKey() + strip0x(toBeHex(this.nk, 32));
  }

  static fromExportedViewKey(s) {
    const m = /^vview:([0-9a-fA-F]{64})([0-9a-fA-F]{64})([0-9a-fA-F]{64})$/.exec(String(s).trim());
    if (!m) throw new Error("bad view key");
    return Keypair.fromViewKey(BigInt("0x" + m[1]), m[2], BigInt("0x" + m[3]));
  }

  address() {
    return toBeHex(this.pubkey, 32) + strip0x(hexlify(this.encKeypair.publicKey));
  }

  viewKey() {
    if (!this.encKeypair.secretKey) throw new Error("no view key");
    return strip0x(hexlify(this.encKeypair.secretKey));
  }

  /** Nullifier for a note at `merklePath`. Needs the nullifier key, not the spend key. */
  nullifier(commitment, merklePath) {
    if (this.nk === null) throw new Error("this keypair has no nullifier key");
    return poseidonHash([commitment, merklePath, this.nk]);
  }

  get canSpend() {
    return this.privkey !== null;
  }

  /** Encrypt to this keypair's owner. Output: ephemeralPub(32) | nonce(24) | box. */
  encrypt(bytes) {
    const eph = nacl.box.keyPair();
    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    const box = nacl.box(getBytes(bytes), nonce, this.encKeypair.publicKey, eph.secretKey);
    return getBytes(concat([eph.publicKey, nonce, box]));
  }

  /** Returns plaintext bytes, or null if this note isn't for us. */
  decrypt(data) {
    if (!this.encKeypair.secretKey) return null;
    const buf = getBytes(data);
    if (buf.length < 56 + nacl.box.overheadLength) return null;
    const out = nacl.box.open(buf.subarray(56), buf.subarray(32, 56), buf.subarray(0, 32), this.encKeypair.secretKey);
    return out || null;
  }
}

module.exports = { Keypair, SIGN_IN_MESSAGE, NK_DOMAIN };
