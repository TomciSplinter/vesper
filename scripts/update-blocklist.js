// Refreshes asp/blocklist.json: every EVM (0x...) address on the US Treasury OFAC sanctions
// list (the SDN list's "Digital Currency Address" entries), plus the community-maintained
// extraction at github.com/0xB10C/ofac-sanctioned-digital-currency-addresses as a cross-check.
// Run daily by .github/workflows/blocklist.yml.
//   node scripts/update-blocklist.js
const fs = require("fs");
const path = require("path");
const { getAddress } = require("ethers");

const FILE = path.join(__dirname, "..", "asp", "blocklist.json");
const SOURCES = [
  { name: "OFAC SDN list (US Treasury)", url: "https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.CSV", primary: true },
  ...["ETH", "USDT", "USDC", "ARB", "BSC", "ETC"].map((c) => ({
    name: `0xB10C ${c}`,
    url: `https://raw.githubusercontent.com/0xB10C/ofac-sanctioned-digital-currency-addresses/lists/sanctioned_addresses_${c}.txt`,
  })),
];
const ADDR = /0x[0-9a-fA-F]{40}(?![0-9a-fA-F])/g;

(async () => {
  const found = new Set();
  const report = [];
  for (const s of SOURCES) {
    try {
      const res = await fetch(s.url, { headers: { "user-agent": "vesper-blocklist/1.0 (+https://github.com/TomciSplinter/vesper)" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const addrs = [...new Set((text.match(ADDR) || []).map((a) => getAddress(a.toLowerCase())))];
      addrs.forEach((a) => found.add(a));
      report.push(`${s.name}: ${addrs.length}`);
      if (s.primary && addrs.length < 50) throw new Error(`only ${addrs.length} addresses, expected hundreds`);
    } catch (e) {
      report.push(`${s.name}: FAILED ${e.message}`);
      if (s.primary) {
        console.error(report.join("\n"));
        throw new Error("the official OFAC list couldn't be read; blocklist left unchanged");
      }
    }
  }
  const old = JSON.parse(fs.readFileSync(FILE, "utf8"));
  const next = [...new Set([...found])].sort();
  // Never silently shrink: sanctions are rarely lifted, a big drop means a broken source.
  const dropped = old.filter((a) => !found.has(getAddress(a)));
  if (old.length && dropped.length > Math.max(5, old.length * 0.05)) {
    throw new Error(`${dropped.length} addresses would be removed; refusing (check the sources)`);
  }
  fs.writeFileSync(FILE, JSON.stringify(next, null, 2) + "\n");
  console.log(report.join("\n"));
  console.log(`blocklist: ${old.length} -> ${next.length} addresses (${next.filter((a) => !old.includes(a)).length} new, ${dropped.length} removed)`);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
