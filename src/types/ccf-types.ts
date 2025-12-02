/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */



export interface TransactionHeader {
  version: number;
  flags: number;
  size: number;
}

export interface GcmHeader {
  gcmTag: Uint8Array;
  seqNo: number;
  view: number;
}

export interface LedgerKeyValue {
  key: string;
  value: Uint8Array;
  version: number;
  mapName?: string; // Table/map name for organizing data
}

export interface PublicDomain {
  entryType: EntryType;
  txVersion: number;
  claimsDigest: Uint8Array;
  commitEvidenceDigest: Uint8Array;
  maxConflictVersion: number;
  writes: LedgerKeyValue[];
  deletes: LedgerKeyValue[];
  mapName: string;
  mapVersion: number;
}

export interface Transaction {
  header: TransactionHeader;
  gcmHeader: GcmHeader;
  publicDomain: PublicDomain;
  txDigest: Uint8Array;
}

// Database Transaction type (different from the parsed Transaction type)
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

export const EntryType = {
    WriteSet: 0,
    Snapshot: 1,
    WriteSetWithClaims: 2,
    WriteSetWithCommitEvidence: 3,
    WriteSetWithCommitEvidenceAndClaims: 4
} as const;

export type EntryType = typeof EntryType[keyof typeof EntryType];

export interface LedgerConstants {
  LEDGER_HEADER_SIZE: number;
  GCM_SIZE_IV: number;
  GCM_SIZE_TAG: number;
  LEDGER_DOMAIN_SIZE: number;
  SHA256_HASH_SIZE: number;
}

export const LEDGER_CONSTANTS: LedgerConstants = {
  LEDGER_HEADER_SIZE: 8,
  GCM_SIZE_IV: 12,
  GCM_SIZE_TAG: 16,
  LEDGER_DOMAIN_SIZE: 8,
  SHA256_HASH_SIZE: 32,
};

// Helper functions for EntryType
export const entryTypeHelpers = {
  hasClaims: (entryType: EntryType): boolean => {
    return entryType === EntryType.WriteSetWithClaims ||
                   entryType === EntryType.WriteSetWithCommitEvidenceAndClaims;
  },

  hasCommitEvidence: (entryType: EntryType): boolean => {
    return entryType === EntryType.WriteSetWithCommitEvidence ||
                   entryType === EntryType.WriteSetWithCommitEvidenceAndClaims;
  },
};
