// Verifies the mainnet verifier and pool on Sourcify (API v2), which Blockscout shows as
// verified source. Run after `npx hardhat compile` (uses the build-info).
//   node scripts/sourcify-verify.js
const fs = require("fs");
const path = require("path");
const dep = require("../deployments/robinhood.json");

const API = "https://sourcify.dev/server";
const headers = { "content-type": "application/json", "user-agent": "vesper-verify/1.0 (https://github.com/TomciSplinter/vesper)" };
const dir = path.join(__dirname, "..", "artifacts", "build-info");
const infos = fs.readdirSync(dir).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
const find = (file) => infos.find((b) => b.input.sources[file]);
const log = (msg) => console.log(process.env.CI ? `::notice::${msg}` : msg);

async function verify(address, file, name) {
  const b = find(file);
  const res = await fetch(`${API}/v2/verify/${dep.chainId}/${address}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ stdJsonInput: b.input, compilerVersion: b.solcLongVersion, contractIdentifier: `${file}:${name}` }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return log(`${name}: HTTP ${res.status} ${JSON.stringify(body).slice(0, 400)}`);
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const s = await (await fetch(`${API}/v2/verify/${body.verificationId}`, { headers })).json();
    if (s.isJobCompleted) return log(`${name}: ${s.error ? "FAILED " + JSON.stringify(s.error).slice(0, 400) : "verified (" + (s.contract?.match || s.contract?.runtimeMatch) + ")"}`);
  }
  log(`${name}: still pending`);
}

(async () => {
  await verify(dep.verifier, "contracts/Verifier.sol", "Groth16Verifier");
  await verify(dep.pool, "contracts/VesperPool.sol", "VesperPool");
})();
