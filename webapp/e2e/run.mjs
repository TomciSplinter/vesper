// Browser end-to-end test of the web app against a local chain.
//   node webapp/e2e/run.mjs
// Starts a Hardhat node, deploys Vesper + a mock stock token, runs a relayer, builds
// the app for localhost, serves it, and drives it in Chromium with a test wallet
// injected as window.ethereum. Screenshots go to webapp/e2e/screenshots/.
import { spawn, execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const { ethers } = require("ethers");
const { initPoseidon, Keypair, scanNotes } = require("../../src");
const { Relayer } = require("../../relayer/relayer");
const { createServer } = require("../../relayer/server");

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..", "..");
const shots = path.join(here, "screenshots");
const RPC = "http://127.0.0.1:8545";
const APP_PORT = 5173;
const RELAYER_PORT = 8788;
const FEE = ethers.parseEther("0.5");
const e = (n) => ethers.parseEther(String(n));

// Hardhat's well-known dev accounts (public test keys, never use for real funds).
const KEYS = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // deployer
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // user (the browser wallet)
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // relayer
];

const children = [];
// Children run in their own process group so the whole tree (npx -> hardhat) is stopped.
const cleanup = () =>
  children.forEach((c) => {
    try {
      process.kill(-c.pid, "SIGTERM");
    } catch {}
  });
process.on("exit", cleanup);

function check(cond, msg) {
  if (!cond) throw new Error(`CHECK FAILED: ${msg}`);
  console.log(`  ✔ ${msg}`);
}

