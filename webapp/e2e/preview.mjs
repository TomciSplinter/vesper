// Design preview: a local chain with several stock tokens, some private notes, a claim link
// and prices, then screenshots of every screen on a phone and a desktop.
//   node webapp/e2e/preview.mjs            (sets up the chain the first time, keeps it running)
// Screenshots go to webapp/e2e/screenshots/preview/. Stop the chain with: node webapp/e2e/preview.mjs --stop
import { spawn, execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const { ethers } = require("ethers");
const { initPoseidon, Keypair, Utxo, prepareTransaction, buildTree, scanNotes, signInTypedData, linkKeypair, encodeLinkSecret } = require("../../src");
const { Relayer } = require("../../relayer/relayer");
const { createServer } = require("../../relayer/server");
const { publishAssociationSet } = require("../../relayer/aspUpdate");

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..", "..");
const shots = path.join(here, "screenshots", "preview");
const stateFile = path.join(here, "preview-state.json");
const RPC = "http://127.0.0.1:8545";
const APP_PORT = 5180;
const RELAYER_PORT = 8798;
const ASP_PORT = 8799;
const PRICE_PORT = 8797;
const e = (n) => ethers.parseEther(String(n));
const KEYS = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
];
const STOCKS = [
  ["TSLA", "Tesla", 372.3, 12, 4.2],
  ["NVDA", "NVIDIA", 212.3, 30, 8],
  ["AAPL", "Apple", 346.3, 8, 0],
  ["SPY", "SPDR S&P 500 ETF Trust", 760.7, 3, 1.5],
  ["MSFT", "Microsoft", 524.0, 0, 0],
  ["AMZN", "Amazon", 248.2, 0, 0],
  ["META", "Meta Platforms", 644.9, 0, 0],
  ["QQQ", "Invesco QQQ", 705.4, 0, 0],
];

const provider = new ethers.JsonRpcProvider(RPC, undefined, { staticNetwork: true, cacheTimeout: -1 });
const alive = () => provider.getBlockNumber().then(() => true, () => false);

async function setup() {
  console.log("Starting a local chain…");
  const node = spawn("npx", ["hardhat", "node", "--port", "8545"], { cwd: root, stdio: "ignore", detached: true });
  node.unref();
  for (let i = 0; i < 120 && !(await alive()); i++) await new Promise((r) => setTimeout(r, 500));
  await initPoseidon();
  const [deployer, user] = KEYS.slice(0, 2).map((k) => new ethers.NonceManager(new ethers.Wallet(k, provider)));
  const userAddr = await user.getAddress();
  const art = require("../../artifacts/contracts/mocks/MockStockToken.sol/MockStockToken.json");
  const tokens = [];
  for (const [sym, name, , wallet] of STOCKS) {
    const t = await new ethers.ContractFactory(art.abi, art.bytecode, deployer).deploy(`${name} (test)`, sym);
    await t.waitForDeployment();
    if (wallet) await (await t.mint(userAddr, e(wallet + 20))).wait();
    tokens.push(await t.getAddress());
  }
  const assets = tokens.map((a, i) => `${a}:${(2000 / STOCKS[i][2]).toFixed(1)}`).join(",");
  execFileSync("npx", ["hardhat", "run", "scripts/deploy.js", "--network", "localhost"], { cwd: root, env: { ...process.env, ASSETS: assets }, stdio: "ignore" });
  const dep = JSON.parse(fs.readFileSync(path.join(root, "deployments", "localhost.json")));

  // The user's Vesper account, as the app derives it.
  const t = signInTypedData(31337);
  const kp = Keypair.fromSignature(await new ethers.Wallet(KEYS[1]).signTypedData(t.domain, t.types, t.value));
  const pool = new ethers.Contract(dep.pool, require("../../artifacts/contracts/VesperPool.sol/VesperPool.json").abi, user);
  const send = async (opts, asset) => {
    const p = await prepareTransaction({ pool, asset, chainId: 31337n, tree: await buildTree(pool, undefined, dep.deployBlock), ...opts });
    await (await pool.transact(p.args, p.extData, asset)).wait();
  };
  for (let i = 0; i < STOCKS.length; i++) {
    const amount = STOCKS[i][4];
    if (!amount) continue;
    const token = new ethers.Contract(tokens[i], art.abi, user);
    await (await token.approve(dep.pool, ethers.MaxUint256)).wait();
    console.log(`  depositing ${amount} ${STOCKS[i][0]}`);
    await send({ depositor: userAddr, outputs: [new Utxo({ amount: e(amount), keypair: kp, asset: tokens[i] })] }, tokens[i]);
  }
  // deploy.js sent from the same key in another process, so use a fresh signer (fresh nonce).
  const postman = new ethers.Contract(dep.pool, pool.interface, new ethers.Wallet(KEYS[0], provider));
  await publishAssociationSet(postman, { fromBlock: dep.deployBlock, blocklist: [] });

  // One unclaimed link worth 0.5 TSLA (+ fee), so "Your links" and the claim screen have content.
  const tsla = tokens[0];
  const note = (await scanNotes(pool, kp, { fromBlock: dep.deployBlock })).find((n) => n.asset === BigInt(tsla));
  const link = linkKeypair(kp, 0);
  const fee = e((1 / STOCKS[0][2]).toFixed(4));
  await send({ inputs: [note], outputs: [new Utxo({ amount: e(0.5) + fee, keypair: link, asset: tsla }), new Utxo({ amount: note.amount - e(0.5) - fee, keypair: kp, asset: tsla })] }, tsla);

  fs.writeFileSync(stateFile, JSON.stringify({ dep, tokens, link: encodeLinkSecret(link) }, null, 2));
  console.log("Preview chain ready.");
}

