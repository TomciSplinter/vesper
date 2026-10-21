// Regression tests for the self-audit findings (see audit/findings.md).
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const src = require("../src");
const { Keypair, Utxo, buildTree, scanNotes, fetchAssociationSet } = src;
const { deployVesper, approveAll } = require("./helpers");

const e = (n) => ethers.parseEther(String(n));

describe("Self-audit regressions", function () {
  async function setup() {
    const ctx = await deployVesper();
    ctx.tslaAddr = await ctx.tsla.getAddress();
    ctx.aliceKp = new Keypair();
    ctx.prep = async (opts) =>
      src.prepareTransaction({ pool: ctx.pool, asset: ctx.tslaAddr, chainId: ctx.chainId, tree: await buildTree(ctx.pool), ...opts });
    const d = await ctx.prep({ depositor: ctx.alice.address, outputs: [new Utxo({ amount: e(100), keypair: ctx.aliceKp, asset: ctx.tslaAddr })] });
    await ctx.pool.connect(ctx.alice).transact(d.args, d.extData, ctx.tslaAddr);
    await approveAll(ctx);
    ctx.asp = await fetchAssociationSet(ctx.pool);
    return ctx;
  }

  // Marks the tree as full by rewriting the packed (currentRootIndex | nextIndex << 32) slot.
  async function fillTree(pool) {
    const addr = await pool.getAddress();
    const next = await pool.nextIndex();
    const cur = await pool.currentRootIndex();
    for (let slot = 0; slot < 16; slot++) {
      const v = BigInt(await ethers.provider.getStorage(addr, slot));
      if ((v & 0xffffffffn) === cur && ((v >> 32n) & 0xffffffffn) === next) {
        const full = (v & 0xffffffffn) | ((2n ** 20n) << 32n);
        await ethers.provider.send("hardhat_setStorageAt", [addr, ethers.toBeHex(slot), ethers.toBeHex(full, 32)]);
        expect(await pool.isFull()).to.equal(true);
        return;
      }
    }
    throw new Error("tree slot not found");
  }

  it("F1: a full tree can't freeze funds: whole-note withdrawals still pay out", async function () {
    const ctx = await loadFixture(setup);
    const [note] = await scanNotes(ctx.pool, ctx.aliceKp);
    await fillTree(ctx.pool);
    // The wallet refuses change (it would be lost) and anything that isn't a payout.
    await expect(ctx.prep({ inputs: [note], outputs: [new Utxo({ amount: e(1), keypair: ctx.aliceKp, asset: ctx.tslaAddr })], recipient: ctx.bob.address, asp: ctx.asp })).to.be.rejectedWith("withdraw whole notes");
    // A deposit is refused by the contract.
    const fresh = ethers.Wallet.createRandom().address;
    const w = await ctx.prep({ inputs: [note], recipient: fresh, asp: ctx.asp });
    await ctx.pool.transact(w.args, w.extData, ctx.tslaAddr);
    expect(await ctx.tsla.balanceOf(fresh)).to.equal(e(100));
  });

  it("F1: a full tree refuses new notes (deposits, transfers) with TreeFull", async function () {
    const ctx = await loadFixture(setup);
    const d = await ctx.prep({ depositor: ctx.alice.address, outputs: [new Utxo({ amount: e(1), keypair: ctx.aliceKp, asset: ctx.tslaAddr })] });
    await fillTree(ctx.pool);
    await expect(ctx.pool.connect(ctx.alice).transact(d.args, d.extData, ctx.tslaAddr)).to.be.revertedWithCustomError(ctx.pool, "TreeFull");
  });

  it("F2: a proof built against an old root still works after the root changes", async function () {
    const ctx = await loadFixture(setup);
    const [note] = await scanNotes(ctx.pool, ctx.aliceKp);
    const fresh = ethers.Wallet.createRandom().address;
    const w = await ctx.prep({ inputs: [note], recipient: fresh, asp: ctx.asp });
    // Other users' transactions change the root (the reviewer's attack used 100 of
    // them to push it out of a 100-entry history; every root now stays valid).
    expect(await ctx.pool.isKnownRoot(w.args.root)).to.equal(true);
    const oldRoot = w.args.root;
    const bobKp = new Keypair();
    for (let i = 0; i < 3; i++) {
      const d = await ctx.prep({ depositor: ctx.bob.address, outputs: [new Utxo({ amount: 1n, keypair: bobKp, asset: ctx.tslaAddr })] });
      await ctx.pool.connect(ctx.bob).transact(d.args, d.extData, ctx.tslaAddr);
    }
    expect(await ctx.pool.getLastRoot()).to.not.equal(oldRoot);
    expect(await ctx.pool.isKnownRoot(oldRoot)).to.equal(true);
    expect(await ctx.pool.ROOT_HISTORY_SIZE()).to.equal(100); // ring only feeds getLastRoot now
    await ctx.pool.transact(w.args, w.extData, ctx.tslaAddr);
    expect(await ctx.tsla.balanceOf(fresh)).to.equal(e(100));
  });

  it("F4: an association-set update costs the same whether 1 or 400 labels are already approved", async function () {
    const ctx = await loadFixture(setup);
    const gasFor = async (added) => {
      const tx = await ctx.pool.updateAssociationSet(12345n + BigInt(added.length), added, [], "");
      return (await tx.wait()).gasUsed;
    };
    const big = Array.from({ length: 400 }, (_, i) => BigInt(i + 1000));
    await gasFor(big); // 400 labels now in the published list
    const after = await gasFor([5n]); // adding one more only sends one
    expect(after).to.be.lessThan(80_000n);
  });

  it("F5: a deposit can't pay a fee to anyone", async function () {
    const ctx = await loadFixture(setup);
    const d = await ctx.prep({
      depositor: ctx.alice.address,
      outputs: [new Utxo({ amount: e(10), keypair: ctx.aliceKp, asset: ctx.tslaAddr })],
      fee: e(1),
      relayer: ctx.carol.address,
    });
    await expect(ctx.pool.connect(ctx.alice).transact(d.args, d.extData, ctx.tslaAddr)).to.be.revertedWithCustomError(ctx.pool, "FeeOnDeposit");
  });

  it("F7: note scanning never asks the RPC about specific nullifiers", async function () {
    const ctx = await loadFixture(setup);
    const calls = [];
    const spy = new Proxy(ctx.pool, {
      get(target, prop) {
        if (prop === "isSpent") return (...a) => (calls.push(a), target.isSpent(...a));
        const v = target[prop];
        return typeof v === "function" ? v.bind(target) : v;
      },
    });
    const notes = await scanNotes(spy, ctx.aliceKp);
    expect(notes.length).to.equal(1);
    expect(calls.length).to.equal(0);
  });
});
