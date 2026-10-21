// Minimal HTTP front for the relayer (no framework, no request logging).
//   GET  /info          relayer address, pool, chain, minimum fees
//   POST /relay         { args, extData, asset }  -> 202 { id }   (checked before accepting)
//   GET  /jobs/:id      { status: queued|sending|sent|confirmed|failed, txHash?, error? }
//
// Privacy: the relayer never logs IPs or request bodies. Users should still reach it
// over Tor or a VPN if they don't want the relayer operator to see their IP.
const http = require("http");
const { RelayError } = require("./relayer");

const MAX_BODY = 16 * 1024;

function createServer(relayer, { rateLimitPerMinute = 30 } = {}) {
  const hits = new Map(); // ip -> { count, resetAt }, in memory only, never written out

  function limited(ip) {
    const now = Date.now();
    const h = hits.get(ip);
    if (!h || h.resetAt < now) {
      hits.set(ip, { count: 1, resetAt: now + 60_000 });
      if (hits.size > 10_000) for (const [k, v] of hits) if (v.resetAt < now) hits.delete(k);
      return false;
    }
    return ++h.count > rateLimitPerMinute;
  }

  function send(res, status, obj) {
    res.writeHead(status, {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "GET, POST, OPTIONS",
    });
    res.end(JSON.stringify(obj));
  }

  function readJson(req) {
    return new Promise((resolve, reject) => {
      let size = 0;
      const chunks = [];
      req.on("data", (c) => {
        size += c.length;
        if (size > MAX_BODY) {
          reject(new RelayError("body too large", 413));
          req.destroy();
        } else chunks.push(c);
      });
      req.on("end", () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
        } catch {
          reject(new RelayError("body must be JSON"));
        }
      });
      req.on("error", reject);
    });
  }

  return http.createServer(async (req, res) => {
    try {
      if (req.method === "OPTIONS") return send(res, 204, {});
      const url = new URL(req.url, "http://relayer");

      if (req.method === "GET" && url.pathname === "/info") return send(res, 200, await relayer.info());

      if (req.method === "GET" && url.pathname.startsWith("/jobs/")) {
        const job = relayer.job(url.pathname.slice("/jobs/".length));
        return job ? send(res, 200, job) : send(res, 404, { error: "no such job" });
      }

      if (req.method === "POST" && url.pathname === "/relay") {
        if (limited(req.socket.remoteAddress)) return send(res, 429, { error: "too many requests" });
        const body = await readJson(req);
        const { id } = await relayer.submit(body);
        return send(res, 202, { id });
      }

      send(res, 404, { error: "not found" });
    } catch (err) {
      if (err instanceof RelayError) return send(res, err.status, { error: err.message });
      send(res, 500, { error: "internal error" });
    }
  });
}

module.exports = { createServer };
