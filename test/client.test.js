const { expect } = require("chai");
const { ethers } = require("hardhat");
const { initPoseidon, Keypair, Utxo, SIGN_IN_MESSAGE, selectNotes } = require("../src");

describe("Client helpers", function () {
  before(initPoseidon);
  const asset = "0x00000000000000000000000000000000000000aa";

  it("the same wallet signature always unlocks the same Vesper account", async function () {
    const wallet = ethers.Wallet.createRandom();
    const a = Keypair.fromSignature(await wallet.signMessage(SIGN_IN_MESSAGE));
    const b = Keypair.fromSignature(await wallet.signMessage(SIGN_IN_MESSAGE));
    const other = Keypair.fromSignature(await ethers.Wallet.createRandom().signMessage(SIGN_IN_MESSAGE));
    expect(a.address()).to.equal(b.address());
    expect(a.address()).to.not.equal(other.address());
  });

  it("an exported view key decrypts notes but can't spend", function () {
    const kp = new Keypair();
    const note = new Utxo({ amount: 42n, keypair: kp, asset });
    const viewer = Keypair.fromExportedViewKey(kp.exportViewKey());
    const seen = Utxo.decrypt(viewer, note.encrypt(), 0, note.getCommitment());
    expect(seen.amount).to.equal(42n);
    expect(() => seen.getNullifier()).to.throw("can't spend");
    expect(() => Keypair.fromExportedViewKey("vview:xyz")).to.throw("bad view key");
  });

  it("a note for someone else doesn't decrypt", function () {
    const note = new Utxo({ amount: 1n, keypair: new Keypair(), asset });
    expect(Utxo.decrypt(new Keypair(), note.encrypt(), 0)).to.equal(null);
    expect(() => Keypair.fromAddress("0x1234")).to.throw("bad Vesper address");
  });

  it("picks at most two notes that cover the amount", function () {
    const n = (a) => ({ amount: BigInt(a) });
    const notes = [n(5), n(20), n(8)];
    expect(selectNotes(notes, 7).map((x) => x.amount)).to.deep.equal([8n]);
    expect(selectNotes(notes, 26).map((x) => x.amount)).to.deep.equal([8n, 20n]);
    expect(selectNotes(notes, 29)).to.equal(null);
  });
});
