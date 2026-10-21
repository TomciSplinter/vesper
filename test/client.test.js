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

  it("an exported view key decrypts notes and computes the owner's nullifiers, but can't spend", function () {
    const kp = new Keypair();
    const note = new Utxo({ amount: 42n, keypair: kp, asset, index: 7 });
    const viewer = Keypair.fromExportedViewKey(kp.exportViewKey());
    const seen = Utxo.decrypt(viewer, note.encrypt(), 7, note.getCommitment());
    expect(seen.amount).to.equal(42n);
    expect(seen.getNullifier()).to.equal(note.getNullifier());
    expect(viewer.canSpend).to.equal(false);
    expect(viewer.privkey).to.equal(null);
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

describe("Relayer client", function () {
  it("keeps waiting when a just-sent transaction isn't visible yet (404), then confirms", async function () {
    const { relayTransaction } = require("../src");
    const http = require("http");
    let polls = 0;
    const server = http.createServer((req, res) => {
      res.setHeader("content-type", "application/json");
      if (req.url.endsWith("/relay")) return res.end(JSON.stringify({ id: "0x" + "ab".repeat(32) }));
      polls++;
      if (polls < 3) return (res.statusCode = 404), res.end(JSON.stringify({ error: "not found" }));
      res.end(JSON.stringify({ status: "confirmed", txHash: "0x" + "ab".repeat(32) }));
    });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const url = `http://127.0.0.1:${server.address().port}/api`;
    const prepared = { args: { publicAmount: 0n }, extData: { extAmount: 0n, fee: 0n } };
    const job = await relayTransaction(url, prepared, "0x" + "00".repeat(20), { pollMs: 10 });
    server.close();
    expect(job.status).to.equal("confirmed");
    expect(polls).to.equal(3);
  });
});
