import React, { useEffect, useState, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { Vesper, fmt, parseAmount } from "./vesper.js";
import { toShares } from "../../src/index.js";

// --------------------------------------------------------------- pieces

function Logo({ size = 28 }) {
  // Planet setting below a horizon, gold four-point star above, fading violet lines below.
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M46 6 L48 14 L56 16 L48 18 L46 26 L44 18 L36 16 L44 14 Z" fill="var(--gold)" />
      <path d="M12 40 A16 16 0 0 1 44 40 Z" fill="var(--violet)" />
      <line x1="4" y1="40" x2="60" y2="40" stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="14" y1="47" x2="50" y2="47" stroke="var(--violet)" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      <line x1="20" y1="53" x2="44" y2="53" stroke="var(--violet)" strokeWidth="2" strokeLinecap="round" opacity="0.35" />
      <line x1="26" y1="59" x2="38" y2="59" stroke="var(--violet)" strokeWidth="2" strokeLinecap="round" opacity="0.15" />
    </svg>
  );
}

const short = (s, a = 6, b = 4) => (s && s.length > a + b + 3 ? `${s.slice(0, a)}…${s.slice(-b)}` : s);

function Copy({ text, label = "Copy" }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="btn ghost small"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {}
      }}
    >
      {done ? "Copied" : label}
    </button>
  );
}

function AssetSelect({ vesper, value, onChange }) {
  return (
    <label className="field">
      <span>Stock</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} data-testid="asset">
        {vesper.assets.map((a) => (
          <option key={a.address} value={a.address}>
            {a.symbol}
          </option>
        ))}
      </select>
    </label>
  );
}

function RelayerToggle({ value, onChange, fee, symbol }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} data-testid="use-relayer" />
      <span>
        Send through a relayer {value && fee !== undefined && fee !== null ? <em>(fee {fmt(fee)} {symbol})</em> : null}
        <small>{value ? "Your wallet doesn't appear on this transaction." : "Your wallet pays the gas and appears on-chain, which links it to this transaction."}</small>
      </span>
    </label>
  );
}

// --------------------------------------------------------------- screens

