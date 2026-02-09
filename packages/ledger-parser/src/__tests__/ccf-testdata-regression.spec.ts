/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

/**
 * Regression tests using CCF testdata files.
 *
 * These tests fill coverage gaps identified in docs/CCF_TESTDATA_EVALUATION.md:
 * - Entry type 0 (WriteSet) — no commit evidence, no claims
 * - Entry type 3 (WriteSetWithCommitEvidence) — commit evidence but no claims
 * - Entry-type transitions within a service
 * - View transitions / re-seal boundaries
 * - Uncommitted file handling
 * - Multi-chunk Merkle verification across entry types
 * - Map name diversity (42 unique CCF map names)
 *
 * Source files: CCF/tests/testdata/{eol,expired,double_sealed,sgx}_service
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { LedgerChunkV2 } from '../ledger-chunk';
import type { Transaction } from '../types';
import { EntryType, LEDGER_CONSTANTS, entryTypeHelpers } from '../types';
import { loadTestLedgerFile, CCF_TESTDATA } from './fixtures';

// ---------------------------------------------------------------------------
// Shared transaction cache — each file is read + parsed exactly once
// ---------------------------------------------------------------------------

/** Pre-parsed transactions keyed by fixture path */
const txCache = new Map<string, Transaction[]>();
/** Pre-loaded ArrayBuffers keyed by fixture path (for tests that need fresh LedgerChunkV2 instances) */
const bufferCache = new Map<string, ArrayBuffer>();

/** All fixture paths that will be pre-loaded */
const ALL_FIXTURES = [
  CCF_TESTDATA.eol.LEDGER_1_2,
  CCF_TESTDATA.eol.LEDGER_3_11,
  CCF_TESTDATA.eol.LEDGER_34_35,
  CCF_TESTDATA.eol.LEDGER_36_37,
  CCF_TESTDATA.eol.LEDGER_494_UNCOMMITTED,
  CCF_TESTDATA.expired.LEDGER_1_4,
  CCF_TESTDATA.expired.LEDGER_5_15,
  CCF_TESTDATA.expired.LEDGER_16_26,
  CCF_TESTDATA.doubleSealed.LEDGER_484_485,
  CCF_TESTDATA.doubleSealed.LEDGER_486_491,
  CCF_TESTDATA.doubleSealed.LEDGER_503_505,
  CCF_TESTDATA.sgx.LEDGER_1_37,
];

async function parseFile(filename: string): Promise<Transaction[]> {
  const buffer = await loadTestLedgerFile(filename);
  bufferCache.set(filename, buffer);
  const chunk = new LedgerChunkV2(filename.split('/').pop()!, buffer);
  const transactions: Transaction[] = [];
  for await (const tx of chunk.readAllTransactions()) {
    transactions.push(tx);
  }
  return transactions;
}

beforeAll(async () => {
  await Promise.all(
    ALL_FIXTURES.map(async (file) => {
      txCache.set(file, await parseFile(file));
    }),
  );
});

/** Look up pre-parsed transactions (read-only) */
function cached(filename: string): Transaction[] {
  const result = txCache.get(filename);
  if (!result) throw new Error(`Fixture not pre-loaded: ${filename}`);
  return result;
}

/** Get a pre-loaded ArrayBuffer for tests that need a fresh LedgerChunkV2 */
function cachedBuffer(filename: string): ArrayBuffer {
  const result = bufferCache.get(filename);
  if (!result) throw new Error(`Buffer not pre-loaded: ${filename}`);
  return result;
}

// ---------------------------------------------------------------------------
// 1. WriteSet (entry type 0) — eol_service & sgx_service
// ---------------------------------------------------------------------------

