/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

// Re-export parser types for convenience
export type {
  Transaction,
  TransactionHeader,
  GcmHeader,
  PublicDomain,
  LedgerKeyValue,
  LedgerConstants,
} from '@ccf/ledger-parser';

export {
  EntryType,
  LEDGER_CONSTANTS,
  entryTypeHelpers,
} from '@ccf/ledger-parser';

// Database Transaction type (app-specific, different from the parsed Transaction type)
export interface DatabaseTransaction {
  id: number;
  fileId: number;
  fileName: string;
  sequenceNumber: number;
  version: number;
  flags: number;
  size: number;
  entryType: number;
  txVersion: number;
  txView: number;
  maxConflictVersion: number;
  txId: string;
  writeCount: number;
  deleteCount: number;
  fileSize: number;
}
