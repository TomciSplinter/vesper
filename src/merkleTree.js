const { poseidonHash } = require("./poseidon");
const { ZERO_VALUE } = require("./constants");

/**
 * Full in-memory copy of the pool's tree, rebuilt from NewCommitment events.
 * Layout must match MerkleTreeWithHistory.sol: leaf at index i is a LEFT child
 * when i is even; empty slots hash as zeros[level].
 */
class MerkleTree {
  constructor(levels, leaves = []) {
    this.levels = levels;
    this.zeros = [ZERO_VALUE];
    for (let i = 1; i <= levels; i++) this.zeros.push(poseidonHash([this.zeros[i - 1], this.zeros[i - 1]]));
    this.leaves = leaves.map(BigInt);
    this._rebuild();
  }

  _rebuild() {
    this.layers = [this.leaves.slice()];
    for (let level = 1; level <= this.levels; level++) {
      const below = this.layers[level - 1];
      const layer = [];
      for (let i = 0; i < Math.ceil(below.length / 2); i++) {
        const left = below[2 * i];
        const right = 2 * i + 1 < below.length ? below[2 * i + 1] : this.zeros[level - 1];
        layer.push(poseidonHash([left, right]));
      }
      this.layers.push(layer);
    }
  }

  insert(leaf) {
    this.leaves.push(BigInt(leaf));
    this._rebuild();
  }

  bulkInsert(leaves) {
    this.leaves.push(...leaves.map(BigInt));
    this._rebuild();
  }

  root() {
    const top = this.layers[this.levels];
    return top.length ? top[0] : this.zeros[this.levels];
  }

  indexOf(leaf) {
    return this.leaves.findIndex((l) => l === BigInt(leaf));
  }

  /** pathElements[level] = sibling at that level; pathIndices = leaf index (its bits pick left/right). */
  path(index) {
    if (index < 0 || index >= this.leaves.length) throw new Error(`index ${index} not in tree`);
    const pathElements = [];
    let idx = index;
    for (let level = 0; level < this.levels; level++) {
      const sibling = idx ^ 1;
      const layer = this.layers[level];
      pathElements.push(sibling < layer.length ? layer[sibling] : this.zeros[level]);
      idx >>= 1;
    }
    return { pathElements, pathIndices: index };
  }
}

module.exports = { MerkleTree };
