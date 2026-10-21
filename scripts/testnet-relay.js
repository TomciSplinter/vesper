// Live relayer check: the user deposits from their own wallet, then withdraws to a
// brand-new address THROUGH the relayer, so the withdrawal is sent by the relayer.
//   RELAYER_URL=http://localhost:8787 npx hardhat run scripts/testnet-relay.js --network robinhoodTestnet
const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");
const { initPoseidon, Keypair, Utxo, prepareTransaction, buildTree, scanNotes, getRelayerInfo, relayTransaction } = require("../src");

const e = (n) => ethers.parseEther(String(n));
const fmt = (n) => ethers.formatEther(n);

async function main() {
  if ((await ethers.provider.getNetwork()).chainId === 4663n) throw new Error("Testnets only.");
  const relayerUrl = process.env.RELAYER_URL || "http://localhost:8787";
  const dep = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployments", `${network.name}.json`)));
  await initPoseidon();

  const [user] = await ethers.getSigners();
  const pool = await ethers.getContractAt("VesperPool", dep.pool, user);
  const token = await ethers.getContractAt("MockStockToken", dep.mockToken, user);
  const asset = dep.mockToken;
  const fromBlock = dep.deployBlock;
  const explorer = (h) => `https://explorer.testnet.chain.robinhood.com/tx/${h}`;

  const info = await getRelayerInfo(relayerUrl);
  const fee = BigInt(info.minFees[ethers.getAddress(asset)]);
  console.log(`relayer ${info.relayer}, fee ${fmt(fee)} vTSLA`);

  const me = new Keypair();
  const fresh = ethers.Wallet.createRandom().address;

  // 1. Deposit from the user's own wallet (deposits can't be relayed).
  const d = await prepareTransaction({
    pool, asset, chainId: dep.chainId, tree: await buildTree(pool, undefined, fromBlock),
    outputs: [new Utxo({ amount: e(5), keypair: me, asset })],
  });
  const dr = await (await pool.transact(d.args, d.extData, asset)).wait();
  console.log(`1. deposit 5 from user wallet: ${explorer(dr.hash)}`);
  const userNonceAfterDeposit = await ethers.provider.getTransactionCount(user.address);

  // 2. Withdraw everything to a brand-new address via the relayer.
  const [note] = await scanNotes(pool, me, { fromBlock });
  const w = await prepareTransaction({
    pool, asset, chainId: dep.chainId, tree: await buildTree(pool, undefined, fromBlock),
    inputs: [note], recipient: fresh, relayer: info.relayer, fee,
  });
  const job = await relayTransaction(relayerUrl, w, asset, { pollMs: 1000 });
  const receipt = await ethers.provider.getTransactionReceipt(job.txHash);
  console.log(`2. relayed withdrawal to ${fresh}: ${explorer(job.txHash)}  (sent by ${receipt.from})`);

  const freshBal = await token.balanceOf(fresh);
  const result = {
    sentByRelayer: receipt.from === info.relayer,
    userSentNothingMore: (await ethers.provider.getTransactionCount(user.address)) === userNonceAfterDeposit,
    freshAddressGot: fmt(freshBal),
    relayerFeeBalance: fmt(await token.balanceOf(info.relayer)),
    freshAddressEth: fmt(await ethers.provider.getBalance(fresh)),
  };
  console.log(result);
  if (!result.sentByRelayer || !result.userSentNothingMore || freshBal !== e(5) - fee) {
    throw new Error("Relay test FAILED");
  }
  console.log("Relay test PASSED");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
