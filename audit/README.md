# Vesper self-audit

**Self-audited; findings and fixes published here. This is not a third-party audit.** Vesper launches on mainnet with small deposit caps until an external audit is done.

## What was done (21–22 Oct 2026)

1. **Independent adversarial review.** A separate reviewer that did not write the code attacked the circuit, contracts, client and relayer, and proved each serious issue with a working test (`review-poc/`).
2. **Automated tools.** Slither (contracts), circomspect and `circom --inspect` (circuit). Picus couldn't be installed on the build machine; see `tools.md`.
3. **Fixes and regression tests** for every finding that could be fixed without changing the circuit, so the proving key and its ceremony stay valid.

## Results

- **No break in the core cryptography.** Nobody can mint value, spend a note twice, spend someone else's note, forge a nullifier, privately withdraw unapproved money, launder it through fees, or borrow an approved label. The reviewer checked these with crafted witnesses and tests (`review-poc/audit_circuit.test.js`).
- **11 findings and 4 observations** around the cryptography: 7 fixed (F1, F2, F4, F5, F7, F8, S3), 3 mitigated (F3, F9, F11), and 5 accepted and documented (F6, F10, S1, S2, S4). Details are in `findings.md`.
- **Tests:** 66 contract, circuit and client tests, plus 23 browser checks, all passing after the fixes.

## Admin powers, and what can't happen

| Power | Who | Delay |
| --- | --- | --- |
| Move or freeze anyone's funds | Nobody | Not possible |
| Stop a withdrawal of approved money | Nobody | Not possible |
| Stop an exit of unapproved money to its depositor | Nobody | Not possible |
| Pause new deposits, lower a cap, disable a stock | Guardian or owner | Instant (it only restricts) |
| Enable a stock or raise a cap | Owner | 3 days' public notice |
| Change the guardian or approval publisher | Owner | 3 days' public notice |
| Switch compliance on or off | Owner | 3 days' public notice |
| Add deposits to the approved list | Approval publisher | Instant |
| Remove deposits from the approved list | Approval publisher | Takes effect after 7 days |

Each delayed change is announced on-chain (`ChangeScheduled`) before it can run, so anyone who disagrees can withdraw first.

## Before raising caps

- An external audit of the circuit and contracts by a ZK specialist.
- Picus (or a similar tool that checks the circuit for loose constraints) on the final circuit.
- A multi-party trusted-setup ceremony; the current proving key is a single-machine dev key.
- A tree that rolls over when full (F1), and a minimum deposit size (F4).
- A single always-on relayer instead of serverless functions (F10).
- A real screening policy: sanctions lists or a screening provider, approval delay, appeals (S2).
