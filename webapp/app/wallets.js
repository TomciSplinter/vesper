// Finding a wallet: extensions in this browser (EIP-6963, with window.ethereum as a fallback),
// and wallet apps on a phone through WalletConnect (deep link on mobile, QR code on desktop).

export const isMobile = () => typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

/** Wallets injected into this page: [{ id, name, icon, provider }]. */
export function discoverInjected(timeoutMs = 400) {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve([]);
    const found = new Map();
    const onAnnounce = (e) => {
      const { info, provider } = e.detail || {};
      if (info?.uuid && provider) found.set(info.uuid, { id: info.rdns || info.uuid, name: info.name, icon: info.icon, provider });
    };
    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    setTimeout(() => {
      window.removeEventListener("eip6963:announceProvider", onAnnounce);
      const list = [...found.values()];
      if (!list.length && window.ethereum) list.push({ id: "injected", name: "Browser wallet", icon: null, provider: window.ethereum });
      resolve(list);
    }, timeoutMs);
  });
}

// Phone wallet apps that open a WalletConnect request from a link.
export const WALLET_APPS = [
  { id: "metamask", name: "MetaMask", link: (u) => `https://metamask.app.link/wc?uri=${encodeURIComponent(u)}` },
  { id: "trust", name: "Trust Wallet", link: (u) => `https://link.trustwallet.com/wc?uri=${encodeURIComponent(u)}` },
  { id: "rainbow", name: "Rainbow", link: (u) => `https://rnbwapp.com/wc?uri=${encodeURIComponent(u)}` },
  { id: "coinbase", name: "Coinbase Wallet", link: (u) => `https://go.cb-w.com/wc?uri=${encodeURIComponent(u)}` },
];

let wcProvider = null;
export let wcStage = "idle"; // where a stuck connection got to, shown if it fails

/** Wipes WalletConnect's saved sessions in this browser (old, broken ones can make it hang). */
export async function resetWalletConnectStorage() {
  wcProvider = null;
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith("wc@") || k.startsWith("WALLETCONNECT") || k.startsWith("W3M")) localStorage.removeItem(k);
  } catch {}
  try {
    const dbs = indexedDB.databases ? await indexedDB.databases() : [{ name: "WALLET_CONNECT_V2_INDEXED_DB" }];
    await Promise.all(
      dbs.filter((d) => /WALLET_CONNECT|walletconnect/i.test(d.name || "")).map((d) => new Promise((r) => {
        const q = indexedDB.deleteDatabase(d.name);
        q.onsuccess = q.onerror = q.onblocked = () => r();
      })),
    );
  } catch {}
}

/**
 * Starts a WalletConnect session. onUri(uri) is called with the pairing link (show it as a
 * QR code, or open it in a wallet app). Resolves with an EIP-1193 provider once approved.
 */
export async function connectWalletConnect(config, onUri) {
  if (!config.walletConnectProjectId) throw new Error("Wallet apps aren't set up on this site yet.");
  wcStage = "loading";
  const { EthereumProvider } = await import("@walletconnect/ethereum-provider");
  wcStage = "starting";
  if (wcProvider) {
    try {
      await wcProvider.disconnect();
    } catch {}
  }
  const origin = typeof location !== "undefined" ? location.origin : "https://vesper.markets";
  wcProvider = await EthereumProvider.init({
    projectId: config.walletConnectProjectId,
    optionalChains: [config.chainId],
    rpcMap: { [config.chainId]: config.rpcUrl },
    showQrModal: false,
    metadata: {
      name: "Vesper",
      description: "Hold stocks privately.",
      url: origin,
      icons: [`${origin}/icon.png`],
    },
  });
  wcStage = "pairing";
  wcProvider.on("display_uri", (u) => {
    wcStage = "waiting for wallet";
    onUri(u);
  });
  await wcProvider.connect({ optionalChains: [config.chainId], rpcMap: { [config.chainId]: config.rpcUrl } });
  return wcProvider;
}

export async function cancelWalletConnect() {
  if (!wcProvider) return;
  try {
    await wcProvider.disconnect();
  } catch {}
  wcProvider = null;
}
