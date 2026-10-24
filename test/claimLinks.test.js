const { expect } = require("chai");
const { ethers } = require("hardhat");
const { Keypair, Utxo, buildTree, scanNotes, linkKeypair, encodeLinkSecret, decodeLinkSecret, readLink, scanLinks, fetchAssociationSet } = require("../src");
const { deployVesper, approveAll, prepareTransaction } = require("./helpers");

const e = (n) => ethers.parseEther(String(n));

describe("Claim links", function () {
  it("derives the same link keys every time, and the secret round-trips through a URL", async function () {
    await deployVesper();
    const owner = new Keypair();
    const a = linkKeypair(owner, 0);
    expect(linkKeypair(owner, 0).privkey).to.equal(a.privkey);
    expect(linkKeypair(owner, 1).privkey).to.not.equal(a.privkey);
    expect(linkKeypair(new Keypair(), 0).privkey).to.not.equal(a.privkey);
    const url = `https://vesper.markets/#claim=${encodeLinkSecret(a)}`;
    expect(decodeLinkSecret(url).address()).to.equal(a.address());
    expect(() => decodeLinkSecret("https://vesper.markets/#claim=nope")).to.throw("isn't a valid");
  });

  it("a link is funded by a private transfer, claimed by anyone holding it, and the sender sees it claimed", async function () {
    const ctx = await deployVesper();
    const asset = await ctx.tsla.getAddress();
    const alice = new Keypair();
    const bob = new Keypair();
    const tx = async (opts, signer = ctx.alice) => {
      const p = await prepareTransaction({ pool: ctx.pool, asset, chainId: ctx.chainId, tree: await buildTree(ctx.pool), ...opts });
      return (await ctx.pool.connect(signer).transact(p.args, p.extData, asset)).wait();
    };

    await tx({ depositor: ctx.alice.address, outputs: [new Utxo({ amount: e(10), keypair: alice, asset })] });
    await approveAll(ctx);

    // Alice makes link #0 worth 3 (+0.5 for the claim fee).
    let { links, nextIndex } = await scanLinks(ctx.pool, alice);
    expect(links).to.have.length(0);
    expect(nextIndex).to.equal(0);
    const link = linkKeypair(alice, nextIndex);
    const [note] = await scanNotes(ctx.pool, alice);
    await tx({ inputs: [note], outputs: [new Utxo({ amount: e(3.5), keypair: link, asset }), new Utxo({ amount: e(6.5), keypair: alice, asset })] });

    ({ links, nextIndex } = await scanLinks(ctx.pool, alice));
    expect(links.map((l) => [l.index, l.claimed])).to.deep.equal([[0, false]]);
    expect(nextIndex).to.equal(1);

    // Bob only has the URL. He claims through a relayer into his own private balance.
    const opened = decodeLinkSecret(`https://vesper.markets/#claim=${encodeLinkSecret(link)}`);
    const { notes } = await readLink(ctx.pool, opened);
    expect(notes.map((n) => n.amount)).to.deep.equal([e(3.5)]);
    const asp = await fetchAssociationSet(ctx.pool);
    await tx({ inputs: notes, outputs: [new Utxo({ amount: e(3), keypair: bob, asset })], fee: e(0.5), relayer: ctx.relayer.address, asp }, ctx.relayer);

    expect((await scanNotes(ctx.pool, bob)).map((n) => n.amount)).to.deep.equal([e(3)]);
    expect(await ctx.tsla.balanceOf(ctx.relayer.address)).to.equal(e(0.5));
    ({ links } = await scanLinks(ctx.pool, alice));
    expect(links[0].claimed).to.equal(true);
    // Claiming twice fails: the note is spent.
    expect((await readLink(ctx.pool, opened)).notes).to.have.length(0);
  });

  it("a link can be claimed straight out to a wallet address, so the receiver needs no account", async function () {
    const ctx = await deployVesper();
    const asset = await ctx.tsla.getAddress();
    const alice = new Keypair();
    const tx = async (opts, signer = ctx.alice) => {
      const p = await prepareTransaction({ pool: ctx.pool, asset, chainId: ctx.chainId, tree: await buildTree(ctx.pool), ...opts });
      return (await ctx.pool.connect(signer).transact(p.args, p.extData, asset)).wait();
    };
    await tx({ depositor: ctx.alice.address, outputs: [new Utxo({ amount: e(2), keypair: alice, asset })] });
    await approveAll(ctx);
    const link = linkKeypair(alice, 0);
    const [note] = await scanNotes(ctx.pool, alice);
    await tx({ inputs: [note], outputs: [new Utxo({ amount: e(2), keypair: link, asset })] });

    const fresh = ethers.Wallet.createRandom().address;
    const { notes } = await readLink(ctx.pool, link);
    const asp = await fetchAssociationSet(ctx.pool);
    await tx({ inputs: notes, recipient: fresh, fee: e(0.5), relayer: ctx.relayer.address, asp }, ctx.relayer);
    expect(await ctx.tsla.balanceOf(fresh)).to.equal(e(1.5));
  });
});
