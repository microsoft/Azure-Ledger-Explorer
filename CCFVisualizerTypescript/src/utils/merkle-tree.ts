/**
 * TypeScript implementation of MerkleTree
 * Ported from C# CCFParser.MerkleTree
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
   */
  async calculateRootHash(): Promise<Uint8Array> {
    if (this.leaves.length === 0) {
      throw new Error("Cannot calculate root hash of an empty tree.");
    }

    let currentLevel = [...this.leaves];

    while (currentLevel.length > 1) {
      const nextLevel: Uint8Array[] = [];

      for (let i = 0; i < currentLevel.length; i += 2) {
        // If there's a pair, merge and hash them
        if (i + 1 < currentLevel.length) {
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
   * Combine two byte arrays
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
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return new Uint8Array(hashBuffer);
  }
}

/**
 * Convert Uint8Array to lowercase hex string
 */
export function toHexStringLower(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
