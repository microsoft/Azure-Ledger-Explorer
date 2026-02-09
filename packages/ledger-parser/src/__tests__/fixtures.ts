/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

/**
 * Test fixtures for @microsoft/ccf-ledger-parser
 * 
 * These fixtures are copied from the e2e test files and represent real CCF ledger chunks.
 * The tests use the actual ledger files located in ../../e2e/test_files/
 * 
 * CCF testdata files are sourced from CCF/tests/testdata/ and organised by service type.
 * See docs/CCF_TESTDATA_EVALUATION.md for the evaluation that selected these files.
 */

import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Path to the test files directory
 * Going up from packages/ledger-parser/src/__tests__ to the root e2e/test_files
 */
export const TEST_FILES_DIR = join(__dirname, '..', '..', '..', '..', 'e2e', 'test_files');

/**
 * Load a test ledger file as an ArrayBuffer
 */
export async function loadTestLedgerFile(filename: string): Promise<ArrayBuffer> {
  const filePath = join(TEST_FILES_DIR, filename);
  const buffer = await readFile(filePath);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

/**
 * Test ledger file names
 */
export const TEST_FILES = {
  /** Valid ledger chunk with transactions 1-14 */
  LEDGER_1_14: 'ledger_1-14.committed',
  /** Valid ledger chunk with transactions 15-3926 */
  LEDGER_15_3926: 'ledger_15-3926.committed',
  /** Invalid filename (doesn't match ledger_*.committed pattern) */
  INVALID_NAME: 'invalidnameledger_1-14.committed',
} as const;

/**
 * CCF testdata files organised by service type.
 * These cover entry types and scenarios not exercised by the original test files.
 */
export const CCF_TESTDATA = {
  /** eol_service — Contains WriteSet (entry type 0) and view transitions */
  eol: {
    /** WriteSet transactions, seq 1–2 */
    LEDGER_1_2: 'eol_service/ledger_1-2.committed',
    /** WriteSet transactions, seq 3–11 */
    LEDGER_3_11: 'eol_service/ledger_3-11.committed',
    /** View transition boundary (WriteSet side), seq 34–35 */
    LEDGER_34_35: 'eol_service/ledger_34-35.committed',
    /** View transition boundary (WriteSetWithCommitEvidenceAndClaims side), seq 36–37 */
    LEDGER_36_37: 'eol_service/ledger_36-37.committed',
    /** Uncommitted file — should parse 0 transactions */
    LEDGER_494_UNCOMMITTED: 'eol_service/ledger_494',
  },
  /** expired_service — Contains WriteSetWithCommitEvidence (entry type 3) and type transition */
  expired: {
    /** WriteSetWithCommitEvidence transactions, seq 1–4 */
    LEDGER_1_4: 'expired_service/ledger_1-4.committed',
    /** WriteSetWithCommitEvidence transactions, seq 5–15 */
    LEDGER_5_15: 'expired_service/ledger_5-15.committed',
    /** Entry-type transition: WriteSetWithCommitEvidence → WriteSetWithCommitEvidenceAndClaims, seq 16–26 */
    LEDGER_16_26: 'expired_service/ledger_16-26.committed',
  },
  /** double_sealed_service — Re-seal boundary with view transitions */
  doubleSealed: {
    /** Pre re-seal (view 4), seq 484–485 */
    LEDGER_484_485: 'double_sealed_service/ledger_484-485.committed',
    /** Re-seal boundary (view 4→5), seq 486–491 */
    LEDGER_486_491: 'double_sealed_service/ledger_486-491.committed',
    /** Post re-seal (view 5), seq 503–505 */
    LEDGER_503_505: 'double_sealed_service/ledger_503-505.committed',
  },
  /** sgx_service — Largest single chunk with WriteSet, includes SGX attestation maps */
  sgx: {
    /** 37 transactions with WriteSet entry type + SGX-specific maps, seq 1–37 */
    LEDGER_1_37: 'sgx_service/ledger_1-37.committed',
  },
} as const;

/**
 * Expected sequence number ranges for test files
 */
export const EXPECTED_RANGES = {
  [TEST_FILES.LEDGER_1_14]: { start: 1, end: 14 },
  [TEST_FILES.LEDGER_15_3926]: { start: 15, end: 3926 },
} as const;

/**
 * Create a minimal valid ledger buffer for unit testing
 * This creates a ledger with the 8-byte file size header but no transactions
 */
export function createEmptyLedgerBuffer(): ArrayBuffer {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  // File size = 8 (just the header, no transactions)
  view.setBigUint64(0, 8n, true);
  return buffer;
}

/**
 * Create a corrupted ledger buffer with invalid file size
 */
export function createCorruptedLedgerBuffer(): ArrayBuffer {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  // File size claims to be larger than actual buffer
  view.setBigUint64(0, 1000000n, true);
  return buffer;
}
