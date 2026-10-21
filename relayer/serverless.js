// The relayer as stateless serverless functions (used by api/ on Vercel).
// Same checks as the long-running server; the difference is that each request
// sends its transaction right away and status is read back from the chain.
//
// Environment (set in the Vercel project settings, never in the repo):
//   RELAYER_KEY    private key of the relayer wallet (pays gas, receives fees)
//   RPC_URL        e.g. https://rpc.testnet.chain.robinhood.com
//   CHAIN_ID       e.g. 46630
//   POOL           optional, ignored: the pool comes from deployments/<DEPLOYMENT_NAME>.json,
//                  the same file the web app is built from, so the two always agree
//   DEPLOYMENT_NAME optional, default "robinhoodTestnet"
//   RELAYER_FEES   optional "0xToken:0.1,0xOther:0.2": minimum fee per asset, whole tokens.
//                  Defaults come from the deployment file's "relayerFees"; this overrides per asset.
const { ethers } = require("ethers");
const { Relayer, RelayError } = require("./relayer");

const MAX_BODY = 16 * 1024;
const DEPLOYMENTS = { robinhoodTestnet: require("../deployments/robinhoodTestnet.json") };

/** The pool this deployment serves (from the deployment file, not an env var). */
function deployedPool(env = process.env) {
  const dep = DEPLOYMENTS[(env.DEPLOYMENT_NAME || "robinhoodTestnet").trim()];
  if (!dep) throw new RelayError("relayer misconfigured: DEPLOYMENT_NAME is unknown", 503);
  return dep;
}

let cached;

// Tolerates values pasted with surrounding quotes or spaces.
const clean = (v) => String(v).trim().replace(/^["']+|["']+$/g, "").trim();

// Builds the relayer from env vars. A bad value is reported by NAME only (never its
// contents), so a misconfiguration shows up as a clear message instead of "internal error".
function relayerFromEnv(env = process.env) {
  if (cached) return cached;
  const names = ["RELAYER_KEY", "RPC_URL", "CHAIN_ID"];
  const v = Object.fromEntries([...names, "RELAYER_FEES"].map((k) => [k, env[k] === undefined ? "" : clean(env[k])]));
  const missing = names.filter((k) => !v[k]);
  if (missing.length) throw new RelayError(`relayer not configured (missing ${missing.join(", ")})`, 503);
  const bad = (name, why) => new RelayError(`relayer misconfigured: ${name} ${why}`, 503);

  const key = /^[0-9a-fA-F]{64}$/.test(v.RELAYER_KEY) ? "0x" + v.RELAYER_KEY : v.RELAYER_KEY;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) throw bad("RELAYER_KEY", "must be 0x followed by 64 hex characters");
  if (!/^https?:\/\//.test(v.RPC_URL)) throw bad("RPC_URL", "must start with https://");
  const chainId = Number(v.CHAIN_ID);
  if (!Number.isInteger(chainId) || chainId <= 0) throw bad("CHAIN_ID", "must be a number like 46630");
  const dep = deployedPool(env);
  if (dep.chainId !== chainId) throw bad("CHAIN_ID", `doesn't match the deployment (${dep.chainId})`);
  // "0xToken:0.1,0xOther:0.2". Also accepts a decimal comma ("0,1"), any separator
  // between address and fee (":", space, "=", a look-alike colon) and ";" between entries.
  const minFees = {};
  for (const [asset, fee] of Object.entries(dep.relayerFees || {})) minFees[ethers.getAddress(asset)] = ethers.parseEther(String(fee));
  const entry = /(0x[0-9a-fA-F]{40})[^0-9a-zA-Z]*?([0-9]+(?:[.,][0-9]+)?)(?![0-9a-fA-Fx])/g;
  for (const [, asset, fee] of v.RELAYER_FEES.matchAll(entry)) {
    try {
      minFees[ethers.getAddress(asset)] = ethers.parseEther(fee.replace(",", "."));
    } catch {
      throw bad("RELAYER_FEES", "fee must be a number, like 0xTokenAddress:0.1");
    }
  }
  if (/0x[0-9a-fA-F]{40}/.test(v.RELAYER_FEES) && ![...v.RELAYER_FEES.matchAll(entry)].length) {
    throw bad("RELAYER_FEES", "fee must be a number, like 0xTokenAddress:0.1");
  }
  if (!Object.keys(minFees).length) throw bad("RELAYER_FEES", "needs at least one 0xTokenAddress:fee");

  const provider = new ethers.JsonRpcProvider(v.RPC_URL, chainId, { staticNetwork: true });
  cached = new Relayer({ signer: new ethers.Wallet(key, provider), pool: ethers.getAddress(dep.pool), minFees });
  return cached;
}

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.setHeader("cache-control", "no-store");
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-headers", "content-type");
  res.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
  res.end(JSON.stringify(obj));
}

async function readBody(req) {
  // Vercel pre-parses JSON bodies; plain Node doesn't.
  if (req.body !== undefined) {
    if (typeof req.body === "string") {
      if (req.body.length > MAX_BODY) throw new RelayError("body too large", 413);
      try {
        return JSON.parse(req.body);
      } catch {
        throw new RelayError("body must be JSON");
      }
    }
    if (JSON.stringify(req.body).length > MAX_BODY) throw new RelayError("body too large", 413);
    return req.body;
  }
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY) throw new RelayError("body too large", 413);
    chunks.push(c);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new RelayError("body must be JSON");
  }
}

/** Wraps a handler body with CORS, method check and error mapping. */
function handler(method, fn, getRelayer = relayerFromEnv) {
  return async (req, res) => {
    if (req.method === "OPTIONS") return send(res, 204, {});
    if (req.method !== method) return send(res, 405, { error: `use ${method}` });
    try {
      const out = await fn(getRelayer(), req);
      return out ? send(res, out.status || 200, out.body) : send(res, 404, { error: "not found" });
    } catch (err) {
      if (err instanceof RelayError) return send(res, err.status, { error: err.message });
      // Shows up in Vercel's function logs. Never includes env values.
      console.error("relayer error:", err?.shortMessage || err?.message || err);
      return send(res, 500, { error: "internal error" });
    }
  };
}

function createHandlers(getRelayer = relayerFromEnv) {
  return {
    info: handler("GET", async (r) => ({ body: await r.info() }), getRelayer),
    relay: handler("POST", async (r, req) => ({ status: 202, body: await r.submitNow(await readBody(req)) }), getRelayer),
    job: handler(
      "GET",
      async (r, req) => {
        const id = req.query?.id ?? new URL(req.url, "http://x").pathname.split("/").pop();
        const job = await r.txStatus(String(id));
        return job ? { body: job } : null;
      },
      getRelayer
    ),
  };
}

module.exports = { createHandlers, relayerFromEnv, deployedPool };
