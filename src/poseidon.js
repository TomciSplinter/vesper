const { buildPoseidon } = require("circomlibjs");

let instance;

/** Call once before using hash helpers. */
async function initPoseidon() {
  if (!instance) instance = await buildPoseidon();
  return instance;
}

/** Poseidon over BN254 -> BigInt. Same hash as circomlib's Poseidon(n). */
function poseidonHash(items) {
  if (!instance) throw new Error("call initPoseidon() first");
  return instance.F.toObject(instance(items.map((x) => BigInt(x))));
}

module.exports = { initPoseidon, poseidonHash };
