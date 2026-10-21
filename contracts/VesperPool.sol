// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

import {MerkleTreeWithHistory} from "./MerkleTreeWithHistory.sol";
import {IHasher} from "./interfaces/IHasher.sol";
import {IVerifier} from "./interfaces/IVerifier.sol";

/// @title VesperPool
/// @notice Shielded pool for ERC-20s (built for Robinhood Chain Stock Tokens).
/// Deposit, transfer privately and withdraw with a Groth16 proof.
///
/// Safety rules this contract keeps:
///  - Not upgradeable. The verifier and hasher are fixed at deploy time.
///  - Admin powers only limit NEW deposits (allowlist, caps, pause). Nothing an
///    admin does can block a withdrawal or move user funds.
///  - Notes store RAW token amounts. Stock Token splits/dividends change only the
///    ERC-8056 uiMultiplier, never raw balances, so notes stay correct.
///  - If an asset's issuer pauses its token, withdrawals of that asset revert
///    until it is unpaused; the notes remain valid.
contract VesperPool is MerkleTreeWithHistory, ReentrancyGuard, Ownable2Step {
    using SafeERC20 for IERC20;

    int256 public constant MAX_EXT_AMOUNT = 2 ** 248;
    uint256 public constant MAX_FEE = 2 ** 248;

    IVerifier public immutable verifier;

    struct AssetConfig {
        bool depositsEnabled;
        uint256 maxDepositAmount; // per transaction, raw units
    }

    struct ExtData {
        address recipient;
        int256 extAmount;
        address relayer;
        uint256 fee;
        bytes encryptedOutput1;
        bytes encryptedOutput2;
    }

    struct Proof {
        bytes proof; // abi.encode(uint256[2] a, uint256[2][2] b, uint256[2] c)
        bytes32 root;
        bytes32[2] inputNullifiers;
        bytes32[2] outputCommitments;
        uint256 publicAmount;
        bytes32 extDataHash;
    }

    mapping(address => AssetConfig) public assetConfig;
    mapping(bytes32 => bool) public nullifierHashes;
    address public guardian;
    bool public depositsPaused;

    event NewCommitment(bytes32 indexed commitment, uint256 index, bytes encryptedOutput);
    event NewNullifier(bytes32 indexed nullifier);
    event AssetConfigured(address indexed asset, bool depositsEnabled, uint256 maxDepositAmount);
    event DepositsPaused(bool paused);
    event GuardianSet(address guardian);

    error AssetNotEnabled();
    error DepositsArePaused();
    error DepositTooLarge();
    error UnknownRoot();
    error NullifierAlreadySpent();
    error BadExtDataHash();
    error BadPublicAmount();
    error InvalidProof();
    error BadRecipient();
    error FeeOnTransferNotSupported();
    error NotGuardian();

    constructor(IVerifier _verifier, IHasher _hasher, uint32 _levels, address _owner)
        MerkleTreeWithHistory(_levels, _hasher)
        Ownable(_owner)
    {
        verifier = _verifier;
        guardian = _owner;
    }

    // ------------------------------------------------------------------ user

    /// One entry point for deposit (extAmount > 0), private transfer
    /// (extAmount == 0) and withdrawal (extAmount < 0).
    function transact(Proof calldata args, ExtData calldata extData, address asset) external nonReentrant {
        if (extData.extAmount > 0) {
            AssetConfig memory cfg = assetConfig[asset];
            if (!cfg.depositsEnabled) revert AssetNotEnabled();
            if (depositsPaused) revert DepositsArePaused();
            uint256 amount = uint256(extData.extAmount);
            if (amount > cfg.maxDepositAmount) revert DepositTooLarge();

            uint256 before = IERC20(asset).balanceOf(address(this));
            IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
            if (IERC20(asset).balanceOf(address(this)) - before != amount) revert FeeOnTransferNotSupported();
        }
        _transact(args, extData, asset);
    }

    // ----------------------------------------------------------------- views

    function isSpent(bytes32 nullifier) external view returns (bool) {
        return nullifierHashes[nullifier];
    }

    /// The hash the circuit commits to. Binds chain, pool, asset and every extData field.
    function hashExtData(ExtData calldata extData, address asset) public view returns (bytes32) {
        return bytes32(uint256(keccak256(abi.encode(block.chainid, address(this), asset, extData))) % FIELD_SIZE);
    }

    function calculatePublicAmount(int256 extAmount, uint256 fee) public pure returns (uint256) {
        if (fee >= MAX_FEE) revert BadPublicAmount();
        if (extAmount <= -MAX_EXT_AMOUNT || extAmount >= MAX_EXT_AMOUNT) revert BadPublicAmount();
        int256 publicAmount = extAmount - int256(fee);
        return publicAmount >= 0 ? uint256(publicAmount) : FIELD_SIZE - uint256(-publicAmount);
    }

    // ----------------------------------------------------------------- admin

    function configureAsset(address asset, bool depositsEnabled, uint256 maxDepositAmount) external onlyOwner {
        assetConfig[asset] = AssetConfig(depositsEnabled, maxDepositAmount);
        emit AssetConfigured(asset, depositsEnabled, maxDepositAmount);
    }

    function setGuardian(address _guardian) external onlyOwner {
        guardian = _guardian;
        emit GuardianSet(_guardian);
    }

    /// Emergency brake on NEW deposits only. Withdrawals always stay open.
    function setDepositsPaused(bool paused) external {
        if (msg.sender != guardian && msg.sender != owner()) revert NotGuardian();
        depositsPaused = paused;
        emit DepositsPaused(paused);
    }

    // -------------------------------------------------------------- internal

    function _transact(Proof calldata args, ExtData calldata extData, address asset) internal {
        if (!isKnownRoot(args.root)) revert UnknownRoot();
        for (uint256 i = 0; i < 2; i++) {
            if (nullifierHashes[args.inputNullifiers[i]]) revert NullifierAlreadySpent();
        }
        if (args.extDataHash != hashExtData(extData, asset)) revert BadExtDataHash();
        if (args.publicAmount != calculatePublicAmount(extData.extAmount, extData.fee)) revert BadPublicAmount();
        if (!_verify(args, asset)) revert InvalidProof();

        for (uint256 i = 0; i < 2; i++) {
            nullifierHashes[args.inputNullifiers[i]] = true;
        }

        if (extData.extAmount < 0) {
            if (extData.recipient == address(0)) revert BadRecipient();
            IERC20(asset).safeTransfer(extData.recipient, uint256(-extData.extAmount));
        }
        if (extData.fee > 0) {
            if (extData.relayer == address(0)) revert BadRecipient();
            IERC20(asset).safeTransfer(extData.relayer, extData.fee);
        }

        uint32 index = _insert(args.outputCommitments[0], args.outputCommitments[1]);
        emit NewCommitment(args.outputCommitments[0], index, extData.encryptedOutput1);
        emit NewCommitment(args.outputCommitments[1], index + 1, extData.encryptedOutput2);
        for (uint256 i = 0; i < 2; i++) {
            emit NewNullifier(args.inputNullifiers[i]);
        }
    }

    function _verify(Proof calldata args, address asset) internal view returns (bool) {
        (uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c) =
            abi.decode(args.proof, (uint256[2], uint256[2][2], uint256[2]));

        // Order = public signal declaration order in circuits/transaction.circom.
        uint256[8] memory pub = [
            uint256(args.root),
            args.publicAmount,
            uint256(args.extDataHash),
            uint256(uint160(asset)),
            uint256(args.inputNullifiers[0]),
            uint256(args.inputNullifiers[1]),
            uint256(args.outputCommitments[0]),
            uint256(args.outputCommitments[1])
        ];
        return verifier.verifyProof(a, b, c, pub);
    }
}
