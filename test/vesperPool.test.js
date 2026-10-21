const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { Keypair, Utxo, MerkleTree, buildTree, scanNotes, hashExtData, toBytes32, toShares, MERKLE_TREE_HEIGHT } = require("../src");
const { deployVesper, approveAll, prepareTransaction } = require("./helpers");

const e = (n) => ethers.parseEther(String(n));

describe("VesperPool", function () {
  // Runs a transaction end to end with a real Groth16 proof.
  async function transact(ctx, signer, { asset, inputs = [], outputs = [], fee = 0n, recipient, relayer, exit }) {
    const tree = await buildTree(ctx.pool);
    const { args, extData } = await prepareTransaction({
      pool: ctx.pool,
      asset,
      chainId: ctx.chainId,
      tree,
      inputs,
      outputs,
      fee,
      recipient,
      relayer,
      exit,
      depositor: signer.address,
    });
    return ctx.pool.connect(signer).transact(args, extData, asset);
  }

  async function withAliceDeposit() {
    const ctx = await deployVesper();
    ctx.aliceKp = new Keypair();
    ctx.bobKp = new Keypair();
    ctx.tslaAddr = await ctx.tsla.getAddress();
    await transact(ctx, ctx.alice, {
      asset: ctx.tslaAddr,
      outputs: [new Utxo({ amount: e(100), keypair: ctx.aliceKp, asset: ctx.tslaAddr })],
    });
    await approveAll(ctx);
    return ctx;
  }

  describe("Merkle tree", function () {
    it("JS tree and contract agree on the empty root and after inserts", async function () {
      const ctx = await deployVesper();
      expect(await ctx.pool.getLastRoot()).to.equal(toBytes32(new MerkleTree(MERKLE_TREE_HEIGHT).root()));

      const ctx2 = await loadFixture(withAliceDeposit);
      const tree = await buildTree(ctx2.pool);
      expect(tree.leaves.length).to.equal(2);
      expect(await ctx2.pool.getLastRoot()).to.equal(toBytes32(tree.root()));
    });
  });

  describe("Deposit, transfer, withdraw", function () {
    it("deposits into a shielded note the owner can find", async function () {
      const ctx = await loadFixture(withAliceDeposit);
      expect(await ctx.tsla.balanceOf(await ctx.pool.getAddress())).to.equal(e(100));

      const notes = await scanNotes(ctx.pool, ctx.aliceKp);
      expect(notes.length).to.equal(1);
      expect(notes[0].amount).to.equal(e(100));
      expect(await scanNotes(ctx.pool, ctx.bobKp)).to.have.length(0);
    });

    it("transfers privately: no tokens leave the pool", async function () {
      const ctx = await loadFixture(withAliceDeposit);
      const [aliceNote] = await scanNotes(ctx.pool, ctx.aliceKp);
      const bobAddress = Keypair.fromAddress(ctx.bobKp.address());

      await transact(ctx, ctx.carol /* anyone can submit */, {
        asset: ctx.tslaAddr,
        inputs: [aliceNote],
        outputs: [
          new Utxo({ amount: e(30), keypair: bobAddress, asset: ctx.tslaAddr }),
          new Utxo({ amount: e(70), keypair: ctx.aliceKp, asset: ctx.tslaAddr }),
        ],
      });

      expect(await ctx.tsla.balanceOf(await ctx.pool.getAddress())).to.equal(e(100));
      const bobNotes = await scanNotes(ctx.pool, ctx.bobKp);
      const aliceNotes = await scanNotes(ctx.pool, ctx.aliceKp);
      expect(bobNotes.map((n) => n.amount)).to.deep.equal([e(30)]);
      expect(aliceNotes.map((n) => n.amount)).to.deep.equal([e(70)]);
    });

    it("withdraws to a fresh address through a relayer that takes a fee", async function () {
      const ctx = await loadFixture(withAliceDeposit);
      const [aliceNote] = await scanNotes(ctx.pool, ctx.aliceKp);
      const fresh = ethers.Wallet.createRandom().address;

      await transact(ctx, ctx.relayer, {
        asset: ctx.tslaAddr,
        inputs: [aliceNote],
        outputs: [new Utxo({ amount: e(60), keypair: ctx.aliceKp, asset: ctx.tslaAddr })],
        fee: e(1),
        recipient: fresh,
        relayer: ctx.relayer.address,
      });

      expect(await ctx.tsla.balanceOf(fresh)).to.equal(e(39));
      expect(await ctx.tsla.balanceOf(ctx.relayer.address)).to.equal(e(1));
      expect(await ctx.tsla.balanceOf(await ctx.pool.getAddress())).to.equal(e(60));
      const left = await scanNotes(ctx.pool, ctx.aliceKp);
      expect(left.map((n) => n.amount)).to.deep.equal([e(60)]);
    });

    it("a view key sees the real balance (spends included) but cannot spend", async function () {
      const ctx = await loadFixture(withAliceDeposit);
      const viewer = Keypair.fromExportedViewKey(ctx.aliceKp.exportViewKey());
      const seen = await scanNotes(ctx.pool, viewer);
      expect(seen.map((n) => n.amount)).to.deep.equal([e(100)]);

      // The viewer can't build a spend.
      await expect(
        prepareTransaction({ pool: ctx.pool, asset: ctx.tslaAddr, chainId: ctx.chainId, tree: await buildTree(ctx.pool), inputs: [seen[0]], recipient: ctx.carol.address })
      ).to.be.rejectedWith("can't spend");

      // Alice spends 100 into 40 to Bob + 60 change; the viewer sees exactly 60 left.
      const [note] = await scanNotes(ctx.pool, ctx.aliceKp);
      await transact(ctx, ctx.alice, {
        asset: ctx.tslaAddr,
        inputs: [note],
        outputs: [
          new Utxo({ amount: e(40), keypair: Keypair.fromAddress(ctx.bobKp.address()), asset: ctx.tslaAddr }),
          new Utxo({ amount: e(60), keypair: ctx.aliceKp, asset: ctx.tslaAddr }),
        ],
      });
      expect((await scanNotes(ctx.pool, viewer)).map((n) => n.amount)).to.deep.equal([e(60)]);
      expect((await scanNotes(ctx.pool, viewer, { includeSpent: true })).map((n) => n.amount)).to.deep.equal([e(100), e(60)]);
    });
  });

  describe("Attacks", function () {
    it("rejects a double spend", async function () {
      const ctx = await loadFixture(withAliceDeposit);
      const [note] = await scanNotes(ctx.pool, ctx.aliceKp);
      const tree = await buildTree(ctx.pool);
      const first = await prepareTransaction({
        pool: ctx.pool, asset: ctx.tslaAddr, chainId: ctx.chainId, tree,
        inputs: [note], recipient: ctx.alice.address,
      });
      const second = await prepareTransaction({
        pool: ctx.pool, asset: ctx.tslaAddr, chainId: ctx.chainId, tree,
        inputs: [note], recipient: ctx.bob.address,
      });
      await ctx.pool.transact(first.args, first.extData, ctx.tslaAddr);
      await expect(ctx.pool.transact(second.args, second.extData, ctx.tslaAddr))
        .to.be.revertedWithCustomError(ctx.pool, "NullifierAlreadySpent");
    });

    it("rejects a front-runner who swaps the recipient", async function () {
      const ctx = await loadFixture(withAliceDeposit);
      const [note] = await scanNotes(ctx.pool, ctx.aliceKp);
      const { args, extData } = await prepareTransaction({
        pool: ctx.pool, asset: ctx.tslaAddr, chainId: ctx.chainId, tree: await buildTree(ctx.pool),
        inputs: [note], recipient: ctx.alice.address,
      });
      const stolen = { ...extData, recipient: ctx.carol.address };
      await expect(ctx.pool.transact(args, stolen, ctx.tslaAddr))
        .to.be.revertedWithCustomError(ctx.pool, "BadExtDataHash");

      // Even recomputing the hash doesn't help: the proof is bound to the original one.
      const forgedHash = hashExtData({ chainId: ctx.chainId, pool: await ctx.pool.getAddress(), asset: ctx.tslaAddr, extData: stolen });
      await expect(ctx.pool.transact({ ...args, extDataHash: toBytes32(forgedHash) }, stolen, ctx.tslaAddr))
        .to.be.revertedWithCustomError(ctx.pool, "InvalidProof");
    });

    it("rejects withdrawing a TSLA note as AAPL", async function () {
      const ctx = await loadFixture(withAliceDeposit);
      const aaplAddr = await ctx.aapl.getAddress();
      // Someone else's AAPL so the pool has AAPL to steal.
      await transact(ctx, ctx.bob, { asset: aaplAddr, outputs: [new Utxo({ amount: e(100), keypair: ctx.bobKp, asset: aaplAddr })] });

      const [note] = await scanNotes(ctx.pool, ctx.aliceKp);
      const { args, extData } = await prepareTransaction({
        pool: ctx.pool, asset: ctx.tslaAddr, chainId: ctx.chainId, tree: await buildTree(ctx.pool),
        inputs: [note], recipient: ctx.alice.address,
      });
      const forgedHash = hashExtData({ chainId: ctx.chainId, pool: await ctx.pool.getAddress(), asset: aaplAddr, extData });
      await expect(ctx.pool.transact({ ...args, extDataHash: toBytes32(forgedHash) }, extData, aaplAddr))
        .to.be.revertedWithCustomError(ctx.pool, "InvalidProof");
    });

    it("rejects an unknown root", async function () {
      const ctx = await loadFixture(withAliceDeposit);
      const [note] = await scanNotes(ctx.pool, ctx.aliceKp);
      const { args, extData } = await prepareTransaction({
        pool: ctx.pool, asset: ctx.tslaAddr, chainId: ctx.chainId, tree: await buildTree(ctx.pool),
        inputs: [note], recipient: ctx.alice.address,
      });
      await expect(ctx.pool.transact({ ...args, root: toBytes32(123n) }, extData, ctx.tslaAddr))
        .to.be.revertedWithCustomError(ctx.pool, "UnknownRoot");
    });
  });

  describe("Admin limits and Stock Token behavior", function () {
    it("enforces per-asset deposit caps and allowlist", async function () {
      const ctx = await deployVesper();
      const kp = new Keypair();
      const tsla = await ctx.tsla.getAddress();
      await expect(transact(ctx, ctx.alice, { asset: tsla, outputs: [new Utxo({ amount: e(1001), keypair: kp, asset: tsla })] }))
        .to.be.revertedWithCustomError(ctx.pool, "DepositTooLarge");

      const other = await ethers.deployContract("MockStockToken", ["Unlisted", "XYZ"]);
      const xyz = await other.getAddress();
      await expect(transact(ctx, ctx.alice, { asset: xyz, outputs: [new Utxo({ amount: 1n, keypair: kp, asset: xyz })] }))
        .to.be.revertedWithCustomError(ctx.pool, "AssetNotEnabled");
    });

    it("admin can stop new deposits but never block withdrawals", async function () {
      const ctx = await loadFixture(withAliceDeposit);
      await ctx.pool.configureAsset(ctx.tslaAddr, false, 0);
      await ctx.pool.setDepositsPaused(true);

      await expect(transact(ctx, ctx.alice, { asset: ctx.tslaAddr, outputs: [new Utxo({ amount: 1n, keypair: ctx.aliceKp, asset: ctx.tslaAddr })] }))
        .to.be.revertedWithCustomError(ctx.pool, "AssetNotEnabled");

      const [note] = await scanNotes(ctx.pool, ctx.aliceKp);
      await transact(ctx, ctx.alice, { asset: ctx.tslaAddr, inputs: [note], recipient: ctx.alice.address });
      expect(await ctx.tsla.balanceOf(await ctx.pool.getAddress())).to.equal(0);
    });

    it("issuer pause delays a withdrawal; the note stays valid", async function () {
      const ctx = await loadFixture(withAliceDeposit);
      const [note] = await scanNotes(ctx.pool, ctx.aliceKp);
      await ctx.tsla.setPaused(true);
      await expect(transact(ctx, ctx.alice, { asset: ctx.tslaAddr, inputs: [note], recipient: ctx.alice.address }))
        .to.be.revertedWithCustomError(ctx.tsla, "IsPaused");
      await ctx.tsla.setPaused(false);
      await transact(ctx, ctx.alice, { asset: ctx.tslaAddr, inputs: [note], recipient: ctx.alice.address });
      expect(await ctx.tsla.balanceOf(await ctx.pool.getAddress())).to.equal(0);
    });

    it("a 2-for-1 split changes shares, not raw note amounts", async function () {
      const ctx = await loadFixture(withAliceDeposit);
      await ctx.tsla.setUIMultiplier(e(2));
      const [note] = await scanNotes(ctx.pool, ctx.aliceKp);
      expect(note.amount).to.equal(e(100));
      expect(toShares(note.amount, await ctx.tsla.uiMultiplier())).to.equal(e(200));
      expect(await ctx.tsla.balanceOfUI(await ctx.pool.getAddress())).to.equal(e(200));
    });

    it("only the owner configures assets; only guardian/owner pause", async function () {
      const ctx = await deployVesper();
      await expect(ctx.pool.connect(ctx.alice).configureAsset(ctx.alice.address, true, 1))
        .to.be.revertedWithCustomError(ctx.pool, "OwnableUnauthorizedAccount");
      await expect(ctx.pool.connect(ctx.alice).setDepositsPaused(true))
        .to.be.revertedWithCustomError(ctx.pool, "NotGuardian");
    });
  });
});
