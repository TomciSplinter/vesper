// vesper.markets landing page. No framework, no third-party requests: everything here is
// mock data except the stock prices, which come from Vesper's own /api/prices.

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

const PRICES = { TSLA: 372.32, NVDA: 211.86, AAPL: 346.29, MSFT: 523.95, AMZN: 248.25, GOOGL: 321.69, META: 644.93, COIN: 165.98, AMD: 519.09, INTC: 87.03, MU: 881.01, SPY: 760.71, QQQ: 705.39 };
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const usd = (n) => money.format(n || 0);

// ------------------------------------------------------------ header and menu

const nav = $(".nav");
const menu = $("#menu");
const menuBtn = $(".menu-btn");
const onScroll = () => nav.classList.toggle("scrolled", scrollY > 8);
addEventListener("scroll", onScroll, { passive: true });
onScroll();

function setMenu(open) {
  nav.classList.toggle("open", open);
  menu.hidden = !open;
  menuBtn.setAttribute("aria-expanded", String(open));
  menuBtn.setAttribute("aria-label", open ? "Close menu" : "Menu");
  document.documentElement.style.overflow = open ? "hidden" : "";
}
menuBtn.addEventListener("click", () => setMenu(menu.hidden));
menu.addEventListener("click", (e) => e.target.closest("a") && setMenu(false));
addEventListener("keydown", (e) => e.key === "Escape" && !menu.hidden && setMenu(false));
matchMedia("(min-width: 960px)").addEventListener("change", (m) => m.matches && setMenu(false));

// ------------------------------------------------------------ reveal on scroll

if ("IntersectionObserver" in window && !reduced) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries)
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
  );
  $$("[data-reveal]").forEach((el) => io.observe(el));
} else {
  $$("[data-reveal]").forEach((el) => el.classList.add("in"));
}

// ------------------------------------------------------------ the horizon stage

const eye = '<svg width="12" height="12"><use href="#i-eye"/></svg>';
const star = '<svg width="10" height="10"><use href="#i-star"/></svg>';
const CARDS = [
  { pub: ["Wallet 0x7c3e…19e1", "Holds 14.2 TSLA", "$5,286.94"], priv: ["Private balance", "Only you", "•••••", "••••••"] },
  { pub: ["Transfer", "0x7c3e…19e1 → 0x55c1…eB6c", "2.5 NVDA · $529.65"], priv: ["Private transfer", "Private", "••••• → •••••", "NVDA · •••••"] },
  { pub: ["Wallet 0x91af…204b", "Holds 6 stocks", "$48,210.12"], priv: ["Private balance", "Only you", "•••••", "••••••"] },
  { pub: ["Transfer", "0x91af…204b → 0x3f02…a9d1", "1 AAPL · $346.29"], priv: ["Private transfer", "Private", "••••• → •••••", "AAPL · •••••"] },
  { pub: ["Wallet 0x2a6d…c07e", "Holds 3 META", "$1,934.79"], priv: ["Private balance", "Only you", "•••••", "••••••"] },
];
const card = ([label, title, value], chip, icon) =>
  `<div class="scard"><div class="sc-top"><span>${label}</span><span class="sc-chip">${icon}${chip}</span></div><div class="sc-title num">${title}</div><div class="sc-value num">${value}</div></div>`;
const pubHtml = CARDS.map((c) => card(c.pub, "Public", eye)).join("");
const privHtml = CARDS.map((c) => card([c.priv[0], c.priv[2], c.priv[3]], c.priv[1], star)).join("");
const [pubTrack, privTrack] = $$(".stage .track");
if (pubTrack) {
  pubTrack.innerHTML = pubHtml + pubHtml; // twice, so the loop is seamless
  privTrack.innerHTML = privHtml + privHtml;
}

// ------------------------------------------------------------ try it

const grid = $(".demo-grid");
$$(".view-switch button").forEach((b) =>
  b.addEventListener("click", () => {
    $$(".view-switch button").forEach((x) => {
      x.classList.toggle("on", x === b);
      x.setAttribute("aria-pressed", String(x === b));
    });
    grid.dataset.view = b.dataset.view;
  })
);

const demos = $$("[data-demo]").map((el) => {
  const on = $(".chips [data-v].on", el);
  return { el, amount: on ? Number(on.dataset.v) : 1 };
});

function paintDemo(d) {
  $$("[data-amt]", d.el).forEach((n) => (n.textContent = String(d.amount)));
  $$("[data-usd]", d.el).forEach((n) => (n.textContent = usd(d.amount * (PRICES[n.dataset.usd] || 0))));
}

for (const d of demos) {
  $$(".chips [data-v]", d.el).forEach((b) =>
    b.addEventListener("click", () => {
      $$(".chips [data-v]", d.el).forEach((x) => x.classList.toggle("on", x === b));
      d.amount = Number(b.dataset.v);
      paintDemo(d);
    })
  );
  $$(".chips [data-to]", d.el).forEach((b) =>
    b.addEventListener("click", () => {
      $$(".chips [data-to]", d.el).forEach((x) => x.classList.toggle("on", x === b));
      $$("[data-to-name]", d.el).forEach((n) => (n.textContent = b.dataset.to));
      $$("[data-to-addr]", d.el).forEach((n) => (n.textContent = b.dataset.addr));
    })
  );
  const hide = $("[data-hide]", d.el);
  if (hide) {
    const desc = hide.closest(".switch-row").querySelector("small");
    const onDesc = desc.textContent;
    const paint = () => {
      const relayed = hide.checked;
      desc.textContent = relayed ? onDesc : "Your wallet pays the gas and shows up on-chain next to it.";
      $$("[data-sender]", d.el).forEach((n) => (n.textContent = relayed ? "The Vesper relayer" : "Your wallet, 0x7c3e…19e1"));
      $$("[data-when-hidden]", d.el).forEach((n) => (n.hidden = !relayed));
    };
    hide.addEventListener("change", paint);
    paint();
  }
  paintDemo(d);
}

