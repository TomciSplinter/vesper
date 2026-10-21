// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

/// Matches the Groth16Verifier that `snarkjs zkey export solidityverifier` generates
/// for a circuit with 8 public signals.
interface IVerifier {
    function verifyProof(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[8] calldata pubSignals
    ) external view returns (bool);
}
