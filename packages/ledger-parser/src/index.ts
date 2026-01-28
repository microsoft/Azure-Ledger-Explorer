/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

// Main parser class
export { LedgerChunkV2 } from './ledger-chunk';

// CBOR utilities
export { cborArrayToText, uint8ArrayToHexString, uint8ArrayToB64String } from './cbor-utils';

// Merkle tree utilities
export { 
  MerkleTree, 
  toHexStringLower, 
  areByteArraysEqual, 
  hexStringToBytes 
} from './merkle-tree';

// Ledger validation utilities
export {
  parseLedgerFilename,
  getRangeKey,
  analyzeLedgerSequence,
  formatFileSize,
  formatDate,
} from './ledger-validation';

// CCF internal tree utilities (merklecpp serialisation)
export {
  decodeCcfInternalTree,
  computeCcfInternalTreeRoot,
  formatCcfInternalTreeSummary,
} from './ccf-internal-tree';

export type { CcfInternalTreeDecode } from './ccf-internal-tree';

// COSE signature utilities
export {
  extractCoseSignatureTimeFromCcfValue,
} from './cose-signature-time';

export type { CoseSignatureTimeResult } from './cose-signature-time';

// Types
export type {
  Transaction,
  TransactionHeader,
  GcmHeader,
  PublicDomain,
  LedgerKeyValue,
  LedgerConstants,
  ChunkVerificationResult,
} from './types';

export type {
  LedgerFileInfo,
  SequenceGap,
  RangeGroup,
  LedgerSequenceAnalysis,
} from './ledger-validation';

export {
  EntryType,
  LEDGER_CONSTANTS,
  entryTypeHelpers,
} from './types';
