# Vesper: handoff notes

Context from the chat where this project started (21 Oct 2026). Read this and README.md first.

## What Vesper is
- A shielded pool for **Robinhood Chain Stock Tokens**: deposit, hold and send stocks privately, withdraw with a ZK proof, show holdings with a view key.
- Inspired by Gloam (private stablecoin payments on Robinhood Chain and Tempo). Vesper deliberately targets **stock tokens** instead, so it isn't a clone.
- Name: **Vesper** (evening star). Planned token: **$VESPER**. Preferred domain: **vesper.markets** (also grab vesper.trade and redirect). Note: an unrelated DeFi project called Vesper Finance (VSP) already exists; check trademark before launch.
- Logo: a planet setting below a horizon line with a gold four-point star above; fading violet lines under the horizon = hidden holdings. Colors: night navy #0D0F1F, star gold #F2C46D, violet #8B7CF6, Sora font. Lives on a Claude Design canvas titled "Vesper Logo".

## Facts checked
- Robinhood Chain mainnet went live 1 July 2026 (Arbitrum Orbit L2, settles to Ethereum).
- Stock Tokens: ERC-20, 18 decimals, ERC-8056 scaled UI amount (splits/dividends change `uiMultiplier`, not raw balances). No contract-level allowlist found. Per-token **pause** exists; contracts are upgradeable; the **sequencer screens addresses** against a restricted list. Sources: docs.robinhood.com/chain/building-with-stock-tokens, Beosin code analysis.
- Stock token addresses are on Robinhood's "Token Contracts" docs page; RPC and chain IDs must be taken from official docs.

## State of the code (v0.1)
- Written but **never compiled or run**: the first workspace had no network access. Only checks done: JS syntax, and a simulation proving the Merkle tree logic matches across contract, JS client and circuit.
- Stack: Circom 2.1.6 + snarkjs Groth16, Hardhat 2 + ethers 6, OpenZeppelin 5, circomlibjs Poseidon, tweetnacl for note encryption.
- The proving key from `build-circuit.sh` is a **dev key** (forgeable). deploy.js refuses mainnet without `I_RAN_THE_CEREMONY=yes`.

## First build and test run (21 Oct 2026)
- `npm install`, circom 2.1.9, `npm run build` and `npm test` all succeeded. **14/14 tests pass with real Groth16 proofs. No code changes were needed.**
- Circuit: 12,842 constraints, 8 public inputs (fits the 2^15 ptau). `snarkjs zkey verify` = OK.
- Build time: ~17 min on 2 cores (mostly the dev powers of tau). The test suite takes ~45 s.
- Resolved versions: hardhat 2.29.1, ethers 6.17.0, solc 0.8.24.
- Sandbox note: if Hardhat can't download solc (HH502), put the solc-static-linux 0.8.24 binary from GitHub releases in `~/.cache/hardhat-nodejs/compilers-v2/linux-amd64/` with a matching `list.json`.

