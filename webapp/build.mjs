// Builds the static web app into webapp/dist (host it on any static host).
//   node webapp/build.mjs [path/to/config.json]     default: webapp/config/robinhoodTestnet.json
// Needs `npm run build:circuit` first (copies the circuit's wasm + proving key).
import * as esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const dist = path.join(here, "dist");
const configPath = path.resolve(process.argv[2] || path.join(here, "config", "robinhoodTestnet.json"));

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
fs.copyFileSync(path.join(here, "index.html"), path.join(dist, "index.html"));

const wasm = path.join(root, "build", "transaction2_js", "transaction2.wasm");
const zkey = path.join(root, "build", "transaction2.zkey");
for (const f of [wasm, zkey]) {
  if (!fs.existsSync(f)) throw new Error(`missing ${f}: run npm run build:circuit first`);
  fs.copyFileSync(f, path.join(dist, "circuit", path.basename(f)));
}
fs.copyFileSync(configPath, path.join(dist, "config.json"));

const size = (f) => (fs.statSync(path.join(dist, f)).size / 1e6).toFixed(1) + " MB";
console.log(`Built webapp/dist with ${path.relative(root, configPath)}: app.js ${size("app.js")}, proving key ${size("circuit/transaction2.zkey")}`);
