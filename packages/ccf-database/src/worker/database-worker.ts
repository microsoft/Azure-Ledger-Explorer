/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { runMigrations, dropAllTables, clearAllTables, verifyTables } from '../migrations/migrations';
import { DATABASE_PATH, DATABASE_FILENAME } from '../constants';
import type { Database as SQLiteDB } from '@sqlite.org/sqlite-wasm';
import { shouldDecodeCborValue } from '../utilities/decode-cbor-tables';
import { LedgerChunkV2, MerkleTree, cborArrayToText } from '@microsoft/ccf-ledger-parser';

const log = (...args: unknown[]) => console.warn('[DB Worker]', ...args);
const error = (...args: unknown[]) => console.error('[DB Worker]', ...args);

// Initialize the SQLite worker
const initializeSQLite = async () => {
  let db: SQLiteDB | undefined;
  try {
    log('Loading and initializing SQLite3 module...');

    const sqlite3 = await sqlite3InitModule({
      print: log,
      printErr: error
    });

    log('Running SQLite3 version', sqlite3.version.libVersion);

    // Try to create database with OPFS, fall back to transient if not available
    if ('opfs' in sqlite3) {
      // try opening the database and fall back to readonly mode if SQLITE_BUSY error is thrown, then fall back to transient if that fails
      try {
        db = new sqlite3.oo1.OpfsDb(DATABASE_PATH, 'c');
        log('OPFS is available, created persisted database at', db.filename);
      } catch (err) {
        if (err instanceof Error && err.message.includes('SQLITE_BUSY')) {
          error('Error creating or accessing OPFS database, falling back to readonly mode:', err);
          try {
            db = new sqlite3.oo1.OpfsDb(DATABASE_PATH, 'rt');
          } catch {
            error('Error creating or accessing OPFS readonly database, falling back to transient:', err);
            db = new sqlite3.oo1.DB(DATABASE_PATH, 'ct');
          }
        } else {
          // Re-throw if it's not a SQLITE_BUSY error
          throw err;
        }
      }
    } else {
      db = new sqlite3.oo1.DB(DATABASE_PATH, 'ct');
      log('OPFS is not available, created transient database', db.filename);
    }

    // Run migrations (creates tables if they don't exist)
    runMigrations(db, { log });

    return db;
  } catch (err) {
    error('Failed to initialize SQLite:', err);
    if (db) {
      try {
        db.close();
      } catch (closeErr) {
        log('Error closing database after failed init:', closeErr);
      }
    }
    throw err;
  } finally {
    log('SQLite initialization process completed');
  }
};

// Helper to execute SQL and return results as an array of objects
const execSQL = (db: SQLiteDB, sql: string, bind?: unknown[]): unknown[] => {
  const results: unknown[] = [];

  try {
    const stmt = db.prepare(sql);
    
    try {
      if (bind && bind.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        stmt.bind(bind as any);
      }

      while (stmt.step()) {
        const row = stmt.get({});
        results.push(row);
      }
    } finally {
      stmt.finalize();
    }
  } catch (err) {
    error('SQL execution failed:', sql, 'Error:', err);
    throw err;
  }

  return results;
};

// Initialize the worker
let db: SQLiteDB;

// Module-level Merkle tree state - persists across insertLedgerFile calls
// This avoids expensive serialization/deserialization via postMessage.
let currentMerkleTree: InstanceType<typeof MerkleTree> | null = null;

// Resolvers for streaming-export backpressure ACKs, keyed by message id.
// The export loop parks a resolver here after posting each chunk and awaits
// it; the matching 'exportAck' message resolves it so the next chunk is sent.
// The resolver reports whether the wait ended via a client abort.
const pendingExportAcks = new Map<number, (aborted: boolean) => void>();

// Export ids the client has abandoned (consumer error / stopped reading).
// Recorded so an abort that races ahead of the parked resolver still stops
// the loop on its next iteration instead of hanging forever.
const abortedExports = new Set<number>();

initializeSQLite().then((database) => {
  db = database;

  // Verify tables were created
  verifyTables(db);

  postMessage({ type: 'ready' });
}).catch((err) => {
  error('Initialization failed:', err);
  postMessage({ type: 'error', error: String(err) });
});

