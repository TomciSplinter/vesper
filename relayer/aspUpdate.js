// Runs the association-set policy and publishes the result if it changed.
// Shared by scripts/asp-update.js and the /api/asp-update function.
const { fetchDeposits, approvedLabels, associationTree } = require("../src/asp");

/**
 * @param {Contract} pool   VesperPool connected to the postman's signer
 * @returns {{ total, approved, root, changed, txHash? }}
 */
async function publishAssociationSet(pool, { fromBlock = 0, blocklist = [], minAgeSeconds = 0, uri = "vesper-asp-v0.1: blocklist + min age" } = {}) {
  const provider = pool.runner.provider;
  const deposits = await fetchDeposits(pool, fromBlock);
  const timestamps = {};
  if (minAgeSeconds > 0) {
    for (const b of new Set(deposits.map((d) => d.block))) timestamps[b] = (await provider.getBlock(b)).timestamp;
  }
  const labels = approvedLabels(deposits, { blocklist, minAgeSeconds, timestamps });
  const out = { total: deposits.length, approved: labels.length, root: null, changed: false };
  if (!labels.length) return out;
  const root = associationTree(labels).root();
  out.root = root.toString();
  if (BigInt(await pool.aspRoot()) === root) return out;
  const tx = await pool.updateAssociationSet(root, labels, uri);
  await tx.wait();
  return { ...out, changed: true, txHash: tx.hash };
}

module.exports = { publishAssociationSet };
