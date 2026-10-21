const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { Keypair, Utxo, prepareTransaction, buildTree, scanNotes, serializeRelayRequest } = require("../src");
const { Relayer } = require("../relayer/relayer");
const { createHandlers, relayerFromEnv } = require("../relayer/serverless");
const { deployVesper } = require("./helpers");

const e = (n) => ethers.parseEther(String(n));
const FEE = e("0.1");

// Minimal stand-ins for Vercel's req/res.
function call(handler, { method = "GET", body, url = "/", query } = {}) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(k, v) {
        this.headers[k] = v;
      },
      end(s) {
        resolve({ status: this.statusCode, headers: this.headers, body: s ? JSON.parse(s) : null });
      },
    };
    handler({ method, body, url, query }, res);
  });
}

describe("Serverless relayer (Vercel functions)", function () {
  async function setup() {
    const ctx = await deployVesper();
    ctx.tslaAddr = await ctx.tsla.getAddress();
    ctx.aliceKp = new Keypair();
    const { args, extData } = await prepareTransaction({
      pool: ctx.pool, asset: ctx.tslaAddr, chainId: ctx.chainId, tree: await buildTree(ctx.pool),
      outputs: [new Utxo({ amount: e(10), keypair: ctx.aliceKp, asset: ctx.tslaAddr })],
    });
    await ctx.pool.connect(ctx.alice).transact(args, extData, ctx.tslaAddr);
    const relayer = new Relayer({ signer: ctx.relayer, pool: await ctx.pool.getAddress(), minFees: { [ctx.tslaAddr]: FEE } });
    ctx.h = createHandlers(() => relayer);
    return ctx;
  }

  it("GET /api/info publishes the relayer's terms, with CORS", async function () {
    const ctx = await loadFixture(setup);
    const r = await call(ctx.h.info);
    expect(r.status).to.equal(200);
    expect(r.body.relayer).to.equal(ctx.relayer.address);
    expect(r.body.minFees[ctx.tslaAddr]).to.equal(FEE.toString());
    expect(r.headers["access-control-allow-origin"]).to.equal("*");
  });

  it("POST /api/relay sends a withdrawal and /api/jobs/:hash reports it confirmed", async function () {
    const ctx = await loadFixture(setup);
    const [note] = await scanNotes(ctx.pool, ctx.aliceKp);
    const fresh = ethers.Wallet.createRandom().address;
    const prepared = await prepareTransaction({
      pool: ctx.pool, asset: ctx.tslaAddr, chainId: ctx.chainId, tree: await buildTree(ctx.pool),
      inputs: [note], recipient: fresh, relayer: ctx.relayer.address, fee: FEE,
    });
    // Vercel hands the function an already-parsed body.
    const r = await call(ctx.h.relay, { method: "POST", body: serializeRelayRequest(prepared, ctx.tslaAddr) });
    expect(r.status).to.equal(202);
    expect(r.body.id).to.match(/^0x[0-9a-f]{64}$/);

    const job = await call(ctx.h.job, { query: { id: r.body.id } });
    expect(job.body.status).to.equal("confirmed");
    expect((await ethers.provider.getTransactionReceipt(r.body.id)).from).to.equal(ctx.relayer.address);
    expect(await ctx.tsla.balanceOf(fresh)).to.equal(e(10) - FEE);
  });

  it("rejects bad requests before paying gas, and wrong methods", async function () {
    const ctx = await loadFixture(setup);
    const [note] = await scanNotes(ctx.pool, ctx.aliceKp);
    const prepared = await prepareTransaction({
      pool: ctx.pool, asset: ctx.tslaAddr, chainId: ctx.chainId, tree: await buildTree(ctx.pool),
      inputs: [note], recipient: ctx.carol.address, relayer: ctx.relayer.address, fee: FEE - 1n,
    });
    const nonce = await ethers.provider.getTransactionCount(ctx.relayer.address);
    const r = await call(ctx.h.relay, { method: "POST", body: JSON.stringify(serializeRelayRequest(prepared, ctx.tslaAddr)) });
    expect(r.status).to.equal(400);
    expect(r.body.error).to.include("fee too low");
    expect(await ethers.provider.getTransactionCount(ctx.relayer.address)).to.equal(nonce);

    expect((await call(ctx.h.relay, { method: "GET" })).status).to.equal(405);
    expect((await call(ctx.h.relay, { method: "POST", body: "{not json" })).status).to.equal(400);
    expect((await call(ctx.h.job, { query: { id: "0x" + "ab".repeat(32) } })).status).to.equal(404);
  });

  it("says clearly when the relayer isn't configured, naming the bad setting", function () {
    expect(() => relayerFromEnv({})).to.throw("relayer not configured");
    const ok = {
      RELAYER_KEY: "0x" + "11".repeat(32),
      RPC_URL: "https://rpc.example",
      CHAIN_ID: "46630",
      POOL: "0x163BDa760077E965beB13570222C2267aD2A3957",
      RELAYER_FEES: "0xF9A6426Bd3A2B116f73F151b38a5cF2Fb09bF112:0.1",
    };
    expect(() => relayerFromEnv({ ...ok, RELAYER_KEY: "0x1234" })).to.throw("RELAYER_KEY must be");
    expect(() => relayerFromEnv({ ...ok, CHAIN_ID: "abc" })).to.throw("CHAIN_ID must be");
    expect(() => relayerFromEnv({ ...ok, RELAYER_FEES: "0xF9A6426Bd3A2B116f73F151b38a5cF2Fb09bF112" })).to.throw("RELAYER_FEES");
    // Stray quotes and spaces around a pasted value are fine.
    const r = relayerFromEnv({ ...ok, RELAYER_KEY: ` "${ok.RELAYER_KEY}" `, POOL: `'${ok.POOL}'` });
    expect(r).to.be.ok;
  });
});
