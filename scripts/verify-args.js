// Constructor arguments of the mainnet pool, for `hardhat verify --constructor-args`.
const { ethers } = require("ethers");
const dep = require("../deployments/robinhood.json");
const { MERKLE_TREE_HEIGHT } = require("../src/constants");
module.exports = [
  dep.verifier,
  dep.hasher,
  MERKLE_TREE_HEIGHT,
  dep.owner,
  dep.aspPostman,
  dep.assets.map((a) => a.split(":")[0]),
  dep.assets.map((a) => ethers.parseEther(a.split(":")[1]).toString()),
];
