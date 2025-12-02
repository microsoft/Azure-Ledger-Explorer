/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */



export class MerkleTree {
  // First leaf is always a 32-byte zero hash
  private readonly leaves: Uint8Array[] = [new Uint8Array(32)];

  /**
   * Get read-only access to the leaves
   */
  get Leaves(): readonly Uint8Array[] {
    return this.leaves;
  }

  /**
   * Insert a leaf using byte array data
   */
  insertLeaf(data: Uint8Array): void {
    this.leaves.push(data);
  }

  /**
   * Calculate the final root hash of the Merkle Tree using SHA-256
   * Optimized to reduce array copying
   */
  async calculateRootHash(): Promise<Uint8Array> {
    if (this.leaves.length === 0) {
      throw new Error("Cannot calculate root hash of an empty tree.");
    }

    // Start with the leaves and avoid copying when possible
    let currentLevel = this.leaves.slice(); // Only one initial copy

    while (currentLevel.length > 1) {
      const nextLevel: Uint8Array[] = [];
      const levelLength = currentLevel.length;

      for (let i = 0; i < levelLength; i += 2) {
        // If there's a pair, merge and hash them
        if (i + 1 < levelLength) {
          const combined = this.combine(currentLevel[i], currentLevel[i + 1]);
          const hash = await this.computeHash(combined);
          nextLevel.push(hash);
        } else {
          // If the number of nodes is odd, defer calculation to next level
          nextLevel.push(currentLevel[i]);
        }
      }
      currentLevel = nextLevel;
    }

    return currentLevel[0];
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
    result[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return result;
}
