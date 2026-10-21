const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { deployVesper, adminChange } = require("./helpers");

const e = (n) => ethers.parseEther(String(n));
const DAY = 24 * 60 * 60;

describe("Admin changes: 3-day notice", function () {
  async function setup() {
    const ctx = await deployVesper();
    ctx.tslaAddr = await ctx.tsla.getAddress();
    ctx.enc = (fn, args) => ctx.pool.interface.encodeFunctionData(fn, args);
    return ctx;
  }

  it("initial settings come from the constructor", async function () {
    const ctx = await loadFixture(setup);
    expect(await ctx.pool.ADMIN_DELAY()).to.equal(3 * DAY);
    expect(await ctx.pool.aspPostman()).to.equal(ctx.owner.address);
    const [enabled, cap] = await ctx.pool.assetConfig(ctx.tslaAddr);
    expect(enabled).to.equal(true);
    expect(cap).to.equal(e(1000));
  });

  it("a loosening change is announced and can only run after 3 days", async function () {
    const ctx = await loadFixture(setup);
    const data = ctx.enc("applyAssetConfig", [ctx.tslaAddr, true, e(5000)]);
    const id = ethers.keccak256(data);
    await expect(ctx.pool.scheduleChange(data)).to.emit(ctx.pool, "ChangeScheduled");
    await expect(ctx.pool.executeChange(data)).to.be.revertedWithCustomError(ctx.pool, "TooEarly");
    await time.increase(3 * DAY - 60);
    await expect(ctx.pool.executeChange(data)).to.be.revertedWithCustomError(ctx.pool, "TooEarly");
    await time.increase(60);
    await expect(ctx.pool.executeChange(data)).to.emit(ctx.pool, "ChangeExecuted").withArgs(id);
    expect((await ctx.pool.assetConfig(ctx.tslaAddr))[1]).to.equal(e(5000));
    // Can't be replayed.
    await expect(ctx.pool.executeChange(data)).to.be.revertedWithCustomError(ctx.pool, "NotScheduled");
  });

  it("a scheduled change can be cancelled", async function () {
    const ctx = await loadFixture(setup);
    const data = ctx.enc("applyComplianceRequired", [false]);
    await ctx.pool.scheduleChange(data);
    await ctx.pool.cancelChange(ethers.keccak256(data));
    await time.increase(4 * DAY);
    await expect(ctx.pool.executeChange(data)).to.be.revertedWithCustomError(ctx.pool, "NotScheduled");
    expect(await ctx.pool.complianceRequired()).to.equal(true);
  });

  it("the delayed functions can't be called directly, not even by the owner", async function () {
    const ctx = await loadFixture(setup);
    await expect(ctx.pool.applyAssetConfig(ctx.tslaAddr, true, e(1))).to.be.revertedWithCustomError(ctx.pool, "OnlySelf");
    await expect(ctx.pool.applyGuardian(ctx.alice.address)).to.be.revertedWithCustomError(ctx.pool, "OnlySelf");
    await expect(ctx.pool.applyAspPostman(ctx.alice.address)).to.be.revertedWithCustomError(ctx.pool, "OnlySelf");
    await expect(ctx.pool.applyComplianceRequired(false)).to.be.revertedWithCustomError(ctx.pool, "OnlySelf");
  });

  it("only the four admin changes can be scheduled (nothing that touches funds)", async function () {
    const ctx = await loadFixture(setup);
    for (const data of [
      ctx.enc("renounceOwnership", []),
      ctx.enc("setDepositsPaused", [true]),
      ctx.enc("updateAssociationSet", [1, [], ""]),
      "0x12",
    ]) {
      await expect(ctx.pool.scheduleChange(data)).to.be.revertedWithCustomError(ctx.pool, "NotAllowed");
    }
  });

  it("role changes take effect only after the delay, and reject the zero address", async function () {
    const ctx = await loadFixture(setup);
    await adminChange(ctx.pool, ctx.owner, "applyAspPostman", [ctx.alice.address]);
    expect(await ctx.pool.aspPostman()).to.equal(ctx.alice.address);
    await adminChange(ctx.pool, ctx.owner, "applyGuardian", [ctx.bob.address]);
    expect(await ctx.pool.guardian()).to.equal(ctx.bob.address);
    await expect(adminChange(ctx.pool, ctx.owner, "applyGuardian", [ethers.ZeroAddress])).to.be.revertedWithCustomError(ctx.pool, "ZeroAddress");
  });

  it("emergency brakes are instant: pause deposits, lower a cap, disable an asset (never raise)", async function () {
    const ctx = await loadFixture(setup);
    await ctx.pool.setDepositsPaused(true);
    expect(await ctx.pool.depositsPaused()).to.equal(true);
    await ctx.pool.restrictAsset(ctx.tslaAddr, e(10));
    expect((await ctx.pool.assetConfig(ctx.tslaAddr))[1]).to.equal(e(10));
    await ctx.pool.restrictAsset(ctx.tslaAddr, e(999)); // raising this way does nothing
    expect((await ctx.pool.assetConfig(ctx.tslaAddr))[1]).to.equal(e(10));
    await ctx.pool.restrictAsset(ctx.tslaAddr, 0);
    expect((await ctx.pool.assetConfig(ctx.tslaAddr))[0]).to.equal(false);
  });

  it("deploying with a zero approval publisher or mismatched asset lists fails", async function () {
    const ctx = await loadFixture(setup);
    const args = [await ctx.verifier.getAddress(), await ctx.hasher.getAddress(), 20, ctx.owner.address];
    await expect(ethers.deployContract("VesperPool", [...args, ethers.ZeroAddress, [], []])).to.be.revertedWithCustomError(ctx.pool, "ZeroAddress");
    await expect(ethers.deployContract("VesperPool", [...args, ctx.owner.address, [ctx.tslaAddr], []])).to.be.revertedWithCustomError(ctx.pool, "LengthMismatch");
  });
});