// Handle messages from the main thread
self.onmessage = async (event: MessageEvent) => {
  const { type, id, payload } = event.data;

  // Backpressure ACK for streaming export — resolve the parked chunk sender
  // so it may read and post the next chunk. Handled outside the try/switch
  // because it produces no response of its own.
  if (type === 'exportAck') {
    if (typeof id !== 'number' || !Number.isFinite(id)) return;
    const resolveAck = pendingExportAcks.get(id);
    if (typeof resolveAck === 'function') {
      pendingExportAcks.delete(id);
      resolveAck(false);
    }
    return;
  }

  // Client abandoned the export (consumer error or stopped reading). Unpark
  // the loop so it stops reading chunks and releases the OPFS file handle.
  if (type === 'exportAbort') {
    if (typeof id !== 'number' || !Number.isFinite(id)) return;
    abortedExports.add(id);
    const resolveAck = pendingExportAcks.get(id);
    if (typeof resolveAck === 'function') {
      pendingExportAcks.delete(id);
      resolveAck(true);
    }
    return;
  }

  try {
    let result;

    switch (type) {
      case 'exec': {
        // Execute SQL and return results
        result = execSQL(db, payload.sql, payload.bind);
        break;
      }

      case 'insertLedgerFile': {
        const { filename, fileSize, arrayBuffer, shouldVerify } = payload;

        log(`Processing ledger file: ${filename} (${fileSize} bytes), verify: ${shouldVerify !== false}`);

        // Insert file record
        const fileResult = execSQL(db, `
          SELECT id FROM ledger_files WHERE filename = ?
        `, [filename]);

        let fileId: number;
        if (fileResult.length > 0) {
          fileId = (fileResult[0] as Record<string, unknown>).id as number;
          execSQL(db, `
            UPDATE ledger_files 
            SET file_size = ?, updated_at = CURRENT_TIMESTAMP, verified = NULL, verified_at = NULL, verification_error = NULL
            WHERE id = ?
          `, [fileSize, fileId]);
        } else {
          db.exec({
            sql: `INSERT INTO ledger_files (filename, file_size, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)`,
            bind: [filename, fileSize]
          });
          const idResult = execSQL(db, 'SELECT last_insert_rowid() as id');
          fileId = (idResult[0] as Record<string, unknown>).id as number;
        }

        log(`File ID: ${fileId}, parsing transactions...`);

        // Parse ledger file with optional verification
        const ledgerChunk = new LedgerChunkV2(filename, arrayBuffer);
        
        // Use module-level Merkle tree state (persists across calls, avoids postMessage overhead)
        const merkleTree = shouldVerify !== false
          ? (currentMerkleTree ?? undefined)
          : undefined;

        // Define type for parsed transactions
        type ParsedTransaction = NonNullable<Awaited<ReturnType<typeof ledgerChunk.readSingleTransaction>>>;
        
        // Parse and optionally verify transactions
        let transactionsToInsert: ParsedTransaction[];
        let verificationResult: { verified: boolean; transactionCount: number; signatureSeqNo?: number; expectedRoot?: string; calculatedRoot?: string; error?: string };
        let updatedTree: InstanceType<typeof MerkleTree>;
        
        if (shouldVerify !== false) {
          const verifyResult = await ledgerChunk.verifyTransactions(merkleTree);
          transactionsToInsert = verifyResult.transactions;
          verificationResult = verifyResult.result;
          updatedTree = verifyResult.merkleTree;
        } else {
          // Parse without verification
          transactionsToInsert = [];
          for await (const transaction of ledgerChunk.readAllTransactions()) {
            if (transaction) {
              transactionsToInsert.push(transaction);
            }
          }
          verificationResult = { verified: false, transactionCount: transactionsToInsert.length };
          updatedTree = merkleTree || new MerkleTree();
        }

        // Collect all data in memory first for bulk insert
        const txBinds: unknown[][] = [];
        const writeBinds: unknown[][] = [];
        const deleteBinds: unknown[][] = [];
        let transactionCount = 0;

        log('Preparing transactions for insert...');

        for (const transaction of transactionsToInsert) {
          const seqNo = transaction.gcmHeader.seqNo;

          // Collect transaction data
          txBinds.push([
            seqNo,
            fileId,
            transaction.header.version,
            transaction.header.flags,
            transaction.header.size,
            transaction.publicDomain.entryType,
            transaction.publicDomain.txVersion,
            transaction.publicDomain.maxConflictVersion,
            transaction.txDigest,
            transaction.gcmHeader.view + '.' + transaction.publicDomain.txVersion,
            transaction.gcmHeader.view,
          ]);

          // Collect writes data
          for (const write of transaction.publicDomain.writes) {
            let valueText = '';
            if (write.value && write.value.length > 0) {
              try {
                if (shouldDecodeCborValue(write.mapName)) {
                  valueText = cborArrayToText(write.value);
                } else {
                  valueText = new TextDecoder('utf-8', { fatal: false }).decode(write.value);
                }
              } catch {
                valueText = '';
              }
            }

            const valueBytes = write.value && write.value.length > 0 ? write.value : null;
            writeBinds.push([seqNo, write.mapName || '', write.key, valueText, valueBytes, write.version]);
          }

          // Collect deletes data
          for (const del of transaction.publicDomain.deletes) {
            deleteBinds.push([seqNo, del.mapName || '', del.key, del.version]);
          }

          transactionCount++;

          if (transactionCount % 10000 === 0) {
            log(`Parsed ${transactionCount} transactions...`);
          }
        }

        log(`Parsed ${transactionCount} transactions, now bulk inserting...`);

        // Prepare statements once (outside try block for proper cleanup)
        const txStmt = db.prepare(`
          INSERT INTO transactions (
            sequence_no, file_id, version, flags, size,
            entry_type, tx_version, max_conflict_version,
            tx_digest, transaction_id, tx_view
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const writeStmt = db.prepare(`
          INSERT INTO kv_writes (sequence_no, map_name, key_name, value_text, value_bytes, version)
          VALUES (?, ?, ?, ?, ?, ?)
        `);

        const deleteStmt = db.prepare(`
          INSERT INTO kv_deletes (sequence_no, map_name, key_name, version)
          VALUES (?, ?, ?, ?)
        `);

        // Bulk insert in a single transaction using the fastest method
        db.exec('BEGIN IMMEDIATE TRANSACTION');

        try {
          // Insert all transactions - use bind + step pattern for better performance
          log(`Inserting ${txBinds.length} transactions...`);
          for (let i = 0; i < txBinds.length; i++) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            txStmt.bind(txBinds[i] as any).step();
            txStmt.reset();

            // Progress logging every 25000 inserts (keeps the console useful
            // for long imports without serialising thousands of postMessage logs)
            if ((i + 1) % 25000 === 0) {
              log(`Inserted ${i + 1}/${txBinds.length} transactions...`);
            }
          }

          // Insert all writes
          log(`Inserting ${writeBinds.length} writes...`);
          for (let i = 0; i < writeBinds.length; i++) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            writeStmt.bind(writeBinds[i] as any).step();
            writeStmt.reset();

            if ((i + 1) % 50000 === 0) {
              log(`Inserted ${i + 1}/${writeBinds.length} writes...`);
            }
          }

          // Insert all deletes
          if (deleteBinds.length > 0) {
            log(`Inserting ${deleteBinds.length} deletes...`);
            for (let i = 0; i < deleteBinds.length; i++) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              deleteStmt.bind(deleteBinds[i] as any).step();
              deleteStmt.reset();
            }
          }

          db.exec('COMMIT');

          // Finalize statements after successful commit
          txStmt.finalize();
          writeStmt.finalize();
          deleteStmt.finalize();

          // NOTE: ANALYZE used to run here, once per file. For multi-file
          // imports that meant N ANALYZE passes over a growing database —
          // the dominant cost of importing a large MST ledger. The hook
          // layer now triggers ANALYZE once at the end of a batch via the
          // 'analyzeDatabase' worker message.

          log(`Completed: ${transactionCount} transactions inserted`);

          // Update verification status in the database
          if (shouldVerify !== false) {
            const verified = verificationResult.verified;
            const verificationError = verificationResult.error || null;
            
            execSQL(db, `
              UPDATE ledger_files 
              SET verified = ?, verified_at = CURRENT_TIMESTAMP, verification_error = ?
              WHERE id = ?
            `, [verified ? 1 : 0, verificationError, fileId]);
            
            log(`Verification status: ${verified ? 'PASSED' : 'FAILED'}${verificationError ? ` - ${verificationError}` : ''}`);
          }

          // Store Merkle tree state at module level for next chunk (avoids postMessage overhead)
          if (shouldVerify !== false) {
            currentMerkleTree = updatedTree;
          }

          result = { 
            fileId, 
            transactionCount,
            verification: shouldVerify !== false ? {
              verified: verificationResult.verified,
              transactionCount: verificationResult.transactionCount,
              signatureSeqNo: verificationResult.signatureSeqNo,
              expectedRoot: verificationResult.expectedRoot,
              calculatedRoot: verificationResult.calculatedRoot,
              error: verificationResult.error,
            } : null,
          };
        } catch (err) {
          db.exec('ROLLBACK');
          // Always finalize statements even on error
          try {
            txStmt.finalize();
            writeStmt.finalize();
            deleteStmt.finalize();
          } catch (finalizeErr) {
            log('Error finalizing statements:', finalizeErr);
          }
          throw err;
        }

        break;
      }

      case 'execBatch': {
        // Execute multiple SQL statements in a transaction
        db.exec('BEGIN IMMEDIATE TRANSACTION');

        try {
          for (const stmt of payload.statements) {
            db.exec({
              sql: stmt.sql,
              bind: stmt.bind || [],
            });
          }

          db.exec('COMMIT');
          result = { success: true };
        } catch (err) {
          db.exec('ROLLBACK');
          throw err;
        }
        break;
      }

      case 'execBatchOptimized': {
        // Optimized batch execution using prepared statements
        db.exec('BEGIN IMMEDIATE TRANSACTION');

        const stmtMap = new Map();

        try {
          for (const item of payload.statements) {
            // Reuse prepared statements for the same SQL
            if (!stmtMap.has(item.sql)) {
              stmtMap.set(item.sql, db.prepare(item.sql));
            }

            const stmt = stmtMap.get(item.sql);
            if (item.bind && item.bind.length > 0) {
              // Use bind().step() pattern instead of stepReset()
              stmt.bind(item.bind).step();
              stmt.reset();
            } else {
              stmt.step();
              stmt.reset();
            }
          }

          db.exec('COMMIT');

          // Finalize all prepared statements after commit
          for (const stmt of stmtMap.values()) {
            stmt.finalize();
          }

          result = { success: true };
        } catch (err) {
          db.exec('ROLLBACK');
          // Finalize all prepared statements even on error
          for (const stmt of stmtMap.values()) {
            try {
              stmt.finalize();
            } catch (finalizeErr) {
              log('Error finalizing statement:', finalizeErr);
            }
          }
          throw err;
        }
        break;
      }

      case 'close':
        db.close();
        result = { success: true };
        break;

      case 'clearAllData': {
        // Clear all data from tables (preserves schema)
        clearAllTables(db, { log });
        // Also reset the Merkle tree state since we're starting fresh
        currentMerkleTree = null;
        result = { success: true };
        break;
      }

      case 'resetMerkleState': {
        // Reset the module-level Merkle tree state (used when starting a fresh import)
        currentMerkleTree = null;
        result = { success: true };
        break;
      }

      case 'analyzeDatabase': {
        // Refresh SQLite query-planner statistics. Run once after a batch
        // of insertLedgerFile calls so the planner picks optimal indexes
        // for subsequent reads, without paying the N-times cost of doing
        // it per file during the batch.
        log('Running ANALYZE to refresh query-planner statistics...');
        db.exec('ANALYZE');
        log('ANALYZE complete');
        result = { success: true };
        break;
      }

      case 'exportDatabase': {
        // Stream the live database to the main thread in chunks rather than
        // allocating the entire file as a single Uint8Array (which OOMs on
        // multi-GB databases). Strategy:
        //   1. Checkpoint WAL so the OPFS file is fully up to date.
        //   2. Get a File snapshot from the OPFS directory handle.
        //   3. Read + transfer chunks (64 MB each) so peak memory stays bounded.
        log('Exporting database (streaming)...');

        // Flush WAL to the OPFS file
        db.exec('PRAGMA wal_checkpoint(TRUNCATE)');

        if (!navigator.storage || typeof navigator.storage.getDirectory !== 'function') {
          throw new Error('Database export requires OPFS support (navigator.storage.getDirectory is unavailable).');
        }
        const opfsRoot = await navigator.storage.getDirectory();
        const fileHandle = await opfsRoot.getFileHandle(DATABASE_FILENAME);
        const file = await fileHandle.getFile();
        const totalSize = file.size;
        log(`Database file size: ${totalSize} bytes, streaming in chunks...`);

        if (totalSize === 0) {
          postMessage({
            type: 'exportChunk',
            id,
            chunk: new ArrayBuffer(0),
            offset: 0,
            totalSize: 0,
            done: true,
          });
          log('Export streaming complete: 0 bytes sent');
          return;
        }

        const CHUNK_SIZE = 64 * 1024 * 1024; // 64 MB
        let offset = 0;
        while (offset < totalSize) {
          const end = Math.min(offset + CHUNK_SIZE, totalSize);
          const slice = file.slice(offset, end);
          const arrayBuffer = await slice.arrayBuffer();
          const done = end >= totalSize;
          postMessage(
            {
              type: 'exportChunk',
              id,
              chunk: arrayBuffer,
              offset,
              totalSize,
              done,
            },
            [arrayBuffer]
          );
          offset = end;

          // Backpressure: wait for the client to ACK (i.e. finish writing) this
          // chunk before reading and posting the next one. This bounds peak
          // memory to a single in-flight chunk even for multi-GB databases.
          if (!done) {
            // Abort may have arrived before we parked; bail without waiting.
            if (abortedExports.has(id)) {
              abortedExports.delete(id);
              log('Export aborted by client; releasing file handle');
              return;
            }
            const aborted = await new Promise<boolean>((resolveAck) => {
              pendingExportAcks.set(id, resolveAck);
            });
            if (aborted) {
              abortedExports.delete(id);
              log('Export aborted by client; releasing file handle');
              return;
            }
          }
        }

        abortedExports.delete(id);
        log(`Export streaming complete: ${totalSize} bytes sent`);
        // Do NOT fall through to default postMessage — chunks already sent.
        return;
      }

      case 'deleteDatabase': {
        // Delete the OPFS database file completely
        try {
          // First close the current database connection
          if (db) {
            db.close();
          }

          // Re-initialize sqlite3 to get access to OPFS utilities
          const sqlite3 = await sqlite3InitModule({
            print: log,
            printErr: error
          });

          // Check if OPFS is available and delete the database file
          if ('opfs' in sqlite3) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const opfsUtil = (sqlite3 as any).opfs;

            try {
              await opfsUtil.unlink(DATABASE_PATH);
              log('OPFS database file deleted successfully');
            } catch (unlinkErr) {
              // File might not exist, which is okay
              log('Could not delete OPFS file (may not exist):', unlinkErr);
            }

            // Recreate the database
            db = new sqlite3.oo1.OpfsDb(DATABASE_PATH);
            log('New OPFS database created at', db.filename);
          } else {
            // For non-OPFS (transient) databases, just recreate
            db = new sqlite3.oo1.DB(DATABASE_PATH, 'ct');
            log('New transient database created');
          }

          // Drop any existing tables first (belt and suspenders approach)
          try {
            dropAllTables(db, { log });
          } catch (dropErr) {
            log('No existing tables to drop (this is fine):', dropErr);
          }

          // Run migrations in the new database
          runMigrations(db, { log });

          result = { success: true };
        } catch (deleteErr) {
          error('Failed to delete database:', deleteErr);
          throw deleteErr;
        }
        break;
      }

      default:
        throw new Error(`Unknown message type: ${type}`);
    }

    postMessage({ type: 'response', id, result });
  } catch (err) {
    error('Error handling message:', err);
    postMessage({
      type: 'error',
      id,
      error: err instanceof Error ? err.message : String(err)
    });
  }
};
