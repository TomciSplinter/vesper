// Drives the web app against the LIVE testnet pool: deposit, then a relayed withdrawal.
//   TEST_WALLET_KEY=0x... RELAYER_URL=http://127.0.0.1:8787 RPC_URL=https://rpc.testnet.chain.robinhood.com \
//   node webapp/e2e/testnet-check.mjs
// TEST_WALLET_KEY needs test ETH and some of the mock token. The browser talks to a local
// JSON-RPC pass-through, so this also works where the browser has no direct internet.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const { ethers } = require("ethers");
const { initPoseidon } = require("../../src");
const { publishAssociationSet } = require("../../relayer/aspUpdate");

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..", "..");
const shots = path.join(here, "screenshots");
const base = JSON.parse(fs.readFileSync(path.join(here, "..", "config", "robinhoodTestnet.json")));
const RPC = process.env.RPC_URL || base.rpcUrl;
const PASS_PORT = 8546;
const APP_PORT = 5174;
const ASP_PORT = 8790;

function check(cond, msg) {
  if (!cond) throw new Error(`CHECK FAILED: ${msg}`);
  console.log(`  ✔ ${msg}`);
}

const provider = new ethers.JsonRpcProvider(RPC, base.chainId, { staticNetwork: true });

// Local JSON-RPC pass-through for the browser.
const pass = http.createServer((req, res) => {
  const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type", "content-type": "application/json" };
  if (req.method === "OPTIONS") return res.writeHead(204, cors).end();
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", async () => {
    const one = async (r) => {
      try {
        return { jsonrpc: "2.0", id: r.id, result: await provider.send(r.method, r.params || []) };
      } catch (err) {
        return { jsonrpc: "2.0", id: r.id, error: { code: err?.error?.code ?? -32000, message: err?.error?.message || err.shortMessage || err.message, data: err?.error?.data ?? err?.data } };
      }
    };
    const parsed = JSON.parse(body);
    const out = Array.isArray(parsed) ? await Promise.all(parsed.map(one)) : await one(parsed);
    res.writeHead(200, cors).end(JSON.stringify(out));
  });
});