// ------------------------------------------------------------ the gift story

const story = $(".story");
if (story) {
  const typedUsd = $(".typed-usd", story);
  const set = (o) => {
    for (const [k, v] of Object.entries(o)) story.dataset[k] = v;
    if ("create" in o) typedUsd.textContent = o.create === "idle" ? usd(0) : usd(PRICES.AAPL);
  };
  const EVENTS = [
    [0, { scene: "create", create: "idle", claim: "idle", chat: "0", feed: "0" }],
    [900, { create: "typed" }],
    [2000, { create: "press" }],
    [2250, { create: "busy" }],
    [3900, { create: "made", feed: "1" }],
    [5000, { create: "share" }],
    [5600, { scene: "send", chat: "0" }],
    [6000, { chat: "1" }],
    [6700, { chat: "2" }],
    [7300, { chat: "3" }],
    [8200, { chat: "4" }],
    [9200, { scene: "claim", claim: "idle" }],
    [10500, { claim: "press" }],
    [10750, { claim: "busy" }],
    [12500, { scene: "done", feed: "2", claim: "idle" }],
  ];
  const END = 16000; // the last scene stays up a while
  const LOOP = 17500;
  // Where each step button jumps: the start of the scene, or (no motion) its finished state.
  const STARTS = reduced ? [5100, 8300, 10400, 15000] : [0, 5600, 9200, 12500];

  let t = 0; // ms into the story
  let last = null; // previous frame time
  let userPaused = reduced;
  let visible = false;
  let applied = -1; // index of the last event applied

  const applyUpTo = (ms) => {
    for (let i = applied + 1; i < EVENTS.length && EVENTS[i][0] <= ms; i++) {
      set(EVENTS[i][1]);
      applied = i;
    }
  };
  const jump = (ms) => {
    t = ms;
    applied = -1;
    applyUpTo(t);
    story.style.setProperty("--p", Math.min(t / END, 1).toFixed(4));
  };
  let ticking = false; // one animation loop at a time
  const running = () => !userPaused && visible && !document.hidden;
  const frame = (now) => {
    if (!running()) {
      last = null;
      ticking = false;
      return;
    }
    if (last !== null) t += Math.min(now - last, 100);
    last = now;
    if (t >= LOOP) jump(0);
    else {
      applyUpTo(t);
      story.style.setProperty("--p", Math.min(t / END, 1).toFixed(4));
    }
    requestAnimationFrame(frame);
  };
  const kick = () => {
    if (!running() || ticking) return;
    ticking = true;
    last = null;
    requestAnimationFrame(frame);
  };
  const paintPaused = () => {
    story.classList.toggle("paused", userPaused);
    $(".story-play", story).setAttribute("aria-label", userPaused ? "Play" : "Pause");
  };

  jump(reduced ? STARTS[0] : 0);
  paintPaused();
  $(".story-play", story).addEventListener("click", () => {
    userPaused = !userPaused;
    if (!userPaused && t >= END) jump(0);
    paintPaused();
    kick();
  });
  $$("[data-go]", story).forEach((b) =>
    b.addEventListener("click", () => {
      jump(STARTS[Number(b.dataset.go)]);
      kick();
    })
  );
  document.addEventListener("visibilitychange", kick);
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      ([e]) => {
        visible = e.isIntersecting;
        kick();
      },
      { threshold: 0.35 }
    ).observe(story);
  } else {
    visible = true;
    kick();
  }
}

// ------------------------------------------------------------ live prices

function paintPrices(live) {
  for (const li of $$(".stocks [data-sym]")) {
    const p = PRICES[li.dataset.sym];
    const el = $(".s-price", li);
    if (!p || !el) continue;
    const text = usd(p);
    if (live && el.textContent !== text) {
      el.classList.add("flash");
      setTimeout(() => el.classList.remove("flash"), 900);
    }
    el.textContent = text;
  }
  demos.forEach(paintDemo);
  if (story) {
    $$("[data-usd]", story).forEach((n) => {
      if (!n.classList.contains("typed-usd") || story.dataset.create !== "idle") n.textContent = usd(PRICES[n.dataset.usd]);
    });
  }
}

async function loadPrices() {
  try {
    const [cfg, res] = await Promise.all([fetch("/config.json").then((r) => r.json()), fetch("/api/prices")]);
    if (!res.ok) return;
    const { prices, updatedAt } = await res.json();
    const byAddr = Object.fromEntries(Object.entries(prices || {}).map(([a, p]) => [a.toLowerCase(), p]));
    let n = 0;
    for (const a of cfg.assets || []) {
      const p = byAddr[String(a.address).toLowerCase()];
      if (p > 0) {
        PRICES[a.symbol] = p;
        n++;
      }
    }
    if (!n) return;
    paintPrices(true);
    const note = $("[data-prices-note]");
    if (note) {
      const at = updatedAt ? new Date(updatedAt) : new Date();
      note.innerHTML = `<span class="live-dot"></span>Live prices · ${at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    }
  } catch {
    // Keep the indicative prices.
  }
}
paintPrices(false);
loadPrices();
setInterval(() => !document.hidden && loadPrices(), 60_000);

// "How links work" and other links straight to a question open it.
function openFromHash() {
  const el = location.hash.length > 1 ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
  if (el && el.tagName === "DETAILS") el.open = true;
}
addEventListener("hashchange", openFromHash);
openFromHash();
