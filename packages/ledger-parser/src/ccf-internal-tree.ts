/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { toHexStringLower } from './merkle-tree';
import { CCF_INTERNAL_TABLES } from './table-names';

const HASH_SIZE_BYTES = 32;

const readUint64BE = (
  bytes: Uint8Array,
  offset: number
): { value: bigint; offset: number } => {
  if (offset + 8 > bytes.length) {
    throw new Error('Not enough bytes to read uint64');
  }

  let value = 0n;
  for (let i = 0; i < 8; i++) {
    value = (value << 8n) | BigInt(bytes[offset + i]);
  }
  return { value, offset: offset + 8 };
};

const popcountBigint = (value: bigint): number => {
  let v = value;
  let count = 0;
  while (v !== 0n) {
    if ((v & 1n) === 1n) count++;
    v >>= 1n;
  }
  return count;
};

const concatTwo = (left: Uint8Array, right: Uint8Array): Uint8Array => {
  const combined = new Uint8Array(left.length + right.length);
  combined.set(left, 0);
  combined.set(right, left.length);
  return combined;
};

const sha256 = async (data: Uint8Array): Promise<Uint8Array> => {
  const digest = await crypto.subtle.digest('SHA-256', data as BufferSource);
  return new Uint8Array(digest);
};

export type CcfInternalTreeDecode = {
  // merklecpp serialisation fields
  leafCount: bigint;
  minIndex: bigint; // aka num_flushed
  maxIndex: bigint; // derived = minIndex + leafCount - 1
  leafHashes: Uint8Array[];
  extraHashes: Uint8Array[];

  // convenience
  expectedExtraHashes: number;
  warnings: string[];
};

/**
 * Decodes CCF's `public:ccf.internal.tree` value.
 *
 * CCF stores this as `std::vector<uint8_t>` from `merklecpp` tree serialisation.
 * CCF uses `TreeT<32, sha256_history>` where `sha256_history(l,r)=SHA256(l||r)`.
 *
 * Layout (big-endian u64):
 * - uint64 leafCount
 * - uint64 numFlushed (aka minIndex)
 * - leafCount * 32 bytes leaf hashes
 * - popcount(numFlushed) * 32 bytes extra hashes (may be 0)
 */
export const decodeCcfInternalTree = (bytes: Uint8Array): CcfInternalTreeDecode => {
  if (bytes.length === 0) {
    return {
      leafCount: 0n,
      minIndex: 0n,
      maxIndex: 0n,
      leafHashes: [],
      extraHashes: [],
      expectedExtraHashes: 0,
      warnings: ['Empty value'],
    };
  }

  let offset = 0;
  const warnings: string[] = [];

  const headerLeafCount = readUint64BE(bytes, offset);
  const leafCount = headerLeafCount.value;
  offset = headerLeafCount.offset;

  const headerMinIndex = readUint64BE(bytes, offset);
  const minIndex = headerMinIndex.value;
  offset = headerMinIndex.offset;

  const leafHashes: Uint8Array[] = [];
  const leafCountNumber = Number(leafCount);
  if (!Number.isSafeInteger(leafCountNumber) || leafCountNumber < 0) {
    throw new Error(`Unsupported leafCount for JS array allocation: ${leafCount.toString()}`);
  }

  const requiredLeafBytes = BigInt(leafCountNumber) * BigInt(HASH_SIZE_BYTES);
  const available = BigInt(bytes.length - offset);
  if (available < requiredLeafBytes) {
    throw new Error('Not enough bytes to read leaf hashes');
  }

  for (let i = 0; i < leafCountNumber; i++) {
    leafHashes.push(bytes.slice(offset, offset + HASH_SIZE_BYTES));
    offset += HASH_SIZE_BYTES;
  }

  const expectedExtraHashes = popcountBigint(minIndex);
  const remaining = bytes.length - offset;
  if (remaining % HASH_SIZE_BYTES !== 0) {
    warnings.push(
      `Trailing bytes (${remaining}) not a multiple of ${HASH_SIZE_BYTES}; cannot fully decode extra hashes`
    );
  }

  const extraHashes: Uint8Array[] = [];
  const extraCount = Math.floor(remaining / HASH_SIZE_BYTES);
  for (let i = 0; i < extraCount; i++) {
    extraHashes.push(bytes.slice(offset, offset + HASH_SIZE_BYTES));
    offset += HASH_SIZE_BYTES;
  }

  if (extraHashes.length !== expectedExtraHashes) {
    warnings.push(
      `Extra hash count mismatch: expected ${expectedExtraHashes} (popcount(minIndex)), got ${extraHashes.length}`
    );
  }

  const maxIndex = leafCount === 0n ? minIndex : minIndex + leafCount - 1n;
  return {
    leafCount,
    minIndex,
    maxIndex,
    leafHashes,
    extraHashes,
    expectedExtraHashes,
    warnings,
  };
};

