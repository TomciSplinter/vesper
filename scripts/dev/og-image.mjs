// Renders webapp/site/og.png (1200x630), the picture chat apps show for a vesper.markets link.
//   node scripts/dev/og-image.mjs
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
// Inline the fonts: a page set with setContent can't load file:// fonts.
const font = (f) => "data:font/woff2;base64," + fs.readFileSync(path.join(root, "node_modules", f)).toString("base64");
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:"Instrument Sans";src:url(${font("@fontsource-variable/instrument-sans/files/instrument-sans-latin-wght-normal.woff2")}) format("woff2");font-weight:400 700}
@font-face{font-family:"Newsreader";src:url(${font("@fontsource-variable/newsreader/files/newsreader-latin-opsz-normal.woff2")}) format("woff2");font-weight:200 800}
*{box-sizing:border-box}html,body{margin:0;width:1200px;height:630px;overflow:hidden;background:#0e1119}
.c{position:relative;width:1200px;height:630px;overflow:hidden;color:#e9ebf2;font-family:"Instrument Sans",sans-serif;
  background:linear-gradient(180deg,#111725 0%,#151c2f 44%,#1b2135 74%,#241f2b 100%)}
.glow{position:absolute;inset:0;background:radial-gradient(48% 42% at 78% 76%,rgba(235,203,134,.24),rgba(235,203,134,0) 70%)}
.stars{position:absolute;inset:0 0 150px 0;background-image:
 radial-gradient(1.6px 1.6px at 8% 14%,#fff 50%,transparent),radial-gradient(1.2px 1.2px at 22% 66%,#fff 50%,transparent),
 radial-gradient(1.6px 1.6px at 46% 9%,#fff 50%,transparent),radial-gradient(1.2px 1.2px at 63% 22%,#fff 50%,transparent),
 radial-gradient(1.6px 1.6px at 95% 12%,#fff 50%,transparent),radial-gradient(1.2px 1.2px at 57% 52%,#fff 50%,transparent),
 radial-gradient(1.2px 1.2px at 36% 31%,#fff 50%,transparent),radial-gradient(1.4px 1.4px at 88% 44%,#fff 50%,transparent);opacity:.45}
.planet{position:absolute;left:935px;top:480px;width:340px;height:340px;border-radius:50%;transform:translate(-50%,-50%);
  background:radial-gradient(circle at 50% 22%,#dfe3ee 0%,#b9c0d3 40%,#7f88a2 100%);box-shadow:0 0 90px 10px rgba(185,192,211,.18)}
.sea{position:absolute;left:0;right:0;top:480px;bottom:0;background:linear-gradient(180deg,#121624,#0c0f17)}
.line{position:absolute;left:0;right:0;top:480px;height:1.5px;background:linear-gradient(90deg,rgba(233,235,242,.05),rgba(233,235,242,.7) 78%,rgba(233,235,242,.1))}
.r{position:absolute;height:3px;border-radius:3px;background:#b9c0d3;transform:translateX(-50%);left:935px}
.star{position:absolute;left:1068px;top:120px;width:38px;height:38px;color:#ebcb86;filter:drop-shadow(0 0 14px rgba(235,203,134,.9))}
.brand{position:absolute;left:72px;top:64px;display:flex;align-items:center;gap:14px;font-family:Newsreader,serif;font-size:36px;font-weight:500}
h1{position:absolute;left:72px;top:150px;width:700px;margin:0;font-family:Newsreader,serif;font-weight:300;font-size:86px;line-height:1;letter-spacing:-.025em}
p{position:absolute;left:72px;top:372px;width:600px;margin:0;font-size:26px;line-height:1.45;color:#c4c8d4}
.url{position:absolute;left:72px;bottom:44px;font-size:21px;color:#969caf;letter-spacing:.02em}
</style></head><body><div class="c">
<div class="stars"></div><div class="glow"></div><div class="planet"></div><div class="sea"></div><div class="line"></div>
<span class="r" style="top:504px;width:300px;opacity:.4"></span><span class="r" style="top:532px;width:186px;opacity:.2"></span><span class="r" style="top:558px;width:92px;opacity:.1"></span>
<svg class="star" viewBox="0 0 24 24"><path d="M12 1.8l1.9 8.3 8.3 1.9-8.3 1.9L12 22.2l-1.9-8.3L1.8 12l8.3-1.9z" fill="currentColor"/></svg>
<div class="brand"><svg width="46" height="46" viewBox="0 0 64 64"><path d="M46 8 L48 15 L55 17 L48 19 L46 26 L44 19 L37 17 L44 15 Z" fill="#ebcb86"/><path d="M13 42 A15 15 0 0 1 43 42 Z" fill="#b9c0d3"/><line x1="5" y1="42" x2="59" y2="42" stroke="#e9ebf2" stroke-width="3" stroke-linecap="round"/><line x1="15" y1="49.5" x2="49" y2="49.5" stroke="#b9c0d3" stroke-width="2.4" stroke-linecap="round" opacity=".45"/><line x1="23" y1="56.5" x2="41" y2="56.5" stroke="#b9c0d3" stroke-width="2.4" stroke-linecap="round" opacity=".2"/></svg>Vesper</div>
<h1>Private stocks on a public chain.</h1>
<p>Hold, send and gift Robinhood stock tokens without showing the chain what you own.</p>
<div class="url">vesper.markets</div>
</div></body></html>`;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
await p.setContent(html, { waitUntil: "load" });
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(300);
await p.screenshot({ path: path.join(root, "webapp", "site", "og.png") });
await b.close();
console.log("wrote webapp/site/og.png");
