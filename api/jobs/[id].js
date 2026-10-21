// GET /api/jobs/:id: status of a relayed transaction (id = tx hash), read from the chain.
module.exports = require("../../relayer/serverless").createHandlers().job;
