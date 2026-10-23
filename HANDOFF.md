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
- The proving key from `build-circuit.sh` is a **dev key** (forgeable). deploy.js refuses mainnet unless Verifier.sol and the zkey match `ceremony/final.json` (written by `scripts/import-ceremony.js` from the finalized `vesper-ceremony` repo).

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
- View keys originally couldn't see spends (the nullifier needed the spend key). **Fixed the same day; see the next section.**
- Other limits: proofs run on the page's main thread (a few seconds on desktop, slower on phones; move to a Web Worker); the key is in memory only; the whole chain history is rescanned on each refresh (add caching); the 3.4 MB bundle could be split.

## Nullifier key: view keys see the real balance (21 Oct 2026)
- Circuit: `nullifier = Poseidon(commitment, leafIndex, nk)` with `nk = Poseidon(spendKey, NK_DOMAIN)` and `NK_DOMAIN = keccak256("vesper-nullifier-key") mod p` (`circuits/keypair.circom`, `src/keypair.js`). This replaces Nova's signature-based nullifier. Spending still needs the spend key; `nk` only lets you compute nullifiers. 12,794 constraints.
- View key format is now `vview:` + pubkey + decryption key + nk (3×32 bytes). Older 2-part view keys are rejected as "bad view key".
- New testnet pool (old one abandoned, it only held fake vTSLA): pool `0x163BDa760077E965beB13570222C2267aD2A3957`, verifier `0xFe115B3301bb0d4c66201c4202756A1a66de81bC`, hasher `0x92648D1f63fe3317065CC0c8b3694e2855d3DB42`, deploy block 140247715. Same vTSLA token `0xF9A6…F112`. Old pool was `0x0f52ed18CBCE672dcBb51dD2554Cc469054EE026`.
- Verified: 30/30 Hardhat tests (including a view key watching a spend), 18/18 browser checks (read-only shows the real 44, not 262.5), live smoke test on the new pool, and the live app check including a view key showing the owner's exact balance.

## Relayer on Vercel (21 Oct 2026)
- `api/info.js`, `api/relay.js`, `api/jobs/[id].js` → `relayer/serverless.js` → the same `Relayer` checks. Stateless: `submitNow` sends straight away and returns the tx hash as the job id; `txStatus` reads the receipt. `vercel.json` now installs production deps (`npm ci --omit=dev --ignore-scripts`) so the functions have `ethers`; the static app is still served pre-built from `webapp/dist`.
- Env vars are set in Vercel only: `RELAYER_KEY` (testnet relayer wallet `0x6aEB684fB1F8611E46379BAd32FBacf1EC10d912`), `RPC_URL`, `CHAIN_ID=46630`, `POOL`, `RELAYER_FEES` (vTSLA 0.1).
- Tests: `test/serverless.test.js` (4). A late double-spend found by simulation now reports 409 "note already spent".
- Serverless limits: no shared memory, so no cross-request rate limit or in-flight note lock (two simultaneous requests for the same note can both be sent and the second reverts on-chain, costing the relayer gas), and simultaneous sends can collide on nonce (one fails; the user retries). Fine for testnet; before mainnet use a single long-running relayer (`npm run relayer`) or add a shared store (e.g. Vercel KV) for nonces and locks. Keep the relayer wallet topped up; each relay costs ~0.0000116 ETH at testnet gas prices.

## First real user test (21 Oct 2026)
- Founder's wallet `0x1710…e2dd` got 100 vTSLA. On a phone, at vesper.markets: deposited 10 (tx `0x90976d…951c`), then withdrew 5 through the Vercel relayer to `0xE345…aa03` (tx `0x4715a6…2817`, sent by the relayer wallet, so the founder's wallet doesn't appear). **Works end to end.**
- `/api/health` always returns 200 with relayer status and which settings are present (names only), useful after changing Vercel env vars.

