// POST /api/relay: check a prepared transaction and send it. Returns { id: txHash }.
module.exports = require("../relayer/serverless").createHandlers().relay;
