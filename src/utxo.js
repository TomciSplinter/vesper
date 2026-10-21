// Runs in Node and in the browser (no Node-only APIs).
const { randomBytes, hexlify, toBeHex, concat, dataSlice } = require("ethers");
const { poseidonHash } = require("./poseidon");
const { Keypair } = require("./keypair");

const assetToField = (asset) => BigInt(asset); // address -> uint160 as field
const randomBlinding = () => BigInt(hexlify(randomBytes(31)));

/** A shielded note. amount is in RAW token units (not uiMultiplier-adjusted). */
class Utxo {
  constructor({ amount = 0n, keypair = new Keypair(), blinding = randomBlinding(), asset, index = null } = {}) {
    if (asset === undefined) throw new Error("asset is required");
    this.amount = BigInt(amount);
    this.keypair = keypair;
    this.blinding = BigInt(blinding);
    this.asset = assetToField(asset);
    this.index = index;
  }

  getCommitment() {
    if (this._commitment === undefined) {
      this._commitment = poseidonHash([this.amount, this.keypair.pubkey, this.blinding, this.asset]);
    }
    return this._commitment;
  }

  getNullifier() {
    if (this.amount > 0n && this.index === null) throw new Error("can't spend a note before it's in the tree");
    const path = this.index === null ? 0n : BigInt(this.index);
    return this.keypair.nullifier(this.getCommitment(), path);
  }

  /** amount(32) | blinding(32) | asset(20), encrypted to the note owner. */
  encrypt() {
    const plain = concat([toBeHex(this.amount, 32), toBeHex(this.blinding, 32), toBeHex(this.asset, 20)]);
    return hexlify(this.keypair.encrypt(plain));
  }

  /** Try to open an on-chain encrypted note with our keypair. Returns Utxo or null. */
  static decrypt(keypair, encryptedOutput, index, expectedCommitment) {
    let plain;
    try {
      plain = keypair.decrypt(encryptedOutput);
    } catch {
      return null;
    }
    if (!plain || plain.length !== 84) return null;
    const hex = hexlify(plain);
    const utxo = new Utxo({
      amount: BigInt(dataSlice(hex, 0, 32)),
      blinding: BigInt(dataSlice(hex, 32, 64)),
      asset: dataSlice(hex, 64, 84),
      keypair,
      index,
    });
    // Reject notes whose encrypted contents don't match the on-chain commitment.
    if (expectedCommitment !== undefined && utxo.getCommitment() !== BigInt(expectedCommitment)) return null;
    return utxo;
  }
}

module.exports = { Utxo };
