// Client side of the relayer: fetch its terms, send a prepared transaction, wait for it.
/** JSON-safe copy of prepareTransaction()'s { args, extData } (BigInt -> string). */
function serializeRelayRequest({ args, extData }, asset) {
  const s = (v) => (typeof v === "bigint" ? v.toString() : v);
  return {
    args: { ...args, publicAmount: s(args.publicAmount) },
    extData: { ...extData, extAmount: s(extData.extAmount), fee: s(extData.fee) },
    asset,
  };
}

async function call(url, opts) {
  const res = await fetch(url, opts);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`relayer: ${body.error || res.status}`);
  return body;
}

/** { relayer, pool, chainId, minFees: { asset: rawFee } } */
async function getRelayerInfo(relayerUrl) {
  return call(new URL("/info", relayerUrl));
}

/**
 * Sends a transaction built with prepareTransaction({ ..., relayer: info.relayer, fee }).
 * Resolves with the final job ({ status: "confirmed", txHash }) or throws.
 */
async function relayTransaction(relayerUrl, prepared, asset, { pollMs = 1000, timeoutMs = 300_000 } = {}) {
  const { id } = await call(new URL("/relay", relayerUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(serializeRelayRequest(prepared, asset)),
  });
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const job = await call(new URL(`/jobs/${id}`, relayerUrl));
    if (job.status === "confirmed") return { id, ...job };
    if (job.status === "failed") throw new Error(`relayer: transaction failed (${job.error || "reverted"})`);
    await new Promise((r) => setTimeout(r, pollMs));
  }
  throw new Error(`relayer: timed out waiting for job ${id}`);
}

module.exports = { getRelayerInfo, relayTransaction, serializeRelayRequest };
