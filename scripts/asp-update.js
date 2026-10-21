// Publishes the association set (approved deposits) for the pool on --network.
//   npx hardhat run scripts/asp-update.js --network robinhoodTestnet
// Signs with the first account, which must be the pool's aspPostman (the owner by default).
// Policy: asp/blocklist.json (addresses never approved) and MIN_AGE_SECONDS (default 0).
// Safe to run on a schedule: does nothing if the set hasn't changed.
const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");
const { initPoseidon, fetchDeposits, approvedLabels, associationTree } = require("../src");

async function main() {
  await initPoseidon();
  const dep = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployments", `${network.name}.json`)));
  const [signer] = await ethers.getSigners();
  const pool = await ethers.getContractAt("VesperPool", dep.pool, signer);
  const blocklist = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "asp", "blocklist.json")));
  const minAgeSeconds = Number(process.env.MIN_AGE_SECONDS || 0);

  const deposits = await fetchDeposits(pool, dep.deployBlock);
  const timestamps = {};
  if (minAgeSeconds > 0) {
    for (const b of new Set(deposits.map((d) => d.block))) timestamps[b] = (await ethers.provider.getBlock(b)).timestamp;
  }
  const labels = approvedLabels(deposits, { blocklist, minAgeSeconds, timestamps });
  const root = associationTree(labels).root();
  console.log(`${deposits.length} deposits, ${labels.length} approved, ${deposits.length - labels.length} not approved`);

  if (labels.length === 0) return console.log("Nothing approved yet; not publishing.");
  if (BigInt(await pool.aspRoot()) === root) return console.log("Association set unchanged.");
  const tx = await pool.updateAssociationSet(root, labels, process.env.ASP_URI || "vesper-asp-v0.1: blocklist + min age");
  await tx.wait();
  console.log(`Published root ${root} in ${tx.hash}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