function serveStatic(dir, port) {
  const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm" };
  const s = http.createServer((req, res) => {
    const p = path.join(dir, decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/$/, "/index.html"));
    if (!p.startsWith(dir) || !fs.existsSync(p)) return res.writeHead(404).end();
    res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise((r) => s.listen(port, "127.0.0.1", () => r(s)));
}

async function main() {
  fs.mkdirSync(shots, { recursive: true });
  const wallet = new ethers.Wallet(process.env.TEST_WALLET_KEY, provider);
  const token = new ethers.Contract(base.assets[0].address, ["function balanceOf(address) view returns (uint256)"], provider);
  await new Promise((r) => pass.listen(PASS_PORT, "127.0.0.1", r));

  // Local copy of /api/asp-update, signing as the pool's postman (RELAYER_KEY wallet).
  await initPoseidon();
  const postman = new ethers.Wallet(process.env.RELAYER_KEY, provider);
  const poolAsPostman = new ethers.Contract(
    base.pool,
    [
      "event NewDeposit(uint256 indexed label, address indexed depositor, address indexed asset, uint256 amount)",
        "event AssociationSetUpdated(uint256 root, uint256[] added, uint256[] removed, string uri)",
      "function aspRoot() view returns (uint256)",
      "function updateAssociationSet(uint256 root, uint256[] added, uint256[] removed, string uri)",
    ],
    postman
  );
  const asp = http.createServer(async (req, res) => {
    const cors = { "access-control-allow-origin": "*", "content-type": "application/json" };
    if (req.method === "OPTIONS") return res.writeHead(204, cors).end();
    try {
      const r = await publishAssociationSet(poolAsPostman, { fromBlock: base.deployBlock, blocklist: [] });
      console.log(`    screener: ${r.approved}/${r.total} approved${r.changed ? ", published" : ""}`);
      res.writeHead(200, cors).end(JSON.stringify(r));
    } catch (err) {
      console.log("    screener error:", err.shortMessage || err.message);
      res.writeHead(500, cors).end(JSON.stringify({ error: err.message }));
    }
  });
  await new Promise((r) => asp.listen(ASP_PORT, "127.0.0.1", r));

  const cfgPath = path.join(here, "testnet-check.config.json");
  fs.writeFileSync(cfgPath, JSON.stringify({ ...base, rpcUrl: `http://127.0.0.1:${PASS_PORT}`, relayers: [process.env.RELAYER_URL || "http://127.0.0.1:8787"], aspUpdateUrl: `http://127.0.0.1:${ASP_PORT}/asp-update` }, null, 2));
  execFileSync("node", [path.join(root, "webapp", "build.mjs"), cfgPath], { cwd: root, stdio: "inherit" });
  const app = await serveStatic(path.join(root, "webapp", "dist"), APP_PORT);

  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium" });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  page.setDefaultTimeout(300_000);
  page.on("pageerror", (err) => console.log("  [page error]", err.message));
  await page.exposeFunction("__walletRequest", async ({ method, params = [] }) => {
    switch (method) {
      case "eth_requestAccounts":
      case "eth_accounts":
        return [wallet.address];
      case "eth_chainId":
        return ethers.toBeHex(base.chainId);
      case "wallet_switchEthereumChain":
      case "wallet_addEthereumChain":
        return null;
      case "eth_signTypedData_v4": {
        const t = JSON.parse(params[1]);
        delete t.types.EIP712Domain;
        return wallet.signTypedData(t.domain, t.types, t.message);
      }
      case "personal_sign":
        return wallet.signMessage(ethers.getBytes(params[0]));
      case "eth_sendTransaction": {
        const t = params[0];
        return (await wallet.sendTransaction({ to: t.to, data: t.data, value: t.value ? BigInt(t.value) : 0n })).hash;
      }
      default:
        return provider.send(method, params);
    }
  });
  await page.addInitScript(() => {
    window.ethereum = { request: (a) => window.__walletRequest(a), on() {}, removeListener() {} };
  });
  const done = async (label) => {
    await page.waitForSelector('[data-testid="done"], [data-testid="error"]');
    const err = await page.$('[data-testid="error"]');
    if (err) throw new Error(`${label} failed in the UI: ${await err.textContent()}`);
    const link = await page.getAttribute('[data-testid="progress"] a', "href").catch(() => null);
    console.log(`    ${label}: ${link}`);
    await page.click('[data-testid="close"]');
    await page.waitForFunction(() => document.querySelector('[data-testid="refresh"]')?.textContent === "Refresh");
    return link;
  };
  const priv = async () => ethers.parseEther((await page.textContent('[data-testid="private-vTSLA"]')).trim());

  await page.goto(`http://127.0.0.1:${APP_PORT}/`);
  await page.click('[data-testid="unlock"]');
  await page.waitForFunction(() => document.querySelector('[data-testid="refresh"]')?.textContent === "Refresh");
  const start = await priv();
  check(true, `unlocked on Robinhood testnet; private balance ${ethers.formatEther(start)}`);

  await page.fill('[data-testid="amount"]', "2");
  await page.click('[data-testid="submit-deposit"]');
  await done("deposit");
  check((await priv()) === start + ethers.parseEther("2"), "deposit of 2 vTSLA shows in the private balance");
  check(!(await page.$('[data-testid="pending-vTSLA"]')), "the deposit was approved by the screener (nothing waiting)");

  const fresh = ethers.Wallet.createRandom().address;
  await page.click('[data-testid="tab-withdraw"]');
  await page.fill('[data-testid="amount"]', "1");
  await page.fill('[data-testid="to"]', fresh);
  await page.waitForFunction(() => /fee 0\.1/.test(document.querySelector('[data-testid="form-withdraw"]').textContent));
  const nonce = await provider.getTransactionCount(wallet.address);
  await page.click('[data-testid="submit-withdraw"]');
  await done("relayed withdraw");
  check((await token.balanceOf(fresh)) === ethers.parseEther("1"), "brand-new address received exactly 1 vTSLA");
  check((await provider.getTransactionCount(wallet.address)) === nonce, "user's wallet sent nothing for the withdrawal");
  await page.screenshot({ path: path.join(shots, "testnet-after.png") });

  // View key on the live chain: read-only balance must equal the owner's real balance.
  const ownerBalance = await priv();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.click('[data-testid="tab-viewkey"]');
  await page.click('[data-testid="show-viewkey"]');
  const viewKey = (await page.textContent('[data-testid="viewkey"]')).trim();
  await page.click('[data-testid="lock"]');
  await page.click("text=I have a view key");
  await page.fill('[data-testid="viewkey-input"]', viewKey);
  await page.click('[data-testid="open-viewkey"]');
  await page.waitForSelector('[data-testid="readonly-note"]');
  await page.waitForFunction(() => document.querySelector('[data-testid="refresh"]')?.textContent === "Refresh");
  check((await priv()) === ownerBalance, `view key shows the same live balance as the owner (${ethers.formatEther(ownerBalance)})`);

  await browser.close();
  app.close();
  pass.close();
  asp.close();
  console.log("\nTestnet web app check PASSED");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
