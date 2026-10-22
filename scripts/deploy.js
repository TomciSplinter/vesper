// Deploys Vesper to the network passed with --network.
//   ASSETS="0xTokenA:1000,0xTokenB:500" npx hardhat run scripts/deploy.js --network robinhoodTestnet
// Each asset is "address:maxDepositPerTx" in whole tokens (18 decimals).
//
// Uses the Groth16Verifier in contracts/Verifier.sol. On mainnet it must be the one from the
// public ceremony (scripts/import-ceremony.js records its hash in ceremony/final.json).
const { ethers, network } = require("hardhat");
const { poseidonContract } = require("circomlibjs");
const { MERKLE_TREE_HEIGHT } = require("../src/constants");

function checkCeremonyKey() {
  const fs = require("fs");
  const path = require("path");
  const crypto = require("crypto");
  const root = path.join(__dirname, "..");
  const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(path.join(root, f))).digest("hex");
  const recordFile = path.join(root, "ceremony", "final.json");
  if (!fs.existsSync(recordFile)) throw new Error("Refusing mainnet deploy: no ceremony key imported (run scripts/import-ceremony.js).");
  const rec = JSON.parse(fs.readFileSync(recordFile, "utf8"));
  if (rec.dryRun) throw new Error("Refusing mainnet deploy: the imported key is from a dry run.");
  if (sha("contracts/Verifier.sol") !== rec.verifierSol || sha("build/transaction2.zkey") !== rec.zkey) {
    throw new Error("Refusing mainnet deploy: Verifier.sol or the proving key don't match the ceremony's final key.");
  }
}

async function main() {
  const [deployer] = await ethers.getSigners();
  // Guard by chain id, not network name, so a renamed network can't skip it.
  const MAINNET_CHAIN_ID = 4663n; // Robinhood Chain mainnet
  const onMainnet = (await ethers.provider.getNetwork()).chainId === MAINNET_CHAIN_ID;
  if (onMainnet) checkCeremonyKey();
  console.log(`Deploying to ${network.name} from ${deployer.address}`);

  const hasher = await new ethers.ContractFactory(poseidonContract.generateABI(2), poseidonContract.createCode(2), deployer).deploy();
  await hasher.waitForDeployment();
  const verifier = await ethers.deployContract("Groth16Verifier");
  await verifier.waitForDeployment();
  const assets = (process.env.ASSETS || "").split(",").filter(Boolean);

  // Testnet only: MOCK_TOKEN="SYMBOL:maxDeposit" deploys a stand-in stock token,
  // mints some to the deployer and enables it in the pool.
  let mockToken;
  if (process.env.MOCK_TOKEN) {
    if (onMainnet) throw new Error("MOCK_TOKEN is for testnets only.");
    const [symbol, max] = process.env.MOCK_TOKEN.split(":");
    mockToken = await ethers.deployContract("MockStockToken", [`${symbol} Test Stock Token`, symbol]);
    await mockToken.waitForDeployment();
    await (await mockToken.mint(deployer.address, ethers.parseEther("10000"))).wait();
    console.log(`  mock ${symbol} at ${await mockToken.getAddress()} (10000 minted to deployer)`);
    assets.push(`${await mockToken.getAddress()}:${max || "1000"}`);
  }

  // Initial assets and the approval publisher go in the constructor: later changes
  // that loosen rules have to wait the pool's 3-day ADMIN_DELAY.
  const postman = process.env.ASP_POSTMAN || deployer.address;
  const assetAddrs = assets.map((a) => a.split(":")[0]);
  const caps = assets.map((a) => ethers.parseEther(a.split(":")[1]));
  const pool = await ethers.deployContract("VesperPool", [
    await verifier.getAddress(),
    await hasher.getAddress(),
    MERKLE_TREE_HEIGHT,
    deployer.address,
    postman,
    assetAddrs,
    caps,
  ]);
  await pool.waitForDeployment();
  for (const entry of assets) console.log(`  enabled ${entry.split(":")[0]} (max ${entry.split(":")[1]} per deposit)`);
  console.log(`  aspPostman ${postman}`);

  const deployment = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployer: deployer.address,
    deployBlock: await ethers.provider.getBlockNumber(),
    hasher: await hasher.getAddress(),
    verifier: await verifier.getAddress(),
    pool: await pool.getAddress(),
    mockToken: mockToken ? await mockToken.getAddress() : undefined,
    assets,
  };
  const out = require("path").join(__dirname, "..", "deployments", `${network.name}.json`);
  require("fs").mkdirSync(require("path").dirname(out), { recursive: true });
  require("fs").writeFileSync(out, JSON.stringify(deployment, null, 2));
  console.log(deployment);
  console.log(`Saved to ${out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