describe('WriteSet (entry type 0) — eol_service', () => {
  it('should parse WriteSet transactions from ledger_1-2', () => {
    const transactions = cached(CCF_TESTDATA.eol.LEDGER_1_2);

    expect(transactions.length).toBe(2);
    expect(transactions[0].gcmHeader.seqNo).toBe(1);
    expect(transactions[1].gcmHeader.seqNo).toBe(2);

    // All transactions should be WriteSet (entry type 0)
    for (const tx of transactions) {
      expect(tx.publicDomain.entryType).toBe(EntryType.WriteSet);
    }
  });

  it('should have no claims digest and no commit evidence digest for WriteSet', () => {
    const transactions = cached(CCF_TESTDATA.eol.LEDGER_1_2);

    for (const tx of transactions) {
      expect(entryTypeHelpers.hasClaims(tx.publicDomain.entryType)).toBe(false);
      expect(entryTypeHelpers.hasCommitEvidence(tx.publicDomain.entryType)).toBe(false);
      expect(tx.publicDomain.claimsDigest.length).toBe(0);
      expect(tx.publicDomain.commitEvidenceDigest.length).toBe(0);
    }
  });

  it('should parse 9 WriteSet transactions from ledger_3-11', () => {
    const transactions = cached(CCF_TESTDATA.eol.LEDGER_3_11);

    expect(transactions.length).toBe(9);
    expect(transactions[0].gcmHeader.seqNo).toBe(3);
    expect(transactions[transactions.length - 1].gcmHeader.seqNo).toBe(11);

    for (const tx of transactions) {
      expect(tx.publicDomain.entryType).toBe(EntryType.WriteSet);
    }
  });

  it('should produce sequential sequence numbers across eol chunks', () => {
    const chunk1 = cached(CCF_TESTDATA.eol.LEDGER_1_2);
    const chunk2 = cached(CCF_TESTDATA.eol.LEDGER_3_11);

    const allSeqNos = [
      ...chunk1.map(tx => tx.gcmHeader.seqNo),
      ...chunk2.map(tx => tx.gcmHeader.seqNo),
    ];

    // Should be contiguous 1..11
    for (let i = 0; i < allSeqNos.length; i++) {
      expect(allSeqNos[i]).toBe(i + 1);
    }
  });
});

