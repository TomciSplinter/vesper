// GET /api/info: relayer address, pool, chain and minimum fees. See relayer/serverless.js.
module.exports = require("../relayer/serverless").createHandlers().info;