## Compliance: association sets (21 Oct 2026)
- Circuit (17,740 constraints, 11 public inputs: root, publicAmount, extDataHash, asset, newLabel, aspRoot, exitLabel, 2 nullifiers, 2 commitments): notes are `Poseidon(amount, pubkey, blinding, asset, label)`. Deposits get a pool-assigned `newLabel` and may not spend notes (`newLabel * sumIns === 0`); other txs keep the inputs' label. Payouts prove `label ∈ aspRoot` tree (depth 20) or `exitLabel == label`.
- VesperPool: `nextDepositLabel(depositor)` (keccak of chain, pool, depositor, nonce), `depositorOf(label)`, `NewDeposit` event, `updateAssociationSet(root, labels, uri)` by `aspPostman` (current + previous root accepted; superseded by the self-audit: changes only, 7-day grace), `complianceRequired` (default on). Any payout (extAmount < 0 or fee > 0) needs an accepted aspRoot, or an exit: no fee, recipient = depositor. Transfers with no fee need neither.
- Client: `Utxo.label`; `prepareTransaction({ depositor, asp, exit })`; `fetchAssociationSet` rebuilds the list from the latest event and checks it against the on-chain root; `selectNotes` keeps to one label; `NotApprovedError`. `src/asp.js` (fetchDeposits, approvedLabels, associationTree), `relayer/aspUpdate.js`, `scripts/asp-update.js`, `api/asp-update.js`.
- Fixed along the way: event lookups used ethers' cached block number and could miss a tx that had just landed (`src/events.js` now asks up to "latest").
- Web app: "N waiting for approval" per stock; withdrawals use approved money only; "Return to depositing wallet" for the rest; relayed sends need approved money.
- Tests: 48 Hardhat tests (14 in `test/compliance.test.js`: made-up sets, fee laundering, borrowing a label via deposit+spend at the circuit level, the label following a transfer, exits) and 22 browser checks. Live testnet: smoke test and app check both PASSED.
- New testnet pool `0x0c350E68C861b01E4Ac7bbf895C3e0f0e8b7f424` (verifier `0x2fc39a50496bFF439b959589ad0D00F406db8b86`, deploy block 140286311), same vTSLA. `aspPostman` = relayer wallet `0x6aEB…d912`. Previous pool `0x163B…3957` abandoned.
- Open questions for the real thing: who runs the screener and with which lists, approval delay, appeals, and whether the screener should also cover deposits. The recipient of unapproved money can only exit it to the original depositor; the app should warn about this before accepting.

- The Vercel relayer now takes the pool from `deployments/robinhoodTestnet.json` (same as the app); the `POOL` env var is ignored. New pools only need a push.

## Real Robinhood test stock (21 Oct 2026)
- Testnet TSLA Stock Token: `0xC9f9c86933092BbbfFF3CCb4b105A4A94bf3Bd4E` ("Tesla", 18 decimals, about 238k holders, has `uiMultiplier()` and `paused()`, minted 5 at a time by the official faucet at faucet.testnet.chain.robinhood.com). Many look-alike "TSLA" tokens exist on testnet; this is the one with the stock-token interface that the faucet mints.
- Checked: a simulated transfer from a holder into the pool succeeds (no contract-recipient block).
- Enabled in the compliance pool (cap 1000 per deposit). Added to the app as "TSLA" (vTSLA kept).
- Relayer fees now default from `deployments/robinhoodTestnet.json` → `relayerFees` (TSLA 0.01, vTSLA 0.1); the `RELAYER_FEES` env var is optional and overrides per asset.

- **Live with real Robinhood test stock (21 Oct 2026):** the founder claimed TSLA from the official faucet, deposited 3 TSLA from a phone (tx `0x814e80…a3d`), then withdrew 1 TSLA through the Vercel relayer to `0xE345…aa03` (tx `0xccfa5e…5446`, sent by the relayer, with proof of approval, 0.01 TSLA fee). Pool holds 1.99 TSLA.

## Self-audit (22 Oct 2026)
- See `audit/README.md` (summary, admin-powers table), `audit/findings.md` (F1–F11, S1–S4 with fixes), `audit/tools.md` (Slither, circomspect, circom --inspect; Picus not installable here). An independent reviewer that did not write the code found no break in the core cryptography but 11 issues around it; 7 fixed, 3 mitigated, 5 accepted and documented. The circuit is unchanged, so the zkey and any ceremony on it stay valid.
- Contract changes: every historical tree root stays valid; payouts still work on a full tree (`TreeFull` for anything else); deposits can't pay fees; `updateAssociationSet(root, added, removed, uri)` with a 7-day grace for replaced roots (`ASP_GRACE`, `aspRootReplacedAt`, no more `previousAspRoot`); 3-day `ADMIN_DELAY` via `scheduleChange`/`executeChange`/`cancelChange` for `applyAssetConfig`/`applyGuardian`/`applyAspPostman`/`applyComplianceRequired`; instant `restrictAsset` and pause; initial assets + postman in the constructor (`ASP_POSTMAN` env in deploy.js); mainnet guard by chain id 4663.
- Client/app: spent checks are local (NewNullifier events); association set replayed from diffs, `forLabel` finds still-valid older sets; notes show approved / "withdraw by <date>" / waiting; relayer-sponsored exits (`sponsorExits` in the deployment file); `maxRelayerFees` cap in the app config; EIP-712 sign-in bound to chain id (new accounts) with a warning if a wallet's account changes; privacy note on Send.
- Tests: 66 Hardhat (new `test/admin.test.js`, `test/selfaudit.test.js`) + 23 browser checks.