function Welcome({ vesper, onUnlocked, onError }) {
  const [busy, setBusy] = useState(false);
  const [viewKey, setViewKey] = useState("");
  const [showView, setShowView] = useState(false);

  async function unlock() {
    setBusy(true);
    try {
      await vesper.unlock();
      onUnlocked();
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="welcome">
      <Logo size={72} />
      <h1>Hold stocks privately.</h1>
      <p className="lead">
        Deposit Robinhood Chain Stock Tokens into Vesper, send them to anyone without the world seeing, and withdraw whenever you like.
      </p>
      <button className="btn primary wide" onClick={unlock} disabled={busy} data-testid="unlock">
        {busy ? "Check your wallet…" : "Connect wallet"}
      </button>
      <p className="hint">You'll sign one free message. That signature becomes your private Vesper account. The same wallet always opens the same account.</p>

      <button className="link" onClick={() => setShowView(!showView)}>I have a view key</button>
      {showView && (
        <div className="card">
          <label className="field">
            <span>View key</span>
            <input value={viewKey} onChange={(e) => setViewKey(e.target.value)} placeholder="vview:…" data-testid="viewkey-input" />
          </label>
          <button
            className="btn wide"
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
  );
}

function Balances({ vesper, data, onRefresh, refreshing }) {
  return (
    <section className="card">
      <div className="row between">
        <h2>{vesper.viewOnly ? "Notes received" : "Private balance"}</h2>
        <button className="btn ghost small" onClick={onRefresh} disabled={refreshing} data-testid="refresh">
          {refreshing ? "Scanning…" : "Refresh"}
        </button>
      </div>
      {vesper.viewOnly && (
        <p className="note">Read-only. A view key shows every note this account has received, but it can't tell which ones have been spent, so this can be higher than the current balance.</p>
      )}
      {!data && <p className="muted">Scanning the pool for your notes…</p>}
      {data &&
        data.byAsset.map(({ asset, total, notes, uiMultiplier, walletBalance }) => (
          <div className="asset" key={asset.address} data-testid={`balance-${asset.symbol}`}>
            <div>
              <div className="sym">{asset.symbol}</div>
              <div className="muted small">
                {notes.length} note{notes.length === 1 ? "" : "s"}
                {walletBalance !== null ? ` · wallet ${fmt(walletBalance)}` : ""}
              </div>
            </div>
            <div className="amt">
              <span data-testid={`private-${asset.symbol}`}>{fmt(total)}</span>
              {uiMultiplier !== 10n ** 18n && <div className="muted small">= {fmt(toShares(total, uiMultiplier))} shares</div>}
            </div>
          </div>
        ))}
    </section>
  );
}

function ActionForm({ vesper, kind, data, run }) {
  const [asset, setAsset] = useState(vesper.assets[0]?.address);
  const [amount, setAmount] = useState("");
  const [to, setTo] = useState("");
  const [useRelayer, setUseRelayer] = useState(kind !== "deposit" && !!vesper.config.relayers?.length);
  const [fee, setFee] = useState(null);
  const symbol = vesper.asset(asset)?.symbol;
  const row = data?.byAsset.find((b) => b.asset.address === asset);

  useEffect(() => {
    let live = true;
    if (kind === "deposit" || !useRelayer) return setFee(null);
    vesper.relayerFee(asset).then((r) => live && setFee(r ? r.fee : null)).catch(() => live && setFee(null));
    return () => {
      live = false;
    };
  }, [asset, useRelayer, kind]);

  const submit = () =>
    run(async (onStep) => {
      const amt = parseAmount(amount);
      if (kind === "deposit") return vesper.deposit(asset, amt, onStep);
      if (kind === "send") return vesper.send(asset, amt, to, { useRelayer }, onStep);
      return vesper.withdraw(asset, amt, to, { useRelayer }, onStep);
    });

  const titles = {
    deposit: ["Deposit", "Move stock tokens from your wallet into your private balance."],
    send: ["Send privately", "Send to a Vesper address. Nobody can see who sent it, who got it, or how much."],
    withdraw: ["Withdraw", "Move stock back out to any wallet. A brand-new address keeps it unlinked from you."],
  };

  return (
    <section className="card" data-testid={`form-${kind}`}>
      <h2>{titles[kind][0]}</h2>
      <p className="muted">{titles[kind][1]}</p>
      <AssetSelect vesper={vesper} value={asset} onChange={setAsset} />
      <label className="field">
        <span>
          Amount {row && kind !== "deposit" && <em>· private {fmt(row.total)}</em>}
          {row && kind === "deposit" && row.walletBalance !== null && <em>· wallet {fmt(row.walletBalance)}</em>}
        </span>
        <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.0" data-testid="amount" />
      </label>
      {kind === "send" && (
        <label className="field">
          <span>Their Vesper address</span>
          <textarea rows={3} value={to} onChange={(e) => setTo(e.target.value)} placeholder="0x… (long address from their Receive tab)" data-testid="to" />
        </label>
      )}
      {kind === "withdraw" && (
        <label className="field">
          <span>To wallet address</span>
          <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="0x…" data-testid="to" />
          {vesper.account && to && to.toLowerCase() === vesper.account.toLowerCase() && (
            <small className="warn">This is your connected wallet. Anyone watching can link it to this withdrawal.</small>
          )}
        </label>
      )}
      {kind !== "deposit" && <RelayerToggle value={useRelayer} onChange={setUseRelayer} fee={fee} symbol={symbol} />}
      {kind === "deposit" && <p className="hint">Deposits come from your wallet, so they're public. What you do afterwards is private.</p>}
      <button className="btn primary wide" onClick={submit} data-testid={`submit-${kind}`}>
        {titles[kind][0]}
      </button>
      {kind !== "deposit" && row && row.notes.length > 2 && (
        <button className="link" onClick={() => run((s) => vesper.combine(asset, { useRelayer }, s))} data-testid="combine">
          Combine notes ({row.notes.length})
        </button>
      )}
    </section>
  );
}

function Receive({ vesper }) {
  const addr = vesper.keypair.address();
  return (
    <section className="card">
      <h2>Receive privately</h2>
      <p className="muted">Share this Vesper address. Anyone can send you stock to it inside the pool. It doesn't reveal your wallet.</p>
      <code className="mono block" data-testid="vesper-address">{addr}</code>
      <Copy text={addr} label="Copy address" />
    </section>
  );
}

function ViewKey({ vesper }) {
  const [shown, setShown] = useState(false);
  const key = vesper.keypair.exportViewKey();
  return (
    <section className="card">
      <h2>View key</h2>
      <p className="muted">
        Give this to an accountant or auditor. It lets them see the notes you've received, but they can't move anything. Anyone with it can see that
        history, so only share it with people you trust.
      </p>
      {shown ? (
        <>
          <code className="mono block" data-testid="viewkey">{key}</code>
          <Copy text={key} label="Copy view key" />
        </>
      ) : (
        <button className="btn wide" onClick={() => setShown(true)} data-testid="show-viewkey">
          Show view key
        </button>
      )}
    </section>
  );
}

function Progress({ state, vesper, onClose }) {
  if (!state) return null;
  const link = state.txHash && vesper.explorerTx(state.txHash);
  return (
    <div className="overlay" role="dialog" aria-live="polite">
      <div className="card sheet" data-testid="progress">
        {state.status === "working" && (
          <>
            <div className="spinner" />
            <p>{state.step}</p>
          </>
        )}
        {state.status === "done" && (
          <>
            <h2 data-testid="done">Done</h2>
            {link ? (
              <a href={link} target="_blank" rel="noreferrer">View on explorer</a>
            ) : (
              <code className="mono small">{short(state.txHash, 10, 8)}</code>
            )}
            <button className="btn primary wide" onClick={onClose} data-testid="close">OK</button>
          </>
        )}
        {state.status === "error" && (
          <>
            <h2>That didn't work</h2>
            <p className="error" data-testid="error">{state.error}</p>
            <button className="btn wide" onClick={onClose} data-testid="close">Close</button>
          </>
        )}
      </div>
    </div>
  );
}

function friendly(e) {
  const m = e?.shortMessage || e?.reason || e?.message || String(e);
  if (/user rejected|denied|ACTION_REJECTED/i.test(m) || e?.code === 4001) return "You cancelled in your wallet.";
  return m.replace(/^Error: /, "");
}

// --------------------------------------------------------------- app

function App() {
  const [vesper, setVesper] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [unlocked, setUnlocked] = useState(false);
  const [tab, setTab] = useState("deposit");
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    Vesper.load().then(setVesper).catch((e) => setLoadError(friendly(e)));
  }, []);

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

  async function run(action) {
    setProgress({ status: "working", step: "Getting ready…" });
    try {
      const txHash = await action((step) => setProgress({ status: "working", step }));
      setProgress({ status: "done", txHash });
      refresh();
    } catch (e) {
      setProgress({ status: "error", error: friendly(e) });
    }
  }

  if (loadError) return <div className="shell"><p className="error">{loadError}</p></div>;
  if (!vesper) return <div className="shell"><div className="spinner" /></div>;

  const tabs = vesper.viewOnly
    ? []
    : [
        ["deposit", "Deposit"],
        ["send", "Send"],
        ["withdraw", "Withdraw"],
        ["receive", "Receive"],
        ["viewkey", "View key"],
      ];

  return (
    <div className="shell">
      <header>
        <div className="brand">
          <Logo />
          <span>Vesper</span>
        </div>
        <div className="row gap">
          <span className="pill">{vesper.config.chainName}</span>
          {unlocked && (
            <button
              className="btn ghost small"
              onClick={() => {
                vesper.lock();
                setUnlocked(false);
                setData(null);
              }}
              data-testid="lock"
            >
              {vesper.viewOnly ? "Close" : short(vesper.account)}
            </button>
          )}
        </div>
      </header>

      {vesper.config.testnet && <div className="banner">Testnet. Unaudited software. Don't use real funds.</div>}

      {!unlocked ? (
        <Welcome vesper={vesper} onUnlocked={() => setUnlocked(true)} onError={(e) => setProgress({ status: "error", error: friendly(e) })} />
      ) : (
        <main>
          <Balances vesper={vesper} data={data} onRefresh={refresh} refreshing={refreshing} />
          {tabs.length > 0 && (
            <nav className="tabs">
              {tabs.map(([k, label]) => (
                <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)} data-testid={`tab-${k}`}>
                  {label}
                </button>
              ))}
            </nav>
          )}
          {!vesper.viewOnly && ["deposit", "send", "withdraw"].includes(tab) && (
            <ActionForm key={tab} vesper={vesper} kind={tab} data={data} run={run} />
          )}
          {!vesper.viewOnly && tab === "receive" && <Receive vesper={vesper} />}
          {!vesper.viewOnly && tab === "viewkey" && <ViewKey vesper={vesper} />}
        </main>
      )}

      <Progress state={progress} vesper={vesper} onClose={() => setProgress(null)} />
      <footer className="muted small">v0.1 · testnet only until the ceremony and audit are done</footer>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
