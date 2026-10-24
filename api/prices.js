// GET /api/prices: USD value of one token of each listed stock, from Robinhood's public
// token API (underlying price x the token's share multiplier). Cached for a minute. The app
// asks for every listed stock at once, so the request says nothing about what anyone holds.
const { getAddress } = require("ethers");
const { activeDeployment } = require("../deployments");

const ASSETS_URL = "https://api.robinhood.com/rhj/assets";
const PRICES_URL = "https://api.robinhood.com/rhj/prices";
let cache = null;

async function getJson(url) {
  const res = await fetch(url, { headers: { "user-agent": "vesper/1.0 (+https://vesper.markets)" } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

async function loadPrices() {
  const dep = activeDeployment();
  const wanted = new Set((dep?.assets || []).map((a) => getAddress(a.split(":")[0])));
  const [{ assets }, { quotes }] = await Promise.all([getJson(ASSETS_URL), getJson(PRICES_URL)]);
  const deployed = (x) => (x.deployments || []).find((d) => d.chainId === dep.chainId);
  const multiplier = new Map();
  for (const a of assets) {
    const d = deployed(a);
    if (d) multiplier.set(getAddress(d.contractAddress), Number(a.currentMultiplier || 1));
  }
  const prices = {};
  for (const q of quotes) {
    const d = deployed(q);
    if (!d) continue;
    const addr = getAddress(d.contractAddress);
    if (!wanted.has(addr)) continue;
    const mid = (Number(q.bid) + Number(q.ask)) / 2;
    if (!(mid > 0)) continue;
    prices[addr] = Math.round(mid * (multiplier.get(addr) || 1) * 1e4) / 1e4;
  }
  return { updatedAt: new Date().toISOString(), prices };
}

module.exports = async (req, res) => {
  res.setHeader("content-type", "application/json");
  res.setHeader("access-control-allow-origin", "*");
  try {
    if (!cache || Date.now() - cache.at > 60_000) cache = { at: Date.now(), body: await loadPrices() };
    res.setHeader("cache-control", "public, s-maxage=60, stale-while-revalidate=300");
    res.statusCode = 200;
    res.end(JSON.stringify(cache.body));
  } catch (err) {
    res.setHeader("cache-control", "no-store");
    res.statusCode = 502;
    res.end(JSON.stringify({ error: "prices unavailable" }));
  }
};
