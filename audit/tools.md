# Automated tools

Run on commit `380f1ec` plus the admin-delay change (branch `self-audit`), 21–22 Oct 2026. Raw output is in `tool-output/`.

| Tool | Target | Result |
| --- | --- | --- |
| [Slither](https://github.com/crytic/slither) 0.11.6 | `contracts/` (excluding the generated verifier and the mock token) | 5 detector hits, all low or informational. No reentrancy, unchecked transfer, arbitrary-send or shadowing issues. |
| [circomspect](https://github.com/trailofbits/circomspect) 0.9.0 | `circuits/transaction.circom`, `merkleproof.circom`, `keypair.circom` at INFO level | 2 warnings, both reviewed and intended (below); 27 notes about loop-counter arithmetic, not applicable. |
| `circom --inspect` (circom 2.1.9) | `circuits/transaction2.circom` | 2 warnings (CA02), intended (below). |
| [Picus](https://github.com/Veridise/Picus) | circuit | **Not run.** It needs Racket packages that this build machine can't download. Run it before raising the caps (see "Before raising caps" in `README.md`). The main circuit has no output signals, so Picus's uniqueness check mostly concerns the sub-templates, which are standard circomlib or two-line Poseidon wrappers. |

## Slither

| Detector | Where | Assessment |
| --- | --- | --- |
| missing-zero-check | constructor `_owner`, `setGuardian`, `setAspPostman` | **Fixed.** The new admin-delay code rejects a zero guardian or postman, and the constructor rejects a zero postman. A zero owner was already rejected by OpenZeppelin `Ownable`. |
| unindexed-event-address | `GuardianSet`, `AspPostmanSet` | **Fixed.** The address is now indexed. |
| naming-convention | `setGuardian(_guardian)` | **Fixed** with the admin rewrite (`applyGuardian(newGuardian)`). |
| calls-loop | `MerkleTreeWithHistory` constructor hashes 20 levels through the hasher contract | Accepted: it runs once at deployment, against an immutable hasher. |
| cyclomatic-complexity | `_transact` (13) | Accepted: it's a straight list of checks. Compliance logic already lives in `_checkCompliance`. |

## circomspect

| Code | Where | Assessment |
| --- | --- | --- |
| CS0017 intermediate signal in one constraint | `extDataSquare <== extDataHash * extDataHash` | Intended. It forces `extDataHash` into a constraint so the proof is bound to the recipient, relayer, fee and encrypted notes. This is the same pattern as Tornado Cash Nova. |
| CS0010 `Num2Bits` aliasing | `MerkleProof`: `Num2Bits(levels)` on `pathIndices` | Not applicable. `levels` = 20, so the value is constrained below 2^20, far below the field size. Aliasing only matters for `Num2Bits(254)`. |
| CS0003 / CS0004 | loop counters, `levels - 1` | Notes about compile-time variables, not signals. Not applicable. |

## circom --inspect

| Code | Where | Assessment |
| --- | --- | --- |
| CA02 unused subcomponent outputs | `outAmountCheck[i].out` (248 bits each) | Intended. `Num2Bits(248)` is used only as a range check on each output amount. Its internal constraints (each bit is 0 or 1, and the bits sum to the input) are what matter; the bits themselves aren't needed. |
