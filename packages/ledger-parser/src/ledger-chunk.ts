/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import type { 
  Transaction, 
  TransactionHeader, 
  GcmHeader, 
  PublicDomain, 
  LedgerKeyValue,
  ChunkVerificationResult,
} from './types';
import { 
  EntryType,
  LEDGER_CONSTANTS,
  entryTypeHelpers
} from './types';
import { 
  MerkleTree, 
  areByteArraysEqual, 
  toHexStringLower,
  hexStringToBytes 
} from './merkle-tree';

/**
 * Parser for CCF LedgerChunkV2 format files.
 * 
 * @example
 * ```typescript
 * const buffer = await file.arrayBuffer();
 * const chunk = new LedgerChunkV2(file.name, buffer);
 * 
 * for await (const transaction of chunk.readAllTransactions()) {
 *   console.log(transaction.gcmHeader.seqNo);
 * }
 * ```
 */
export class LedgerChunkV2 {
  public fileName: string;
  private buffer: ArrayBuffer;
  private view: DataView;
  private offset: number = 0;  
  private _fileSize: bigint;
  
  constructor(fileName: string, buffer: ArrayBuffer) {
    this.fileName = fileName;
    this.buffer = buffer;
    this.view = new DataView(buffer);
    
    // Read file size from the first 8 bytes (little-endian)
    this._fileSize = this.view.getBigUint64(0, true);    
    this.offset = 8;
  }

  /**
   * Reads a single transaction from the ledger buffer
   */
  async readSingleTransaction(): Promise<Transaction | null> {
    if (this.offset >= this._fileSize) {
      return null;
    }

    try {
      // Read transaction header
      const headerBuffer = this.buffer.slice(this.offset, this.offset + LEDGER_CONSTANTS.LEDGER_HEADER_SIZE);
      const header = this.parseTransactionHeader(new DataView(headerBuffer));
      this.offset += LEDGER_CONSTANTS.LEDGER_HEADER_SIZE;

      // Read the entire transaction into memory
      const txBuffer = this.buffer.slice(this.offset, this.offset + Number(header.size));
      const txView = new DataView(txBuffer);
      this.offset += Number(header.size);      

      let txOffset = 0;

      // Read GCM header
      const gcmHeaderSize = LEDGER_CONSTANTS.GCM_SIZE_IV + LEDGER_CONSTANTS.GCM_SIZE_TAG;
      const gcmHeaderBuffer = txBuffer.slice(txOffset, txOffset + gcmHeaderSize);
      const gcmHeader = this.parseGcmHeader(new DataView(gcmHeaderBuffer));
      txOffset += gcmHeaderSize;

      // Read public domain size
      const publicDomainSize = Number(txView.getBigUint64(txOffset, true));
      txOffset += LEDGER_CONSTANTS.LEDGER_DOMAIN_SIZE;

      // Read public domain
      const publicDomainBuffer = txBuffer.slice(txOffset, txOffset + publicDomainSize);
      const publicDomain = this.parsePublicDomain(new DataView(publicDomainBuffer), publicDomainSize);
      txOffset += publicDomainSize;

      // Calculate transaction digest
      const txDigest = await this.calculateTxDigest(
        new Uint8Array(headerBuffer),
        new Uint8Array(txBuffer),
        publicDomain.commitEvidenceDigest,
        publicDomain.claimsDigest
      );

      return {
        header,
        gcmHeader,
        publicDomain,
        txDigest,
      };
    } catch (error) {
      console.error('Error reading transaction:', error);
      return null;
    }
  }

  /**
   * Parses transaction header from buffer
   */
  private parseTransactionHeader(view: DataView): TransactionHeader {
    const version = view.getUint8(0);
    const flags = view.getUint8(1);
    const size = view.getUint32(2, true); // Little-endian
    
    return { version, flags, size };
  }

  /**
   * Parses GCM header from buffer
   */
  private parseGcmHeader(view: DataView): GcmHeader {
    const gcmTag = new Uint8Array(view.buffer, view.byteOffset, LEDGER_CONSTANTS.GCM_SIZE_TAG);
    const seqNo = Number(view.getBigUint64(LEDGER_CONSTANTS.GCM_SIZE_TAG, true));
    const viewNum = view.getUint32(LEDGER_CONSTANTS.GCM_SIZE_TAG + 8, true);
    
    return {
      gcmTag,
      seqNo,
      view: viewNum,
    };
  }

