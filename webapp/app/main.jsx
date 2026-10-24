import React, { useEffect, useState, useCallback, useRef } from "react";
import { createRoot } from "react-dom/client";
import { formatUnits } from "ethers";
import { Vesper, fmt, parseAmount } from "./vesper.js";
import { toShares } from "../../src/index.js";
import { discoverInjected, connectWalletConnect, cancelWalletConnect, resetWalletConnectStorage, WALLET_APPS, isMobile } from "./wallets.js";
import * as wallets from "./wallets.js";

// ------------------------------------------------------------------ helpers

const ONE = 10n ** 18n;
const short = (s, a = 6, b = 4) => (s && s.length > a + b + 3 ? `${s.slice(0, a)}…${s.slice(-b)}` : s);
const toNum = (raw) => Number(formatUnits(raw ?? 0n, 18));
const exact = (raw) => (raw > 0n ? formatUnits(raw, 18).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1") : "0");
const usdFormat = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usd = (n) => (n > 0 && n < 0.01 ? "<$0.01" : usdFormat.format(n || 0));
const companyName = (asset) => (asset?.name || "").replace(/\s*\(.*\)\s*$/, "");
const tryAmount = (s) => {
  try {
    return parseAmount(s);
  } catch {
    return null;
  }
};

function friendly(e) {
  const m = e?.shortMessage || e?.reason || e?.message || String(e);
  if (/user rejected|denied|ACTION_REJECTED/i.test(m) || e?.code === 4001) return "You cancelled in your wallet.";
  return m.replace(/^Error: /, "");
}

// Desktop layout from 960px; phones keep one column.
function useWide() {
  const q = "(min-width: 960px)";
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setWide(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return wide;
}

// ------------------------------------------------------------------ icons and marks

const ICONS = {
  star: <path d="M12 1.8l1.9 8.3 8.3 1.9-8.3 1.9L12 22.2l-1.9-8.3L1.8 12l8.3-1.9z" fill="currentColor" stroke="none" />,
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12s3.6-6.5 9.5-6.5S21.5 12 21.5 12s-3.6 6.5-9.5 6.5S2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.7" />
    </>
  ),
  down: <path d="M12 5v14M6.5 13.5L12 19l5.5-5.5" />,
  copy: (
    <>
      <rect x="8.5" y="8.5" width="12" height="12" rx="2.5" />
      <path d="M15.5 8.5V6A2.5 2.5 0 0 0 13 3.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  chevron: <path d="M6.5 9.5l5.5 5.5 5.5-5.5" />,
  share: (
    <>
      <path d="M12 14.5V3.5M7.5 8L12 3.5 16.5 8" />
      <path d="M5 12v6.5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V12" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5M12 7.6v.1" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6L6 18" />,
  scan: (
    <>
      <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
      <path d="M8 12h8" />
    </>
  ),
  alert: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5M12 16.4v.1" />
    </>
  ),
};

function Icon({ name, size = 16, className = "" }) {
  return (
    <svg className={`icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

// A planet setting below the horizon, with the evening star above it.
function Logo({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="logo">
      <path d="M46 8 L48 15 L55 17 L48 19 L46 26 L44 19 L37 17 L44 15 Z" fill="var(--star)" />
      <path d="M13 42 A15 15 0 0 1 43 42 Z" fill="var(--planet)" />
      <line x1="5" y1="42" x2="59" y2="42" stroke="var(--text)" strokeWidth="3" strokeLinecap="round" />
      <line x1="15" y1="49.5" x2="49" y2="49.5" stroke="var(--planet)" strokeWidth="2.4" strokeLinecap="round" opacity="0.45" />
      <line x1="23" y1="56.5" x2="41" y2="56.5" stroke="var(--planet)" strokeWidth="2.4" strokeLinecap="round" opacity="0.2" />
    </svg>
  );
}

// The horizon: what's above it is public, what's below it only you can see.
function Horizon({ className = "" }) {
  return (
    <div className={`horizon ${className}`} aria-hidden="true">
      <span className="horizon-line" />
      <Icon name="star" size={16} className="horizon-star" />
      <span className="horizon-line" />
    </div>
  );
}

// A round ticker mark. Small ones show the first letter only, so they stay legible.
function Ticker({ asset, size = 40 }) {
  const full = (asset?.symbol || "?").slice(0, 4);
  const sym = size < 30 ? full[0] : full;
  const scale = sym.length > 3 ? 0.27 : sym.length > 2 ? 0.3 : sym.length > 1 ? 0.34 : 0.46;
  return (
    <span className="ticker" style={{ width: size, height: size, fontSize: Math.round(size * scale) }} aria-hidden="true">
      {sym}
    </span>
  );
}

function Badge({ kind }) {
  if (kind === "private")
    return (
      <span className="badge private">
        <Icon name="star" size={10} />
        Only you
      </span>
    );
  return (
    <span className="badge public">
      <Icon name="eye" size={13} />
      Public
    </span>
  );
}

function Copy({ text, label = "Copy", className = "btn ghost small" }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {}
      }}
    >
      <Icon name={done ? "check" : "copy"} size={15} />
      {done ? "Copied" : label}
    </button>
  );
}

// ------------------------------------------------------------------ header

function Header({ vesper, unlocked, onLock }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const off = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", off);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", off);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <a className="brand" href="/app/" aria-label="Vesper app home">
          <Logo />
          <span>Vesper</span>
        </a>
        <div className="top-right">
          <span className={`chain${unlocked ? " when-wide" : ""}`}>
            <span className="chain-dot" />
            {vesper.config.chainName}
          </span>
          {unlocked && (
            <div className="acct" ref={ref}>
              <button className="acct-btn" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu" data-testid="account-menu">
                {vesper.viewOnly ? "Read-only" : short(vesper.account)}
                <Icon name="chevron" size={14} />
              </button>
              {open && (
                <div className="menu" role="menu">
                  <div className="menu-head">
                    <span className="chain">
                      <span className="chain-dot" />
                      {vesper.config.chainName}
                    </span>
                    {!vesper.viewOnly && <code className="mono menu-addr">{vesper.account}</code>}
                  </div>
                  {!vesper.viewOnly && <Copy text={vesper.account} label="Copy wallet address" className="menu-item" />}
                  <button
                    className="menu-item"
                    role="menuitem"
                    data-testid="lock"
                    onClick={() => {
                      setOpen(false);
                      onLock();
                    }}
                  >
                    <Icon name="lock" size={15} />
                    {vesper.viewOnly ? "Close the view key" : "Lock Vesper"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

// ------------------------------------------------------------------ welcome

function HorizonDemo({ symbol = "TSLA" }) {
  return (
    <figure className="demo" aria-label="What's public and what's private with Vesper">
      <div className="demo-above">
        <figcaption className="demo-cap">
          <Icon name="eye" size={14} />
          What anyone on the chain sees
        </figcaption>
        <ul>
          <li>
            <span className="who">0x7099…79C8</span> put 5 {symbol} into Vesper
          </li>
          <li>
            Vesper paid 2 {symbol} to <span className="who">0x55c1…eB6c</span>
          </li>
        </ul>
      </div>
      <Horizon className="demo-horizon" />
      <div className="demo-below">
        <p className="demo-cap">
          <Icon name="star" size={11} />
          What only you see
        </p>
        <ul>
          <li>You hold 3 {symbol}</li>
          <li>You paid Ana 1 {symbol}</li>
          <li>The 2 {symbol} paid out was your own withdrawal</li>
        </ul>
      </div>
    </figure>
  );
}

function Welcome({ vesper, onUnlocked, onError, chooseWallet }) {
  const [busy, setBusy] = useState(false);
  const [viewKey, setViewKey] = useState("");
  const [showView, setShowView] = useState(false);

  async function unlock() {
    let provider;
    try {
      provider = await chooseWallet();
    } catch {
      return; // closed the picker
    }
    setBusy(true);
    try {
      await vesper.unlock(provider);
      onUnlocked();
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="welcome">
      <div className="welcome-copy">
        <h1>Hold stocks privately.</h1>
        <p className="lead">
          Keep your Robinhood stock tokens in a balance only you can see. Send them to anyone or move them out, and the chain never shows what you hold.
        </p>
        <button className="btn primary block" onClick={unlock} disabled={busy} data-testid="unlock">
          {busy ? "Check your wallet…" : "Connect wallet"}
        </button>
        <p className="hint">You'll sign one free message. That signature becomes your private Vesper account, and the same wallet always opens the same account.</p>
        <button className="btn-text" onClick={() => setShowView(!showView)} aria-expanded={showView}>
          I have a view key
        </button>
        {showView && (
          <div className="viewkey-open">
            <label className="field">
              <span>View key</span>
              <input value={viewKey} onChange={(e) => setViewKey(e.target.value)} placeholder="vview:…" data-testid="viewkey-input" spellCheck={false} />
            </label>
            <button
              className="btn ghost block"
              data-testid="open-viewkey"
              onClick={() => {
                try {
                  vesper.openViewKey(viewKey);
                  onUnlocked();
                } catch (e) {
                  onError(e);
                }
              }}
            >
              Open read-only
            </button>
          </div>
        )}
      </div>
      <HorizonDemo symbol={vesper.assets[0]?.symbol} />
    </div>
  );
}

// ------------------------------------------------------------------ portfolio

function priceTotals(data, prices, key) {
  const rows = data?.byAsset || [];
  if (!prices || !rows.length || rows.some((r) => prices[r.asset.address] == null)) return null;
  return rows.reduce((s, r) => s + toNum(r[key] ?? 0n) * prices[r.asset.address], 0);
}

function tokenSummary(rows, key) {
  const held = rows.filter((r) => (r[key] ?? 0n) > 0n);
  if (!held.length) return { main: "0", unit: rows.length === 1 ? rows[0].asset.symbol : "" };
  if (held.length === 1) return { main: fmt(held[0][key]), unit: held[0].asset.symbol };
  return { main: `${held.length}`, unit: "stocks" };
}

function HorizonCard({ vesper, data, prices }) {
  const rows = data?.byAsset || [];
  const privateUsd = priceTotals(data, prices, "total");
  const walletUsd = vesper.viewOnly ? null : priceTotals(data, prices, "walletBalance");
  const held = rows.filter((r) => r.total > 0n);
  const priv = tokenSummary(rows, "total");
  const wal = tokenSummary(rows, "walletBalance");

  let detail = null;
  if (data) {
    if (!held.length) detail = vesper.viewOnly ? "Nothing in this account yet." : "Nothing here yet. Add stock from your wallet to start.";
    else if (privateUsd !== null) {
      const parts = held.slice(0, 3).map((r) => `${fmt(r.total)} ${r.asset.symbol}`);
      detail = parts.join(", ") + (held.length > 3 ? ` and ${held.length - 3} more` : "");
    } else if (held.length > 1) detail = held.map((r) => `${fmt(r.total)} ${r.asset.symbol}`).join(", ");
  }

  return (
    <section className="horizon-card" aria-label="Your balances">
      <div className="hc-above">
        <div className="hc-head">
          <span>{vesper.viewOnly ? "View key" : "Your wallet"}</span>
          {!vesper.viewOnly && <Badge kind="public" />}
        </div>
        {vesper.viewOnly ? (
          <p className="hc-note" data-testid="readonly-note">
            This is a read-only view. It shows this account's private balance and history, but nothing can be moved from here.
          </p>
        ) : (
          <div className="hc-wallet">
            <span className="hc-wallet-value">{!data ? "…" : walletUsd !== null ? usd(walletUsd) : `${wal.main} ${wal.unit}`.trim()}</span>
            <span className="hc-wallet-addr">{short(vesper.account)}</span>
          </div>
        )}
      </div>
      <Horizon />
      <div className="hc-below">
        <div className="hc-head">
          <span>Private balance</span>
          <Badge kind="private" />
        </div>
        <div className="hc-big" aria-live="polite">
          {!data ? (
            <span className="skeleton" />
          ) : privateUsd !== null ? (
            usd(privateUsd)
          ) : (
            <>
              {priv.main}
              {priv.unit && <span className="hc-unit">{priv.unit}</span>}
            </>
          )}
        </div>
        {detail && <p className="hc-detail">{detail}</p>}
      </div>
    </section>
  );
}

function HoldingRow({ row, price }) {
  const { asset, total, pending, expiring, expiringBy, uiMultiplier, walletBalance } = row;
  const split = uiMultiplier !== ONE;
  return (
    <li className="holding" data-testid={`balance-${asset.symbol}`}>
      <Ticker asset={asset} />
      <div className="holding-body">
        <div className="holding-top">
          <span className="holding-sym">{asset.symbol}</span>
          <span className="holding-amt num" data-testid={`private-${asset.symbol}`}>
            {fmt(total)}
          </span>
        </div>
        <div className="holding-sub">
          <span>{companyName(asset)}</span>
          {price != null && <span className="num">{usd(toNum(total) * price)}</span>}
        </div>
        {split && <div className="holding-note">= {fmt(toShares(total, uiMultiplier))} shares</div>}
        {pending > 0n && (
          <div className="holding-note warn" data-testid={`pending-${asset.symbol}`}>
            {fmt(pending)} waiting for approval
          </div>
        )}
        {expiring > 0n && (
          <div className="holding-note warn" data-testid={`expiring-${asset.symbol}`}>
            {fmt(expiring)} was removed from the approved list: withdraw it privately by {new Date(expiringBy).toLocaleDateString()}
          </div>
        )}
        {walletBalance !== null && walletBalance > 0n && <div className="holding-note">In your wallet: {fmt(walletBalance)}</div>}
      </div>
    </li>
  );
}

function Holdings({ data, prices, onRefresh, refreshing }) {
  const [showAll, setShowAll] = useState(false);
  const rows = data?.byAsset || [];
  const active = rows.filter((r) => r.total > 0n || r.pending > 0n || r.expiring > 0n || (r.walletBalance ?? 0n) > 0n);
  const shown = showAll || !active.length ? rows : active;
  return (
    <section className="panel holdings">
      <div className="panel-head">
        <h2>Holdings</h2>
        <button className="btn-text" onClick={onRefresh} disabled={refreshing} data-testid="refresh">
          {refreshing ? "Scanning…" : "Refresh"}
        </button>
      </div>
      {!data && <p className="muted">Scanning the pool for your private notes…</p>}
      {data && (
        <ul className="holding-list">
          {shown.map((r) => (
            <HoldingRow key={r.asset.address} row={r} price={prices?.[r.asset.address]} />
          ))}
        </ul>
      )}
      {data && shown.length < rows.length && (
        <button className="btn-text more" onClick={() => setShowAll(true)}>
          Show all {rows.length} stocks
        </button>
      )}
    </section>
  );
}

function Account({ vesper }) {
  const [showKey, setShowKey] = useState(false);
  const addr = vesper.keypair.address();
  const key = vesper.keypair.exportViewKey();
  return (
    <section className="panel account">
      <div className="panel-head">
        <h2>Receive privately</h2>
      </div>
      <p className="muted">Share your Vesper address to get paid inside the pool. It doesn't reveal your wallet.</p>
      <div className="code-box">
        <code className="mono" data-testid="vesper-address">
          {addr}
        </code>
      </div>
      <Copy text={addr} label="Copy address" />

      <div className="panel-rule" />
      <div className="panel-head">
        <h2>View key</h2>
      </div>
      <p className="muted">Give this to an accountant or auditor. They see your private balance and history but can't move anything, so only share it with people you trust.</p>
      {showKey ? (
        <>
          <div className="code-box">
            <code className="mono" data-testid="viewkey">
              {key}
            </code>
          </div>
          <Copy text={key} label="Copy view key" />
        </>
      ) : (
        <button className="btn ghost" onClick={() => setShowKey(true)} data-testid="show-viewkey">
          <Icon name="eye" size={15} />
          Show view key
        </button>
      )}
    </section>
  );
}

// ------------------------------------------------------------------ actions

// A native select (so phones show their own picker), drawn as a pill.
function AssetPicker({ vesper, value, onChange }) {
  const a = vesper.asset(value);
  return (
    <label className="asset-pick">
      <Ticker asset={a} size={24} />
      <span className="asset-sym">{a?.symbol}</span>
      <Icon name="chevron" size={14} />
      <select value={value} onChange={(e) => onChange(e.target.value)} data-testid="asset" aria-label="Stock">
        {vesper.assets.map((x) => (
          <option key={x.address} value={x.address}>
            {companyName(x) ? `${companyName(x)} (${x.symbol})` : x.symbol}
          </option>
        ))}
      </select>
    </label>
  );
}

function Rows({ items }) {
  return (
    <dl className="rows">
      {items.filter(Boolean).map(([k, v]) => (
        <div className="row-kv" key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

// What a block explorer will show about this action.
function Explorer({ items }) {
  return (
    <div className="explorer">
      <p className="explorer-cap">
        <Icon name="eye" size={14} />
        On the explorer
      </p>
      <dl className="rows">
        {items.map(([k, v, seen]) => (
          <div className="row-kv" key={k}>
            <dt>{k}</dt>
            <dd className={seen ? "seen" : "hidden"}>
              {!seen && <Icon name="lock" size={13} />}
              {v}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Switch({ checked, onChange, title, desc }) {
  return (
    <label className="switch-row">
      <span className="switch-text">
        <span className="switch-title">{title}</span>
        <span className="switch-desc">{desc}</span>
      </span>
      <input type="checkbox" role="switch" className="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} data-testid="use-relayer" />
    </label>
  );
}

function useRelayerFee(vesper, asset, on) {
  const [fee, setFee] = useState(null);
  useEffect(() => {
    let live = true;
    if (!on) return setFee(null);
    vesper
      .relayerFee(asset)
      .then((r) => live && setFee(r ? r.fee : null))
      .catch(() => live && setFee(null));
    return () => {
      live = false;
    };
  }, [asset, on]);
  return fee;
}

function firstHeld(vesper, data, key) {
  const r = data?.byAsset.find((b) => (b[key] ?? 0n) > 0n);
  return r ? r.asset.address : vesper.assets[0]?.address;
}

const COPY = {
  deposit: { title: "Add privately", lead: "Move stock from your wallet into your private balance.", well: "You add", cta: "Add privately" },
  send: { title: "Send privately", lead: "Pay any Vesper address. Nobody else can see who paid whom, or how much.", well: "You send", cta: "Send privately" },
  withdraw: { title: "Withdraw", lead: "Move stock out to any wallet. A brand-new address keeps it unlinked from you.", well: "You withdraw", cta: "Withdraw" },
};

function MoveForm({ vesper, kind, data, prices, run }) {
  const [asset, setAsset] = useState(() => firstHeld(vesper, data, kind === "deposit" ? "walletBalance" : "total"));
  const [amount, setAmount] = useState("");
  const [to, setTo] = useState("");
  const [useRelayer, setUseRelayer] = useState(kind !== "deposit" && !!vesper.config.relayers?.length);
  const [limit, setLimit] = useState(null);
  const fee = useRelayerFee(vesper, asset, kind !== "deposit" && useRelayer);
  const symbol = vesper.asset(asset)?.symbol;
  const row = data?.byAsset.find((b) => b.asset.address === asset);
  const price = prices?.[asset];
  const amt = tryAmount(amount);
  const copy = COPY[kind];

  useEffect(() => {
    if (kind !== "deposit") return;
    let live = true;
    vesper.pool
      .assetConfig(asset)
      .then(([, max]) => live && setLimit(max))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [asset, kind]);

  const feeNow = kind !== "deposit" && useRelayer ? fee ?? 0n : 0n;
  const available = !row ? null : kind === "deposit" ? row.walletBalance : kind === "send" && !useRelayer ? row.total : row.approved;
  const availLabel = kind === "deposit" ? "Wallet" : kind === "send" && !useRelayer ? "Private" : "Available";
  const max = available === null || available === undefined ? null : available > feeNow ? available - feeNow : 0n;

  const submit = () =>
    run(async (onStep) => {
      const a = parseAmount(amount);
      if (kind === "deposit") return vesper.deposit(asset, a, onStep);
      if (kind === "send") return vesper.send(asset, a, to.trim(), { useRelayer }, onStep);
      return vesper.withdraw(asset, a, to.trim(), { useRelayer }, onStep);
    });

  const amountText = (x) => (x ? `${fmt(x)} ${symbol}` : "–");
  const relayerFeeRow = useRelayer ? ["Relayer fee", fee === null ? "–" : `${fmt(fee)} ${symbol}`] : ["Network fee", "A few cents, paid in ETH"];
  const rows = {
    deposit: [
      ["Network fee", "A few cents, paid in ETH"],
      ["Deposit limit", limit ? `${fmt(limit)} ${symbol} at a time` : "–"],
    ],
    send: [relayerFeeRow, ["They receive", amountText(amt)]],
    withdraw: [relayerFeeRow, ["Arrives", amountText(amt)]],
  }[kind];
  const explorer = {
    deposit: [
      ["Your wallet and the amount", "Visible", true],
      ["Your private balance", "Hidden", false],
    ],
    send: useRelayer
      ? [
          ["Sent by", "The Vesper relayer", true],
          ["Your wallet", "Never shows", false],
          ["Amount and recipient", "Hidden", false],
        ]
      : [
          ["Sent by", "Your wallet", true],
          ["Amount and recipient", "Hidden", false],
        ],
    withdraw: useRelayer
      ? [
          ["Paid out by", "The Vesper relayer", true],
          ["Your wallet", "Never shows", false],
          ["Receiving address and amount", "Visible", true],
        ]
      : [
          ["Paid out by", "Your wallet", true],
          ["Receiving address and amount", "Visible", true],
        ],
  }[kind];

  return (
    <div className="form" data-testid={`form-${kind}`}>
      <div className="form-head">
        <h2>{copy.title}</h2>
        <p>{copy.lead}</p>
      </div>

      <div className="well">
        <div className="well-top">
          <span>{copy.well}</span>
          {available !== null && available !== undefined && (
            <span className="well-avail">
              {availLabel} <span className="num">{fmt(available)}</span>
              {max > 0n && (
                <button className="max" onClick={() => setAmount(exact(max))}>
                  Max
                </button>
              )}
            </span>
          )}
        </div>
        <div className="well-main">
          <input
            className="amount-input num"
            inputMode="decimal"
            autoComplete="off"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            data-testid="amount"
            aria-label={`Amount of ${symbol}`}
          />
          <AssetPicker vesper={vesper} value={asset} onChange={setAsset} />
        </div>
        {price != null && <div className="well-foot num">{usd(amt ? toNum(amt) * price : 0)}</div>}
      </div>

      {kind === "deposit" && (
        <>
          <div className="connector" aria-hidden="true">
            <Icon name="down" size={14} />
          </div>
          <div className="well soft">
            <div className="well-top">
              <span>Into your private balance</span>
              <Badge kind="private" />
            </div>
            <div className="well-echo num">
              {amt ? fmt(amt) : "0"} <span>{symbol}</span>
            </div>
          </div>
        </>
      )}

      {kind === "send" && (
        <label className="field">
          <span>To</span>
          <textarea rows={3} value={to} onChange={(e) => setTo(e.target.value)} placeholder="Their Vesper address, from their Receive privately section" data-testid="to" spellCheck={false} />
          <small>The person you pay can see which public wallet first deposited this money, and how much it deposited. Nobody else can.</small>
        </label>
      )}
      {kind === "withdraw" && (
        <label className="field">
          <span>To wallet address</span>
          <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="0x…" data-testid="to" spellCheck={false} autoComplete="off" />
          {vesper.account && to && to.trim().toLowerCase() === vesper.account.toLowerCase() && (
            <small className="warn">This is your connected wallet. Anyone watching can link it to this withdrawal.</small>
          )}
        </label>
      )}

      {kind !== "deposit" && (
        <Switch
          checked={useRelayer}
          onChange={setUseRelayer}
          title="Hide my wallet"
          desc={useRelayer ? "The Vesper relayer sends it for a small fee, so your wallet never appears." : "Your wallet pays the gas and appears on-chain next to this transaction."}
        />
      )}

      <Rows items={rows} />
      <Explorer items={explorer} />

      <button className="btn primary block" onClick={submit} data-testid={`submit-${kind}`}>
        {copy.cta}
      </button>
      {kind === "deposit" && <p className="form-note">Deposits come from your wallet, so they're public. What you do afterwards is private.</p>}

      {kind === "withdraw" && row && row.pending > 0n && (
        <div className="exit-box">
          <p>
            {fmt(row.pending)} {symbol} is waiting for approval, so it can't be withdrawn privately yet. You can wait, or return it to the wallet that made the original
            deposit. If this money was sent to you, that's the sender's wallet, not yours. Returning is public.
          </p>
          <button className="btn ghost block" onClick={() => run((s) => vesper.returnToDepositor(asset, s))} data-testid="return-to-depositor">
            Return to depositing wallet
          </button>
        </div>
      )}
      {kind !== "deposit" && row && row.notes.length > 2 && (
        <p className="form-note">
          Your {symbol} is split into {row.notes.length} notes.{" "}
          <button className="inline-link" onClick={() => run((s) => vesper.combine(asset, { useRelayer }, s))} data-testid="combine">
            Combine them
          </button>{" "}
          if a payment says it's split across too many.
        </p>
      )}
    </div>
  );
}

function LinkForm({ vesper, data, prices, run }) {
  const [asset, setAsset] = useState(() => firstHeld(vesper, data, "approved"));
  const [amount, setAmount] = useState("");
  const [created, setCreated] = useState(null);
  const [links, setLinks] = useState(null);
  const fee = useRelayerFee(vesper, asset, true);
  const symbol = vesper.asset(asset)?.symbol;
  const row = data?.byAsset.find((b) => b.asset.address === asset);
  const price = prices?.[asset];
  const amt = tryAmount(amount);
  const cost = fee === null ? null : 2n * fee;
  const max = row && cost !== null && row.approved > cost ? row.approved - cost : 0n;

  const loadLinks = useCallback(() => {
    vesper
      .myLinks()
      .then(setLinks)
      .catch(() => setLinks([]));
  }, [vesper]);
  useEffect(loadLinks, [loadLinks, data]);

  const create = () =>
    run(async (onStep) => {
      const r = await vesper.createLink(asset, parseAmount(amount), { useRelayer: true }, onStep);
      setCreated(r);
      setAmount("");
      return r.txHash;
    });

  const share = async (url) => {
    try {
      if (navigator.share) await navigator.share({ title: "Vesper", text: "Here's some stock for you. Open the link to claim it.", url });
    } catch {}
  };

  return (
    <div className="form" data-testid="form-link">
      <div className="form-head">
        <h2>Send as a link</h2>
        <p>Turn stock into a link that works like cash. Whoever opens it can claim it, even without a Vesper account or any ETH.</p>
      </div>

      <div className="well">
        <div className="well-top">
          <span>They get</span>
          {row && (
            <span className="well-avail">
              Available <span className="num">{fmt(row.approved)}</span>
              {max > 0n && (
                <button className="max" onClick={() => setAmount(exact(max))}>
                  Max
                </button>
              )}
            </span>
          )}
        </div>
        <div className="well-main">
          <input className="amount-input num" inputMode="decimal" autoComplete="off" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" data-testid="link-amount" aria-label={`Amount of ${symbol}`} />
          <AssetPicker vesper={vesper} value={asset} onChange={setAsset} />
        </div>
        {price != null && <div className="well-foot num">{usd(amt ? toNum(amt) * price : 0)}</div>}
      </div>

      <Rows
        items={[
          ["Fee to create it", fee === null ? "–" : `${fmt(fee)} ${symbol}`],
          ["Their claim fee, paid by you", fee === null ? "–" : `${fmt(fee)} ${symbol}`],
          ["Taken from your balance", amt && cost !== null ? `${fmt(amt + cost)} ${symbol}` : "–"],
        ]}
      />
      <Explorer
        items={[
          ["Amount and who claims it", "Hidden", false],
          ["Who can claim it", "Anyone holding the link", true],
        ]}
      />

      <button className="btn primary block" onClick={create} data-testid="submit-link">
        Create link
      </button>

      {created && (
        <div className="created" data-testid="link-created">
          <p>
            <strong>
              Your link for {fmt(created.amount)} {vesper.asset(created.asset)?.symbol}.
            </strong>{" "}
            Anyone who has it can claim it, so send it privately, like cash in an envelope.
          </p>
          <div className="code-box">
            <code className="mono" data-testid="link-url">
              {created.url}
            </code>
          </div>
          <div className="btn-row">
            <Copy text={created.url} label="Copy link" />
            {typeof navigator !== "undefined" && navigator.share && (
              <button className="btn ghost small" onClick={() => share(created.url)}>
                <Icon name="share" size={15} />
                Share
              </button>
            )}
          </div>
        </div>
      )}

      {links && links.length > 0 && (
        <div className="links">
          <h3>Your links</h3>
          <ul>
            {links.map((l) => (
              <li className="link-row" key={l.index} data-testid={`link-${l.index}`}>
                <div>
                  <div className="link-title">{l.claimed ? "Claimed" : `${fmt(l.receive)} ${l.asset?.symbol || ""}`}</div>
                  <div className="link-sub">Link {l.index + 1}</div>
                </div>
                {!l.claimed && l.asset && (
                  <div className="btn-row">
                    <Copy text={l.url} label="Copy" />
                    <button className="btn ghost small" data-testid={`reclaim-${l.index}`} onClick={() => run((st) => vesper.claimLink(l.keypair, l.asset.address, "private", st))}>
                      Take back
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const TABS = [
  ["deposit", "Add"],
  ["send", "Send"],
  ["link", "Link"],
  ["withdraw", "Withdraw"],
];

function Actions({ vesper, data, prices, run, tab, setTab }) {
  return (
    <section className="panel actions">
      <div className="segmented" role="tablist" aria-label="What do you want to do">
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)} data-testid={`tab-${k}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === "link" ? (
        <LinkForm vesper={vesper} data={data} prices={prices} run={run} />
      ) : (
        <MoveForm key={tab} vesper={vesper} kind={tab} data={data} prices={prices} run={run} />
      )}
    </section>
  );
}

// ------------------------------------------------------------------ claim links

function ClaimScreen({ vesper, secret, unlocked, onUnlock, run, onClose, chooseWallet }) {
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState(null);
  const [to, setTo] = useState("");

  useEffect(() => {
    vesper
      .openLink(secret)
      .then(setInfo)
      .catch((e) => setErr(friendly(e)));
  }, [secret]);

  const item = info?.items?.[0];
  const claimPrivate = async () => {
    let provider = null;
    if (!unlocked) {
      try {
        provider = await chooseWallet();
      } catch {
        return;
      }
    }
    run(async (step) => {
      if (provider) {
        step("Sign in with your wallet…");
        await vesper.unlock(provider);
        onUnlock();
      }
      return vesper.claimLink(info.keypair, item.asset.address, "private", step);
    }, onClose);
  };
  const claimTo = () => run((step) => vesper.claimLink(info.keypair, item.asset.address, to.trim(), step), onClose);

  return (
    <section className="claim" data-testid="claim-screen">
      <Logo size={44} />
      <h1 className="claim-title">You've been sent stock</h1>
      {err && (
        <p className="error" data-testid="claim-error">
          {err}
        </p>
      )}
      {!info && !err && <p className="muted">Opening the link…</p>}
      {info && !item && (
        <p className="muted" data-testid="claim-empty">
          This link has already been claimed.
        </p>
      )}
      {item && (
        <>
          <div className="claim-amount num" data-testid="claim-amount">
            {fmt(item.receive)} <span>{item.asset.symbol}</span>
          </div>
          <p className="claim-sub">{companyName(item.asset)}. Claiming is free for you: the relayer pays the gas.</p>
          <Horizon className="claim-horizon" />
          <button className="btn primary block" onClick={claimPrivate} data-testid="claim-private">
            Claim to my private Vesper balance
          </button>
          <p className="hint">Connect any wallet and sign one free message. Nobody will see it arrive.</p>
          <div className="or">
            <span>or</span>
          </div>
          <label className="field">
            <span>Send it to a wallet address</span>
            <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="0x…" data-testid="claim-to" spellCheck={false} autoComplete="off" />
          </label>
          <button className="btn ghost block" onClick={claimTo} data-testid="claim-address">
            Send to this address
          </button>
        </>
      )}
      <button className="btn-text" onClick={onClose}>
        Not now
      </button>
    </section>
  );
}


// ------------------------------------------------------------------ wallet picker

function WalletSheet({ vesper, onPick, onClose }) {
  const [injected, setInjected] = useState(null);
  const [chosen, setChosen] = useState(null); // a WALLET_APPS entry, "other" or "qr"
  const [uri, setUri] = useState(null);
  const [qr, setQr] = useState(null);
  const [err, setErr] = useState(null);
  const pending = useRef(null);
  const mobile = isMobile();
  const wc = !!vesper.config.walletConnectProjectId;
  const waiting = chosen ? (typeof chosen === "object" ? chosen.name : chosen) : null;

  // Start the WalletConnect pairing early, so tapping a wallet can open it straight away
  // (phones only open another app from a tap, not after a delay).
  const attempt = useRef(0);
  const begin = () => {
    if (pending.current) return;
    setErr(null);
    const run = ++attempt.current;
    let slow;
    const stuck = new Promise((_, no) => {
      slow = setTimeout(() => no(Object.assign(new Error("stuck"), { stuck: true })), 15000);
    });
    const go = connectWalletConnect(vesper.config, (u) => {
      clearTimeout(slow);
      if (run !== attempt.current) return;
      setErr(null);
      setUri(u);
    });
    pending.current = go;
    // A hang before the pairing link appears: clear old saved sessions and try once more by itself.
    Promise.race([go.then((p) => ({ p })), stuck.catch((e) => (wallets.wcStage === "waiting for wallet" ? new Promise(() => {}) : Promise.reject(e)))])
      .then(({ p }) => {
        clearTimeout(slow);
        if (run === attempt.current) onPick(p);
      })
      .catch(async (e) => {
        clearTimeout(slow);
        if (run !== attempt.current) return;
        pending.current = null;
        setUri(null);
        const stage = wallets.wcStage;
        await cancelWalletConnect();
        await resetWalletConnectStorage();
        if (run === 1) return begin(); // first failure: retry once with a clean slate
        setChosen(null);
        const why = e.stuck ? `WalletConnect didn't answer (stopped at: ${stage}).` : friendly(e);
        setErr(`${why} Try again, or try a different network (Wi-Fi vs mobile data).`);
      });
  };

  useEffect(() => {
    discoverInjected().then(setInjected);
    if (wc && mobile) begin();
  }, []);

  useEffect(() => {
    if (!uri || chosen !== "qr" && chosen !== "other") return;
    import("qrcode")
      .then((QR) => QR.toDataURL(uri, { margin: 1, width: 300, color: { dark: "#0e1119", light: "#e9ebf2" } }))
      .then(setQr)
      .catch(() => {});
  }, [uri, chosen]);

  const openApp = (app) => {
    setChosen(app);
    if (uri) window.location.href = app.link(uri);
    else begin();
  };
  const pickInjected = (p) => {
    if (pending.current) cancelWalletConnect();
    pending.current = null;
    onPick(p);
  };
  const reset = () => {
    setChosen(null);
    setQr(null);
  };
  const close = () => {
    cancelWalletConnect();
    pending.current = null;
    onClose();
  };

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Connect a wallet" onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="sheet wallet-sheet" data-testid="wallet-sheet">
        <div className="ws-head">
          <h2 className="sheet-title">{waiting ? "Waiting for your wallet" : "Connect a wallet"}</h2>
          <button className="icon-btn" onClick={close} aria-label="Close">
            <Icon name="close" size={18} />
          </button>
        </div>

        {waiting ? (
          <div className="ws-wait">
            {qr ? (
              <>
                <img className="qr" src={qr} alt="WalletConnect QR code" width="260" height="260" />
                <p className="ws-note">Scan this with a wallet app on your phone, then approve the connection there.</p>
              </>
            ) : (
              <div className="working" aria-hidden="true">
                <Horizon />
              </div>
            )}
            {typeof chosen === "object" && (
              <>
                <p className="ws-note">{uri ? `Approve the connection in ${chosen.name}, then come back to this tab.` : "Preparing the connection…"}</p>
                {uri && (
                  <a className="btn primary block" href={chosen.link(uri)} data-testid="open-wallet-app">
                    Open {chosen.name}
                  </a>
                )}
              </>
            )}
            {chosen === "other" && uri && (
              <div className="btn-row center">
                <a className="btn ghost small" href={uri}>
                  Open wallet app
                </a>
                <Copy text={uri} label="Copy link" />
              </div>
            )}
            {chosen === "qr" && !qr && <p className="ws-note">Preparing the QR code…</p>}
            {err && <p className="error ws-note">{err}</p>}
            <button className="btn-text" onClick={reset}>
              Choose a different wallet
            </button>
          </div>
        ) : (
          <>
            {injected === null && <p className="ws-note">Looking for wallets…</p>}
            {injected && injected.length > 0 && (
              <div className="ws-group">
                <p className="ws-label">In this browser</p>
                {injected.map((w) => (
                  <button key={w.id} className="ws-item" onClick={() => pickInjected(w.provider)} data-testid={`wallet-${w.id}`}>
                    {w.icon ? <img src={w.icon} alt="" width="32" height="32" className="ws-icon" /> : <span className="ws-icon blank">{w.name[0]}</span>}
                    <span className="ws-name">{w.name}</span>
                    <Icon name="chevron" size={16} className="ws-go" />
                  </button>
                ))}
              </div>
            )}
            {wc && (
              <div className="ws-group">
                <p className="ws-label">{mobile ? "Wallet app on this phone" : "Wallet app on your phone"}</p>
                {mobile ? (
                  <>
                    {WALLET_APPS.map((a) => (
                      <button key={a.id} className="ws-item" onClick={() => openApp(a)} data-testid={`wallet-app-${a.id}`}>
                        <span className="ws-icon blank">{a.name[0]}</span>
                        <span className="ws-name">{a.name}</span>
                        <Icon name="chevron" size={16} className="ws-go" />
                      </button>
                    ))}
                    <button className="ws-item" onClick={() => (setChosen("other"), begin())} data-testid="wallet-app-other">
                      <span className="ws-icon blank">+</span>
                      <span className="ws-name">Another wallet app</span>
                      <Icon name="chevron" size={16} className="ws-go" />
                    </button>
                  </>
                ) : (
                  <button className="ws-item" onClick={() => (setChosen("qr"), begin())} data-testid="wallet-app-qr">
                    <span className="ws-icon blank">
                      <Icon name="scan" size={18} />
                    </span>
                    <span className="ws-name">Scan a QR code with your phone</span>
                    <Icon name="chevron" size={16} className="ws-go" />
                  </button>
                )}
              </div>
            )}
            {injected && !injected.length && !wc && <p className="ws-note">No wallet found. Install a wallet extension, or open this page in your wallet app's browser.</p>}
            {err && <p className="error ws-note">{err}</p>}
            <p className="ws-foot">Your keys stay in your wallet. Vesper only asks for one free signature to open your private account.</p>
          </>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ progress

function Progress({ state, vesper, onClose }) {
  if (!state) return null;
  const link = state.txHash && vesper.explorerTx(state.txHash);
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-live="polite">
      <div className="sheet" data-testid="progress">
        {state.status === "working" && (
          <>
            <div className="working" aria-hidden="true">
              <Horizon />
            </div>
            <p className="sheet-title">{state.step}</p>
            <p className="sheet-sub">This can take up to a minute. Keep this tab open.</p>
          </>
        )}
        {state.status === "done" && (
          <>
            <div className="mark ok" aria-hidden="true">
              <Icon name="check" size={22} />
            </div>
            <h2 className="sheet-title" data-testid="done">
              Done
            </h2>
            {link ? (
              <a className="sheet-link" href={link} target="_blank" rel="noreferrer">
                View on the explorer
              </a>
            ) : (
              <code className="mono sheet-sub">{short(state.txHash, 10, 8)}</code>
            )}
            <button className="btn primary block" onClick={onClose} data-testid="close">
              OK
            </button>
          </>
        )}
        {state.status === "error" && (
          <>
            <div className="mark bad" aria-hidden="true">
              <Icon name="alert" size={22} />
            </div>
            <h2 className="sheet-title">That didn't work</h2>
            <p className="error" data-testid="error">
              {state.error}
            </p>
            <button className="btn ghost block" onClick={onClose} data-testid="close">
              Close
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ app

function App() {
  const [vesper, setVesper] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [unlocked, setUnlocked] = useState(false);
  const [tab, setTab] = useState("deposit");
  const [data, setData] = useState(null);
  const [prices, setPrices] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [progress, setProgress] = useState(null);
  const [picker, setPicker] = useState(null);
  const [claimSecret, setClaimSecret] = useState(() => {
    const m = /claim=([^&]+)/.exec(typeof location !== "undefined" ? location.hash : "");
    return m ? decodeURIComponent(m[1]) : null;
  });
  const wide = useWide();

  const closeClaim = () => {
    setClaimSecret(null);
    try {
      history.replaceState(null, "", location.pathname + location.search);
    } catch {}
  };

  useEffect(() => {
    Vesper.load()
      .then(setVesper)
      .catch((e) => setLoadError(friendly(e)));
  }, []);

  // Prices for every listed stock, refreshed every minute (says nothing about your holdings).
  useEffect(() => {
    if (!vesper?.config.pricesUrl) return;
    let live = true;
    const load = () => vesper.prices().then((p) => live && p && setPrices(p));
    load();
    const t = setInterval(load, 60_000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [vesper]);

  const refresh = useCallback(async () => {
    if (!vesper?.keypair) return;
    setRefreshing(true);
    try {
      setData(await vesper.balances());
    } catch (e) {
      setProgress({ status: "error", error: friendly(e) });
    } finally {
      setRefreshing(false);
    }
  }, [vesper]);

  useEffect(() => {
    if (unlocked) refresh();
  }, [unlocked, refresh]);

  async function run(action, onDone) {
    setProgress({ status: "working", step: "Getting ready…" });
    try {
      const txHash = await action((step) => setProgress({ status: "working", step }));
      setProgress({ status: "done", txHash });
      if (onDone) onDone();
      refresh();
    } catch (e) {
      setProgress({ status: "error", error: friendly(e) });
    }
  }

  if (loadError)
    return (
      <div className="page">
        <p className="error">{loadError}</p>
      </div>
    );
  if (!vesper)
    return (
      <div className="page loading" aria-label="Loading">
        <Horizon />
      </div>
    );

  // Opens the wallet picker; resolves with the chosen wallet's provider.
  const chooseWallet = () =>
    new Promise((resolve, reject) =>
      setPicker({
        pick: (p) => (setPicker(null), resolve(p)),
        close: () => (setPicker(null), reject(new Error("closed"))),
      })
    );

  const lock = () => {
    vesper.lock();
    setUnlocked(false);
    setData(null);
  };
  const notice = vesper.config.notice || (vesper.config.testnet ? "Testnet. Test tokens only, nothing here has real value." : null);
  const actions = !vesper.viewOnly && <Actions vesper={vesper} data={data} prices={prices} run={run} tab={tab} setTab={setTab} />;

  return (
    <div className={`app${wide ? " is-wide" : ""}`}>
      <Header vesper={vesper} unlocked={unlocked} onLock={lock} />
      <div className="page">
        {notice && (
          <p className="notice">
            <Icon name="info" size={15} />
            <span>{notice}</span>
          </p>
        )}
        {unlocked && vesper.accountWarning && (
          <p className="notice warn" data-testid="account-warning">
            <Icon name="alert" size={15} />
            <span>{vesper.accountWarning}</span>
          </p>
        )}

        {claimSecret ? (
          <ClaimScreen vesper={vesper} secret={claimSecret} unlocked={unlocked && !vesper.viewOnly} onUnlock={() => setUnlocked(true)} run={run} onClose={closeClaim} chooseWallet={chooseWallet} />
        ) : !unlocked ? (
          <Welcome vesper={vesper} chooseWallet={chooseWallet} onUnlocked={() => setUnlocked(true)} onError={(e) => setProgress({ status: "error", error: friendly(e) })} />
        ) : (
          <main className="dash">
            <div className="col-main">
              <HorizonCard vesper={vesper} data={data} prices={prices} />
              {!wide && actions}
              <Holdings data={data} prices={prices} onRefresh={refresh} refreshing={refreshing} />
              {!vesper.viewOnly && <Account vesper={vesper} />}
            </div>
            {wide && actions && <aside className="col-side">{actions}</aside>}
          </main>
        )}

        <footer className="foot">
          <p>
            {vesper.config.testnet
              ? "Vesper v0.1 on testnet."
              : "Vesper v0.1. Deposits and withdrawals are public; everything in between stays private."}
          </p>
          <nav>
            <a href="/">vesper.markets</a>
            <a href="https://github.com/TomciSplinter/vesper/tree/main/audit" target="_blank" rel="noreferrer">
              Review notes
            </a>
            <a href="https://github.com/TomciSplinter/vesper-ceremony" target="_blank" rel="noreferrer">
              Ceremony
            </a>
            <a href="https://github.com/TomciSplinter/vesper" target="_blank" rel="noreferrer">
              Source code
            </a>
            <a href="https://x.com/VesperRobinhood" target="_blank" rel="noreferrer">
              X
            </a>
            <a href="mailto:contact@vesper.markets">Contact</a>
          </nav>
        </footer>
      </div>
      {picker && <WalletSheet vesper={vesper} onPick={picker.pick} onClose={picker.close} />}
      <Progress state={progress} vesper={vesper} onClose={() => setProgress(null)} />
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
