/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */



import type { CCFDatabase } from '../database';
import type { WriteReceiptVerificationResult } from '../types/write-receipt-types';

export interface LedgerComparisonResult {
  foundInLedger: boolean;
  transactionId?: number;
  ledgerTxDigest?: string;
  receiptTxDigest: string;
  digestsMatch: boolean;
  error?: string;
}

export class WriteReceiptLedgerService {
  private db: CCFDatabase;

  constructor(db: CCFDatabase) {
    this.db = db;
  }

  /**
   * Compare a write receipt against ledger data
   */
  async compareWithLedger(
    receiptVerificationResult: WriteReceiptVerificationResult
  ): Promise<LedgerComparisonResult> {
    try {
      if (!receiptVerificationResult.isValid || !receiptVerificationResult.isCompleted) {
        return {
          foundInLedger: false,
          receiptTxDigest: receiptVerificationResult.txDigest,
          digestsMatch: false,
          error: 'Receipt verification failed - cannot compare with ledger'
        };
      }

      // Get the transaction digest from the receipt
      const receiptTxDigest = receiptVerificationResult.txDigest;

      // Convert hex string to bytes for database comparison
      const digestBytes = this.hexToBytes(receiptTxDigest);

      // Search for this transaction digest in the ledger
      const transaction = await this.findTransactionByDigest(digestBytes);

      if (!transaction) {
        return {
          foundInLedger: false,
          receiptTxDigest,
          digestsMatch: false,
          error: 'Transaction not found in ledger'
        };
      }

      // Convert the ledger digest back to hex for comparison
      const ledgerTxDigest = this.bytesToHex(transaction.txDigest);
      const digestsMatch = ledgerTxDigest.toLowerCase() === receiptTxDigest.toLowerCase();

      return {
        foundInLedger: true,
        transactionId: transaction.transactionId,
        ledgerTxDigest,
        receiptTxDigest,
        digestsMatch
      };

    } catch (error) {
      return {
        foundInLedger: false,
        receiptTxDigest: receiptVerificationResult.txDigest,
        digestsMatch: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Find a transaction by its digest
   */
  private async findTransactionByDigest(digestBytes: Uint8Array): Promise<{
    transactionId: number;
    txDigest: Uint8Array;
  } | null> {
    try {
      // Use the new public API method
      return await this.db.getTransactionByDigest(digestBytes);
    } catch (error) {
      console.error('Error finding transaction by digest:', error);
      return null;
    }
  }

  /**
   * Convert hex string to bytes
   */
  private hexToBytes(hex: string): Uint8Array {
    // Remove any whitespace and ensure even length
    const cleanHex = hex.replace(/\s/g, '');
    if (cleanHex.length % 2 !== 0) {
      throw new Error('Invalid hex string length');
    }

    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < cleanHex.length; i += 2) {
      bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
    }
    return bytes;
  }

  /**
   * Convert bytes to hex string
   */
  private bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Get additional transaction details if found
   */
  async getTransactionDetails(transactionId: number): Promise<{
    version: number;
    txVersion: number;
    entryType: number;
    writeCount: number;
    deleteCount: number;
  } | null> {
    try {
      const transaction = await this.db.getTransactionById(transactionId);
      if (!transaction) return null;

      return {
        version: transaction.version,
        txVersion: transaction.txVersion,
        entryType: transaction.entryType,
        writeCount: transaction.writeCount,
        deleteCount: transaction.deleteCount
      };
    } catch (error) {
      console.error('Error getting transaction details:', error);
      return null;
    }
  }
}