describe('WriteSet (entry type 0) — sgx_service', () => {
  it('should parse 37 transactions from the largest WriteSet chunk', () => {
    const transactions = cached(CCF_TESTDATA.sgx.LEDGER_1_37);

    expect(transactions.length).toBe(37);
    expect(transactions[0].gcmHeader.seqNo).toBe(1);
    expect(transactions[transactions.length - 1].gcmHeader.seqNo).toBe(37);
  });

  it('should contain WriteSet entry type for all transactions', () => {
    const transactions = cached(CCF_TESTDATA.sgx.LEDGER_1_37);

    for (const tx of transactions) {
      expect(tx.publicDomain.entryType).toBe(EntryType.WriteSet);
      expect(tx.publicDomain.claimsDigest.length).toBe(0);
      expect(tx.publicDomain.commitEvidenceDigest.length).toBe(0);
    }
  });

  it('should extract SGX-specific map names', () => {
    const transactions = cached(CCF_TESTDATA.sgx.LEDGER_1_37);

    const mapNames = new Set<string>();
    for (const tx of transactions) {
      for (const write of tx.publicDomain.writes) {
        if (write.mapName) {
          mapNames.add(write.mapName);
        }
      }
    }

    // SGX service should have node-related maps
    const mapList = [...mapNames];
    expect(mapList.some(m => m.startsWith('public:ccf.gov.nodes.'))).toBe(true);
    expect(mapList.some(m => m.startsWith('public:ccf.internal.'))).toBe(true);
  });

  it('should have valid transaction digests for all WriteSet transactions', () => {
    const transactions = cached(CCF_TESTDATA.sgx.LEDGER_1_37);

    for (const tx of transactions) {
      expect(tx.txDigest).toBeInstanceOf(Uint8Array);
      expect(tx.txDigest.length).toBe(LEDGER_CONSTANTS.SHA256_HASH_SIZE);
      // Digest should not be all zeros
      expect(tx.txDigest.some(b => b !== 0)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. WriteSetWithCommitEvidence (entry type 3) — expired_service
// ---------------------------------------------------------------------------

describe('WriteSetWithCommitEvidence (entry type 3) — expired_service', () => {
  it('should parse WriteSetWithCommitEvidence transactions from ledger_1-4', () => {
    const transactions = cached(CCF_TESTDATA.expired.LEDGER_1_4);

    expect(transactions.length).toBe(4);
    expect(transactions[0].gcmHeader.seqNo).toBe(1);
    expect(transactions[3].gcmHeader.seqNo).toBe(4);

    for (const tx of transactions) {
      expect(tx.publicDomain.entryType).toBe(EntryType.WriteSetWithCommitEvidence);
    }
  });

  it('should have commit evidence digest but no claims digest', () => {
    const transactions = cached(CCF_TESTDATA.expired.LEDGER_1_4);

    for (const tx of transactions) {
      expect(entryTypeHelpers.hasCommitEvidence(tx.publicDomain.entryType)).toBe(true);
      expect(entryTypeHelpers.hasClaims(tx.publicDomain.entryType)).toBe(false);

      expect(tx.publicDomain.commitEvidenceDigest.length).toBe(LEDGER_CONSTANTS.SHA256_HASH_SIZE);
      expect(tx.publicDomain.claimsDigest.length).toBe(0);
    }
  });

  it('should parse 11 WriteSetWithCommitEvidence transactions from ledger_5-15', () => {
    const transactions = cached(CCF_TESTDATA.expired.LEDGER_5_15);

    expect(transactions.length).toBe(11);
    expect(transactions[0].gcmHeader.seqNo).toBe(5);
    expect(transactions[transactions.length - 1].gcmHeader.seqNo).toBe(15);

    for (const tx of transactions) {
      expect(tx.publicDomain.entryType).toBe(EntryType.WriteSetWithCommitEvidence);
    }
  });

  it('should produce contiguous sequence numbers across expired chunks', () => {
    const chunk1 = cached(CCF_TESTDATA.expired.LEDGER_1_4);
    const chunk2 = cached(CCF_TESTDATA.expired.LEDGER_5_15);

    const allSeqNos = [
      ...chunk1.map(tx => tx.gcmHeader.seqNo),
      ...chunk2.map(tx => tx.gcmHeader.seqNo),
    ];

    // Should be contiguous 1..15
    for (let i = 0; i < allSeqNos.length; i++) {
      expect(allSeqNos[i]).toBe(i + 1);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Entry-type transition within a service
// ---------------------------------------------------------------------------

describe('Entry-type transition — expired_service ledger_16-26', () => {
  it('should parse transactions containing a transition from type 3 to type 4', () => {
    const transactions = cached(CCF_TESTDATA.expired.LEDGER_16_26);

    expect(transactions.length).toBe(11);
    expect(transactions[0].gcmHeader.seqNo).toBe(16);
    expect(transactions[transactions.length - 1].gcmHeader.seqNo).toBe(26);

    const entryTypes = new Set(transactions.map(tx => tx.publicDomain.entryType));

    // Should contain both entry types (transition chunk)
    expect(entryTypes.has(EntryType.WriteSetWithCommitEvidence)).toBe(true);
    expect(entryTypes.has(EntryType.WriteSetWithCommitEvidenceAndClaims)).toBe(true);
  });

  it('should have correct digest fields based on each transaction entry type', () => {
    const transactions = cached(CCF_TESTDATA.expired.LEDGER_16_26);

    for (const tx of transactions) {
      // Commit evidence present in both type 3 and type 4
      expect(tx.publicDomain.commitEvidenceDigest.length).toBe(LEDGER_CONSTANTS.SHA256_HASH_SIZE);

      if (tx.publicDomain.entryType === EntryType.WriteSetWithCommitEvidenceAndClaims) {
        // Type 4: claims digest present
        expect(tx.publicDomain.claimsDigest.length).toBe(LEDGER_CONSTANTS.SHA256_HASH_SIZE);
      } else {
        // Type 3: no claims digest
        expect(tx.publicDomain.claimsDigest.length).toBe(0);
      }
    }
  });

  it('should maintain contiguous sequence numbers across the transition', () => {
    // Combine all three expired_service chunks: type 3 only → type 3 only → type 3→4 transition
    const chunk1 = cached(CCF_TESTDATA.expired.LEDGER_1_4);
    const chunk2 = cached(CCF_TESTDATA.expired.LEDGER_5_15);
    const chunk3 = cached(CCF_TESTDATA.expired.LEDGER_16_26);

    const allSeqNos = [
      ...chunk1.map(tx => tx.gcmHeader.seqNo),
      ...chunk2.map(tx => tx.gcmHeader.seqNo),
      ...chunk3.map(tx => tx.gcmHeader.seqNo),
    ];

    // Should be contiguous 1..26
    expect(allSeqNos.length).toBe(26);
    for (let i = 0; i < allSeqNos.length; i++) {
      expect(allSeqNos[i]).toBe(i + 1);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. View transitions / re-seal boundary
// ---------------------------------------------------------------------------

describe('View transition — eol_service', () => {
  it('should handle the WriteSet → WriteSetWithCommitEvidenceAndClaims view boundary', () => {
    // ledger_34-35 is the last WriteSet chunk before recovery
    const before = cached(CCF_TESTDATA.eol.LEDGER_34_35);
    // ledger_36-37 is the first chunk after recovery with new entry type
    const after = cached(CCF_TESTDATA.eol.LEDGER_36_37);

    expect(before.length).toBe(2);
    expect(after.length).toBe(2);

    // Before recovery: all WriteSet
    for (const tx of before) {
      expect(tx.publicDomain.entryType).toBe(EntryType.WriteSet);
    }

    // After recovery: WriteSetWithCommitEvidenceAndClaims
    for (const tx of after) {
      expect(tx.publicDomain.entryType).toBe(EntryType.WriteSetWithCommitEvidenceAndClaims);
    }

    // The view number should change at the boundary
    const lastViewBefore = before[before.length - 1].gcmHeader.view;
    const firstViewAfter = after[0].gcmHeader.view;
    expect(firstViewAfter).toBeGreaterThan(lastViewBefore);
  });
});

describe('Re-seal boundary — double_sealed_service', () => {
  it('should parse chunks spanning a re-seal (view 4 → view 5)', () => {
    const preSeal = cached(CCF_TESTDATA.doubleSealed.LEDGER_484_485);
    const boundary = cached(CCF_TESTDATA.doubleSealed.LEDGER_486_491);
    const postSeal = cached(CCF_TESTDATA.doubleSealed.LEDGER_503_505);

    expect(preSeal.length).toBe(2);
    expect(boundary.length).toBe(6);
    expect(postSeal.length).toBe(3);

    // Sequence numbers should be correct for each chunk
    expect(preSeal[0].gcmHeader.seqNo).toBe(484);
    expect(preSeal[1].gcmHeader.seqNo).toBe(485);
    expect(boundary[0].gcmHeader.seqNo).toBe(486);
    expect(boundary[boundary.length - 1].gcmHeader.seqNo).toBe(491);
    expect(postSeal[0].gcmHeader.seqNo).toBe(503);
    expect(postSeal[postSeal.length - 1].gcmHeader.seqNo).toBe(505);
  });

  it('should detect the view number increase across the re-seal', () => {
    const preSeal = cached(CCF_TESTDATA.doubleSealed.LEDGER_484_485);
    const boundary = cached(CCF_TESTDATA.doubleSealed.LEDGER_486_491);
    const postSeal = cached(CCF_TESTDATA.doubleSealed.LEDGER_503_505);

    const allViews = [
      ...preSeal.map(tx => tx.gcmHeader.view),
      ...boundary.map(tx => tx.gcmHeader.view),
      ...postSeal.map(tx => tx.gcmHeader.view),
    ];

    // Views should be monotonically non-decreasing
    for (let i = 1; i < allViews.length; i++) {
      expect(allViews[i]).toBeGreaterThanOrEqual(allViews[i - 1]);
    }

    // There should be at least two distinct views across all three chunks spanning the re-seal
    const uniqueViews = new Set(allViews);
    expect(uniqueViews.size).toBeGreaterThanOrEqual(2);
  });

  it('should produce valid transaction digests across the re-seal', () => {
    const allTx = [
      ...cached(CCF_TESTDATA.doubleSealed.LEDGER_484_485),
      ...cached(CCF_TESTDATA.doubleSealed.LEDGER_486_491),
      ...cached(CCF_TESTDATA.doubleSealed.LEDGER_503_505),
    ];

    for (const tx of allTx) {
      expect(tx.txDigest).toBeInstanceOf(Uint8Array);
      expect(tx.txDigest.length).toBe(LEDGER_CONSTANTS.SHA256_HASH_SIZE);
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Uncommitted file handling
// ---------------------------------------------------------------------------

describe('Uncommitted file handling', () => {
  it('should parse transactions from an uncommitted ledger file', () => {
    // Uncommitted files are valid ledger data that hasn't been sealed yet.
    // The parser should still be able to read whatever transactions are present.
    // The file was already parsed during beforeAll; the key assertion is that
    // parsing didn't throw and the resulting transactions have valid structure.
    const transactions = cached(CCF_TESTDATA.eol.LEDGER_494_UNCOMMITTED);

    expect(transactions.length).toBeGreaterThanOrEqual(0);

    for (const tx of transactions) {
      expect(tx.gcmHeader.seqNo).toBeGreaterThan(0);
      expect(tx.txDigest).toBeInstanceOf(Uint8Array);
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Merkle verification across entry types
// ---------------------------------------------------------------------------

describe('Merkle verification across entry types', () => {
  it('should verify eol_service WriteSet chunks with Merkle tree', async () => {
    const chunk1 = new LedgerChunkV2('ledger_1-2.committed', cachedBuffer(CCF_TESTDATA.eol.LEDGER_1_2));
    const { merkleTree: tree1 } = await chunk1.verifyTransactions();

    const chunk2 = new LedgerChunkV2('ledger_3-11.committed', cachedBuffer(CCF_TESTDATA.eol.LEDGER_3_11));
    const { result: result2 } = await chunk2.verifyTransactions(tree1);

    // Second chunk should verify successfully with the tree carried from the first
    expect(result2.transactionCount).toBe(9);
    // Note: verification may or may not find a signature depending on the chunk
  });

  it('should verify expired_service WriteSetWithCommitEvidence chunks', async () => {
    const chunk1 = new LedgerChunkV2('ledger_1-4.committed', cachedBuffer(CCF_TESTDATA.expired.LEDGER_1_4));
    const { merkleTree: tree1 } = await chunk1.verifyTransactions();

    const chunk2 = new LedgerChunkV2('ledger_5-15.committed', cachedBuffer(CCF_TESTDATA.expired.LEDGER_5_15));
    const { merkleTree: tree2 } = await chunk2.verifyTransactions(tree1);

    // Transition chunk: type 3 → type 4
    const chunk3 = new LedgerChunkV2('ledger_16-26.committed', cachedBuffer(CCF_TESTDATA.expired.LEDGER_16_26));
    const { result: result3 } = await chunk3.verifyTransactions(tree2);

    expect(result3.transactionCount).toBe(11);
  });

  it('should verify sgx_service single large WriteSet chunk', async () => {
    const chunk = new LedgerChunkV2('ledger_1-37.committed', cachedBuffer(CCF_TESTDATA.sgx.LEDGER_1_37));
    const { result } = await chunk.verifyTransactions();

    expect(result.transactionCount).toBe(37);
  });
});

// ---------------------------------------------------------------------------
// 7. Map name diversity
// ---------------------------------------------------------------------------

describe('Map name diversity across CCF testdata', () => {
  it('should extract a rich set of CCF map names from sgx_service', () => {
    const transactions = cached(CCF_TESTDATA.sgx.LEDGER_1_37);

    const mapNames = new Set<string>();
    for (const tx of transactions) {
      for (const write of tx.publicDomain.writes) {
        if (write.mapName) {
          mapNames.add(write.mapName);
        }
      }
      for (const del of tx.publicDomain.deletes) {
        if (del.mapName) {
          mapNames.add(del.mapName);
        }
      }
    }

    // SGX service has a diverse set of maps
    expect(mapNames.size).toBeGreaterThan(10);

    // Should include governance, internal, and node maps
    const mapList = [...mapNames];
    expect(mapList.some(m => m.includes('ccf.gov.'))).toBe(true);
    expect(mapList.some(m => m.includes('ccf.internal.'))).toBe(true);
    expect(mapList.some(m => m.includes('ccf.gov.nodes.'))).toBe(true);
  });

  it('should extract map names from all service types consistently', () => {
    const allMaps = new Set<string>();

    // Collect from all services
    const files = [
      CCF_TESTDATA.eol.LEDGER_1_2,
      CCF_TESTDATA.eol.LEDGER_3_11,
      CCF_TESTDATA.expired.LEDGER_1_4,
      CCF_TESTDATA.expired.LEDGER_5_15,
      CCF_TESTDATA.sgx.LEDGER_1_37,
    ];

    for (const file of files) {
      for (const tx of cached(file)) {
        for (const write of tx.publicDomain.writes) {
          if (write.mapName) {
            allMaps.add(write.mapName);
          }
        }
      }
    }

    // Across all services we should find many unique maps
    expect(allMaps.size).toBeGreaterThan(15);

    // All map names should be public: prefixed
    for (const mapName of allMaps) {
      expect(mapName.startsWith('public:')).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 8. Cross-cutting structural assertions
// ---------------------------------------------------------------------------

describe('Cross-cutting structural assertions', () => {
  it.each([
    { name: 'eol ledger_1-2', file: CCF_TESTDATA.eol.LEDGER_1_2, expectedCount: 2 },
    { name: 'eol ledger_3-11', file: CCF_TESTDATA.eol.LEDGER_3_11, expectedCount: 9 },
    { name: 'expired ledger_1-4', file: CCF_TESTDATA.expired.LEDGER_1_4, expectedCount: 4 },
    { name: 'expired ledger_5-15', file: CCF_TESTDATA.expired.LEDGER_5_15, expectedCount: 11 },
    { name: 'expired ledger_16-26', file: CCF_TESTDATA.expired.LEDGER_16_26, expectedCount: 11 },
    { name: 'double_sealed ledger_484-485', file: CCF_TESTDATA.doubleSealed.LEDGER_484_485, expectedCount: 2 },
    { name: 'double_sealed ledger_486-491', file: CCF_TESTDATA.doubleSealed.LEDGER_486_491, expectedCount: 6 },
    { name: 'double_sealed ledger_503-505', file: CCF_TESTDATA.doubleSealed.LEDGER_503_505, expectedCount: 3 },
    { name: 'sgx ledger_1-37', file: CCF_TESTDATA.sgx.LEDGER_1_37, expectedCount: 37 },
  ])('$name: should parse exactly $expectedCount transactions', ({ file, expectedCount }) => {
    const transactions = cached(file);
    expect(transactions.length).toBe(expectedCount);
  });

  it.each([
    { name: 'eol ledger_1-2', file: CCF_TESTDATA.eol.LEDGER_1_2, startSeq: 1, endSeq: 2 },
    { name: 'eol ledger_3-11', file: CCF_TESTDATA.eol.LEDGER_3_11, startSeq: 3, endSeq: 11 },
    { name: 'expired ledger_1-4', file: CCF_TESTDATA.expired.LEDGER_1_4, startSeq: 1, endSeq: 4 },
    { name: 'expired ledger_5-15', file: CCF_TESTDATA.expired.LEDGER_5_15, startSeq: 5, endSeq: 15 },
    { name: 'expired ledger_16-26', file: CCF_TESTDATA.expired.LEDGER_16_26, startSeq: 16, endSeq: 26 },
    { name: 'double_sealed ledger_484-485', file: CCF_TESTDATA.doubleSealed.LEDGER_484_485, startSeq: 484, endSeq: 485 },
    { name: 'double_sealed ledger_486-491', file: CCF_TESTDATA.doubleSealed.LEDGER_486_491, startSeq: 486, endSeq: 491 },
    { name: 'double_sealed ledger_503-505', file: CCF_TESTDATA.doubleSealed.LEDGER_503_505, startSeq: 503, endSeq: 505 },
    { name: 'sgx ledger_1-37', file: CCF_TESTDATA.sgx.LEDGER_1_37, startSeq: 1, endSeq: 37 },
  ])('$name: sequence range $startSeq–$endSeq', ({ file, startSeq, endSeq }) => {
    const transactions = cached(file);

    expect(transactions[0].gcmHeader.seqNo).toBe(startSeq);
    expect(transactions[transactions.length - 1].gcmHeader.seqNo).toBe(endSeq);

    // Verify strictly sequential
    for (let i = 1; i < transactions.length; i++) {
      expect(transactions[i].gcmHeader.seqNo).toBe(transactions[i - 1].gcmHeader.seqNo + 1);
    }
  });
});
