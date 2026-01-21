/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

/**
 * Unit tests for ledger validation logic
 * Tests for analyzeLedgerSequence, parseLedgerFilename, and related functions
 */

import { describe, it, expect } from 'vitest';
import { 
  analyzeLedgerSequence, 
  parseLedgerFilename,
  getRangeKey 
} from '../ledger-validation';

// Helper to create a file object with a filename
const createFile = (filename: string) => ({ filename });

describe('parseLedgerFilename', () => {
  it('parses valid committed ledger filename', () => {
    const result = parseLedgerFilename('ledger_1-14.committed');
    expect(result).toEqual({
      filename: 'ledger_1-14.committed',
      startNo: 1,
      endNo: 14,
      isValid: true,
    });
  });

  it('parses large sequence numbers', () => {
    const result = parseLedgerFilename('ledger_15-9487.committed');
    expect(result).toEqual({
      filename: 'ledger_15-9487.committed',
      startNo: 15,
      endNo: 9487,
      isValid: true,
    });
  });

  it('parses uncommitted ledger filename', () => {
    // Note: The current implementation requires .committed suffix
    // Uncommitted files are treated as invalid
    const result = parseLedgerFilename('ledger_100-200');
    expect(result.isValid).toBe(false);
  });

  it('returns invalid for non-ledger filename', () => {
    const result = parseLedgerFilename('some-other-file.txt');
    expect(result.isValid).toBe(false);
    expect(result.startNo).toBe(-1);
    expect(result.endNo).toBe(-1);
  });

  it('returns invalid for malformed ledger filename', () => {
    const result = parseLedgerFilename('ledger_abc-def.committed');
    expect(result.isValid).toBe(false);
  });
});

describe('getRangeKey', () => {
  it('creates correct range key', () => {
    expect(getRangeKey(1, 100)).toBe('1-100');
    expect(getRangeKey(15, 9487)).toBe('15-9487');
  });
});

