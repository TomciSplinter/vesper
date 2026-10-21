# Vesper

A shielded pool for tokenized stocks on Robinhood Chain. Deposit Stock Tokens, hold and send them privately inside the pool, and withdraw with a zero-knowledge proof. A view key lets you show your holdings to an accountant or auditor without giving up the ability to spend.

> **Status: v0.1, unaudited, not yet compiled in CI.** The proving key built by `npm run build:circuit` is a single-machine DEV key. Anyone who knows its randomness can forge proofs. Testnet only until the ceremony and audit are done.

## How it works

Every holding is a **note**: `{ amount, owner pubkey, random blinding, asset }`. The pool stores only the note's hash (commitment) in a Merkle tree, so on-chain observers see that *a* note was added, not whose or how much.

One circuit handles everything: spend up to 2 notes, create 2 new ones, all of the same asset.

| Action | Inputs | Outputs | Tokens move |
|---|---|---|---|
| Deposit | none | your note | wallet → pool |
| Private transfer | your note(s) | recipient's note + your change | nothing leaves the pool |
| Withdraw | your note(s) | change (optional) | pool → any address, minus relayer fee |

The proof shows, without revealing which notes: the inputs exist in the tree, you own them, they haven't been spent (via unique **nullifiers**), and `inputs + deposit = outputs + withdrawal + fee`. Recipient, relayer, fee, asset, chain and pool address are all bound into the proof, so a front-runner can't redirect a withdrawal.

New notes are encrypted to their owner (X25519 + XSalsa20-Poly1305) and emitted on-chain, so wallets find their notes by scanning events. No off-chain database needed.

### Keys

- **Spend key**: spends notes. Never leaves the user's device.
- **Nullifier key**: derived from the spend key. It computes each note's nullifier, so it can tell which notes have been spent, but it can't spend.
- **View key** = decryption key + nullifier key. It shows your real current balance and history, but can't spend. Give it to whoever needs to see your holdings.

`nullifier = Poseidon(commitment, leafIndex, nk)` with `nk = Poseidon(spendKey, NK_DOMAIN)` (Zcash-style). Spending still requires the spend key to open the note's public key inside the proof.
- **Vesper address**: share it to get paid privately.

### Stock Token specifics

- Stock Tokens are 18-decimal ERC-20s. Splits and reinvested dividends update an ERC-8056 `uiMultiplier` and never change raw balances, so notes hold **raw amounts** and stay correct. Show users `raw × uiMultiplier / 1e18` (`toShares()` in `src/`).
- Robinhood can **pause** a token. While paused, withdrawals of that asset revert; the notes stay valid and work again after unpause.
- The Robinhood Chain sequencer screens addresses against a restricted list. Expect that to apply to deposits and withdrawals.

## Layout

```
circuits/            Circom: transaction (2-in/2-out), Merkle proof, keys
contracts/           VesperPool, Merkle tree, interfaces, MockStockToken
src/                 Client: keys, notes, tree sync, note scanning, proof building, relayer client
relayer/             Relayer service: checks and submits withdrawals/transfers for users
webapp/              Web app (React, static): wallet, balances, deposit/send/withdraw, view key
test/                End-to-end tests with real Groth16 proofs (pool + relayer)
scripts/             build-circuit.sh (dev key + verifier), deploy.js, testnet checks
deployments/         Addresses of deployed pools, per network
```

## Run it

