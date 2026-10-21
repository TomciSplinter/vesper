const { keccak256, toUtf8Bytes } = require("ethers");

const FIELD_SIZE = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
// Must equal MerkleTreeWithHistory.ZERO_VALUE = uint256(keccak256("vesper")) % FIELD_SIZE
const ZERO_VALUE = BigInt(keccak256(toUtf8Bytes("vesper"))) % FIELD_SIZE;
const MERKLE_TREE_HEIGHT = 20;

module.exports = { FIELD_SIZE, ZERO_VALUE, MERKLE_TREE_HEIGHT };
