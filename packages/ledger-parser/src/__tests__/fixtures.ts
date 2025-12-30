/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

/**
 * Test fixtures for @ccf/ledger-parser
 * 
 * These fixtures are copied from the e2e test files and represent real CCF ledger chunks.
 * The tests use the actual ledger files located in ../../e2e/test_files/
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