function serve(port, handler) {
  const s = http.createServer(handler);
  return new Promise((r) => s.listen(port, "127.0.0.1", () => r(s)));
}

function serveStatic(dir) {
  const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm", ".woff2": "font/woff2", ".map": "application/json" };
  return serve(APP_PORT, (req, res) => {
    const p = path.join(dir, decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/\/$/, "/index.html").replace(/^\/app$/, "/app/index.html"));
    if (!p.startsWith(dir) || !fs.existsSync(p)) return res.writeHead(404).end();
    res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" });
    fs.createReadStream(p).pipe(res);
  });
}

async function main() {
  if (process.argv.includes("--stop")) {
    try {
      execFileSync("bash", ["-c", "kill $(lsof -t -i:8545) 2>/dev/null || true"]);
    } catch {}
    fs.rmSync(stateFile, { force: true });
    return;
  }
  if (!(await alive()) || !fs.existsSync(stateFile)) await setup();
  const { dep, tokens, link } = JSON.parse(fs.readFileSync(stateFile, "utf8"));
  fs.mkdirSync(shots, { recursive: true });

  const relayerWallet = new ethers.NonceManager(new ethers.Wallet(KEYS[2], provider));
  const minFees = Object.fromEntries(tokens.map((a, i) => [a, e((1 / STOCKS[i][2]).toFixed(4))]));
  const servers = [];
  servers.push(createServer(new Relayer({ signer: relayerWallet, pool: dep.pool, minFees, sponsorExits: true })).listen(RELAYER_PORT, "127.0.0.1"));
  const postman = new ethers.Contract(dep.pool, require("../../artifacts/contracts/VesperPool.sol/VesperPool.json").abi, new ethers.Wallet(KEYS[0], provider));
  servers.push(
    await serve(ASP_PORT, async (req, res) => {
      const r = await publishAssociationSet(postman, { fromBlock: dep.deployBlock, blocklist: [] }).catch((err) => ({ error: err.message }));
      res.writeHead(200, { "access-control-allow-origin": "*", "content-type": "application/json" }).end(JSON.stringify(r));
    })
  );
  servers.push(
    await serve(PRICE_PORT, (req, res) => {
      const prices = Object.fromEntries(tokens.map((a, i) => [a, STOCKS[i][2]]));
      res.writeHead(200, { "access-control-allow-origin": "*", "content-type": "application/json" }).end(JSON.stringify({ prices }));
    })
  );

  const cfgPath = path.join(here, "preview.config.json");
  fs.writeFileSync(
    cfgPath,
    JSON.stringify({
      testnet: false,
      chainId: 31337,
      chainName: "Robinhood Chain",
      rpcUrl: RPC,
      explorer: "",
      pool: dep.pool,
      deployBlock: dep.deployBlock,
      assets: tokens.map((a, i) => ({ address: a, symbol: STOCKS[i][0], name: `${STOCKS[i][1]} (Robinhood Stock Token)` })),
      relayers: [`http://127.0.0.1:${RELAYER_PORT}`],
      aspUpdateUrl: `http://127.0.0.1:${ASP_PORT}/asp-update`,
      pricesUrl: `http://127.0.0.1:${PRICE_PORT}/prices`,
      walletConnectProjectId: "preview-only-not-a-real-project-id",
      maxRelayerFees: Object.fromEntries(tokens.map((a, i) => [a, (5 / STOCKS[i][2]).toFixed(4)])),
    })
  );
  execFileSync("node", [path.join(root, "webapp", "build.mjs"), cfgPath], { cwd: root, stdio: "ignore" });
  servers.push(await serveStatic(path.join(root, "webapp", "dist")));

  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium" });
  const wallet = new ethers.Wallet(KEYS[1], provider);
  const page = async (width, height, withWallet = true) => {
    const mobileUA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
    const p = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2, ...(width < 600 ? { userAgent: mobileUA, isMobile: true, hasTouch: true } : {}) });
    p.setDefaultTimeout(120_000);
    p.on("pageerror", (err) => console.log("  [page error]", err.message));
    if (withWallet) {
      await p.exposeFunction("__walletRequest", async ({ method, params = [] }) => {
        if (method === "eth_requestAccounts" || method === "eth_accounts") return [wallet.address];
        if (method === "eth_chainId") return "0x7a69";
        if (method.startsWith("wallet_")) return null;
        if (method === "eth_signTypedData_v4") {
          const t = JSON.parse(params[1]);
          delete t.types.EIP712Domain;
          return wallet.signTypedData(t.domain, t.types, t.message);
        }
        if (method === "eth_sendTransaction") {
          const t = params[0];
          return (await wallet.sendTransaction({ to: t.to, data: t.data, value: t.value ? BigInt(t.value) : 0n })).hash;
        }
        return provider.send(method, params);
      });
      await p.addInitScript(() => {
        window.ethereum = { request: (a) => window.__walletRequest(a), on() {}, removeListener() {} };
      });
    }
    return p;
  };
  const snap = (p, name, full = true) => p.screenshot({ path: path.join(shots, name), fullPage: full });
  const ready = (p) => p.waitForFunction(() => document.querySelector('[data-testid="refresh"]')?.textContent === "Refresh" && !/…/.test(document.querySelector(".hc-big")?.textContent || "…"));
  const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const want = (k) => !only.length || only.includes(k);

  for (const [w, h, tag] of [
    [390, 844, "m"],
    [1440, 900, "d"],
  ]) {
    if (want("welcome")) {
      const p = await page(w, h);
      await p.goto(`http://127.0.0.1:${APP_PORT}/app/`);
      await p.waitForSelector('[data-testid="unlock"]');
      await p.waitForTimeout(1900);
      await snap(p, `${tag}-01-welcome.png`);
      await p.close();
    }
    if (want("dash")) {
      const p = await page(w, h);
      await p.goto(`http://127.0.0.1:${APP_PORT}/app/`);
      await p.click('[data-testid="unlock"]');
      await p.waitForSelector('[data-testid="wallet-injected"]');
      await snap(p, `${tag}-01b-wallets.png`, false);
      await p.click('[data-testid="wallet-injected"]');
      await ready(p);
      await snap(p, `${tag}-02-dashboard.png`);
      for (const t of ["send", "link", "withdraw"]) {
        await p.click(`[data-testid="tab-${t}"]`);
        await p.waitForTimeout(600);
        if (t === "send") await p.fill('[data-testid="amount"]', "2,5");
        await snap(p, `${tag}-03-${t}.png`);
      }
      await p.click('[data-testid="account-menu"]');
      await snap(p, `${tag}-04-menu.png`, false);
      await p.keyboard.press("Escape");
      if (want("progress")) {
        await p.click('[data-testid="tab-deposit"]');
        await p.fill('[data-testid="amount"]', "1");
        await p.click('[data-testid="submit-deposit"]');
        await p.waitForSelector('[data-testid="progress"]');
        await p.waitForTimeout(800);
        await snap(p, `${tag}-05-working.png`, false);
        await p.waitForSelector('[data-testid="done"], [data-testid="error"]');
        await snap(p, `${tag}-06-done.png`, false);
        await p.click('[data-testid="close"]');
      }
      await p.close();
    }
    if (want("claim")) {
      const p = await page(w, h, false);
      await p.goto(`http://127.0.0.1:${APP_PORT}/app/#claim=${link}`);
      await p.waitForSelector('[data-testid="claim-amount"], [data-testid="claim-empty"]');
      await snap(p, `${tag}-07-claim.png`);
      await p.close();
    }
  }
  await browser.close();
  servers.forEach((s) => s.close());
  console.log(`Screenshots in ${path.relative(root, shots)}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