Requirements: Node 20+, [circom 2.1.6+](https://docs.circom.io/getting-started/installation/).

```bash
npm install
npm run build      # compile circuit, dev setup, export Verifier.sol, compile contracts
npm test           # deposit, transfer, withdraw, attacks, admin limits, pause, splits
```

The first build takes a few minutes (powers of tau). Each test proof takes a few seconds.

Deploy to testnet (set the RPC and chain ID from Robinhood's docs):

```bash
export RH_TESTNET_RPC=... RH_TESTNET_CHAIN_ID=... DEPLOYER_KEY=...
ASSETS="0xStockToken:1000" npx hardhat run scripts/deploy.js --network robinhoodTestnet
```

The deploy script refuses mainnet unless you confirm the ceremony was run. On a testnet, `MOCK_TOKEN="vTSLA:1000"` also deploys a stand-in stock token. Addresses are saved to `deployments/<network>.json`.

## Relayer

If you withdraw by sending the transaction from your own wallet, that wallet pays the gas and is visible on-chain, which links you to the withdrawal. A relayer sends the transaction for you, pays the gas in ETH, and takes a small fee in the stock token being moved. The fee and the relayer's address are bound into the proof, so a relayer can't change the recipient, the amount or the fee. The worst a relayer can do is refuse a request, and then you can use another relayer or send it yourself.

```bash
RELAYER_KEY=0x... RPC_URL=https://rpc.testnet.chain.robinhood.com \
DEPLOYMENT=deployments/robinhoodTestnet.json RELAYER_FEES="0xToken:0.1" PORT=8080 \
npm run relayer
```

- `GET /info`: relayer address, pool, chain, minimum fee per asset
- `POST /relay`: `{ args, extData, asset }` from `prepareTransaction({ ..., relayer, fee })` returns `{ id }`
- `GET /jobs/:id`: `queued | sending | sent | confirmed | failed`, plus `txHash`

In code: `getRelayerInfo(url)` then `relayTransaction(url, prepared, asset)` (in `src/`).

Before it pays any gas, the relayer checks the fee, its own address, the asset, the root, the nullifiers and the extData hash, then simulates the transaction. Bad requests are turned away for free. It relays withdrawals and private transfers, not deposits (a deposit has to come from the wallet holding the tokens). It doesn't log IPs or request bodies; users who want to hide their IP from the operator should still connect over Tor or a VPN.

v0.1 limits: fees are fixed per asset (no price feed yet), job status lives in memory, there's one wallet with one transaction queue, and there's no relayer registry, so the web app must be given relayer URLs.

## Web app

A static site: no server of its own. It talks to the chain through the RPC in its config, makes proofs in the browser, and uses a relayer if one is configured.

```bash
npm run webapp:build                     # -> webapp/dist (uses webapp/config/robinhoodTestnet.json)
node webapp/build.mjs path/to/config.json   # any other network/pool
npm run webapp:e2e                       # full browser test against a local chain
```

Host `webapp/dist/` on any static host (Vercel, Netlify, Cloudflare Pages, GitHub Pages). On a phone, open it in your wallet app's built-in browser (e.g. MetaMask → Browser).

- **Account**: the wallet signs one fixed message; that signature derives the Vesper spend key. The same wallet always gets the same account, so there's no extra seed to back up. The key lives only in page memory (sign again after reload).
- **Config** (`config.json` next to the app): `chainId`, `chainName`, `rpcUrl`, `explorer`, `pool`, `deployBlock`, `assets[{address, symbol}]`, `relayers[urls]`, `testnet`.
- **Size**: about 3.4 MB of JavaScript plus the 8.5 MB proving key, which loads the first time someone makes a proof.
- **View key mode**: paste a `vview:…` key to see an account's real balance read-only.

## Safety design

- **Not upgradeable.** Verifier and hasher are fixed at deploy.
- **Admin can't touch funds.** The owner can allowlist assets and cap deposit size; the guardian can pause new deposits. Nothing can block a withdrawal.
- **Per-asset deposit caps** keep risk small while the pool is young.
- **Fee-on-transfer tokens are rejected** so the pool's balance always matches its notes.

## Before mainnet

1. **Trusted-setup ceremony**: phase 2 with outside contributors on top of a public phase-1 ptau. Regenerate `Verifier.sol` from the final key.
2. **Audit** of circuits and contracts by a ZK-specialized firm.
3. **Relayer hardening**: fees from a price feed, persistent job store, more than one independent relayer.
4. **Compliance layer**: association-set proofs (Privacy Pools style) so users can prove their funds aren't from flagged deposits.
5. **Legal review**: private holdings of tokenized securities need a lawyer's sign-off.
6. **Web app**: wallet, note scanning, deposit/send/withdraw, view-key export.

## Credit

The note design follows Tornado Cash Nova's audited 2-in/2-out pattern, extended with a per-note asset field so one pool holds many stocks, and with a Zcash-style nullifier key in place of Nova's signature-based nullifier so view keys can see spends.
