/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */



export interface WriteReceiptProofElement {
  left?: string;
  right?: string;
}

export interface WriteReceiptLeafComponents {
  claimsDigest: string;
  commitEvidence: string;
  writeSetDigest: string;
}

export interface WriteReceipt {
  cert: string;
  leafComponents: WriteReceiptLeafComponents;
  nodeId: string;
  proof: WriteReceiptProofElement[];
  signature: string;
}

export interface WriteReceiptVerificationResult {
  isValid: boolean;
  isCompleted: boolean;
  calculatedRoot: string;
  receiptRoot: string;
  txDigest: string;
  merklePath: string[];
  rootsMatch: boolean;
  error?: string;
  // Ledger comparison results
  ledgerComparison?: {
    foundInLedger: boolean;
    transactionId?: number;
    ledgerTxDigest?: string;
    digestsMatch: boolean;
    transactionDetails?: {
      version: number;
      txVersion: number;
      entryType: number;
      writeCount: number;
      deleteCount: number;
    };
    error?: string;
  };
}

export interface WriteReceiptVerificationConfig {
  networkCertificate: string;
  receipt: WriteReceipt;
  // Optional: specific transaction to verify against
  targetTransactionId?: string;
}
