pragma circom 2.1.6;

include "./transaction.circom";

// 2-in / 2-out, Merkle depth 20 (~1M notes).
component main {public [root, publicAmount, extDataHash, asset, inputNullifier, outputCommitment]} = Transaction(20, 2, 2);