  /**
   * Parses public domain from buffer
   */
  private parsePublicDomain(view: DataView, publicDomainSize: number): PublicDomain {
    let offset = 0;
    
    const entryType = view.getUint8(offset++) as EntryType;
    const txVersion = Number(view.getBigUint64(offset, true));
    offset += 8;

    // Read claims digest if present
    const claimsDigest = entryTypeHelpers.hasClaims(entryType)
      ? new Uint8Array(view.buffer, view.byteOffset + offset, LEDGER_CONSTANTS.SHA256_HASH_SIZE)
      : new Uint8Array(0); // Empty array, not array of zeros
    if (entryTypeHelpers.hasClaims(entryType)) {
      offset += LEDGER_CONSTANTS.SHA256_HASH_SIZE;
    }

    // Read commit evidence digest if present
    const commitEvidenceDigest = entryTypeHelpers.hasCommitEvidence(entryType)
      ? new Uint8Array(view.buffer, view.byteOffset + offset, LEDGER_CONSTANTS.SHA256_HASH_SIZE)
      : new Uint8Array(0); // Empty array, not array of zeros
    if (entryTypeHelpers.hasCommitEvidence(entryType)) {
      offset += LEDGER_CONSTANTS.SHA256_HASH_SIZE;
    }

    const maxConflictVersion = Number(view.getBigUint64(offset, true));
    offset += 8;

    if (entryType === EntryType.Snapshot) {
      throw new Error('Snapshot entries are not yet supported');
    }

    const writes: LedgerKeyValue[] = [];
    const deletes: LedgerKeyValue[] = [];

    // Parse map entries
    while (offset < publicDomainSize) {
      const mapNameSize = Number(view.getBigUint64(offset, true));
      offset += 8;

      const mapName = new TextDecoder().decode(
        new Uint8Array(view.buffer, view.byteOffset + offset, mapNameSize)
      );
      offset += mapNameSize;

      const mapVersion = Number(view.getBigUint64(offset, true));
      offset += 8;

      const readCount = Number(view.getBigUint64(offset, true));
      offset += 8;

      if (readCount !== 0) {
        throw new Error('Read count is not 0');
      }

      const writeCount = Number(view.getBigUint64(offset, true));
      offset += 8;

      // Parse write entries
      for (let i = 0; i < writeCount; i++) {
        const keySize = Number(view.getBigUint64(offset, true));
        offset += 8;

        const key = new TextDecoder().decode(
          new Uint8Array(view.buffer, view.byteOffset + offset, keySize)
        );
        offset += keySize;

        const valueSize = Number(view.getBigUint64(offset, true));
        offset += 8;

        const value = new Uint8Array(view.buffer, view.byteOffset + offset, valueSize);
        offset += valueSize;

        writes.push({
          key,
          value,
          version: mapVersion,
          mapName,
        });
      }

      const deleteCount = Number(view.getBigUint64(offset, true));
      offset += 8;

      // Parse delete entries
      for (let i = 0; i < deleteCount; i++) {
        const keySize = Number(view.getBigUint64(offset, true));
        offset += 8;

        const key = new TextDecoder().decode(
          new Uint8Array(view.buffer, view.byteOffset + offset, keySize)
        );
        offset += keySize;

        deletes.push({
          key,
          value: new Uint8Array(0),
          version: mapVersion,
          mapName,
        });
      }
    }

    return {
      entryType,
      txVersion,
      claimsDigest,
      commitEvidenceDigest,
      maxConflictVersion,
      writes,
      deletes,
      mapName: '', // Deprecated: mapName is now stored in individual writes/deletes
      mapVersion: 0, // Deprecated: mapVersion is now stored in individual writes/deletes
    };
  }

  /**
   * Calculates transaction digest using SHA-256
   * Implements the same logic as the C# version using Web Crypto API
   */
  private async calculateTxDigest(
    headerBuffer: Uint8Array,
    txBuffer: Uint8Array,
    commitEvidenceDigest: Uint8Array,
    claimsDigest: Uint8Array
  ): Promise<Uint8Array> {
    try {
      // First hash: headerBuffer + txBuffer to get writeSetDigest
      const writeSetData = new Uint8Array(headerBuffer.length + txBuffer.length);
      writeSetData.set(headerBuffer, 0);
      writeSetData.set(txBuffer, headerBuffer.length);
      
      const writeSetDigestBuffer = await crypto.subtle.digest('SHA-256', writeSetData);
      const writeSetDigest = new Uint8Array(writeSetDigestBuffer);

      // Second hash: writeSetDigest + commitEvidenceDigest + claimsDigest
      // Only include non-empty digests (matching C# IsEmpty check)
      let finalDataSize = writeSetDigest.length;
      
      // Add commitEvidenceDigest size if not empty (length > 0)
      if (commitEvidenceDigest.length > 0) {
        finalDataSize += commitEvidenceDigest.length;
      }
      
      // Add claimsDigest size if not empty (length > 0)
      if (claimsDigest.length > 0) {
        finalDataSize += claimsDigest.length;
      }

      const finalData = new Uint8Array(finalDataSize);
      let offset = 0;

      // Append writeSetDigest
      finalData.set(writeSetDigest, offset);
      offset += writeSetDigest.length;

      // Append commitEvidenceDigest if not empty (matching C# !IsEmpty check)
      if (commitEvidenceDigest.length > 0) {
        finalData.set(commitEvidenceDigest, offset);
        offset += commitEvidenceDigest.length;
      }

      // Append claimsDigest if not empty (matching C# !IsEmpty check)
      if (claimsDigest.length > 0) {
        finalData.set(claimsDigest, offset);
      }

      const finalDigestBuffer = await crypto.subtle.digest('SHA-256', finalData);
      return new Uint8Array(finalDigestBuffer);
    } catch (error) {
      console.error('Error calculating transaction digest:', error);
      // Fallback to empty hash if calculation fails
      return new Uint8Array(LEDGER_CONSTANTS.SHA256_HASH_SIZE);
    }
  }

