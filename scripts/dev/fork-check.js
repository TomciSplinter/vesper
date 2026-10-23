// Mainnet-fork rehearsal: real stock token deposit -> screener approval -> withdrawal to a
// fresh address, with real proofs, on a local fork of Robinhood Chain mainnet.
//   npx hardhat node --fork https://rpc.mainnet.chain.robinhood.com   (other terminal)
//   npx hardhat run scripts/dev/fork-check.js --network localhost
const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");
const { initPoseidon, Keypair, Utxo, prepareTransaction, buildTree, scanNotes, fetchAssociationSet } = require("../../src");
const { publishAssociationSet } = require("../../relayer/aspUpdate");

async function impersonate(addr) {
  await network.provider.request({ method: "hardhat_impersonateAccount", params: [addr] });
  await network.provider.send("hardhat_setBalance", [addr, "0x56BC75E2D63100000"]);
  return ethers.getSigner(addr);
}

async function main() {
  const dep = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "deployments", "localhost.json")));
  await initPoseidon();
  const symbol = process.env.SYMBOL || "TSLA";
  const asset = require("../../deployments/robinhood.assets.json").assets.find((a) => a.symbol === symbol).address;
  const token = await ethers.getContractAt(["function balanceOf(address) view returns (uint256)", "function approve(address,uint256) returns (bool)", "event Transfer(address indexed from, address indexed to, uint256 value)"], asset);
  const head = await ethers.provider.getBlockNumber();
  let holder;
  for (let b = head; !holder && b > head - 2_000_000; b -= 50_000) {
    for (const l of (await token.queryFilter("Transfer", b - 49_999, b)).reverse()) {
      if ((await token.balanceOf(l.args.to)) >= ethers.parseEther("1") && (await ethers.provider.getCode(l.args.to)) === "0x") { holder = l.args.to; break; }
    }
  }
  if (!holder) throw new Error("no holder with >= 1 token found");
  const user = await impersonate(holder);
  const postman = await impersonate(dep.aspPostman);
  const pool = await ethers.getContractAt("VesperPool", dep.pool, user);
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const kp = new Keypair();
  const fresh = ethers.Wallet.createRandom().address;
  const tree = () => buildTree(pool, undefined, dep.deployBlock);

  await (await token.connect(user).approve(dep.pool, ethers.MaxUint256)).wait();
  let p = await prepareTransaction({ pool, asset, chainId, tree: await tree(), depositor: holder, outputs: [new Utxo({ amount: ethers.parseEther("1"), keypair: kp, asset })] });
  let r = await (await pool.transact(p.args, p.extData, asset)).wait();
  console.log(`deposit 1 ${symbol} from ${holder}: gas ${r.gasUsed}`);
  // over the cap must fail
  const cap = (await pool.assetConfig(asset))[1];
  const big = await prepareTransaction({ pool, asset, chainId, tree: await tree(), depositor: holder, outputs: [new Utxo({ amount: cap + 1n, keypair: kp, asset })] }).catch((e) => e);
  const capFails = big instanceof Error || (await pool.transact.staticCall(big.args, big.extData, asset).then(() => false).catch(() => true));
  console.log(`deposit above the ${ethers.formatEther(cap)} cap rejected: ${capFails}`);

  const pub = await publishAssociationSet(pool.connect(postman), { fromBlock: dep.deployBlock, blocklist: require("../../asp/blocklist.json") });
  console.log(`screener approved ${pub.approved}/${pub.total}`);
  const asp = await fetchAssociationSet(pool, dep.deployBlock);
  const [note] = await scanNotes(pool, kp, { fromBlock: dep.deployBlock });
  p = await prepareTransaction({ pool, asset, chainId, tree: await tree(), inputs: [note], recipient: fresh, asp });
  r = await (await pool.transact(p.args, p.extData, asset)).wait();
  console.log(`withdraw 1 ${symbol} to fresh ${fresh}: gas ${r.gasUsed}, balance ${ethers.formatEther(await token.balanceOf(fresh))}`);
  if ((await token.balanceOf(fresh)) !== ethers.parseEther("1") || !capFails) throw new Error("FORK CHECK FAILED");
  console.log(`owner ${await pool.owner()}, guardian ${await pool.guardian()}, postman ${await pool.aspPostman()}`);
  console.log("Fork check PASSED");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
