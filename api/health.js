// GET /api/health: always 200, says whether the relayer is configured and, if not,
// which setting is wrong (names only, never values). Handy for checking a deploy.
const { relayerFromEnv } = require("../relayer/serverless");

module.exports = async (req, res) => {
  res.setHeader("content-type", "application/json");
  res.setHeader("cache-control", "no-store");
  res.setHeader("access-control-allow-origin", "*");
  const present = Object.fromEntries(
    ["RELAYER_KEY", "RPC_URL", "CHAIN_ID", "POOL", "RELAYER_FEES"].map((k) => [k, !!process.env[k]])
  );
  try {
    const info = await relayerFromEnv().info();
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true, ...info, settingsPresent: present }));
  } catch (err) {
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: false, error: err.message, settingsPresent: present }));
  }
};