  /**
   * Async iterator to read all transactions
   */
  async *readAllTransactions(): AsyncGenerator<Transaction, void, unknown> {
    while (this.offset < this.buffer.byteLength) {
      const transaction = await this.readSingleTransaction();
      if (transaction) {
        yield transaction;
      } else {
        break;
      }
    }
  }

  /**
   * Verify all transactions in this chunk and return them along with verification result.
   * 
   * This method iterates through all transactions, builds the Merkle tree, and verifies
   * against the signature transaction at the end of the chunk.
   * 
   * @param existingTree Optional MerkleTree from previous chunk (for continuity)
   * @returns Verification result, the transactions, and the updated Merkle tree
   */
  async verifyTransactions(
    existingTree?: MerkleTree
  ): Promise<{
    result: ChunkVerificationResult;
    transactions: Transaction[];
    merkleTree: MerkleTree;
  }> {
    const merkleTree = existingTree || new MerkleTree();
    
    // Parse all transactions first
    const transactions: Transaction[] = [];
    for await (const transaction of this.readAllTransactions()) {
      transactions.push(transaction);
    }
    
    if (transactions.length === 0) {
      return {
        result: {
          verified: false,
          transactionCount: 0,
          error: 'No transactions to verify',
        },
        transactions,
        merkleTree,
      };
    }

    try {
      // Find the last signature transaction (must be the last transaction in a chunk)
      // Search from the back - in a valid chunk, the last tx should be a signature
      let lastSignatureIndex = -1;
      let lastExpectedRoot: string | undefined;
      let lastSignatureSeqNo: number | undefined;

      for (let i = transactions.length - 1; i >= 0; i--) {
        const transaction = transactions[i];
        const signatureWrite = transaction.publicDomain.writes.find(write => 
          write.mapName?.includes('public:ccf.internal.signatures')
        );

        if (signatureWrite && signatureWrite.value.length > 0) {
          try {
            const signatureJson = new TextDecoder().decode(signatureWrite.value);
            const signatureData = JSON.parse(signatureJson) as { root?: string };
            
            if (signatureData.root) {
              lastSignatureIndex = i;
              lastExpectedRoot = signatureData.root;
              lastSignatureSeqNo = transaction.gcmHeader.seqNo;
              break; // Found the last signature, stop searching
            }
          } catch (parseError) {
            console.warn(`Failed to parse signature data at transaction ${transaction.gcmHeader.seqNo}:`, parseError);
          }
        }
      }

      // Add transaction hashes to Merkle tree (up to but NOT including the signature transaction)
      const txCountToInsert = lastSignatureIndex !== -1 ? lastSignatureIndex : transactions.length;
      for (let i = 0; i < txCountToInsert; i++) {
        merkleTree.insertLeaf(transactions[i].txDigest);
      }

      // Verify using the last signature transaction found
      if (lastExpectedRoot !== undefined && lastSignatureIndex !== -1) {
        const calculatedRootBytes = await merkleTree.calculateRootHash();
        const calculatedRoot = toHexStringLower(calculatedRootBytes);
        const expectedRootBytes = hexStringToBytes(lastExpectedRoot);
        
        if (areByteArraysEqual(calculatedRootBytes, expectedRootBytes)) {
          // Verification passed - now add the signature transaction to carry forward
          merkleTree.insertLeaf(transactions[lastSignatureIndex].txDigest);
          
          return {
            result: {
              verified: true,
              transactionCount: transactions.length,
              signatureSeqNo: lastSignatureSeqNo,
              expectedRoot: lastExpectedRoot,
              calculatedRoot,
            },
            transactions,
            merkleTree,
          };
        } else {
          return {
            result: {
              verified: false,
              transactionCount: transactions.length,
              signatureSeqNo: lastSignatureSeqNo,
              expectedRoot: lastExpectedRoot,
              calculatedRoot,
              error: `Merkle root mismatch at transaction ${lastSignatureSeqNo}`,
            },
            transactions,
            merkleTree,
          };
        }
      }

      // No signature found in this chunk - that's okay for intermediate chunks
      return {
        result: {
          verified: false,
          transactionCount: transactions.length,
          error: 'No signature transaction found in chunk',
        },
        transactions,
        merkleTree,
      };

    } catch (error) {
      return {
        result: {
          verified: false,
          transactionCount: transactions.length,
          error: error instanceof Error ? error.message : 'Unknown error during verification',
        },
        transactions,
        merkleTree,
      };
    }
  }

  /**
   * Get the current position in the buffer
   */
  get position(): number {
    return this.offset;
  }

  /**
   * Check if there are more transactions to read
   */
  get hasMore(): boolean {
    return this.offset < this.buffer.byteLength;
  }
}
