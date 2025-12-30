/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

/**
 * Unit tests for type definitions and helpers
 * 
 * Tests for EntryType enum and helper functions.
 */

import { describe, it, expect } from 'vitest';
import { 
  EntryType, 
  LEDGER_CONSTANTS, 
  entryTypeHelpers 
} from '../types';

describe('EntryType', () => {
  it('should define all entry types', () => {
    expect(EntryType.WriteSet).toBe(0);
    expect(EntryType.Snapshot).toBe(1);
    expect(EntryType.WriteSetWithClaims).toBe(2);
    expect(EntryType.WriteSetWithCommitEvidence).toBe(3);
    expect(EntryType.WriteSetWithCommitEvidenceAndClaims).toBe(4);
  });

  it('should have unique values for each type', () => {
    const values = Object.values(EntryType);
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
  });
});

describe('entryTypeHelpers', () => {
  describe('hasClaims', () => {
    it('should return true for WriteSetWithClaims', () => {
      expect(entryTypeHelpers.hasClaims(EntryType.WriteSetWithClaims)).toBe(true);
    });

    it('should return true for WriteSetWithCommitEvidenceAndClaims', () => {
      expect(entryTypeHelpers.hasClaims(EntryType.WriteSetWithCommitEvidenceAndClaims)).toBe(true);
    });

    it('should return false for WriteSet', () => {
      expect(entryTypeHelpers.hasClaims(EntryType.WriteSet)).toBe(false);
    });

    it('should return false for Snapshot', () => {
      expect(entryTypeHelpers.hasClaims(EntryType.Snapshot)).toBe(false);
    });

    it('should return false for WriteSetWithCommitEvidence', () => {
      expect(entryTypeHelpers.hasClaims(EntryType.WriteSetWithCommitEvidence)).toBe(false);
    });
  });

  describe('hasCommitEvidence', () => {
    it('should return true for WriteSetWithCommitEvidence', () => {
      expect(entryTypeHelpers.hasCommitEvidence(EntryType.WriteSetWithCommitEvidence)).toBe(true);
    });

    it('should return true for WriteSetWithCommitEvidenceAndClaims', () => {
      expect(entryTypeHelpers.hasCommitEvidence(EntryType.WriteSetWithCommitEvidenceAndClaims)).toBe(true);
    });

    it('should return false for WriteSet', () => {
      expect(entryTypeHelpers.hasCommitEvidence(EntryType.WriteSet)).toBe(false);
    });

    it('should return false for Snapshot', () => {
      expect(entryTypeHelpers.hasCommitEvidence(EntryType.Snapshot)).toBe(false);
    });

    it('should return false for WriteSetWithClaims', () => {
      expect(entryTypeHelpers.hasCommitEvidence(EntryType.WriteSetWithClaims)).toBe(false);
    });
  });

  describe('combined checks', () => {
    it('should correctly identify entries with both claims and commit evidence', () => {
      const type = EntryType.WriteSetWithCommitEvidenceAndClaims;
      expect(entryTypeHelpers.hasClaims(type)).toBe(true);
      expect(entryTypeHelpers.hasCommitEvidence(type)).toBe(true);
    });

    it('should correctly identify entries with neither claims nor commit evidence', () => {
      expect(entryTypeHelpers.hasClaims(EntryType.WriteSet)).toBe(false);
      expect(entryTypeHelpers.hasCommitEvidence(EntryType.WriteSet)).toBe(false);
    });
  });
});

describe('LEDGER_CONSTANTS', () => {
  describe('size values', () => {
    it('should have correct header size (8 bytes: 2 version/flags + 4 size + 2 padding)', () => {
      // CCF ledger header: version (1 byte) + flags (1 byte) + size (4 bytes) + padding (2 bytes)
      // But the actual header read is 8 bytes
      expect(LEDGER_CONSTANTS.LEDGER_HEADER_SIZE).toBe(8);
    });

    it('should have correct GCM IV size (12 bytes per AES-GCM spec)', () => {
      expect(LEDGER_CONSTANTS.GCM_SIZE_IV).toBe(12);
    });

    it('should have correct GCM tag size (16 bytes per AES-GCM spec)', () => {
      expect(LEDGER_CONSTANTS.GCM_SIZE_TAG).toBe(16);
    });

    it('should have correct SHA-256 hash size (32 bytes)', () => {
      expect(LEDGER_CONSTANTS.SHA256_HASH_SIZE).toBe(32);
    });

    it('should have correct ledger domain size (8 bytes for uint64)', () => {
      expect(LEDGER_CONSTANTS.LEDGER_DOMAIN_SIZE).toBe(8);
    });
  });

  describe('GCM header total size', () => {
    it('should calculate correct total GCM header size', () => {
      const totalGcmHeaderSize = LEDGER_CONSTANTS.GCM_SIZE_TAG + LEDGER_CONSTANTS.GCM_SIZE_IV;
      // GCM header contains: tag (16) + IV which includes seqno (8) + view (4) = 28
      // But in the actual implementation, GCM_SIZE_IV includes the IV portion after the tag
      expect(totalGcmHeaderSize).toBe(28);
    });
  });
});