export const computeCcfInternalTreeRoot = async (
  decoded: CcfInternalTreeDecode
): Promise<Uint8Array | null> => {
  if (decoded.leafHashes.length === 0) return null;

  const level: Uint8Array[] = decoded.leafHashes.slice();
  let it = decoded.minIndex;
  let extraIndex = 0;

  while (it !== 0n || level.length > 1) {
    if ((it & 1n) === 1n) {
      if (extraIndex >= decoded.extraHashes.length) {
        return null;
      }
      level.unshift(decoded.extraHashes[extraIndex++]);
    }

    const next: Uint8Array[] = [];
    for (let i = 0; i < level.length; i += 2) {
      if (i + 1 >= level.length) {
        next.push(level[i]);
      } else {
        const combined = concatTwo(level[i], level[i + 1]);
        next.push(await sha256(combined));
      }
    }

    level.splice(0, level.length, ...next);
    it >>= 1n;
  }

  return level.length === 1 ? level[0] : null;
};

export const formatCcfInternalTreeSummary = (
  decoded: CcfInternalTreeDecode,
  root: Uint8Array | null
): string => {
  const lines: string[] = [];
  lines.push(`=== CCF Serialised Merkle Tree (${CCF_INTERNAL_TABLES.TREE}) ===`);
  lines.push('Format: merklecpp Tree serialisation (big-endian u64 header + 32-byte hashes)');
  lines.push('');
  lines.push(`min_index (num_flushed): ${decoded.minIndex.toString()}`);
  lines.push(`leaf_count: ${decoded.leafCount.toString()}`);
  lines.push(`max_index: ${decoded.maxIndex.toString()}`);
  lines.push(`extra_hashes: ${decoded.extraHashes.length} (expected ${decoded.expectedExtraHashes})`);
  lines.push(`root: ${root ? toHexStringLower(root) : '<unavailable>'}`);
  lines.push('');

  if (decoded.leafHashes.length > 0) {
    const first = decoded.leafHashes[0];
    const last = decoded.leafHashes[decoded.leafHashes.length - 1];
    lines.push('Leaves:');
    lines.push(`  [${decoded.minIndex.toString()}] ${toHexStringLower(first)}`);
    if (decoded.leafHashes.length > 1) {
      lines.push(`  [${decoded.maxIndex.toString()}] ${toHexStringLower(last)}`);
    }
    if (decoded.leafHashes.length > 2) {
      lines.push(`  ... (${decoded.leafHashes.length - 2} more)`);
    }
    lines.push('');
  }

  if (decoded.extraHashes.length > 0) {
    lines.push('Extra hashes (left-edge siblings):');
    const maxToShow = 8;
    for (let i = 0; i < Math.min(decoded.extraHashes.length, maxToShow); i++) {
      lines.push(`  ${i}: ${toHexStringLower(decoded.extraHashes[i])}`);
    }
    if (decoded.extraHashes.length > maxToShow) {
      lines.push(`  ... (${decoded.extraHashes.length - maxToShow} more)`);
    }
    lines.push('');
  }

  if (decoded.warnings.length > 0) {
    lines.push('Warnings:');
    for (const w of decoded.warnings) {
      lines.push(`- ${w}`);
    }
    lines.push('');
  }

  return lines.join('\n');
};
