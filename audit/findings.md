# Findings and fixes

All findings below come from an independent adversarial review of commit `380f1ec`, done by a separate reviewer that did not write the code (21–22 Oct 2026), plus the automated tools in `tools.md`. The reviewer's proof-of-concept tests are in `review-poc/`. Each fix has a regression test in `test/selfaudit.test.js`, `test/compliance.test.js`, `test/admin.test.js` or `test/relayer.test.js`.

Status: **Fixed** = the issue is gone and a test proves it. **Mitigated** = reduced, with a stated remaining risk. **Accepted** = a known trade-off, documented for users.

| ID | Severity | Finding | Status |
| --- | --- | --- | --- |
| F1 | High | Anyone could fill the note tree with free dummy transactions and freeze all funds forever | Fixed (funds can't freeze); denial of service remains |
| F2 | Medium | 100 spam transactions could push a user's root out of history, invalidating their proof | Fixed |
| F3 | High (trust) | The approval publisher could force money sent to someone to go back to the original depositor | Mitigated |
| F4 | Medium/High | Association-set updates grew with every deposit and break after about 3,000 | Fixed |
| F5 | Low | A deposit could pay a "fee" to any address, skipping compliance | Fixed |
| F6 | High (privacy) | A payment's recipient learns the public wallet that first deposited it, and how much | Accepted, documented |
| F7 | Medium (privacy) | Checking "is this note spent?" told the RPC operator which future spends are yours | Fixed |
| F8 | Medium | Exits had to be sent from the user's own wallet; the UI didn't say who receives them | Fixed |
| F9 | Medium | A relayer could charge more than the fee it showed; nothing capped it | Mitigated |
| F10 | Low | The serverless relayer can pay gas for duplicate, failing submissions | Accepted for testnet |
| F11 | Low/Medium | The spend key came from a plain-text signature; a wallet that signs differently twice opens a different account | Mitigated |
| S1 | Medium (design) | The publisher could split the list over time to narrow down whose withdrawal is whose | Accepted, documented |
| S2 | Info | The testnet approval policy approves almost everything | Accepted for testnet; mainnet needs a real policy |
| S3 | Low | The deploy script's mainnet guard went by network name | Fixed |
| S4 | Info | Stock Tokens are upgradeable and pausable, and the chain screens addresses | Accepted, documented |
| T1–T7 | Low/Info | Automated tool results (see `tools.md`) | 3 fixed, 4 intended or accepted |

## F1: tree filling could freeze funds (High) — fixed

**Problem.** A transaction with two empty inputs and two zero outputs costs no tokens, needs no approval and works even with deposits paused. Each one adds two leaves to the 2^20-leaf tree. Filling it costs roughly 600 Ggas, about 6 ETH at 0.01 gwei. Once full, every transaction, including withdrawals and exits, reverted, and the contract can't be upgraded.

**Fix.** `VesperPool._transact`: when the tree is full, payouts (`extAmount < 0`) still go through and their outputs are simply not stored. Anything else reverts with `TreeFull`. The wallet refuses to build a payout with change on a full tree, so nobody loses a change note. `MerkleTreeWithHistory.isFull()` is new.

**Tests.** `F1: a full tree can't freeze funds…`, `F1: a full tree refuses new notes…`.

**Remaining risk.** An attacker who pays the gas can still fill the tree and stop new deposits and transfers. Funds stay withdrawable, and the fix would be a new pool. A tree that rolls over to a new one is listed under "Before raising caps".

## F2: roots expired after 100 transactions (Medium) — fixed

**Problem.** Only the last 100 roots were accepted. About 112M gas of spam made any slow proof (phones) revert with `UnknownRoot`.

**Fix.** Every root the tree has ever had stays valid (`isRootKnown`). This is safe: an old root only contains notes that really existed, and nullifiers stop double spends.

**Test.** `F2: a proof built against an old root still works after the root changes`.

## F3: the approval publisher could redirect a transfer back to its depositor (High, trust) — mitigated

**Problem.** Exits always pay the label's original depositor. If the publisher drops a label from the list, anyone holding money from that deposit, including someone who was paid with it, can only exit it to the depositor.

**Fixes.**
- A dropped label stays usable for **7 days** (`ASP_GRACE`). A replaced root remains valid for that long, and the wallet finds it automatically. Holders can withdraw privately before the removal bites, and the app shows "withdraw it privately by <date>".
- Changing the publisher itself, and switching compliance on or off, now need **3 days' public notice** (`scheduleChange` / `executeChange`).

**Tests.**
- `a removal from the list only bites after 7 days…`
- `after the grace period, a removed deposit can no longer withdraw privately`
- `test/admin.test.js`

**Remaining risk, stated in the README.** After 7 days, a removed deposit's money can only go back to whoever deposited it. Holders must watch for removals; the app shows them.

## F4: association-set updates didn't scale (Medium/High) — fixed

**Problem.** Every update re-sent and emitted the whole approved list, at 434 gas and 32 bytes of calldata per label. That passes typical transaction size limits at roughly 3,000 labels. After that no new deposit could be approved.

**Fixes.**
- `updateAssociationSet(root, added, removed, uri)` sends only the changes. Wallets rebuild the list by replaying every update and check the root, in `src/transaction.js` (`replayAssociationSet`, `fetchAssociationSet`).
- The publisher sends at most 500 additions per update (`relayer/aspUpdate.js`). It also only publishes when something changed, so calling `/api/asp-update` repeatedly is harmless.

**Test.** `F4: an association-set update costs the same whether 1 or 400 labels are already approved`.

**Remaining risk.** Each new 1-wei deposit costs the publisher a little gas to approve. A minimum deposit size is listed under "Before raising caps".

## F5: deposit fees skipped compliance (Low) — fixed

**Fix.** Deposits with `fee != 0` revert with `FeeOnDeposit`.

**Test.** `F5: a deposit can't pay a fee to anyone`.

## F6: recipients learn the original depositor (High, privacy) — accepted

**Problem.** A note's label is part of its commitment, so the recipient can decrypt it. `depositorOf(label)` and `NewDeposit` are public. Anyone you pay, even several hops later, can see which public wallet first deposited that money and how much. This is built into labels that follow the money.

**What we did.**
- The Send screen says so.
- The README's privacy section says so.

**What could change it.** Hiding the label behind a commitment, with a separate approval nullifier, would remove this. That needs a circuit change and is a later design option.

## F7: spent checks leaked to the RPC (Medium, privacy) — fixed

**Problem.** The wallet asked the RPC `isSpent(nullifier)` for each of your notes. The RPC operator saw your wallet, your IP and your nullifiers, so it could link your later withdrawals to you.

**Fix.** The wallet downloads every `NewNullifier` event and checks locally (`fetchSpentNullifiers`). It never sends a nullifier to the RPC.

**Test.** `F7: note scanning never asks the RPC about specific nullifiers`.

## F8: exits needed the user's wallet; unclear recipient (Medium) — fixed

**Fixes.**
- Relayers can **sponsor exits**: they send them for free, since exits can't pay a fee (`sponsorExits`, on for testnet). The app uses this, so returning money doesn't put the user's wallet on-chain.
- The return box now says that, for money you were sent, the return goes to the sender's original wallet, not yours. The progress message shows the address.

**Tests.** The relayer test `an exit, unless the relayer sponsors exits`, and a browser check that the return was sent by the relayer.

## F9: relayer fee not bound to what was shown (Medium) — mitigated

**Fix.** The app's config sets a maximum fee per stock (`maxRelayerFees`). The wallet refuses a relayer that asks more.

**Remaining risk.** Within the cap, the fee charged is whatever `/info` says at sending time. The two can differ only within the cap.

## F10: the serverless relayer can pay for duplicate submissions (Low) — accepted for testnet

**Problem.** There is no shared lock between serverless calls. Simultaneous identical requests can each be sent, and all but one revert at the relayer's cost.

**Plan.** Run a single always-on relayer before larger caps (`npm run relayer` already has the in-process lock).

## F11: sign-in key from a plain message (Low/Medium) — mitigated

**Fixes.**
- Sign-in is now an EIP-712 request: structured, named "Vesper" and bound to the chain id. Wallets show it as a Vesper request, and testnet and mainnet accounts are separate.
- If a wallet produces a different account than last time on the same device, the app warns before any deposit.

**Remaining risk.** A phishing site that gets the same signature gets the spend key. That's the cost of having no separate seed phrase, and it's documented.

## S1–S4: other observations

| ID | Observation | What we did |
| --- | --- | --- |
| S1 | The publisher could publish deliberately split lists to narrow down which deposit a withdrawal came from | Documented. Lists are public and checkable, so a pattern of splits would be visible. |
| S2 | The testnet policy approves every deposit not on an empty blocklist | Fine for testnet. Mainnet needs a sanctions list or a screening provider (`README.md`). |
| S3 | The deploy script's mainnet guard went by network name | Fixed: it now checks the chain id (Robinhood Chain mainnet, 4663). |
| S4 | Stock Tokens are upgradeable and pausable; the issuer could freeze the pool's balance; an exit to a restricted address would revert | Documented in the README. Outside Vesper's control. |

## Automated tools

See `tools.md`. Slither's missing zero-address checks, unindexed events and naming issue are fixed. circomspect's and circom's warnings are intended patterns, explained there.
