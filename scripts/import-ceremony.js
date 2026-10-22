// Switches Vesper to the ceremony's final key.
//   node scripts/import-ceremony.js ../vesper-ceremony
// Verifies the final key (unless SKIP_VERIFY=1), copies it to build/, copies Verifier.sol to
// contracts/, and records their hashes in ceremony/final.json, which the mainnet deploy checks.
const { execFileSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const repo = path.resolve(process.argv[2] || "../vesper-ceremony");
const root = path.join(__dirname, "..");
const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
const fin = (f) => path.join(repo, "final", f);
if (!fs.existsSync(fin("transaction2_final.zkey"))) throw new Error(`no final key in ${repo}/final: finalize the ceremony first`);

if (process.env.SKIP_VERIFY !== "1") execFileSync("node", ["scripts/verify-final.mjs"], { cwd: repo, stdio: "inherit" });

// The circuit must be the one in this repo.
const r1cs = path.join(root, "build", "transaction2.r1cs");
if (sha(r1cs) !== sha(path.join(repo, "circuit", "transaction2.r1cs"))) throw new Error("ceremony circuit differs from build/transaction2.r1cs");

fs.copyFileSync(fin("transaction2_final.zkey"), path.join(root, "build", "transaction2.zkey"));
fs.copyFileSync(fin("transaction2_vkey.json"), path.join(root, "build", "transaction2_vkey.json"));
fs.copyFileSync(fin("Verifier.sol"), path.join(root, "contracts", "Verifier.sol"));
fs.mkdirSync(path.join(root, "ceremony"), { recursive: true });
const record = {
  source: "https://github.com/TomciSplinter/vesper-ceremony",
  dryRun: Boolean(process.env.DEV_PTAU),
  r1cs: sha(r1cs),
  zkey: sha(path.join(root, "build", "transaction2.zkey")),
  verifierSol: sha(path.join(root, "contracts", "Verifier.sol")),
  finalReadme: fs.readFileSync(fin("README.md"), "utf8"),
};
fs.writeFileSync(path.join(root, "ceremony", "final.json"), JSON.stringify(record, null, 2) + "\n");
console.log("Imported the ceremony key. Now: npx hardhat compile && npm test && npm run webapp:build");
