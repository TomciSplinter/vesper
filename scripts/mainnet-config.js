// After the mainnet deploy: adds relayer fees to deployments/robinhood.json and writes the
// web app config webapp/config/robinhood.json from it and deployments/robinhood.assets.json.
//   node scripts/mainnet-config.js
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const depFile = path.join(root, "deployments", "robinhood.json");
const dep = JSON.parse(fs.readFileSync(depFile, "utf8"));
const list = JSON.parse(fs.readFileSync(path.join(root, "deployments", "robinhood.assets.json"), "utf8"));
if (dep.chainId !== 4663) throw new Error("deployments/robinhood.json is not Robinhood Chain mainnet");
const deployed = new Set(dep.assets.map((a) => a.split(":")[0].toLowerCase()));
const assets = list.assets.filter((a) => deployed.has(a.address.toLowerCase()));

dep.relayerFees = Object.fromEntries(assets.map((a) => [a.address, a.relayerFeeTokens]));
dep.sponsorExits = true;
fs.writeFileSync(depFile, JSON.stringify(dep, null, 2) + "\n");

const config = {
  testnet: false,
  chainId: 4663,
  chainName: "Robinhood Chain",
  rpcUrl: "https://rpc.mainnet.chain.robinhood.com",
  explorer: "https://robinhoodchain.blockscout.com",
  pool: dep.pool,
  deployBlock: dep.deployBlock,
  assets: assets.map((a) => ({ address: a.address, symbol: a.symbol, name: `${a.name} (Robinhood Stock Token)` })),
  relayers: ["/api"],
  aspUpdateUrl: "/api/asp-update",
  pricesUrl: "/api/prices",
  maxRelayerFees: Object.fromEntries(assets.map((a) => [a.address, a.maxRelayerFeeTokens])),
  notice: "Early version. Self-audited, not externally audited. Deposits up to about $2,000 each.",
};
fs.writeFileSync(path.join(root, "webapp", "config", "robinhood.json"), JSON.stringify(config, null, 2) + "\n");
console.log(`Wrote webapp/config/robinhood.json (${assets.length} assets, pool ${dep.pool})`);
