const { expect } = require("chai");
const { ethers } = require("hardhat");
const snarkjs = require("snarkjs");
const path = require("path");
const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const src = require("../src");
const { Keypair, Utxo, buildTree, scanNotes, fetchAssociationSet, associationTree, NotApprovedError } = src;
const { deployVesper, approveAll, adminChange } = require("./helpers");

const e = (n) => ethers.parseEther(String(n));
const WASM = path.join(__dirname, "..", "build", "transaction2_js", "transaction2.wasm");

describe("Compliance (association sets)", function () {
  // Alice and Carol each deposit 100 TSLA. Only Alice's deposit is approved.
  async function setup() {
    const ctx = await deployVesper();
    ctx.tslaAddr = await ctx.tsla.getAddress();
    ctx.aliceKp = new Keypair();
    ctx.carolKp = new Keypair();
    ctx.bobKp = new Keypair();
    ctx.prep = async (opts) =>
      src.prepareTransaction({ pool: ctx.pool, asset: ctx.tslaAddr, chainId: ctx.chainId, tree: await buildTree(ctx.pool), ...opts });
    ctx.send = async (signer, opts) => {
      const p = await ctx.prep({ depositor: signer.address, ...opts });
      return ctx.pool.connect(signer).transact(p.args, p.extData, ctx.tslaAddr);
    };
    await ctx.send(ctx.alice, { outputs: [new Utxo({ amount: e(100), keypair: ctx.aliceKp, asset: ctx.tslaAddr })] });
    await ctx.send(ctx.carol, { outputs: [new Utxo({ amount: e(100), keypair: ctx.carolKp, asset: ctx.tslaAddr })] });
    const deposits = await src.fetchDeposits(ctx.pool);
    ctx.aliceLabel = deposits[0].label;
    ctx.carolLabel = deposits[1].label;
    await approveAll(ctx, { except: [ctx.carolLabel] });
    ctx.asp = await fetchAssociationSet(ctx.pool);
    return ctx;
  }

  it("records each deposit's label and depositor; labels follow the money", async function () {
    const ctx = await loadFixture(setup);
    expect(await ctx.pool.depositorOf(ctx.aliceLabel)).to.equal(ctx.alice.address);
    expect(await ctx.pool.depositorOf(ctx.carolLabel)).to.equal(ctx.carol.address);
    const [note] = await scanNotes(ctx.pool, ctx.aliceKp);
    expect(note.label).to.equal(ctx.aliceLabel);
    expect(ctx.asp.has(ctx.aliceLabel)).to.equal(true);
    expect(ctx.asp.has(ctx.carolLabel)).to.equal(false);
  });

  it("approved money withdraws privately", async function () {
    const ctx = await loadFixture(setup);
    const [note] = await scanNotes(ctx.pool, ctx.aliceKp);
    const fresh = ethers.Wallet.createRandom().address;
    await ctx.send(ctx.bob, { inputs: [note], recipient: fresh, asp: ctx.asp });
    expect(await ctx.tsla.balanceOf(fresh)).to.equal(e(100));
  });

  it("unapproved money can't withdraw privately: the wallet refuses, and so does the contract", async function () {
    const ctx = await loadFixture(setup);
    const [note] = await scanNotes(ctx.pool, ctx.carolKp);
    const fresh = ethers.Wallet.createRandom().address;
    await expect(ctx.prep({ inputs: [note], recipient: fresh, asp: ctx.asp })).to.be.rejectedWith(NotApprovedError);
    // Skipping the association proof altogether: the contract rejects it.
    const p = await ctx.prep({ inputs: [note], recipient: fresh, asp: null });
    await expect(ctx.pool.transact(p.args, p.extData, ctx.tslaAddr)).to.be.revertedWithCustomError(ctx.pool, "NotApproved");
  });

  it("a made-up association set doesn't work", async function () {
    const ctx = await loadFixture(setup);
    const [note] = await scanNotes(ctx.pool, ctx.carolKp);
    const tree = associationTree([ctx.carolLabel]);
    const fake = { root: tree.root(), tree, has: () => true };
    const p = await ctx.prep({ inputs: [note], recipient: ctx.bob.address, asp: fake });
    await expect(ctx.pool.transact(p.args, p.extData, ctx.tslaAddr)).to.be.revertedWithCustomError(ctx.pool, "NotApproved");
  });

  it("unapproved money can always exit to the wallet that deposited it (publicly, no fee)", async function () {
    const ctx = await loadFixture(setup);
    const [note] = await scanNotes(ctx.pool, ctx.carolKp);
    const before = await ctx.tsla.balanceOf(ctx.carol.address);
    await ctx.send(ctx.carol, { inputs: [note], recipient: ctx.carol.address, exit: true });
    expect(await ctx.tsla.balanceOf(ctx.carol.address)).to.equal(before + e(100));
  });

  it("an exit can't go anywhere else, or pay a fee", async function () {
    const ctx = await loadFixture(setup);
    const [note] = await scanNotes(ctx.pool, ctx.carolKp);
    const p = await ctx.prep({ inputs: [note], recipient: ctx.bob.address, exit: true });
    await expect(ctx.pool.transact(p.args, p.extData, ctx.tslaAddr)).to.be.revertedWithCustomError(ctx.pool, "BadExit");
    await expect(ctx.prep({ inputs: [note], recipient: ctx.carol.address, exit: true, fee: 1n, relayer: ctx.bob.address })).to.be.rejectedWith("can't pay a fee");
  });

  it("unapproved money stays unapproved after a private send: the recipient can only exit it to the original depositor", async function () {
    const ctx = await loadFixture(setup);
    const [note] = await scanNotes(ctx.pool, ctx.carolKp);
    await ctx.send(ctx.carol, {
      inputs: [note],
      outputs: [new Utxo({ amount: e(100), keypair: Keypair.fromAddress(ctx.bobKp.address()), asset: ctx.tslaAddr })],
    });
    const [bobNote] = await scanNotes(ctx.pool, ctx.bobKp);
    expect(bobNote.label).to.equal(ctx.carolLabel);
    await expect(ctx.prep({ inputs: [bobNote], recipient: ctx.bob.address, asp: ctx.asp })).to.be.rejectedWith(NotApprovedError);
    const toBob = await ctx.prep({ inputs: [bobNote], recipient: ctx.bob.address, exit: true });
    await expect(ctx.pool.transact(toBob.args, toBob.extData, ctx.tslaAddr)).to.be.revertedWithCustomError(ctx.pool, "BadExit");
    const toCarol = await ctx.prep({ inputs: [bobNote], recipient: ctx.carol.address, exit: true });
    await ctx.pool.transact(toCarol.args, toCarol.extData, ctx.tslaAddr);
  });

  it("unapproved money can't leave through a relayer fee on a private send", async function () {
    const ctx = await loadFixture(setup);
    const [note] = await scanNotes(ctx.pool, ctx.carolKp);
    const p = await ctx.prep({
      inputs: [note],
      outputs: [new Utxo({ amount: e(1), keypair: ctx.carolKp, asset: ctx.tslaAddr })],
      fee: e(99),
      relayer: ctx.carol.address,
      asp: null,
    });
    await expect(ctx.pool.transact(p.args, p.extData, ctx.tslaAddr)).to.be.revertedWithCustomError(ctx.pool, "NotApproved");
  });

  it("notes from different deposits can't be combined", async function () {
    const ctx = await loadFixture(setup);
    const [a] = await scanNotes(ctx.pool, ctx.aliceKp);
    const [c] = await scanNotes(ctx.pool, ctx.carolKp);
    c.keypair = ctx.aliceKp; // even if one wallet held both
    await expect(ctx.prep({ inputs: [a, c], recipient: ctx.bob.address, asp: ctx.asp })).to.be.rejectedWith("different deposits");
  });

  it("the circuit itself forbids a deposit that also spends a note (new money can't borrow an approved label)", async function () {
    const ctx = await loadFixture(setup);
    const [note] = await scanNotes(ctx.pool, ctx.aliceKp);
    // A valid private send, then tampered into "deposit + spend".
    const { input } = await ctx.prep({
      inputs: [note],
      outputs: [new Utxo({ amount: e(100), keypair: ctx.aliceKp, asset: ctx.tslaAddr })],
      dryRun: true,
    });
    await snarkjs.wtns.calculate(input, WASM, { type: "mem" }); // untampered: fine
    const tampered = { ...input, newLabel: input.inLabel };
    await expect(snarkjs.wtns.calculate(tampered, WASM, { type: "mem" })).to.be.rejected;
  });

  it("a deposit must use the label the pool assigns", async function () {
    const ctx = await loadFixture(setup);
    // Prepared as Alice (her next label) but sent by Bob.
    const p = await ctx.prep({ depositor: ctx.alice.address, outputs: [new Utxo({ amount: e(1), keypair: ctx.bobKp, asset: ctx.tslaAddr })] });
    await expect(ctx.pool.connect(ctx.bob).transact(p.args, p.extData, ctx.tslaAddr)).to.be.revertedWithCustomError(ctx.pool, "BadLabel");
  });

  it("a proof made just before the list updates still works (replaced roots stay valid for the grace period)", async function () {
    const ctx = await loadFixture(setup);
    const [note] = await scanNotes(ctx.pool, ctx.aliceKp);
    const p = await ctx.prep({ inputs: [note], recipient: ctx.bob.address, asp: ctx.asp });
    await approveAll(ctx); // now Carol is approved too: new root
    await approveAll(ctx, { except: [ctx.carolLabel] }); // and removed again: another new root
    await ctx.pool.transact(p.args, p.extData, ctx.tslaAddr);
  });

  it("a removal from the list only bites after 7 days, so the holder can still withdraw privately", async function () {
    const ctx = await loadFixture(setup);
    await approveAll(ctx, { except: [ctx.aliceLabel, ctx.carolLabel] }); // Alice's deposit dropped
    const asp = await fetchAssociationSet(ctx.pool);
    expect(asp.has(ctx.aliceLabel)).to.equal(false);
    const [note] = await scanNotes(ctx.pool, ctx.aliceKp);
    // Day 6: the wallet finds Alice in the still-valid older set and withdraws privately.
    await time.increase(6 * 24 * 3600);
    const fresh = ethers.Wallet.createRandom().address;
    const p = await ctx.prep({ inputs: [note], recipient: fresh, asp });
    await ctx.pool.transact(p.args, p.extData, ctx.tslaAddr);
    expect(await ctx.tsla.balanceOf(fresh)).to.equal(e(100));
  });

  it("after the grace period, a removed deposit can no longer withdraw privately", async function () {
    const ctx = await loadFixture(setup);
    const [note] = await scanNotes(ctx.pool, ctx.aliceKp);
    const early = await ctx.prep({ inputs: [note], recipient: ctx.bob.address, asp: ctx.asp }); // proof against the old root
    await approveAll(ctx, { except: [ctx.aliceLabel, ctx.carolLabel] });
    await time.increase(7 * 24 * 3600 + 1);
    await expect(ctx.pool.transact(early.args, early.extData, ctx.tslaAddr)).to.be.revertedWithCustomError(ctx.pool, "NotApproved");
    await expect(ctx.prep({ inputs: [note], recipient: ctx.bob.address, asp: await fetchAssociationSet(ctx.pool) })).to.be.rejectedWith(NotApprovedError);
  });

  it("only the postman publishes the list; only the owner changes the rules", async function () {
    const ctx = await loadFixture(setup);
    await expect(ctx.pool.connect(ctx.bob).updateAssociationSet(1, [], [], "")).to.be.revertedWithCustomError(ctx.pool, "NotPostman");
    const off = ctx.pool.interface.encodeFunctionData("applyComplianceRequired", [false]);
    await expect(ctx.pool.connect(ctx.bob).scheduleChange(off)).to.be.revertedWithCustomError(ctx.pool, "OwnableUnauthorizedAccount");
    // With compliance switched off, a withdrawal without a proof of approval is allowed.
    await adminChange(ctx.pool, ctx.owner, "applyComplianceRequired", [false]);
    const [note] = await scanNotes(ctx.pool, ctx.carolKp);
    const p = await ctx.prep({ inputs: [note], recipient: ctx.bob.address, asp: null });
    await ctx.pool.transact(p.args, p.extData, ctx.tslaAddr);
  });

  it("wallets reject a published list that doesn't match its root", async function () {
    const ctx = await loadFixture(setup);
    await ctx.pool.updateAssociationSet(12345n, [ctx.carolLabel], [], "lying list");
    await expect(fetchAssociationSet(ctx.pool)).to.be.rejectedWith("doesn't match its root");
  });
});
