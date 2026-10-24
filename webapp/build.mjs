// Builds the static web app into webapp/dist (host it on any static host).
//   node webapp/build.mjs [path/to/config.json]     default: webapp/config/robinhood.json (mainnet) if present, else robinhoodTestnet.json
// Needs `npm run build:circuit` first (copies the circuit's wasm + proving key).
import * as esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const dist = path.join(here, "dist");
const defaultConfig = fs.existsSync(path.join(here, "config", "robinhood.json")) ? "robinhood.json" : "robinhoodTestnet.json";
const configPath = path.resolve(process.argv[2] || path.join(here, "config", defaultConfig));

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, "circuit"), { recursive: true });

await esbuild.build({
  entryPoints: { app: path.join(here, "app", "main.jsx") },
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["es2020"],
  minify: true,
  sourcemap: true,
  outdir: dist,
  loader: { ".js": "jsx" },
  jsx: "automatic",
  define: { global: "globalThis", "process.env.NODE_DEBUG": "false", "process.env.NODE_ENV": '"production"' },
  inject: [path.join(here, "app", "shims.js")],
  plugins: [
    {
      // The browser only needs circomlibjs' Poseidon; the full package pulls in Node-only modules.
      name: "poseidon-only",
      setup(b) {
        b.onResolve({ filter: /^circomlibjs$/ }, () => ({
          path: path.join(root, "node_modules", "circomlibjs", "src", "poseidon_wasm.js"),
        }));
      },
    },
  ],
  logLevel: "warning",
});
fs.copyFileSync(path.join(here, "app", "styles.css"), path.join(dist, "app.css"));
// Self-hosted fonts (a privacy app shouldn't make visitors' browsers call a font CDN).
fs.mkdirSync(path.join(dist, "fonts"), { recursive: true });
const fontFiles = {
  "instrument-sans.woff2": "@fontsource-variable/instrument-sans/files/instrument-sans-latin-wght-normal.woff2",
  "newsreader.woff2": "@fontsource-variable/newsreader/files/newsreader-latin-opsz-normal.woff2",
};
for (const [name, src] of Object.entries(fontFiles)) fs.copyFileSync(path.join(root, "node_modules", src), path.join(dist, "fonts", name));
fs.copyFileSync(path.join(here, "index.html"), path.join(dist, "index.html"));

// Circuit files are named after a hash of their contents, so a browser can never use a
// cached copy from an older circuit with a newer app (config.json, never cached, points
// at the current names).
const wasm = path.join(root, "build", "transaction2_js", "transaction2.wasm");
const zkey = path.join(root, "build", "transaction2.zkey");
for (const f of [wasm, zkey]) if (!fs.existsSync(f)) throw new Error(`missing ${f}: run npm run build:circuit first`);
const hash = crypto.createHash("sha256").update(fs.readFileSync(wasm)).update(fs.readFileSync(zkey)).digest("hex").slice(0, 12);
const wasmName = `circuit/transaction2-${hash}.wasm`;
const zkeyName = `circuit/transaction2-${hash}.zkey`;
fs.copyFileSync(wasm, path.join(dist, wasmName));
fs.copyFileSync(zkey, path.join(dist, zkeyName));
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
fs.writeFileSync(path.join(dist, "config.json"), JSON.stringify({ ...config, wasmUrl: wasmName, zkeyUrl: zkeyName }, null, 2) + "\n");

const size = (f) => (fs.statSync(path.join(dist, f)).size / 1e6).toFixed(1) + " MB";
console.log(`Built webapp/dist with ${path.relative(root, configPath)}: app.js ${size("app.js")}, proving key ${size(zkeyName)} (${hash})`);