describe('analyzeLedgerSequence', () => {
  describe('basic analysis', () => {
    it('returns empty analysis for empty file list', () => {
      const result = analyzeLedgerSequence([]);
      expect(result.groups).toHaveLength(0);
      expect(result.sortedRanges).toHaveLength(0);
      expect(result.gaps).toHaveLength(0);
      expect(result.overlaps).toHaveLength(0);
      expect(result.startsAtOne).toBe(false);
      expect(result.isContiguous).toBe(true);
    });

    it('analyzes single file correctly', () => {
      const files = [createFile('ledger_1-100.committed')];
      const result = analyzeLedgerSequence(files);
      
      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].rangeKey).toBe('1-100');
      expect(result.groups[0].startNo).toBe(1);
      expect(result.groups[0].endNo).toBe(100);
      expect(result.groups[0].isDuplicate).toBe(false);
      expect(result.startsAtOne).toBe(true);
      expect(result.isContiguous).toBe(true);
      expect(result.hasOverlaps).toBe(false);
    });

    it('analyzes multiple contiguous files', () => {
      const files = [
        createFile('ledger_1-100.committed'),
        createFile('ledger_101-200.committed'),
        createFile('ledger_201-300.committed'),
      ];
      const result = analyzeLedgerSequence(files);
      
      expect(result.groups).toHaveLength(3);
      expect(result.startsAtOne).toBe(true);
      expect(result.isContiguous).toBe(true);
      expect(result.gaps).toHaveLength(0);
      expect(result.hasOverlaps).toBe(false);
    });

    it('sorts files by start number regardless of input order', () => {
      const files = [
        createFile('ledger_201-300.committed'),
        createFile('ledger_1-100.committed'),
        createFile('ledger_101-200.committed'),
      ];
      const result = analyzeLedgerSequence(files);
      
      expect(result.sortedRanges[0].startNo).toBe(1);
      expect(result.sortedRanges[1].startNo).toBe(101);
      expect(result.sortedRanges[2].startNo).toBe(201);
    });
  });

  describe('duplicate detection', () => {
    it('detects duplicate files with same range from different sources', () => {
      const files = [
        { filename: 'ledger_1-100.committed', source: 'a' },
        { filename: 'ledger_1-100.committed', source: 'b' },
      ];
      const result = analyzeLedgerSequence(files);
      
      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].isDuplicate).toBe(true);
      expect(result.groups[0].files).toHaveLength(2);
      expect(result.duplicateRanges.has('1-100')).toBe(true);
    });

    it('detects multiple duplicate groups', () => {
      const files = [
        { filename: 'ledger_1-100.committed', source: 'a' },
        { filename: 'ledger_1-100.committed', source: 'b' },
        { filename: 'ledger_101-200.committed', source: 'a' },
        { filename: 'ledger_101-200.committed', source: 'b' },
        { filename: 'ledger_101-200.committed', source: 'c' },
      ];
      const result = analyzeLedgerSequence(files);
      
      expect(result.groups).toHaveLength(2);
      expect(result.groups[0].files).toHaveLength(2);
      expect(result.groups[1].files).toHaveLength(3);
      expect(result.duplicateRanges.size).toBe(2);
    });

    it('does not mark single files as duplicates', () => {
      const files = [
        createFile('ledger_1-100.committed'),
        createFile('ledger_101-200.committed'),
      ];
      const result = analyzeLedgerSequence(files);
      
      expect(result.groups[0].isDuplicate).toBe(false);
      expect(result.groups[1].isDuplicate).toBe(false);
      expect(result.duplicateRanges.size).toBe(0);
    });
  });

  describe('gap detection', () => {
    it('detects single gap', () => {
      const files = [
        createFile('ledger_1-100.committed'),
        createFile('ledger_201-300.committed'), // Gap: 101-200
      ];
      const result = analyzeLedgerSequence(files);
      
      expect(result.isContiguous).toBe(false);
      expect(result.gaps).toHaveLength(1);
      expect(result.gaps[0]).toEqual({ startNo: 101, endNo: 200 });
    });

    it('detects multiple gaps', () => {
      const files = [
        createFile('ledger_1-100.committed'),
        createFile('ledger_201-300.committed'), // Gap: 101-200
        createFile('ledger_401-500.committed'), // Gap: 301-400
      ];
      const result = analyzeLedgerSequence(files);
      
      expect(result.isContiguous).toBe(false);
      expect(result.gaps).toHaveLength(2);
      expect(result.gaps[0]).toEqual({ startNo: 101, endNo: 200 });
      expect(result.gaps[1]).toEqual({ startNo: 301, endNo: 400 });
    });

    it('detects small gaps (single sequence number)', () => {
      const files = [
        createFile('ledger_1-100.committed'),
        createFile('ledger_102-200.committed'), // Gap: just sequence 101
      ];
      const result = analyzeLedgerSequence(files);
      
      expect(result.isContiguous).toBe(false);
      expect(result.gaps).toHaveLength(1);
      expect(result.gaps[0]).toEqual({ startNo: 101, endNo: 101 });
    });

    it('does not report gap at beginning if not starting from 1', () => {
      const files = [
        createFile('ledger_100-200.committed'),
        createFile('ledger_201-300.committed'),
      ];
      const result = analyzeLedgerSequence(files);
      
      expect(result.startsAtOne).toBe(false);
      expect(result.isContiguous).toBe(true); // Contiguous within the range
      expect(result.gaps).toHaveLength(0);
    });
  });

  describe('overlap detection', () => {
    it('detects overlapping files', () => {
      const files = [
        createFile('ledger_1-100.committed'),
        createFile('ledger_50-150.committed'), // Overlaps: 50-100
      ];
      const result = analyzeLedgerSequence(files);
      
      expect(result.hasOverlaps).toBe(true);
      expect(result.overlaps).toHaveLength(1);
      expect(result.overlaps[0].first.startNo).toBe(1);
      expect(result.overlaps[0].first.endNo).toBe(100);
      expect(result.overlaps[0].second.startNo).toBe(50);
      expect(result.overlaps[0].second.endNo).toBe(150);
    });

    it('detects multiple overlaps with 3+ files', () => {
      const files = [
        createFile('ledger_15-9487.committed'),
        createFile('ledger_15-9493.committed'),
        createFile('ledger_15-9496.committed'),
      ];
      const result = analyzeLedgerSequence(files);
      
      expect(result.hasOverlaps).toBe(true);
      expect(result.overlaps).toHaveLength(2);
      // First overlap: 15-9487 overlaps with 15-9493
      expect(result.overlaps[0].first.endNo).toBe(9487);
      expect(result.overlaps[0].second.endNo).toBe(9493);
      // Second overlap: 15-9493 overlaps with 15-9496
      expect(result.overlaps[1].first.endNo).toBe(9493);
      expect(result.overlaps[1].second.endNo).toBe(9496);
    });

    it('detects exact boundary overlap (end equals start)', () => {
      const files = [
        createFile('ledger_1-100.committed'),
        createFile('ledger_100-200.committed'), // Overlaps at exactly 100
      ];
      const result = analyzeLedgerSequence(files);
      
      expect(result.hasOverlaps).toBe(true);
      expect(result.overlaps).toHaveLength(1);
    });

    it('does not report overlap for adjacent files', () => {
      const files = [
        createFile('ledger_1-100.committed'),
        createFile('ledger_101-200.committed'), // Adjacent, not overlapping
      ];
      const result = analyzeLedgerSequence(files);
      
      expect(result.hasOverlaps).toBe(false);
      expect(result.overlaps).toHaveLength(0);
    });

    it('handles complete containment overlap', () => {
      const files = [
        createFile('ledger_1-1000.committed'),
        createFile('ledger_50-100.committed'), // Completely contained
      ];
      const result = analyzeLedgerSequence(files);
      
      expect(result.hasOverlaps).toBe(true);
      expect(result.overlaps).toHaveLength(1);
    });
  });

  describe('startsAtOne detection', () => {
    it('returns true when first file starts at 1', () => {
      const files = [createFile('ledger_1-100.committed')];
      const result = analyzeLedgerSequence(files);
      expect(result.startsAtOne).toBe(true);
    });

    it('returns false when first file does not start at 1', () => {
      const files = [createFile('ledger_10-100.committed')];
      const result = analyzeLedgerSequence(files);
      expect(result.startsAtOne).toBe(false);
    });

    it('returns false for empty file list', () => {
      const result = analyzeLedgerSequence([]);
      expect(result.startsAtOne).toBe(false);
    });
  });

  describe('invalid filename handling', () => {
    it('filters out invalid filenames', () => {
      const files = [
        createFile('ledger_1-100.committed'),
        createFile('not-a-ledger-file.txt'),
        createFile('ledger_101-200.committed'),
      ];
      const result = analyzeLedgerSequence(files);
      
      expect(result.groups).toHaveLength(2);
      expect(result.isContiguous).toBe(true);
    });

    it('handles all invalid filenames', () => {
      const files = [
        createFile('invalid1.txt'),
        createFile('invalid2.txt'),
      ];
      const result = analyzeLedgerSequence(files);
      
      expect(result.groups).toHaveLength(0);
      expect(result.sortedRanges).toHaveLength(0);
    });
  });

  describe('complex scenarios', () => {
    it('handles mixed duplicates, gaps, and overlaps', () => {
      const files = [
        // Duplicates for 1-100
        { filename: 'ledger_1-100.committed', source: 'a' },
        { filename: 'ledger_1-100.committed', source: 'b' },
        // Gap: 101-199
        // Overlapping files
        { filename: 'ledger_200-400.committed', source: 'a' },
        { filename: 'ledger_300-500.committed', source: 'a' }, // Overlaps with above
      ];
      const result = analyzeLedgerSequence(files);
      
      expect(result.groups).toHaveLength(3);
      expect(result.duplicateRanges.has('1-100')).toBe(true);
      expect(result.gaps).toHaveLength(1);
      expect(result.gaps[0]).toEqual({ startNo: 101, endNo: 199 });
      expect(result.hasOverlaps).toBe(true);
      expect(result.overlaps).toHaveLength(1);
    });

    it('preserves original file properties in analysis', () => {
      const files = [
        { filename: 'ledger_1-100.committed', customProp: 'value1', id: 'file1' },
        { filename: 'ledger_101-200.committed', customProp: 'value2', id: 'file2' },
      ];
      const result = analyzeLedgerSequence(files);
      
      expect(result.sortedRanges[0].customProp).toBe('value1');
      expect(result.sortedRanges[0].id).toBe('file1');
      expect(result.sortedRanges[1].customProp).toBe('value2');
      expect(result.sortedRanges[1].id).toBe('file2');
    });
  });
});
