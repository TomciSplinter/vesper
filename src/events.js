// Fetch all of a contract's events of one kind since `fromBlock`.
// Asks for everything up to "latest" first (no cached block numbers: ethers caches
// getBlockNumber for a few seconds, which would miss a transaction that just landed).
// If the RPC refuses the range, it splits it in half until it's accepted.
async function queryAll(contract, filter, fromBlock = 0) {
  try {
    return await contract.queryFilter(filter, Number(fromBlock), "latest");
  } catch (first) {
    const provider = contract.runner.provider || contract.runner;
    const latest = typeof provider.send === "function" ? Number(await provider.send("eth_blockNumber", [])) : await provider.getBlockNumber();
    const split = async (from, to, depth) => {
      try {
        return await contract.queryFilter(filter, from, to);
      } catch (err) {
        if (from >= to || depth > 24) throw err;
        const mid = Math.floor((from + to) / 2);
        return [...(await split(from, mid, depth + 1)), ...(await split(mid + 1, to, depth + 1))];
      }
    };
    return split(Number(fromBlock), latest, 0);
  }
}

module.exports = { queryAll };
