// Runs the association-set policy and publishes the result if it changed.
// Shared by scripts/asp-update.js and the /api/asp-update function.
//
// Only CHANGES are published (added / removed labels), so the cost of an update
// doesn't grow with the number of deposits (self-audit F4). The ordered list is
// "previous list minus removed, then added appended", the same replay wallets do.
const { fetchDeposits, approvedLabels, associationTree } = require("../src/asp");
const { replayAssociationSet } = require("../src/transaction");
const { queryAll } = require("../src/events");

const MAX_PER_UPDATE = 500; // keeps each update well under transaction size limits

/**
 * @param {Contract} pool   VesperPool connected to the postman's signer
 * @returns {{ total, approved, root, changed, added, removed, txHash? }}
 */
async function publishAssociationSet(pool, { fromBlock = 0, blocklist = [], minAgeSeconds = 0, uri = "vesper-asp-v0.1: blocklist + min age" } = {}) {
  const provider = pool.runner.provider;
  const deposits = await fetchDeposits(pool, fromBlock);
  const timestamps = {};
  if (minAgeSeconds > 0) {
    for (const b of new Set(deposits.map((d) => d.block))) timestamps[b] = (await provider.getBlock(b)).timestamp;
  }
  const wanted = approvedLabels(deposits, { blocklist, minAgeSeconds, timestamps });
  const wantedSet = new Set(wanted);

  const snapshots = replayAssociationSet(await queryAll(pool, pool.filters.AssociationSetUpdated(), fromBlock));
  const published = snapshots.length ? snapshots[snapshots.length - 1].labels : [];
  const publishedSet = new Set(published);

  const removed = published.filter((l) => !wantedSet.has(l));
  const added = wanted.filter((l) => !publishedSet.has(l)).slice(0, MAX_PER_UPDATE);
  const out = { total: deposits.length, approved: wanted.length, root: null, changed: false, added: added.length, removed: removed.length };
  if (!added.length && !removed.length) return out;

  const removedSet = new Set(removed);
  const next = [...published.filter((l) => !removedSet.has(l)), ...added];
  const root = associationTree(next).root();
  out.root = root.toString();
  const tx = await pool.updateAssociationSet(root, added, removed, uri);
  await tx.wait();
  return { ...out, changed: true, txHash: tx.hash };
}

module.exports = { publishAssociationSet };
