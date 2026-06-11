/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

/**
 * Unit tests for the incremental MerkleTree.
 *
 * The implementation in ../merkle-tree.ts was rewritten from an O(N)-per-call
 * bottom-up reduction to an incremental right-frontier ("Merkle Mountain Range"
 * style) tree so that multi-chunk imports cost O(N) total work instead of
 * O(N * chunks). The output MUST remain bit-exact for every leaf count — the
 * CCF signature verification flow depends on it.
 *
 * These tests pin the public behaviour against an independent reference
 * implementation of the original carry-odd-up reduction, plus they cover the
 * incremental-specific invariants (multiple root calls between inserts, root
 * after fromLeaves reset, empty-tree guard).
 *
 * Real multi-chunk ledger Merkle chains are additionally exercised by the
 * existing CCF testdata regression suite in ccf-testdata-regression.spec.ts;
 * those tests are the byte-exact correctness backstop against actual CCF
 * signatures.
 */

import { describe, it, expect } from 'vitest';
import { MerkleTree, areByteArraysEqual } from '../merkle-tree';

/**
 * Reference implementation of the ORIGINAL carry-odd-up MTH used by CCF.
 * Used purely to assert bit-exact equivalence with the incremental version.
 */
async function referenceRoot(leaves: Uint8Array[]): Promise<Uint8Array> {
  if (leaves.length === 0) {
    throw new Error('Cannot calculate root hash of an empty tree.');
  }
  let level = leaves.slice();
  while (level.length > 1) {
    const next: Uint8Array[] = [];
    for (let i = 0; i < level.length; i += 2) {
      if (i + 1 < level.length) {
        const combined = new Uint8Array(level[i].length + level[i + 1].length);
        combined.set(level[i], 0);
        combined.set(level[i + 1], level[i].length);
        const hash = await crypto.subtle.digest('SHA-256', combined as BufferSource);
        next.push(new Uint8Array(hash));
      } else {
        next.push(level[i]);
      }
    }
    level = next;
  }
  return level[0];
}

/** Build a deterministic leaf with the byte pattern `[i, i, i, ...]` of length 32. */
function makeLeaf(i: number): Uint8Array {
  const out = new Uint8Array(32);
  out.fill(i & 0xff);
  return out;
}

/** Build N deterministic leaves. */
function makeLeaves(n: number): Uint8Array[] {
  const out: Uint8Array[] = [];
  for (let i = 0; i < n; i++) out.push(makeLeaf(i + 1));
  return out;
}

describe('MerkleTree (incremental)', () => {
  describe('bit-exact equivalence with the carry-odd-up reference', () => {
    // Cover small counts, powers of 2, off-by-one around powers of 2, and a
    // larger size to exercise multi-level cascading folds.
    const leafCounts = [
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 15, 16, 17, 31, 32, 33, 63, 64, 65, 127, 128, 1000,
    ];

    for (const n of leafCounts) {
      it(`matches the reference for ${n} inserted leaves (plus prepended zero leaf)`, async () => {
        const tree = new MerkleTree();
        const inserted = makeLeaves(n);
        for (const leaf of inserted) tree.insertLeaf(leaf);

        const got = await tree.calculateRootHash();
        const expected = await referenceRoot([new Uint8Array(32), ...inserted]);

        expect(areByteArraysEqual(got, expected)).toBe(true);
      });
    }
  });

  it('returns the zero-leaf as root for the empty (initial) tree', async () => {
    const tree = new MerkleTree();
    const got = await tree.calculateRootHash();
    expect(areByteArraysEqual(got, new Uint8Array(32))).toBe(true);
  });

  it('produces the same root when calculateRootHash is called multiple times with no inserts in between', async () => {
    const tree = new MerkleTree();
    for (const leaf of makeLeaves(5)) tree.insertLeaf(leaf);
    const first = await tree.calculateRootHash();
    const second = await tree.calculateRootHash();
    const third = await tree.calculateRootHash();
    expect(areByteArraysEqual(first, second)).toBe(true);
    expect(areByteArraysEqual(second, third)).toBe(true);
  });

  it('returns the correct root when inserts are interleaved with root calculations', async () => {
    // Simulates the multi-chunk import flow: insert a batch, compute root,
    // insert the next batch, compute root again — must match a from-scratch
    // computation of the full leaf set at each step.
    const tree = new MerkleTree();
    const all: Uint8Array[] = [];

    // Three "chunks" of variable size, none of which are powers of two.
    const chunkSizes = [3, 5, 7];
    for (const size of chunkSizes) {
      for (let i = 0; i < size; i++) {
        const leaf = makeLeaf(all.length + 1);
        all.push(leaf);
        tree.insertLeaf(leaf);
      }
      const got = await tree.calculateRootHash();
      const expected = await referenceRoot([new Uint8Array(32), ...all]);
      expect(areByteArraysEqual(got, expected)).toBe(true);
    }
  });

  it('throws when calculateRootHash is called on a tree built from an empty leaf array', async () => {
    const tree = MerkleTree.fromLeaves([]);
    await expect(tree.calculateRootHash()).rejects.toThrow(/empty tree/i);
  });

  it('fromLeaves resets the frontier so prefix-root computation works correctly', async () => {
    // Build a tree, populate it, take a root. Then for a prefix of those
    // leaves, fromLeaves([...prefix]) followed by calculateRootHash must
    // produce the same root as the reference for that prefix — this matches
    // the pattern used by src/workers/verification-worker.ts.
    const tree = new MerkleTree();
    for (const leaf of makeLeaves(20)) tree.insertLeaf(leaf);
    await tree.calculateRootHash(); // primes the frontier

    const prefixLengths = [1, 2, 3, 8, 15, 16, 20, 21];
    for (const k of prefixLengths) {
      const leavesPrefix = [...tree.Leaves].slice(0, k);
      const sub = MerkleTree.fromLeaves([...leavesPrefix]);
      const got = await sub.calculateRootHash();
      const expected = await referenceRoot(leavesPrefix);
      expect(areByteArraysEqual(got, expected)).toBe(true);
    }
  });

  it('leafCount excludes the initial zero leaf', () => {
    const tree = new MerkleTree();
    expect(tree.leafCount).toBe(0);
    tree.insertLeaf(makeLeaf(1));
    tree.insertLeaf(makeLeaf(2));
    expect(tree.leafCount).toBe(2);
  });
});
