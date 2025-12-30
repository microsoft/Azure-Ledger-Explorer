/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

/**
 * Transaction header containing version, flags, and size information
 */
export interface TransactionHeader {
  version: number;
  flags: number;
  size: number;
}

/**
 * GCM (Galois/Counter Mode) header for authenticated encryption
 */
export interface GcmHeader {
  gcmTag: Uint8Array;
  seqNo: number;
  view: number;
}

/**
 * Key-value pair from the ledger with associated metadata
 */
export interface LedgerKeyValue {
  key: string;
  value: Uint8Array;
  version: number;
  mapName?: string;
}

/**
 * Public domain data from a transaction
 */
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

/**
 * A complete parsed transaction from the ledger
 */
export interface Transaction {
  header: TransactionHeader;
  gcmHeader: GcmHeader;
  publicDomain: PublicDomain;
  txDigest: Uint8Array;
}

/**
 * Entry types for ledger transactions
 */
export const EntryType = {
  WriteSet: 0,
  Snapshot: 1,
  WriteSetWithClaims: 2,
  WriteSetWithCommitEvidence: 3,
  WriteSetWithCommitEvidenceAndClaims: 4
} as const;

export type EntryType = typeof EntryType[keyof typeof EntryType];

/**
 * Constants used in ledger parsing
 */
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

/**
 * Helper functions for working with EntryType
 */
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
