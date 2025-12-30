/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

/**
 * Unit tests for LedgerChunkV2 parser
 * 
 * These tests are inspired by the CCF Python ledger parser tests:
 * https://github.com/microsoft/CCF/blob/main/python/src/ccf/ledger.py
 * https://github.com/microsoft/CCF/blob/main/tests/e2e_operations.py
 */

import { describe, it, expect } from 'vitest';
import { LedgerChunkV2 } from '../ledger-chunk';
import { EntryType, LEDGER_CONSTANTS, entryTypeHelpers } from '../types';
import { 
  loadTestLedgerFile, 
  TEST_FILES, 
  EXPECTED_RANGES,
  createEmptyLedgerBuffer,
  createCorruptedLedgerBuffer
} from './fixtures';

describe('LedgerChunkV2', () => {
  describe('constructor', () => {
    it('should create a parser instance with valid parameters', async () => {
      const buffer = await loadTestLedgerFile(TEST_FILES.LEDGER_1_14);
      const chunk = new LedgerChunkV2('ledger_1-14.committed', buffer);
      
      expect(chunk.fileName).toBe('ledger_1-14.committed');
      expect(chunk.position).toBe(8); // After reading the 8-byte file size header
    });

    it('should read the file size from the first 8 bytes', async () => {
      const buffer = await loadTestLedgerFile(TEST_FILES.LEDGER_1_14);
      const chunk = new LedgerChunkV2('ledger_1-14.committed', buffer);
      
      // Position should start after the 8-byte header
      expect(chunk.position).toBe(8);
      expect(chunk.hasMore).toBe(true);
    });

    it('should handle empty ledger buffer', () => {
      const buffer = createEmptyLedgerBuffer();
      const chunk = new LedgerChunkV2('empty.committed', buffer);
      
      expect(chunk.position).toBe(8);
      expect(chunk.hasMore).toBe(false);
    });
  });

  describe('readSingleTransaction', () => {
    it('should read the first transaction from a ledger chunk', async () => {
      const buffer = await loadTestLedgerFile(TEST_FILES.LEDGER_1_14);
      const chunk = new LedgerChunkV2('ledger_1-14.committed', buffer);
      
      const tx = await chunk.readSingleTransaction();
      
      expect(tx).not.toBeNull();
      expect(tx!.header).toBeDefined();
      expect(tx!.gcmHeader).toBeDefined();
      expect(tx!.publicDomain).toBeDefined();
      expect(tx!.txDigest).toBeDefined();
    });

    it('should parse transaction header correctly', async () => {
      const buffer = await loadTestLedgerFile(TEST_FILES.LEDGER_1_14);
      const chunk = new LedgerChunkV2('ledger_1-14.committed', buffer);
      
      const tx = await chunk.readSingleTransaction();
      
      expect(tx!.header.version).toBeGreaterThanOrEqual(0);
      expect(tx!.header.flags).toBeGreaterThanOrEqual(0);
      expect(tx!.header.size).toBeGreaterThan(0);
    });

    it('should parse GCM header with view and sequence number', async () => {
      const buffer = await loadTestLedgerFile(TEST_FILES.LEDGER_1_14);
      const chunk = new LedgerChunkV2('ledger_1-14.committed', buffer);
      
      const tx = await chunk.readSingleTransaction();
      
      // First transaction should have seqNo = 1
      expect(tx!.gcmHeader.seqNo).toBe(1);
      expect(tx!.gcmHeader.view).toBeGreaterThanOrEqual(1);
      expect(tx!.gcmHeader.gcmTag).toBeInstanceOf(Uint8Array);
      expect(tx!.gcmHeader.gcmTag.length).toBe(LEDGER_CONSTANTS.GCM_SIZE_TAG);
    });

    it('should parse public domain with entry type', async () => {
      const buffer = await loadTestLedgerFile(TEST_FILES.LEDGER_1_14);
      const chunk = new LedgerChunkV2('ledger_1-14.committed', buffer);
      
      const tx = await chunk.readSingleTransaction();
      
      expect(tx!.publicDomain.entryType).toBeDefined();
      expect(Object.values(EntryType)).toContain(tx!.publicDomain.entryType);
      expect(tx!.publicDomain.txVersion).toBeGreaterThanOrEqual(0);
    });

    it('should return null when no more transactions', async () => {
      const buffer = createEmptyLedgerBuffer();
      const chunk = new LedgerChunkV2('empty.committed', buffer);
      
      const tx = await chunk.readSingleTransaction();
      
      expect(tx).toBeNull();
    });

    it('should calculate transaction digest', async () => {
      const buffer = await loadTestLedgerFile(TEST_FILES.LEDGER_1_14);
      const chunk = new LedgerChunkV2('ledger_1-14.committed', buffer);
      
      const tx = await chunk.readSingleTransaction();
      
      expect(tx!.txDigest).toBeInstanceOf(Uint8Array);
      expect(tx!.txDigest.length).toBe(LEDGER_CONSTANTS.SHA256_HASH_SIZE);
    });
  });

  describe('readAllTransactions', () => {
    it('should iterate over all transactions in ledger_1-14', async () => {
      const buffer = await loadTestLedgerFile(TEST_FILES.LEDGER_1_14);
      const chunk = new LedgerChunkV2('ledger_1-14.committed', buffer);
      
      const transactions = [];
      for await (const tx of chunk.readAllTransactions()) {
        transactions.push(tx);
      }
      
      // Ledger_1-14 should have 14 transactions
      expect(transactions.length).toBe(14);
    });

    it('should read transactions with sequential sequence numbers', async () => {
      const buffer = await loadTestLedgerFile(TEST_FILES.LEDGER_1_14);
      const chunk = new LedgerChunkV2('ledger_1-14.committed', buffer);
      
      const seqNos: number[] = [];
      for await (const tx of chunk.readAllTransactions()) {
        seqNos.push(tx.gcmHeader.seqNo);
      }
      
      // Verify sequential order starting from 1
      expect(seqNos[0]).toBe(EXPECTED_RANGES[TEST_FILES.LEDGER_1_14].start);
      expect(seqNos[seqNos.length - 1]).toBe(EXPECTED_RANGES[TEST_FILES.LEDGER_1_14].end);
      
      // Verify sequential (each seqNo is +1 from previous)
      for (let i = 1; i < seqNos.length; i++) {
        expect(seqNos[i]).toBe(seqNos[i - 1] + 1);
      }
    });

    it('should parse all transactions from a larger ledger chunk', async () => {
      const buffer = await loadTestLedgerFile(TEST_FILES.LEDGER_15_3926);
      const chunk = new LedgerChunkV2('ledger_15-3926.committed', buffer);
      
      const transactions = [];
      for await (const tx of chunk.readAllTransactions()) {
        transactions.push(tx);
      }
      
      // Should have 3926 - 15 + 1 = 3912 transactions
      const expectedCount = EXPECTED_RANGES[TEST_FILES.LEDGER_15_3926].end - 
                           EXPECTED_RANGES[TEST_FILES.LEDGER_15_3926].start + 1;
      expect(transactions.length).toBe(expectedCount);
    });

    it('should maintain consistent view across transactions in a chunk', async () => {
      const buffer = await loadTestLedgerFile(TEST_FILES.LEDGER_1_14);
      const chunk = new LedgerChunkV2('ledger_1-14.committed', buffer);
      
      let previousView: number | null = null;
      for await (const tx of chunk.readAllTransactions()) {
        // View should be consistent or monotonically increasing
        if (previousView !== null) {
          expect(tx.gcmHeader.view).toBeGreaterThanOrEqual(previousView);
        }
        previousView = tx.gcmHeader.view;
      }
    });
  });

  describe('public domain parsing', () => {
    it('should parse writes from transactions', async () => {
      const buffer = await loadTestLedgerFile(TEST_FILES.LEDGER_1_14);
      const chunk = new LedgerChunkV2('ledger_1-14.committed', buffer);
      
      let hasWrites = false;
      for await (const tx of chunk.readAllTransactions()) {
        if (tx.publicDomain.writes.length > 0) {
          hasWrites = true;
          for (const write of tx.publicDomain.writes) {
            expect(write.key).toBeDefined();
            expect(write.value).toBeInstanceOf(Uint8Array);
            expect(typeof write.version).toBe('number');
          }
        }
      }
      
      // At least some transactions should have writes
      expect(hasWrites).toBe(true);
    });

    it('should parse map names in writes', async () => {
      const buffer = await loadTestLedgerFile(TEST_FILES.LEDGER_1_14);
      const chunk = new LedgerChunkV2('ledger_1-14.committed', buffer);
      
      const mapNames = new Set<string>();
      for await (const tx of chunk.readAllTransactions()) {
        for (const write of tx.publicDomain.writes) {
          if (write.mapName) {
            mapNames.add(write.mapName);
          }
        }
      }
      
      // Should have some public: prefixed maps
      const publicMaps = [...mapNames].filter(name => name.startsWith('public:'));
      expect(publicMaps.length).toBeGreaterThan(0);
    });

    it('should parse deletes when present', async () => {
      const buffer = await loadTestLedgerFile(TEST_FILES.LEDGER_15_3926);
      const chunk = new LedgerChunkV2('ledger_15-3926.committed', buffer);
      
      for await (const tx of chunk.readAllTransactions()) {
        if (tx.publicDomain.deletes.length > 0) {
          for (const del of tx.publicDomain.deletes) {
            expect(del.key).toBeDefined();
            // Deletes have empty values
            expect(del.value.length).toBe(0);
          }
          break; // Just need to find one
        }
      }
      
      // Note: Not all ledgers have deletes, so we don't assert anything here
    });

    it('should handle claims digest based on entry type', async () => {
      const buffer = await loadTestLedgerFile(TEST_FILES.LEDGER_1_14);
      const chunk = new LedgerChunkV2('ledger_1-14.committed', buffer);
      
      for await (const tx of chunk.readAllTransactions()) {
        const hasClaims = entryTypeHelpers.hasClaims(tx.publicDomain.entryType);
        
        if (hasClaims) {
          expect(tx.publicDomain.claimsDigest.length).toBe(LEDGER_CONSTANTS.SHA256_HASH_SIZE);
        } else {
          expect(tx.publicDomain.claimsDigest.length).toBe(0);
        }
      }
    });

    it('should handle commit evidence digest based on entry type', async () => {
      const buffer = await loadTestLedgerFile(TEST_FILES.LEDGER_1_14);
      const chunk = new LedgerChunkV2('ledger_1-14.committed', buffer);
      
      for await (const tx of chunk.readAllTransactions()) {
        const hasCommitEvidence = entryTypeHelpers.hasCommitEvidence(tx.publicDomain.entryType);
        
        if (hasCommitEvidence) {
          expect(tx.publicDomain.commitEvidenceDigest.length).toBe(LEDGER_CONSTANTS.SHA256_HASH_SIZE);
        } else {
          expect(tx.publicDomain.commitEvidenceDigest.length).toBe(0);
        }
      }
    });
  });

  describe('position tracking', () => {
    it('should track position correctly during iteration', async () => {
      const buffer = await loadTestLedgerFile(TEST_FILES.LEDGER_1_14);
      const chunk = new LedgerChunkV2('ledger_1-14.committed', buffer);
      
      let previousPosition = chunk.position;
      for await (const _ of chunk.readAllTransactions()) {
        // Position should advance after each transaction
        expect(chunk.position).toBeGreaterThan(previousPosition);
        previousPosition = chunk.position;
      }
    });

    it('should indicate no more transactions when exhausted', async () => {
      const buffer = await loadTestLedgerFile(TEST_FILES.LEDGER_1_14);
      const chunk = new LedgerChunkV2('ledger_1-14.committed', buffer);
      
      expect(chunk.hasMore).toBe(true);
      
      // Exhaust all transactions
      let txCount = 0;
      for await (const _ of chunk.readAllTransactions()) {
        txCount++;
      }
      
      // Verify we read all expected transactions
      expect(txCount).toBe(14);
      
      // After reading all transactions, readSingleTransaction should return null
      const nextTx = await chunk.readSingleTransaction();
      expect(nextTx).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should handle corrupted ledger gracefully', async () => {
      const buffer = createCorruptedLedgerBuffer();
      const chunk = new LedgerChunkV2('corrupted.committed', buffer);
      
      // Reading should return null when buffer is exhausted
      const tx = await chunk.readSingleTransaction();
      expect(tx).toBeNull();
    });
  });
});

describe('LEDGER_CONSTANTS', () => {
  it('should have correct ledger header size', () => {
    // 2 bytes version + flags, 4 bytes size = 6, but CCF uses 8
    expect(LEDGER_CONSTANTS.LEDGER_HEADER_SIZE).toBe(8);
  });

  it('should have correct GCM sizes', () => {
    expect(LEDGER_CONSTANTS.GCM_SIZE_IV).toBe(12);
    expect(LEDGER_CONSTANTS.GCM_SIZE_TAG).toBe(16);
  });

  it('should have correct SHA256 hash size', () => {
    expect(LEDGER_CONSTANTS.SHA256_HASH_SIZE).toBe(32);
  });

  it('should have correct ledger domain size', () => {
    expect(LEDGER_CONSTANTS.LEDGER_DOMAIN_SIZE).toBe(8);
  });
});