async function waitForRpc() {
  const p = new ethers.JsonRpcProvider(RPC);
  for (let i = 0; i < 120; i++) {
    try {
      await p.getBlockNumber();
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error("hardhat node didn't start");
}

function serveStatic(dir, port) {
  const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm", ".map": "application/json" };
  const server = http.createServer((req, res) => {
    const p = path.join(dir, decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/$/, "/index.html"));
    if (!p.startsWith(dir) || !fs.existsSync(p)) return res.writeHead(404).end();
    res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise((r) => server.listen(port, "127.0.0.1", () => r(server)));
}

async function main() {
  fs.mkdirSync(shots, { recursive: true });
  await initPoseidon();

  console.log("Starting local chain…");
  const node = spawn("npx", ["hardhat", "node", "--port", "8545"], { cwd: root, stdio: "ignore", detached: true });
  children.push(node);
  await waitForRpc();

  console.log("Deploying…");
  execFileSync("npx", ["hardhat", "run", "scripts/deploy.js", "--network", "localhost"], {
    cwd: root,
    env: { ...process.env, MOCK_TOKEN: "vTSLA:1000" },
    stdio: "ignore",
  });
  const dep = JSON.parse(fs.readFileSync(path.join(root, "deployments", "localhost.json")));

  const provider = new ethers.JsonRpcProvider(RPC);
  const [deployer, user, relayerWallet] = KEYS.map((k) => new ethers.NonceManager(new ethers.Wallet(k, provider)));
  const userAddr = await user.getAddress();
  const token = new ethers.Contract(dep.mockToken, ["function mint(address,uint256)", "function balanceOf(address) view returns (uint256)", "function setUIMultiplier(uint256)"], deployer);
  await (await token.mint(userAddr, e(500))).wait();

  console.log("Starting relayer…");
  const relayer = new Relayer({ signer: relayerWallet, pool: dep.pool, minFees: { [dep.mockToken]: FEE } });
  const relayerServer = createServer(relayer);
  await new Promise((r) => relayerServer.listen(RELAYER_PORT, "127.0.0.1", r));

  console.log("Building app for localhost…");
  const cfgPath = path.join(here, "localhost.config.json");
  fs.writeFileSync(cfgPath, JSON.stringify({
    testnet: true,
    chainId: 31337,
    chainName: "Local test chain",
    rpcUrl: RPC,
    explorer: "",
    pool: dep.pool,
    deployBlock: dep.deployBlock,
    assets: [{ address: dep.mockToken, symbol: "vTSLA", name: "vTSLA test token" }],
    relayers: [`http://127.0.0.1:${RELAYER_PORT}`],
  }, null, 2));
  execFileSync("node", [path.join(root, "webapp", "build.mjs"), cfgPath], { cwd: root, stdio: "inherit" });
  const appServer = await serveStatic(path.join(root, "webapp", "dist"), APP_PORT);

  // ------------------------------------------------------------ browser
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium" });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  page.on("pageerror", (err) => console.log("  [page error]", err.message));
  page.setDefaultTimeout(180_000);

  // Test wallet: the page's window.ethereum forwards to this Node handler.
  const userWallet = new ethers.Wallet(KEYS[1], provider);
  await page.exposeFunction("__walletRequest", async ({ method, params = [] }) => {
    switch (method) {
      case "eth_requestAccounts":
      case "eth_accounts":
        return [userAddr];
      case "eth_chainId":
        return "0x7a69";
      case "wallet_switchEthereumChain":
      case "wallet_addEthereumChain":
        return null;
      case "personal_sign":
        return userWallet.signMessage(ethers.getBytes(params[0]));
      case "eth_sendTransaction": {
        const t = params[0];
        const tx = await user.sendTransaction({ to: t.to, data: t.data, value: t.value ? BigInt(t.value) : 0n, gasLimit: t.gas ? BigInt(t.gas) : undefined });
        return tx.hash;
      }
      default:
        return provider.send(method, params);
    }
  });
  await page.addInitScript(() => {
    window.ethereum = {
      isMetaMask: true,
      request: async (args) => {
        try {
          return await window.__walletRequest(args);
        } catch (err) {
          throw Object.assign(new Error(err.message), { code: -32603 });
        }
      },
      on() {},
      removeListener() {},
    };
  });

  const done = async (label) => {
    await page.waitForSelector('[data-testid="done"], [data-testid="error"]');
    const err = await page.$('[data-testid="error"]');
    if (err) throw new Error(`${label} failed in the UI: ${await err.textContent()}`);
    await page.click('[data-testid="close"]');
    await page.waitForFunction(() => document.querySelector('[data-testid="refresh"]')?.textContent === "Refresh");
  };
  const privateBalance = async () => ethers.parseEther((await page.textContent('[data-testid="private-vTSLA"]')).trim());

  console.log("Driving the app…");
  await page.goto(`http://127.0.0.1:${APP_PORT}/`);
  await page.waitForSelector('[data-testid="unlock"]');
  await page.screenshot({ path: path.join(shots, "1-welcome.png") });
  const desktop = async (name) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(shots, name) });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
  };
  await desktop("desk-1-welcome.png");

  await page.click('[data-testid="unlock"]');
  await page.waitForFunction(() => document.querySelector('[data-testid="private-vTSLA"]')?.textContent === "0");
  check(true, "wallet connects and unlocks the Vesper account; private balance 0");

  // Deposit
  await page.fill('[data-testid="amount"]', "100");
  await page.click('[data-testid="submit-deposit"]');
  await page.waitForSelector('[data-testid="progress"]');
  await page.screenshot({ path: path.join(shots, "2-proving.png") });
  await done("deposit");
  check((await privateBalance()) === e(100), "deposit 100 → private balance 100");
  check((await token.balanceOf(userAddr)) === e(400), "wallet went from 500 to 400 vTSLA");
  await page.screenshot({ path: path.join(shots, "3-balance.png") });
  await page.click('[data-testid="tab-send"]');
  await desktop("desk-2-account.png");
  await page.click('[data-testid="tab-deposit"]');

  // Private send through the relayer
  const bob = new Keypair();
  await page.click('[data-testid="tab-send"]');
  await page.fill('[data-testid="amount"]', "30");
  await page.fill('[data-testid="to"]', bob.address());
  await page.waitForFunction(() => /fee 0\.5/.test(document.querySelector('[data-testid="form-send"]').textContent));
  await page.screenshot({ path: path.join(shots, "4-send.png") });
  const userNonce = await provider.getTransactionCount(userAddr);
  await page.click('[data-testid="submit-send"]');
  await done("send");
  const pool = new ethers.Contract(dep.pool, ["event NewCommitment(bytes32 indexed commitment, uint256 index, bytes encryptedOutput)", "function isSpent(bytes32) view returns (bool)"], provider);
  const bobNotes = await scanNotes(pool, bob, { fromBlock: dep.deployBlock });
  check(bobNotes.length === 1 && bobNotes[0].amount === e(30), "Bob's Vesper account received 30 privately");
  check((await privateBalance()) === e(100) - e(30) - FEE, "sender has 69.5 left (0.5 relayer fee)");
  check((await provider.getTransactionCount(userAddr)) === userNonce, "user's wallet sent no transaction for the private send");

  // Withdraw through the relayer to a fresh address
  const fresh = ethers.Wallet.createRandom().address;
  await page.click('[data-testid="tab-withdraw"]');
  await page.fill('[data-testid="amount"]', "20");
  await page.fill('[data-testid="to"]', fresh);
  await page.click('[data-testid="submit-withdraw"]');
  await done("withdraw");
  check((await token.balanceOf(fresh)) === e(20), "fresh address received exactly 20 vTSLA");
  check((await privateBalance()) === e(69.5) - e(20) - FEE, "private balance now 49");

  // Withdraw from own wallet (no relayer), with the self-address warning
  await page.click('[data-testid="tab-withdraw"]');
  await page.fill('[data-testid="amount"]', "5");
  await page.fill('[data-testid="to"]', userAddr);
  await page.waitForSelector(".warn");
  await page.uncheck('[data-testid="use-relayer"]');
  await page.click('[data-testid="submit-withdraw"]');
  await done("own-wallet withdraw");
  check((await token.balanceOf(userAddr)) === e(405), "withdrawal without relayer: wallet back to 405");
  check((await privateBalance()) === e(44), "private balance now 44");

  // Asking for too much shows a clear error and changes nothing
  await page.click('[data-testid="tab-withdraw"]');
  await page.fill('[data-testid="amount"]', "1000");
  await page.fill('[data-testid="to"]', fresh);
  await page.click('[data-testid="submit-withdraw"]');
  await page.waitForSelector('[data-testid="error"]');
  check(/Not enough private balance/.test(await page.textContent('[data-testid="error"]')), "overspending shows 'Not enough private balance'");
  await page.click('[data-testid="close"]');

  // Stock split shows shares
  await (await token.setUIMultiplier(e(2))).wait();
  await page.click('[data-testid="refresh"]');
  await page.waitForFunction(() => /= 88 shares/.test(document.querySelector('[data-testid="balance-vTSLA"]').textContent));
  check(true, "after a 2-for-1 split the balance shows 44 tokens = 88 shares");

  // Receive tab shows the same address the wallet derives
  await page.click('[data-testid="tab-receive"]');
  await page.screenshot({ path: path.join(shots, "6-receive.png") });
  const shown = (await page.textContent('[data-testid="vesper-address"]')).trim();
  const expected = Keypair.fromSignature(await userWallet.signMessage(require("../../src").SIGN_IN_MESSAGE)).address();
  check(shown === expected, "Receive tab shows this wallet's Vesper address");

  // View key → read-only mode
  await page.click('[data-testid="tab-viewkey"]');
  await page.click('[data-testid="show-viewkey"]');
  const viewKey = (await page.textContent('[data-testid="viewkey"]')).trim();
  check(viewKey.startsWith("vview:"), "view key can be exported");
  await page.click('[data-testid="lock"]');
  await page.click("text=I have a view key");
  await page.fill('[data-testid="viewkey-input"]', viewKey);
  await page.click('[data-testid="open-viewkey"]');
  await page.waitForSelector('[data-testid="private-vTSLA"]');
  await page.waitForFunction(() => document.querySelector('[data-testid="refresh"]')?.textContent === "Refresh");
  check((await page.$('[data-testid="tab-send"]')) === null, "view key opens read-only (no send/withdraw)");
  await page.waitForFunction(() => /= 88 shares/.test(document.querySelector('[data-testid="balance-vTSLA"]').textContent));
  check((await privateBalance()) === e(44), "view key shows the REAL private balance (44), with spent notes excluded");
  check(/read-only/.test(await page.textContent("main")), "read-only mode is labelled");
  check(!/wallet \d/.test(await page.textContent('[data-testid="balance-vTSLA"]')), "read-only mode doesn't show the connected wallet's balance");
  await page.screenshot({ path: path.join(shots, "5-viewkey.png") });

  await browser.close();
  appServer.close();
  relayerServer.close();
  console.log("\nWeb app E2E PASSED");
}

main()
  .then(() => {
    cleanup();
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    cleanup();
    process.exit(1);
  });
