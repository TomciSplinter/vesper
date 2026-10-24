// Opens the live site like a phone, taps Connect wallet -> MetaMask, and reports what
// WalletConnect does (console, failed requests, websockets). Run in CI where the internet is open.
import { chromium } from "playwright";
const url = process.argv[2] || "https://www.vesper.markets/";
const out = [];
const log = (m) => { out.push(m); console.log(m); };
const b = await chromium.launch();
const ctx = await b.newContext({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
p.on("console", (m) => log(`console.${m.type()}: ${m.text().slice(0, 300)}`));
p.on("pageerror", (e) => log(`pageerror: ${e.message.slice(0, 300)}`));
p.on("requestfailed", (r) => log(`requestfailed: ${r.url().slice(0, 150)} ${r.failure()?.errorText}`));
p.on("response", (r) => { if (/walletconnect|reown/.test(r.url())) log(`response ${r.status()} ${r.url().slice(0, 150)}`); });
p.on("websocket", (ws) => {
  log(`websocket open ${ws.url().slice(0, 120)}`);
  ws.on("close", () => log(`websocket closed ${ws.url().slice(0, 80)}`));
  ws.on("socketerror", (e) => log(`websocket error ${e}`));
  ws.on("framereceived", (f) => log(`ws recv ${String(f.payload).slice(0, 200)}`));
});
p.on("framenavigated", (f) => { if (f === p.mainFrame()) log(`navigated ${f.url().slice(0, 150)}`); });
await p.goto(url);
await p.click('[data-testid="unlock"]');
await p.waitForTimeout(6000);
await p.click('[data-testid="wallet-app-metamask"]').catch((e) => log("click failed " + e.message));
await p.waitForTimeout(20000);
log("sheet text: " + (await p.textContent('[data-testid="wallet-sheet"]').catch(() => "none")));
await b.close();
