// The relayer as stateless serverless functions (used by api/ on Vercel).
// Same checks as the long-running server; the difference is that each request
// sends its transaction right away and status is read back from the chain.
//
// Environment (set in the Vercel project settings, never in the repo):
//   RELAYER_KEY    private key of the relayer wallet (pays gas, receives fees)
//   RPC_URL        e.g. https://rpc.testnet.chain.robinhood.com
//   CHAIN_ID       e.g. 46630
//   POOL           VesperPool address
//   RELAYER_FEES   "0xToken:0.1,0xOther:0.2"  minimum fee per asset, whole tokens
const { ethers } = require("ethers");
const { Relayer, RelayError } = require("./relayer");

const MAX_BODY = 16 * 1024;

let cached;
function relayerFromEnv(env = process.env) {
  if (cached) return cached;
  const missing = ["RELAYER_KEY", "RPC_URL", "CHAIN_ID", "POOL", "RELAYER_FEES"].filter((k) => !env[k]);
  if (missing.length) throw new RelayError(`relayer not configured (missing ${missing.join(", ")})`, 503);
  const provider = new ethers.JsonRpcProvider(env.RPC_URL, Number(env.CHAIN_ID), { staticNetwork: true });
  const signer = new ethers.Wallet(env.RELAYER_KEY.trim(), provider);
  const minFees = {};
  for (const entry of env.RELAYER_FEES.split(",").filter(Boolean)) {
    const [asset, fee] = entry.trim().split(":");
    minFees[asset] = ethers.parseEther(fee);
  }
  cached = new Relayer({ signer, pool: env.POOL.trim(), minFees });
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

module.exports = { createHandlers, relayerFromEnv };
