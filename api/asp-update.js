// POST /api/asp-update: re-runs the approval policy (asp/blocklist.json) and publishes
// the association set if it changed. Anyone may call it (the web app does after a
// deposit): the policy is fixed, and it only spends gas when there's a new deposit.
// Signs with ASP_KEY if set, else RELAYER_KEY; that wallet must be the pool's aspPostman.
const { ethers } = require("ethers");
const { initPoseidon } = require("../src/poseidon");
const { publishAssociationSet } = require("../relayer/aspUpdate");
const deployments = { robinhoodTestnet: require("../deployments/robinhoodTestnet.json") };

let running = null;

module.exports = async (req, res) => {
  res.setHeader("content-type", "application/json");
  res.setHeader("cache-control", "no-store");
  res.setHeader("access-control-allow-origin", "*");
  if (req.method === "OPTIONS") return res.end("{}");
  try {
    const key = (process.env.ASP_KEY || process.env.RELAYER_KEY || "").trim().replace(/^["']|["']$/g, "");
    const dep = deployments[process.env.DEPLOYMENT_NAME || "robinhoodTestnet"];
    if (!key || !process.env.RPC_URL) throw new Error("approvals not configured");
    await initPoseidon();
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL.trim(), dep.chainId, { staticNetwork: true });
    const pool = new ethers.Contract(
      dep.pool,
      [
        "event NewDeposit(uint256 indexed label, address indexed depositor, address indexed asset, uint256 amount)",
        "event AssociationSetUpdated(uint256 root, uint256[] added, uint256[] removed, string uri)",
        "function aspRoot() view returns (uint256)",
        "function aspPostman() view returns (address)",
        "function updateAssociationSet(uint256 root, uint256[] added, uint256[] removed, string uri)",
      ],
      new ethers.Wallet(key, provider)
    );
    if (ethers.getAddress(await pool.aspPostman()) !== pool.runner.address) throw new Error("this wallet isn't the pool's aspPostman");
    // One publish at a time per instance.
    running = running || publishAssociationSet(pool, { fromBlock: dep.deployBlock, blocklist: require("../asp/blocklist.json") }).finally(() => (running = null));
    const r = await running;
    res.statusCode = 200;
    res.end(JSON.stringify(r));
  } catch (err) {
    res.statusCode = 503;
    res.end(JSON.stringify({ error: err.shortMessage || err.message }));
  }
};
