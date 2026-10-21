#!/usr/bin/env node
// Starts a Vesper relayer.
//
//   RELAYER_KEY=0x...                       wallet that pays gas and receives fees (keep it topped up with ETH)
//   RPC_URL=https://rpc.testnet.chain.robinhood.com
//   POOL=0x...                              or DEPLOYMENT=deployments/robinhoodTestnet.json
//   RELAYER_FEES="0xToken:0.01,0xOther:0.02"  minimum fee per asset, in whole tokens (18 decimals)
//   PORT=8080
//
//   node relayer/index.js
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const { Relayer } = require("./relayer");
const { createServer } = require("./server");

function need(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`missing ${name}`);
    process.exit(1);
  }
  return v;
}

async function main() {
  const provider = new ethers.JsonRpcProvider(need("RPC_URL"));
  const signer = new ethers.Wallet(need("RELAYER_KEY"), provider);

  let pool = process.env.POOL;
  if (!pool && process.env.DEPLOYMENT) {
    pool = JSON.parse(fs.readFileSync(path.resolve(process.env.DEPLOYMENT))).pool;
  }
  if (!pool) need("POOL");

  const minFees = {};
  for (const entry of need("RELAYER_FEES").split(",").filter(Boolean)) {
    const [asset, fee] = entry.split(":");
    minFees[asset] = ethers.parseEther(fee);
  }

  const relayer = new Relayer({ signer, pool, minFees });
  const info = await relayer.info();
  const balance = await provider.getBalance(info.relayer);
  console.log(`Vesper relayer ${info.relayer} on chain ${info.chainId}, pool ${info.pool}`);
  console.log(`Gas balance: ${ethers.formatEther(balance)} ETH`);

  const port = Number(process.env.PORT || 8080);
  createServer(relayer).listen(port, () => console.log(`Listening on :${port}`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
