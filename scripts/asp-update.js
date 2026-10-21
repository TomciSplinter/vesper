// Publishes the association set (approved deposits) for the pool on --network.
//   npx hardhat run scripts/asp-update.js --network robinhoodTestnet
// Signs with the first account, which must be the pool's aspPostman.
// Policy: asp/blocklist.json (addresses never approved) and MIN_AGE_SECONDS (default 0).
// Safe to run on a schedule: does nothing if the set hasn't changed.
const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");
const { initPoseidon } = require("../src");
const { publishAssociationSet } = require("../relayer/aspUpdate");

async function main() {
  await initPoseidon();
  const dep = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployments", `${network.name}.json`)));
  const [signer] = await ethers.getSigners();
  const pool = await ethers.getContractAt("VesperPool", dep.pool, signer);
  const r = await publishAssociationSet(pool, {
    fromBlock: dep.deployBlock,
    blocklist: require("../asp/blocklist.json"),
    minAgeSeconds: Number(process.env.MIN_AGE_SECONDS || 0),
  });
  console.log(`${r.total} deposits, ${r.approved} approved.`, r.changed ? `Published in ${r.txHash}` : "No change.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
