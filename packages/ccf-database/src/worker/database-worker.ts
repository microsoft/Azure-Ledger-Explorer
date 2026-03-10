/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { runMigrations, dropAllTables, clearAllTables, verifyTables } from '../migrations/migrations';
import { DATABASE_PATH } from '../constants';
import type { Database as SQLiteDB } from '@sqlite.org/sqlite-wasm';
import { shouldDecodeCborValue } from '../utilities/decode-cbor-tables';

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
// This avoids expensive serialization/deserialization via postMessage
// Using 'unknown' since the actual MerkleTree type is dynamically imported
let currentMerkleTree: unknown = null;

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

  try {
    let result;

    switch (type) {
      case 'exec': {
        // Execute SQL and return results
        result = execSQL(db, payload.sql, payload.bind);
        break;
      }

      case 'insertLedgerFile': {
        // Import LedgerChunkV2 dynamically in the worker
        const { LedgerChunkV2, MerkleTree } = await import('@microsoft/ccf-ledger-parser');

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
        // Cast via unknown since the type is dynamically imported
        const merkleTree = shouldVerify !== false 
          ? (currentMerkleTree as InstanceType<typeof MerkleTree> | undefined) 
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

        // Import CBOR decoder
        const { cborArrayToText } = await import('@microsoft/ccf-ledger-parser');

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

          if (transactionCount % 1000 === 0) {
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

            // Progress logging every 1000 inserts
            if ((i + 1) % 1000 === 0) {
              log(`Inserted ${i + 1}/${txBinds.length} transactions...`);
            }
          }

          // Insert all writes
          log(`Inserting ${writeBinds.length} writes...`);
          for (let i = 0; i < writeBinds.length; i++) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            writeStmt.bind(writeBinds[i] as any).step();
            writeStmt.reset();

            if ((i + 1) % 5000 === 0) {
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

          // Refresh query-planner statistics so SQLite picks optimal indexes
          db.exec('ANALYZE');

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
