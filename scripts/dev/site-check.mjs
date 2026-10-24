// Checks the live site like a phone: landing page, /app/, the old claim-link redirect and the
// link preview image. Run in CI (the sandbox can't reach vesper.markets).
import { chromium } from "playwright";
const base = process.argv[2] || "https://www.vesper.markets";
const log = (m) => console.log(m);
const b = await chromium.launch();
const ctx = await b.newContext({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("pageerror " + e.message));
p.on("response", (r) => r.status() >= 400 && errs.push(`${r.status()} ${r.url()}`));
let ok = true;
const check = (cond, msg) => {
  log(`${cond ? "PASS" : "FAIL"} ${msg}`);
  if (!cond) ok = false;
};

await p.goto(base + "/");
await p.waitForTimeout(2500);
check((await p.title()).includes("Private stocks"), `landing title: ${await p.title()}`);
check((await p.locator(".stage .scard").count()) >= 10, "horizon stage has its cards");
const price = await p.locator('.stocks [data-sym="TSLA"] .s-price').textContent();
const note = await p.locator("[data-prices-note]").textContent();
check(/Live prices/.test(note), `stock prices are live (TSLA ${price}, "${note.trim()}")`);
const sw = await p.evaluate(() => document.documentElement.scrollWidth);
check(sw <= 390, `no sideways scroll (width ${sw})`);

await p.goto(base + "/#claim=vlink1test");
await p.waitForTimeout(2000);
check(p.url().includes("/app/#claim=vlink1test"), `old claim link forwards to ${p.url()}`);

for (const path of ["/app/", "/app"]) {
  await p.goto(base + path);
  const app = await p.waitForSelector('[data-testid="unlock"]', { timeout: 30000 }).then(() => true).catch(() => false);
  check(app, `${path} opens the app`);
}
const og = await ctx.request.get(base + "/og.png");
check(og.ok() && (og.headers()["content-type"] || "").includes("image/png"), `og.png served (${og.status()})`);

errs.length && log("errors seen:\n" + errs.join("\n"));
await b.close();
process.exit(ok ? 0 : 1);
