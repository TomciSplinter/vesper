// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {IHasher} from "./interfaces/IHasher.sol";

/// Incremental Poseidon Merkle tree that inserts two leaves at a time.
/// EVERY root it has ever had stays valid for proofs (isRootKnown), so a proof can't
/// be made stale by others' transactions (self-audit F2). This is safe: an old root
/// only contains notes that really existed, and nullifiers stop double spends.
/// Must stay in sync with circuits/merkleproof.circom and src/merkleTree.js.
abstract contract MerkleTreeWithHistory {
    uint256 public constant FIELD_SIZE =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;
    uint256 public constant ZERO_VALUE = uint256(keccak256("vesper")) % FIELD_SIZE;
    uint32 public constant ROOT_HISTORY_SIZE = 100;

    IHasher public immutable hasher;
    uint32 public immutable levels;

    // zeros[i] = root of an empty subtree of height i (zeros[0] = empty leaf)
    mapping(uint256 => bytes32) public zeros;
    // filledSubtrees[i] = most recent left node at level i
    mapping(uint256 => bytes32) public filledSubtrees;
    mapping(uint256 => bytes32) public roots; // recent roots, for getLastRoot
    mapping(bytes32 => bool) public isRootKnown; // every root ever

    uint32 public currentRootIndex;
    uint32 public nextIndex;

    constructor(uint32 _levels, IHasher _hasher) {
        require(_levels > 0 && _levels < 32, "levels out of range");
        levels = _levels;
        hasher = _hasher;

        bytes32 current = bytes32(ZERO_VALUE);
        zeros[0] = current;
        filledSubtrees[0] = current;
        for (uint32 i = 1; i <= _levels; i++) {
            current = _hashLeftRight(_hasher, current, current);
            zeros[i] = current;
            filledSubtrees[i] = current;
        }
        roots[0] = zeros[_levels];
        isRootKnown[zeros[_levels]] = true;
    }

    function hashLeftRight(bytes32 left, bytes32 right) public view returns (bytes32) {
        return _hashLeftRight(hasher, left, right);
    }

    function _hashLeftRight(IHasher _hasher, bytes32 left, bytes32 right) internal pure returns (bytes32) {
        require(uint256(left) < FIELD_SIZE, "left out of field");
        require(uint256(right) < FIELD_SIZE, "right out of field");
        return bytes32(_hasher.poseidon([uint256(left), uint256(right)]));
    }

    /// Inserts two leaves; returns the index of the first.
    function _insert(bytes32 leaf1, bytes32 leaf2) internal returns (uint32 index) {
        uint32 _nextIndex = nextIndex;
        require(_nextIndex != uint32(2) ** levels, "tree is full");

        uint32 currentIndex = _nextIndex / 2;
        bytes32 currentLevelHash = hashLeftRight(leaf1, leaf2);
        bytes32 left;
        bytes32 right;

        for (uint32 i = 1; i < levels; i++) {
            if (currentIndex % 2 == 0) {
                left = currentLevelHash;
                right = zeros[i];
                filledSubtrees[i] = currentLevelHash;
            } else {
                left = filledSubtrees[i];
                right = currentLevelHash;
            }
            currentLevelHash = hashLeftRight(left, right);
            currentIndex /= 2;
        }

        uint32 newRootIndex = (currentRootIndex + 1) % ROOT_HISTORY_SIZE;
        currentRootIndex = newRootIndex;
        roots[newRootIndex] = currentLevelHash;
        isRootKnown[currentLevelHash] = true;
        nextIndex = _nextIndex + 2;
        return _nextIndex;
    }

    function isKnownRoot(bytes32 root) public view returns (bool) {
        return root != 0 && isRootKnown[root];
    }

    /// True once all 2^levels leaves are used. New notes can't be added then, but
    /// withdrawals and exits still work (VesperPool skips inserting their outputs).
    function isFull() public view returns (bool) {
        return nextIndex >= uint32(2) ** levels;
    }

    function getLastRoot() public view returns (bytes32) {
        return roots[currentRootIndex];
    }
}
