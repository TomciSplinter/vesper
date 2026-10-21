// Witness-level negative checks of circuit constraints (wasm asserts === constraints).
const { expect } = require("chai");
const { ethers } = require("hardhat");
const snarkjs = require("snarkjs");
const path = require("path");
const src = require("../src");
const { Keypair, Utxo, buildTree, scanNotes, fetchAssociationSet } = src;
const { deployVesper, approveAll } = require("./helpers");
const WASM = path.join(__dirname, "..", "build", "transaction2_js", "transaction2.wasm");
const P = src.FIELD_SIZE ?? 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const e = (n) => ethers.parseEther(String(n));
const ok = (i) => snarkjs.wtns.calculate(i, WASM, { type: "mem" });

describe("AUDIT circuit negatives", function () {
  it("rejects bad aspRoot / exitLabel / overflowing outputs / wrong root / deposit+spend", async function () {
    const ctx = await deployVesper();
    const asset = await ctx.tsla.getAddress();
    const kp = new Keypair();
    const prep = async (o) => src.prepareTransaction({ pool: ctx.pool, asset, chainId: ctx.chainId, tree: await buildTree(ctx.pool), ...o });
    const d = await prep({ depositor: ctx.alice.address, outputs: [new Utxo({ amount: e(10), keypair: kp, asset })] });
    await ctx.pool.connect(ctx.alice).transact(d.args, d.extData, asset);
    await approveAll(ctx);
    const [note] = await scanNotes(ctx.pool, kp);
    const { input } = await prep({ inputs: [note], recipient: ctx.bob.address, asp: await fetchAssociationSet(ctx.pool), dryRun: true });
    await ok(input);
    await expect(ok({ ...input, aspRoot: input.aspRoot + 1n })).to.be.rejected;
    await expect(ok({ ...input, exitLabel: 2n })).to.be.rejected;              // non-boolean enable still forces equality
    await expect(ok({ ...input, exitLabel: input.inLabel })).to.be.fulfilled;  // (equal label passes)
    await expect(ok({ ...input, root: input.root + 1n })).to.be.rejected;
    // try minting: output amount p-1 ("negative") with publicAmount compensating
    const bad = { ...input, outAmount: [P - 1n, input.outAmount[1]], publicAmount: (input.publicAmount + P - 1n - input.outAmount[0]) % P };
    await expect(ok(bad)).to.be.rejected;
    // dummy with nonzero amount (not in tree)
    await expect(ok({ ...input, inAmount: [input.inAmount[0], 1n], publicAmount: (input.publicAmount + P - 1n) % P })).to.be.rejected;
    // pathIndices >= 2^20 alias
    await expect(ok({ ...input, inPathIndices: [input.inPathIndices[0] + 2 ** 20, input.inPathIndices[1]] })).to.be.rejected;
  });
});
