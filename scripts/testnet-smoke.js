// Live check against a deployed pool with a mock token (see deploy.js MOCK_TOKEN):
// deposit -> private transfer -> withdraw, each with a real Groth16 proof.
//   npx hardhat run scripts/testnet-smoke.js --network robinhoodTestnet
const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");
const { initPoseidon, Keypair, Utxo, prepareTransaction, buildTree, scanNotes, fetchAssociationSet } = require("../src");
const { publishAssociationSet } = require("../relayer/aspUpdate");

const e = (n) => ethers.parseEther(String(n));
const fmt = (n) => ethers.formatEther(n);

async function main() {
  if ((await ethers.provider.getNetwork()).chainId === 4663n) throw new Error("Smoke test is for testnets only.");
  const dep = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployments", `${network.name}.json`)));
  if (!dep.mockToken) throw new Error("No mock token in this deployment.");
  await initPoseidon();

  const [signer] = await ethers.getSigners();
  const pool = await ethers.getContractAt("VesperPool", dep.pool, signer);
  const token = await ethers.getContractAt("MockStockToken", dep.mockToken, signer);
  const asset = dep.mockToken;
  const chainId = dep.chainId;
  const fromBlock = dep.deployBlock;
  const tree = () => buildTree(pool, undefined, fromBlock);
  const explorer = (h) => `https://explorer.testnet.chain.robinhood.com/tx/${h}`;

  async function send(label, opts) {
    const { args, extData } = await prepareTransaction({ pool, asset, chainId, tree: await tree(), ...opts });
    const tx = await pool.transact(args, extData, asset);
    const r = await tx.wait();
    console.log(`${label}: ${explorer(r.hash)}  (gas ${r.gasUsed})`);
  }

  const alice = new Keypair();
  const bob = new Keypair();
  const fresh = ethers.Wallet.createRandom().address;

  if ((await token.allowance(signer.address, dep.pool)) < e(100)) {
    await (await token.approve(dep.pool, ethers.MaxUint256)).wait();
  }

  await send("1. deposit 10 into Alice's note", {
    depositor: signer.address,
    outputs: [new Utxo({ amount: e(10), keypair: alice, asset })],
  });

  // The screener approves the deposit (postman = RELAYER_KEY wallet, or the signer).
  const postmanKey = process.env.ASP_KEY || process.env.RELAYER_KEY;
  const postman = postmanKey ? new ethers.Wallet(postmanKey, ethers.provider) : signer;
  const published = await publishAssociationSet(pool.connect(postman), { fromBlock, blocklist: require("../asp/blocklist.json") });
  console.log(`   screener: ${published.approved}/${published.total} deposits approved${published.txHash ? " " + explorer(published.txHash) : ""}`);
  const asp = await fetchAssociationSet(pool, fromBlock);

  const [aliceNote] = await scanNotes(pool, alice, { fromBlock });
  await send("2. private transfer 4 to Bob, 6 change to Alice", {
    inputs: [aliceNote],
    outputs: [
      new Utxo({ amount: e(4), keypair: Keypair.fromAddress(bob.address()), asset }),
      new Utxo({ amount: e(6), keypair: alice, asset }),
    ],
  });

  const [bobNote] = await scanNotes(pool, bob, { fromBlock });
  await send("3. Bob withdraws 4 to a fresh address (proving the money is approved)", { inputs: [bobNote], recipient: fresh, asp });

  const aliceLeft = (await scanNotes(pool, alice, { fromBlock })).map((n) => fmt(n.amount));
  const bobLeft = (await scanNotes(pool, bob, { fromBlock })).map((n) => fmt(n.amount));
  const freshBal = fmt(await token.balanceOf(fresh));
  console.log({ aliceNotes: aliceLeft, bobNotes: bobLeft, freshAddress: fresh, freshBalance: freshBal });

  if (aliceLeft.join() !== "6.0" || bobLeft.length !== 0 || freshBal !== "4.0") {
    throw new Error("Smoke test FAILED: balances don't match");
  }
  console.log("Smoke test PASSED");
}

// snarkjs leaves worker threads alive, so exit explicitly.
main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
