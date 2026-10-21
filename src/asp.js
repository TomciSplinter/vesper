// Association set provider (ASP) helpers: which deposits are approved.
// v0.1 policy: approve every deposit whose depositor isn't on the blocklist and that
// is at least `minAgeSeconds` old. The list is published on-chain by the pool's
// aspPostman (scripts/asp-update.js); wallets rebuild and verify it (fetchAssociationSet).
const { getAddress } = require("ethers");
const { MerkleTree } = require("./merkleTree");
const { MERKLE_TREE_HEIGHT } = require("./constants");

/** All deposits: [{ label, depositor, asset, amount, block, timestamp? }] in order. */
async function fetchDeposits(pool, fromBlock = 0) {
  const provider = pool.runner.provider || pool.runner;
  const latest = await provider.getBlockNumber();
  const filter = pool.filters.NewDeposit();
  const query = async (from, to, depth = 0) => {
    try {
      return await pool.queryFilter(filter, from, to);
    } catch (err) {
      if (from >= to || depth > 20) throw err;
      const mid = Math.floor((from + to) / 2);
      return [...(await query(from, mid, depth + 1)), ...(await query(mid + 1, to, depth + 1))];
    }
  };
  const events = await query(Number(fromBlock), latest);
  return events.map((e) => ({
    label: BigInt(e.args.label),
    depositor: getAddress(e.args.depositor),
    asset: getAddress(e.args.asset),
    amount: BigInt(e.args.amount),
    block: e.blockNumber,
  }));
}

/** Applies the policy. Returns approved labels in deposit order. */
function approvedLabels(deposits, { blocklist = [], minAgeSeconds = 0, now = Math.floor(Date.now() / 1000), timestamps = {} } = {}) {
  const blocked = new Set(blocklist.map((a) => getAddress(a)));
  return deposits
    .filter((d) => !blocked.has(d.depositor))
    .filter((d) => minAgeSeconds === 0 || (timestamps[d.block] !== undefined && now - timestamps[d.block] >= minAgeSeconds))
    .map((d) => d.label);
}

function associationTree(labels, levels = MERKLE_TREE_HEIGHT) {
  return new MerkleTree(levels, labels);
}

module.exports = { fetchDeposits, approvedLabels, associationTree };
