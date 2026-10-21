const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { Keypair, Utxo, prepareTransaction, buildTree, scanNotes, getRelayerInfo, relayTransaction, serializeRelayRequest } = require("../src");
const { Relayer } = require("../relayer/relayer");
const { createServer } = require("../relayer/server");
const { deployVesper } = require("./helpers");

const e = (n) => ethers.parseEther(String(n));
const MIN_FEE = e("0.5");

describe("Relayer", function () {
  let server;
  let url;

  async function setup() {
    const ctx = await deployVesper();
    ctx.tslaAddr = await ctx.tsla.getAddress();
    ctx.aliceKp = new Keypair();
    ctx.bobKp = new Keypair();

    const { args, extData } = await prepareTransaction({
      pool: ctx.pool, asset: ctx.tslaAddr, chainId: ctx.chainId, tree: await buildTree(ctx.pool),
      outputs: [new Utxo({ amount: e(100), keypair: ctx.aliceKp, asset: ctx.tslaAddr })],
    });
    await ctx.pool.connect(ctx.alice).transact(args, extData, ctx.tslaAddr);
    return ctx;
  }

  // Fresh relayer + HTTP server per test, bound to the fixture's chain state.
  async function withRelayer() {
    const ctx = await loadFixture(setup);
    ctx.relayerService = new Relayer({
      signer: ctx.relayer,
      pool: await ctx.pool.getAddress(),
      minFees: { [ctx.tslaAddr]: MIN_FEE },
    });
    server = createServer(ctx.relayerService);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    url = `http://127.0.0.1:${server.address().port}`;
    return ctx;
  }

  afterEach(async function () {
    if (server) await new Promise((r) => server.close(r));
    server = null;
  });

  async function prepare(ctx, opts) {
    return prepareTransaction({
      pool: ctx.pool, asset: ctx.tslaAddr, chainId: ctx.chainId, tree: await buildTree(ctx.pool),
      relayer: ctx.relayer.address, fee: MIN_FEE, ...opts,
    });
  }

  async function post(body) {
    const res = await fetch(`${url}/relay`, { method: "POST", headers: { "content-type": "application/json" }, body });
    return { status: res.status, body: await res.json() };
  }

  async function expectRejected(ctx, prepared, asset, status, message) {
    const nonce = await ethers.provider.getTransactionCount(ctx.relayer.address);
    const r = await post(JSON.stringify(serializeRelayRequest(prepared, asset)));
    expect(r.status).to.equal(status);
    expect(r.body.error).to.include(message);
    // A rejected request must never cost the relayer gas.
    expect(await ethers.provider.getTransactionCount(ctx.relayer.address)).to.equal(nonce);
  }

  it("publishes its address, chain and minimum fees", async function () {
    const ctx = await withRelayer();
    const info = await getRelayerInfo(url);
    expect(info.relayer).to.equal(ctx.relayer.address);
    expect(info.pool).to.equal(await ctx.pool.getAddress());
    expect(info.chainId).to.equal(Number(ctx.chainId));
    expect(info.minFees[ctx.tslaAddr]).to.equal(MIN_FEE.toString());
  });

  it("relays a withdrawal: the user's wallet never sends a transaction", async function () {
    const ctx = await withRelayer();
    const [note] = await scanNotes(ctx.pool, ctx.aliceKp);
    const fresh = ethers.Wallet.createRandom().address;
    const aliceNonce = await ethers.provider.getTransactionCount(ctx.alice.address);
    const relayerEth = await ethers.provider.getBalance(ctx.relayer.address);

    const prepared = await prepare(ctx, { inputs: [note], recipient: fresh });
    const job = await relayTransaction(url, prepared, ctx.tslaAddr, { pollMs: 50 });

    expect(job.status).to.equal("confirmed");
    const receipt = await ethers.provider.getTransactionReceipt(job.txHash);
    expect(receipt.from).to.equal(ctx.relayer.address);
    expect(await ctx.tsla.balanceOf(fresh)).to.equal(e(100) - MIN_FEE);
    expect(await ctx.tsla.balanceOf(ctx.relayer.address)).to.equal(MIN_FEE);
    expect(await ethers.provider.getBalance(ctx.relayer.address)).to.be.lessThan(relayerEth); // relayer paid gas
    expect(await ethers.provider.getTransactionCount(ctx.alice.address)).to.equal(aliceNonce);
  });

  it("relays a private transfer, paying the fee out of the pool", async function () {
    const ctx = await withRelayer();
    const [note] = await scanNotes(ctx.pool, ctx.aliceKp);
    const prepared = await prepare(ctx, {
      inputs: [note],
      outputs: [
        new Utxo({ amount: e(30), keypair: Keypair.fromAddress(ctx.bobKp.address()), asset: ctx.tslaAddr }),
        new Utxo({ amount: e(100) - e(30) - MIN_FEE, keypair: ctx.aliceKp, asset: ctx.tslaAddr }),
      ],
    });
    await relayTransaction(url, prepared, ctx.tslaAddr, { pollMs: 50 });

    expect((await scanNotes(ctx.pool, ctx.bobKp)).map((n) => n.amount)).to.deep.equal([e(30)]);
    expect((await scanNotes(ctx.pool, ctx.aliceKp)).map((n) => n.amount)).to.deep.equal([e(100) - e(30) - MIN_FEE]);
    expect(await ctx.tsla.balanceOf(ctx.relayer.address)).to.equal(MIN_FEE);
  });

  describe("turns away bad requests without spending gas", function () {
    it("fee below the minimum", async function () {
      const ctx = await withRelayer();
      const [note] = await scanNotes(ctx.pool, ctx.aliceKp);
      const p = await prepare(ctx, { inputs: [note], recipient: ctx.carol.address, fee: MIN_FEE - 1n });
      await expectRejected(ctx, p, ctx.tslaAddr, 400, "fee too low");
    });

    it("fee addressed to a different relayer", async function () {
      const ctx = await withRelayer();
      const [note] = await scanNotes(ctx.pool, ctx.aliceKp);
      const p = await prepare(ctx, { inputs: [note], recipient: ctx.carol.address, relayer: ctx.carol.address });
      await expectRejected(ctx, p, ctx.tslaAddr, 400, "extData.relayer must be");
    });

    it("deposits", async function () {
      const ctx = await withRelayer();
      const p = await prepare(ctx, { outputs: [new Utxo({ amount: e(1), keypair: ctx.aliceKp, asset: ctx.tslaAddr })] });
      await expectRejected(ctx, p, ctx.tslaAddr, 400, "deposits can't be relayed");
    });

    it("an asset the relayer doesn't serve", async function () {
      const ctx = await withRelayer();
      const [note] = await scanNotes(ctx.pool, ctx.aliceKp);
      const p = await prepare(ctx, { inputs: [note], recipient: ctx.carol.address });
      await expectRejected(ctx, p, await ctx.aapl.getAddress(), 400, "doesn't handle that asset");
    });

    it("a swapped recipient", async function () {
      const ctx = await withRelayer();
      const [note] = await scanNotes(ctx.pool, ctx.aliceKp);
      const p = await prepare(ctx, { inputs: [note], recipient: ctx.alice.address });
      p.extData = { ...p.extData, recipient: ctx.carol.address };
      await expectRejected(ctx, p, ctx.tslaAddr, 400, "extDataHash doesn't match");
    });

    it("a broken proof (caught by simulation)", async function () {
      const ctx = await withRelayer();
      const [note] = await scanNotes(ctx.pool, ctx.aliceKp);
      const p = await prepare(ctx, { inputs: [note], recipient: ctx.carol.address });
      const bad = p.args.proof.slice(0, -4) + (p.args.proof.endsWith("00") ? "0101" : "0000");
      p.args = { ...p.args, proof: bad };
      await expectRejected(ctx, p, ctx.tslaAddr, 400, "would fail: InvalidProof");
    });

    it("a note that's already spent", async function () {
      const ctx = await withRelayer();
      const [note] = await scanNotes(ctx.pool, ctx.aliceKp);
      const p = await prepare(ctx, { inputs: [note], recipient: ctx.carol.address });
      await relayTransaction(url, p, ctx.tslaAddr, { pollMs: 50 });
      const again = await prepare(ctx, { inputs: [note], recipient: ctx.carol.address });
      await expectRejected(ctx, again, ctx.tslaAddr, 409, "already spent");
    });

    it("the same note sent twice at once", async function () {
      const ctx = await withRelayer();
      const [note] = await scanNotes(ctx.pool, ctx.aliceKp);
      const a = await prepare(ctx, { inputs: [note], recipient: ctx.carol.address });
      const b = await prepare(ctx, { inputs: [note], recipient: ctx.bob.address });
      const results = await Promise.all([a, b].map((p) => post(JSON.stringify(serializeRelayRequest(p, ctx.tslaAddr)))));
      expect(results.map((r) => r.status).sort()).to.deep.equal([202, 409]);
    });

    it("garbage and oversized bodies", async function () {
      await withRelayer();
      expect((await post("not json")).status).to.equal(400);
      expect((await post(JSON.stringify({ args: {}, extData: {}, asset: "0x1" }))).status).to.equal(400);
      const big = await post(JSON.stringify({ pad: "x".repeat(20000) })).catch(() => ({ status: 413 }));
      expect(big.status).to.equal(413);
    });
  });
});