## Robinhood Chain testnet deployment (21 Oct 2026)
- Network: testnet, chain ID 46630, RPC `https://rpc.testnet.chain.robinhood.com`, explorer `explorer.testnet.chain.robinhood.com`.
- Addresses are in `deployments/robinhoodTestnet.json`: pool `0x0f52ed18CBCE672dcBb51dD2554Cc469054EE026`, fake stock token vTSLA `0xF9A6426Bd3A2B116f73F151b38a5cF2Fb09bF112` (a MockStockToken, not a real Robinhood token), verifier, hasher. Deploy block 140206364.
- Deployer/owner: throwaway wallet `0x0c155951c104aC663F97967959a75A7fB1A3C1B3`. Its key only lived in the session's `.env` (not shipped). If it's lost, redeploy; it's testnet.
- `scripts/testnet-smoke.js` ran deposit → private transfer → withdraw with real proofs on testnet: **PASSED**. Each transaction uses ~1.1M gas; the whole deploy + test used ~0.00014 test ETH.
- Changes: `deploy.js` has a `MOCK_TOKEN="SYMBOL:maxDeposit"` option (testnets only) and saves addresses to `deployments/`. `buildTree`/`scanNotes` take a `fromBlock` so scans start at the deploy block. Scripts end with `process.exit` because snarkjs leaves worker threads running.
- Sandbox notes: Hardhat reads only lowercase `http_proxy`, so run `export http_proxy="$HTTPS_PROXY"`. The testnet RPC domain had to be allowed in claude.ai Settings → Capabilities.
- Still to do on testnet: try a real Robinhood testnet stock token (address from the docs' Token Contracts page, plus some test stock to deposit).

## Relayer v0.1 (21 Oct 2026)
- `relayer/relayer.js` (checks + submit queue), `relayer/server.js` (HTTP: `/info`, `/relay`, `/jobs/:id`), `relayer/index.js` (start with `npm run relayer`; env vars in README). Client helpers: `getRelayerInfo`, `relayTransaction` in `src/relayerClient.js`.
- Before it pays gas: fixed minimum fee per asset, extData.relayer must be its own address, no deposits, known root, nullifiers unspent and not already queued, extDataHash and publicAmount match, then a full `staticCall` simulation. No IP or body logging; in-memory rate limit of 30 requests/min per IP.
- Tests: `test/relayer.test.js`, 12 passing (relayed withdrawal and transfer over real HTTP; rejects low fee, wrong relayer, deposits, unknown asset, swapped recipient, broken proof, spent note, the same note twice at once, garbage/oversized bodies, all without spending gas).
- Testnet: relayer wallet `0x6aEB684fB1F8611E46379BAd32FBacf1EC10d912` (funded with 0.01 test ETH; key only in the session `.env`). `scripts/testnet-relay.js` showed a deposit from the user's wallet, then a withdrawal to a brand-new address sent by the relayer: **PASSED**. Fee 0.1 vTSLA; gas ~1.16M ≈ 0.0000116 ETH at 0.01 gwei.
- Sandbox: plain Node scripts reach the RPC with `NODE_USE_ENV_PROXY=1`; Hardhat needs `http_proxy`.
- Known v0.1 limits: fixed fees (no price feed), jobs in memory, one wallet with a serial queue, no relayer discovery. The relayer sees the user's IP unless they use Tor/VPN.

## Web app v0.1 (21 Oct 2026)
- `webapp/`: React app bundled with esbuild into static files (`npm run webapp:build` → `webapp/dist`). Screens: connect/unlock, private balance per stock (shows shares after splits), Deposit, Send (to a Vesper address), Withdraw (any 0x address), Receive (Vesper address), View key (export), plus read-only mode from a pasted view key. Relayer on by default for send/withdraw, with an own-wallet fallback and a warning. "Combine notes" appears when a balance is split over more than 2 notes.
- Account = keccak of a wallet signature over a fixed message (`SIGN_IN_MESSAGE` in `src/keypair.js`). **Changing that message changes everyone's account.**
- `src/` now runs in browsers as well as Node (no Node crypto/Buffer/path). It also gained `Keypair.fromSignature`, `exportViewKey`/`fromExportedViewKey`, `selectNotes`, and log queries that split the range if the RPC refuses it. In the browser, circomlibjs is swapped for its Poseidon-only file (see `webapp/build.mjs`).
- Tests: `test/client.test.js` (4). `webapp/e2e/run.mjs` is a full browser run on a local chain: unlock, deposit, relayed send, relayed withdraw, own-wallet withdraw, overspend error, split display, Receive, view-key read-only. **17/17 checks PASS.** `webapp/e2e/testnet-check.mjs` did a deposit plus a relayed withdrawal through the UI on the live testnet pool: **PASSED**.
- Testnet RPC sends `access-control-allow-origin: *`, so a hosted app can call it directly.
- Shipped `webapp/dist` points at the testnet pool with `relayers: []` (no public relayer yet), so send/withdraw default to the user's own wallet until a relayer URL is added to `config.json`.
- **Protocol gap found: view keys can't see spends.** The nullifier needs the spend key, so a view-key holder sees every note received but not which were spent; read-only mode is labelled "Notes received" for this reason. Fix (circuit change, needs rebuild + redeploy): add a separate nullifier key (Zcash-style `nk`) that's included in the view key, so viewers can compute nullifiers without being able to spend.
- Other limits: proofs run on the page's main thread (a few seconds on desktop, slower on phones; move to a Web Worker); the key is in memory only; the whole chain history is rescanned on each refresh (add caching); the 3.4 MB bundle could be split.

## Next steps
1. ~~`npm install`, install circom, `npm run build`, `npm test`; fix whatever fails.~~ Done.
2. Deploy to Robinhood Chain testnet with a real stock token address.
3. ~~Relayer service~~ and ~~web app~~ v0.1 done (see above). Next: host the web app and a relayer publicly; fix the view-key spent-status gap. Relayer hardening before mainnet: price-feed fees, persistent jobs, run it on a real server, several operators.
4. Compliance: association-set proofs (Privacy Pools style).
5. Trusted-setup ceremony with outside contributors, ZK audit, legal review (private holdings of tokenized securities), then mainnet with small deposit caps. Token launch last.

## Working style
The founder is non-technical-leaning and on mobile: explain plainly, keep replies short, avoid jargon.
