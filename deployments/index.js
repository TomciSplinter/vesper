// Which deployment the relayer and approval API serve. Mainnet ("robinhood") once it exists,
// else testnet; DEPLOYMENT_NAME overrides. The deployment file is the source of truth for the
// pool, chain id and public RPC, so the Vercel settings only need the relayer key.
// Static require() paths so Vercel bundles the files with the functions.
function tryRequire(load) {
  try {
    return load();
  } catch {
    return null;
  }
}

const DEPLOYMENTS = {
  robinhood: tryRequire(() => require("./robinhood.json")),
  robinhoodTestnet: tryRequire(() => require("./robinhoodTestnet.json")),
};

function activeDeployment(env = process.env) {
  const name = String(env.DEPLOYMENT_NAME || "").trim() || (DEPLOYMENTS.robinhood ? "robinhood" : "robinhoodTestnet");
  return DEPLOYMENTS[name] || null;
}

/** env RPC_URL is used only if env CHAIN_ID says it's for this deployment's chain. */
function rpcFor(dep, env = process.env) {
  const clean = (v) => String(v || "").trim().replace(/^["']+|["']+$/g, "").trim();
  if (clean(env.RPC_URL) && Number(clean(env.CHAIN_ID)) === dep.chainId) return clean(env.RPC_URL);
  return dep.rpcUrl;
}

module.exports = { DEPLOYMENTS, activeDeployment, rpcFor };
