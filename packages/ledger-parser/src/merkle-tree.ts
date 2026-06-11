/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

/**
 * Merkle Tree implementation for CCF ledger verification.
 *
 * The tree always starts with a zero hash as the first leaf.
 * Each transaction's digest is added as a leaf, and the root
 * hash is compared against signature transactions.
 *
 * # Hash shape (must remain bit-exact)
 *
 * For a leaf sequence `[L0, L1, ..., Ln-1]` the root is the bottom-up reduction
 * where each level pairs adjacent nodes with `SHA-256(left || right)` and any
 * trailing odd element is carried up unchanged to the next level. There are no
 * RFC 6962 domain-separator bytes; leaves are inserted as-is.
 *
 * # Incremental implementation
 *
 * Instead of rebuilding the full pyramid every time {@link calculateRootHash}
 * is called (the previous behaviour: `O(N)` hashes per call, leading to
 * `O(N * chunks)` total work during a multi-chunk import), we maintain a
 * right-frontier — at most one buffered hash per tree level — and a watermark
 * of how many leaves have already been folded in. New leaves are folded
 * lazily on the next root computation in amortized `O(1)` hashes per leaf;
 * collecting the root is then a single `O(log N)` right-to-left walk of the
 * frontier. The output matches the previous implementation bit-for-bit because
 * the final walk simulates the "carry odd up" rule by treating empty frontier
 * slots as a no-op promotion.
 *
 * # Caller contract
 *
 * Inserted leaves are treated as immutable. The frontier caches their hashes,
 * so mutating a `Uint8Array` after passing it to {@link insertLeaf} produces
 * undefined behaviour. {@link calculateRootHash} is not safe to call
 * concurrently with itself or with {@link insertLeaf} on the same instance —
 * all existing call sites are sequential.
 */
export class MerkleTree {
  // First leaf is always a 32-byte zero hash
  private readonly leaves: Uint8Array[] = [new Uint8Array(32)];

  // Right-frontier cache: frontier[k] is the buffered hash at tree level k
  // (undefined when that level slot is empty). At most log2(N)+1 entries.
  private frontier: (Uint8Array | undefined)[] = [];

  // Number of entries in `leaves` already folded into `frontier`.
  // calculateRootHash lazily folds leaves[foldedCount..leaves.length] on each call.
  private foldedCount = 0;

  /**
   * Create a MerkleTree from existing leaves (for state restoration).
   * This replaces the default initial leaves with the provided ones.
   *
   * The frontier and watermark are reset, so the first call to
   * {@link calculateRootHash} folds the provided leaves from scratch.
   *
   * @param existingLeaves Array of leaves to restore (should include the initial zero hash)
   */
  static fromLeaves(existingLeaves: Uint8Array[]): MerkleTree {
    const tree = new MerkleTree();
    // Replace the default leaves with the existing ones
    // Clear the array and add all existing leaves
    tree.leaves.length = 0;
    for (const leaf of existingLeaves) {
      tree.leaves.push(leaf);
    }
    // frontier / foldedCount default to [] / 0 already; next calculateRootHash
    // will fold all provided leaves before returning.
    return tree;
  }

  /**
   * Get read-only access to the leaves
   */
  get Leaves(): readonly Uint8Array[] {
    return this.leaves;
  }

  /**
   * Get the number of leaves (excluding the initial zero hash)
   */
  get leafCount(): number {
    return this.leaves.length - 1;
  }

  /**
   * Insert a leaf using byte array data.
   *
   * The leaf is appended to the leaf list but not folded into the frontier
   * until the next {@link calculateRootHash} call. The caller must treat the
   * passed `Uint8Array` as immutable from this point on.
   */
  insertLeaf(data: Uint8Array): void {
    this.leaves.push(data);
  }

  /**
   * Calculate the final root hash of the Merkle Tree using SHA-256.
   *
   * Bit-exact match with the original O(N) bottom-up reduction. Cost on each
   * call is `O(new leaves since last call)` hashes amortized for the lazy
   * fold, plus `O(log N)` hashes for the final frontier walk.
   */
  async calculateRootHash(): Promise<Uint8Array> {
    if (this.leaves.length === 0) {
      throw new Error("Cannot calculate root hash of an empty tree.");
    }

    // Snapshot the target so a concurrent insertLeaf can't move the goalpost
    // mid-fold. (All current call sites are sequential; this is defensive.)
    const targetCount = this.leaves.length;
    while (this.foldedCount < targetCount) {
      await this.foldOne(this.leaves[this.foldedCount]);
      // Increment only after a successful fold so an aborted hash doesn't
      // silently skip a leaf on the next call.
      this.foldedCount++;
    }

    // Collapse the frontier right-to-left without mutating it: walk from the
    // lowest occupied level up, taking the lowest entry as the seed and then
    // hashing each higher entry on the left of the running value.
    //
    // The shape of this fold mirrors the original algorithm: an empty
    // frontier slot represents the "carry odd up unchanged" case, and a
    // non-empty slot represents a perfect subtree root that pairs on the left.
    let running: Uint8Array | undefined;
    for (let h = 0; h < this.frontier.length; h++) {
      const node = this.frontier[h];
      if (node === undefined) continue;
      if (running === undefined) {
        running = node;
      } else {
        running = await this.computeHash(this.combine(node, running));
      }
    }

    // Unreachable given the empty-tree guard above, but be defensive about it.
    if (running === undefined) {
      throw new Error("Internal: frontier empty after folding a non-empty leaf set.");
    }
    return running;
  }

  /**
   * Fold a single leaf into the right-frontier.
   *
   * Cascades upward through occupied levels: at each occupied level k we
   * compute `H(frontier[k] || carry)` and clear that slot; we stop at the
   * first empty slot and park the carry there. Amortized O(1) hashes per
   * leaf across a full import.
   */
  private async foldOne(leaf: Uint8Array): Promise<void> {
    let carry = leaf;
    let h = 0;
    while (h < this.frontier.length && this.frontier[h] !== undefined) {
      // Non-null assertion is safe — guarded by the while predicate.
      carry = await this.computeHash(this.combine(this.frontier[h]!, carry));
      this.frontier[h] = undefined;
      h++;
    }
    while (this.frontier.length <= h) {
      this.frontier.push(undefined);
    }
    this.frontier[h] = carry;
  }

  /**
   * Combine two byte arrays (optimized)
   */
  private combine(first: Uint8Array, second: Uint8Array): Uint8Array {
    const combined = new Uint8Array(first.length + second.length);
    combined.set(first, 0);
    combined.set(second, first.length);
    return combined;
  }

  /**
   * Compute SHA-256 hash using Web Crypto API
   */
  private async computeHash(data: Uint8Array): Promise<Uint8Array> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data as BufferSource);
    return new Uint8Array(hashBuffer);
  }
}

/**
 * Convert Uint8Array to lowercase hex string (optimized for performance)
 */
export function toHexStringLower(bytes: Uint8Array): string {
  let result = '';
  for (let i = 0; i < bytes.length; i++) {
    const hex = bytes[i].toString(16);
    result += hex.length === 1 ? '0' + hex : hex;
  }
  return result;
}

/**
 * Fast byte array comparison - avoids string conversion overhead
 */
export function areByteArraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Convert hex string to Uint8Array (optimized)
 */
export function hexStringToBytes(hex: string): Uint8Array {
  const result = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    result[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return result;
}