## Next steps
1. ~~`npm install`, install circom, `npm run build`, `npm test`; fix whatever fails.~~ Done.
2. ~~Deploy to Robinhood Chain testnet with a real stock token address.~~ Done: real testnet TSLA works end to end.
3. ~~Relayer service~~ and ~~web app~~ v0.1 done (see above). Web app hosted on Vercel at vesper.markets. ~~View-key spent-status gap~~ fixed. Relayer runs as Vercel functions at vesper.markets/api (see below). Relayer hardening before mainnet: price-feed fees, persistent jobs, run it on a real server, several operators.
4. ~~Compliance: association-set proofs (Privacy Pools style).~~ Mechanism done (see above); the screening policy and provider are still open.
5. Trusted-setup ceremony with outside contributors, ZK audit, legal review (private holdings of tokenized securities), then mainnet with small deposit caps. Token launch last.

## Working style
The founder is non-technical-leaning and on mobile: explain plainly, keep replies short, avoid jargon.

## Trusted-setup ceremony (set up)

- Public repo `TomciSplinter/vesper-ceremony` (staged at `../vesper-ceremony`): circuit source + `transaction2.r1cs` (recompiles byte-identical with circom 2.1.9), scripts `contribute / verify (--pr, --all) / finalize / verify-final`, snarkjs 0.7.6 pinned.
- Phase 1: Hermez `powersOfTau28_hez_final_15.ptau`, checked against the blake2b hash in the snarkjs README. The sandbox can't download it; the *Start ceremony* GitHub Action builds `0000.zkey` in public instead.
- Each contribution PR is checked by the *Verify ceremony* Action: only the next `NNNN.zkey` + attestation, valid against r1cs + phase 1, and it must contain every earlier contribution.
- Finish: announce a future drand round as the beacon, `npm run finalize -- <hex> "<source>"`, then here `node scripts/import-ceremony.js ../vesper-ceremony`, compile, test, rebuild the web app, deploy.
- Dry run (dev phase 1, 3 contributors + beacon) passed end to end, including the full test suite on the resulting key.

## Ceremony finished, testnet on the final key

- Phase 2 contributions: Tom, sod, Splinter; sealed with drand quicknet round 33325012 (announced in advance in `final/BEACON.md`), by the *Finalize ceremony* Action. Final zkey sha256 `d5e5d4c3…4923`, Verifier.sol sha256 `55f70ba9…ae94` (recorded in `ceremony/final.json`; mainnet deploy checks them).
- The sandbox can't download the phase-1 file, so `import-ceremony.js` ran with `SKIP_VERIFY=1`; the Finalize Action ran `verify-final` publicly.
- 66/66 tests pass on the final key. New testnet pool `0x35AA1f9D4CbD2882288F5F39892fD4cE1f9AFd22` (verifier `0x1EdE5788b5093138Ac4692bE2330adF057086A10`, hasher `0x9d723D94763864E2b06fc1de17474380E161F733`, deploy block 141470125), same TSLA + vTSLA, postman = relayer wallet. Live smoke test (deposit, private transfer, withdraw) PASSED. Previous pool `0x436c…9033` is in `previousPools`.

## Mainnet (Robinhood Chain, chain id 4663)

- Pool `0x0f52ed18CBCE672dcBb51dD2554Cc469054EE026`, verifier `0x7D5D0A1801813f3D47D11353EbE7F5AFd34df939` (bytecode identical to the ceremony's Verifier.sol), hasher `0x20a046e6044839951DDecfbf6bA70b1D8282d8f6`, deploy block 96303874.
- Owner + guardian: Safe `0x688Bb15968406d889A05baDb599Bae93D6a5476d` (Safe 1.5.0, 2 of 3). aspPostman/relayer: `0x6aEB…d912` (kept from testnet at the founder's choice; its key has been in chat history).
- 13 assets (TSLA NVDA AAPL MSFT AMZN GOOGL META COIN AMD INTC MU SPY QQQ), addresses checked against api.robinhood.com/rhj/assets and on-chain; caps ~ $2k per deposit and relayer fees ~ $1 (deployments/robinhood.assets.json). Admin changes go through the 3-day delay, executed from the Safe.
- Fork rehearsal (`scripts/dev/fork-check.js`) passed with real TSLA before the deploy.
- The relayer and /api/asp-update pick `deployments/robinhood.json` automatically; env RPC_URL/CHAIN_ID are only used if CHAIN_ID matches. The web app builds from `webapp/config/robinhood.json` (`node scripts/mainnet-config.js` regenerates it).
- Source not yet verified on robinhoodchain.blockscout.com (explorer not reachable from the sandbox).
