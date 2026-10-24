// Claim links: send stock as a link that works like cash. Runs in Node and the browser.
//
// The sender pays a note to a one-off "link account" whose secret key is in the link.
// Whoever opens the link can move that note to their own private balance or out to a
// wallet; no circuit or contract change is involved, it's an ordinary private transfer.
//
// Link keys are derived from the sender's spend key and a counter, so the sender's app can
// always find its links again (to see whether they were claimed, or to take one back)
// without storing anything.
const { keccak256, concat, toUtf8Bytes, toBeHex } = require("ethers");
const { Keypair } = require("./keypair");
const { Utxo } = require("./utxo");
const { FIELD_SIZE } = require("./constants");
const { fetchCommitments, fetchSpentNullifiers } = require("./transaction");

const PREFIX = "vlink1";

/** The link account for the sender's link number `index`. */
function linkKeypair(owner, index) {
  if (!owner?.privkey) throw new Error("only a full account can make links");
  let k = BigInt(keccak256(concat([toUtf8Bytes("vesper-claim-link"), toBeHex(owner.privkey, 32), toBeHex(index, 4)]))) % FIELD_SIZE;
  if (k === 0n) k = 1n;
  return new Keypair(k);
}

/** The secret part of a link: "vlink1" + 64 hex characters. */
function encodeLinkSecret(kp) {
  return PREFIX + toBeHex(kp.privkey, 32).slice(2);
}

/** Accepts the secret, or a whole URL containing #claim=<secret>. Returns the link account. */
function decodeLinkSecret(s) {
  const m = new RegExp(`${PREFIX}([0-9a-fA-F]{64})`).exec(String(s || ""));
  if (!m) throw new Error("This isn't a valid Vesper claim link.");
  const k = BigInt("0x" + m[1]);
  if (k <= 0n || k >= FIELD_SIZE) throw new Error("This isn't a valid Vesper claim link.");
  return new Keypair(k);
}

function decryptAll(commitments, kp) {
  const out = [];
  for (const c of commitments) {
    const u = Utxo.decrypt(kp, c.encryptedOutput, c.index, c.commitment);
    if (u && u.amount > 0n) out.push(u);
  }
  return out;
}

/** What a link holds now: { keypair, notes (unspent), funded, claimed }. */
async function readLink(pool, kp, { fromBlock = 0, commitments, spent } = {}) {
  commitments = commitments || (await fetchCommitments(pool, fromBlock));
  spent = spent || (await fetchSpentNullifiers(pool, fromBlock));
  const all = decryptAll(commitments, kp);
  const notes = all.filter((n) => !spent.has(n.getNullifier()));
  return { keypair: kp, notes, funded: all.length > 0, claimed: all.length > 0 && notes.length === 0 };
}

/**
 * The sender's links, oldest first, stopping after `gap` unused numbers in a row.
 * Each: { index, keypair, notes, funded, claimed }. nextIndex is the first unused number.
 */
async function scanLinks(pool, owner, { fromBlock = 0, gap = 3 } = {}) {
  const [commitments, spent] = await Promise.all([fetchCommitments(pool, fromBlock), fetchSpentNullifiers(pool, fromBlock)]);
  const links = [];
  let misses = 0;
  let nextIndex = null;
  for (let i = 0; misses < gap; i++) {
    const link = await readLink(pool, linkKeypair(owner, i), { commitments, spent });
    if (!link.funded) {
      if (nextIndex === null) nextIndex = i;
      misses++;
      continue;
    }
    misses = 0;
    links.push({ index: i, ...link });
  }
  return { links, nextIndex: nextIndex ?? links.length };
}

module.exports = { linkKeypair, encodeLinkSecret, decodeLinkSecret, readLink, scanLinks };
