/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

// Main parser class
export { LedgerChunkV2 } from './ledger-chunk.js';

// CBOR utilities
export { cborArrayToText, uint8ArrayToHexString, uint8ArrayToB64String } from './cbor-utils.js';

// Merkle tree utilities
export { 
  MerkleTree, 
  toHexStringLower, 
  areByteArraysEqual, 
  hexStringToBytes 
} from './merkle-tree.js';

// Ledger validation utilities
export {
  parseLedgerFilename,
  getRangeKey,
  analyzeLedgerSequence,
  formatFileSize,
  formatDate,
} from './ledger-validation.js';

// CCF internal tree utilities (merklecpp serialisation)
export {
  decodeCcfInternalTree,
  computeCcfInternalTreeRoot,
  formatCcfInternalTreeSummary,
} from './ccf-internal-tree.js';

export type { CcfInternalTreeDecode } from './ccf-internal-tree.js';

// COSE signature utilities
export {
  extractCoseSignatureTimeFromCcfValue,
} from './cose-signature-time.js';

export type { CoseSignatureTimeResult } from './cose-signature-time.js';

// Types
export type {
  Transaction,
  TransactionHeader,
  GcmHeader,
  PublicDomain,
  LedgerKeyValue,
  LedgerConstants,
  ChunkVerificationResult,
} from './types.js';

export type {
  LedgerFileInfo,
  SequenceGap,
  RangeGroup,
  LedgerSequenceAnalysis,
} from './ledger-validation.js';

export {
  EntryType,
  LEDGER_CONSTANTS,
  entryTypeHelpers,
} from './types.js';
