// SQLite database worker using official @sqlite.org/sqlite-wasm with OPFS
// This worker handles all database operations to enable OPFS support

import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

const log = (...args: unknown[]) => console.log('[DB Worker]', ...args);
const error = (...args: unknown[]) => console.error('[DB Worker]', ...args);

// Type for the database instance (simplified)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SQLiteDB = any;

// Initialize the SQLite worker
const initializeSQLite = async () => {
  try {
    log('Loading and initializing SQLite3 module...');
    
    const sqlite3 = await sqlite3InitModule({ 
      print: log, 
      printErr: error 
    });
    
    log('Running SQLite3 version', sqlite3.version.libVersion);

    // Try to create database with OPFS, fall back to transient if not available
    let db: SQLiteDB;
    if ('opfs' in sqlite3) {
      db = new sqlite3.oo1.OpfsDb('/ccf-ledger.sqlite3');
      log('OPFS is available, created persisted database at', db.filename);
    } else {
      db = new sqlite3.oo1.DB('/ccf-ledger.sqlite3', 'ct');
      log('OPFS is not available, created transient database', db.filename);
    }

    // Create tables if they don't exist
    createTables(db);

    return db;
  } catch (err) {
    error('Failed to initialize SQLite:', err);
    throw err;
  }
};

// Create database schema
const createTables = (db: SQLiteDB) => {
  log('Creating database tables...');
  
  // Split into individual statements to make debugging easier
  const statements = [
    // Ledger files table
    `CREATE TABLE IF NOT EXISTS ledger_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      file_size INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Transactions table
    `CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_id INTEGER NOT NULL,
      version INTEGER NOT NULL,
      flags INTEGER NOT NULL,
      size INTEGER NOT NULL,
      entry_type INTEGER NOT NULL,
      tx_view INTEGER NOT NULL,
      tx_version INTEGER NOT NULL,
      max_conflict_version INTEGER,
      tx_digest BLOB,
      transaction_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (file_id) REFERENCES ledger_files(id) ON DELETE CASCADE
    )`,

    // Key-value pairs table for writes
    `CREATE TABLE IF NOT EXISTS kv_writes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER NOT NULL,
      map_name TEXT NOT NULL,
      key_name TEXT NOT NULL,
      value_text TEXT,
      version INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
    )`,

    // Key-value pairs table for deletes
    `CREATE TABLE IF NOT EXISTS kv_deletes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER NOT NULL,
      map_name TEXT NOT NULL,
      key_name TEXT NOT NULL,
      version INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
    )`,

    // Indexes for better query performance
    `CREATE INDEX IF NOT EXISTS idx_transactions_file_id ON transactions(file_id)`,
    `CREATE INDEX IF NOT EXISTS idx_kv_writes_transaction_id ON kv_writes(transaction_id)`,
    `CREATE INDEX IF NOT EXISTS idx_kv_writes_map_key ON kv_writes(map_name, key_name)`,
    `CREATE INDEX IF NOT EXISTS idx_kv_writes_value_text ON kv_writes(value_text)`,
    `CREATE INDEX IF NOT EXISTS idx_kv_deletes_transaction_id ON kv_deletes(transaction_id)`,
    `CREATE INDEX IF NOT EXISTS idx_kv_deletes_map_key ON kv_deletes(map_name, key_name)`
  ];

  try {
    for (const stmt of statements) {
      db.exec(stmt);
    }
    log('Database tables created successfully');
  } catch (err) {
    error('Failed to create tables:', err);
    throw err;
  }
};

// Helper to execute SQL and return results as an array of objects
const execSQL = (db: SQLiteDB, sql: string, bind?: unknown[]): unknown[] => {
  const results: unknown[] = [];
  
  try {
    // Use prepare/step/get pattern for proper object results
    const stmt = db.prepare(sql);
    if (bind && bind.length > 0) {
      stmt.bind(bind);
    }
    
    while (stmt.step()) {
      const row = stmt.get({});
      results.push(row);
    }
    
    stmt.finalize();
  } catch (err) {
    error('SQL execution failed:', sql, 'Error:', err);
    throw err;
  }
  
  return results;
};

// Verify tables exist
const verifyTables = (db: SQLiteDB): boolean => {
  try {
    const tables = execSQL(db, `
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      ORDER BY name
    `);
    
    log('Existing tables:', tables);
    
    const requiredTables = ['ledger_files', 'transactions', 'kv_writes', 'kv_deletes'];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingTableNames = tables.map((t: any) => t.name);
    const missingTables = requiredTables.filter(t => !existingTableNames.includes(t));
    
    if (missingTables.length > 0) {
      error('Missing tables:', missingTables);
      return false;
    }
    
    log('All required tables exist');
    return true;
  } catch (err) {
    error('Failed to verify tables:', err);
    return false;
  }
};

// Initialize the worker
let db: SQLiteDB;

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
        const { LedgerChunkV2 } = await import('../parser/ledger-chunk');
        
        const { filename, fileSize, arrayBuffer } = payload;
        
        log(`Processing ledger file: ${filename} (${fileSize} bytes)`);
        
        // Insert file record
        const fileResult = execSQL(db, `
          SELECT id FROM ledger_files WHERE filename = ?
        `, [filename]);
        
        let fileId: number;
        if (fileResult.length > 0) {
          fileId = (fileResult[0] as Record<string, unknown>).id as number;
          execSQL(db, `
            UPDATE ledger_files 
            SET file_size = ?, updated_at = CURRENT_TIMESTAMP
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
        
        // Parse ledger file
        const ledgerChunk = new LedgerChunkV2(filename, arrayBuffer);
        let transactionCount = 0;
        
        // Prepare statements for reuse
        const txStmt = db.prepare(`
          INSERT INTO transactions (
            file_id, version, flags, size,
            entry_type, tx_version, max_conflict_version,
            tx_digest, transaction_id, tx_view
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        const writeStmt = db.prepare(`
          INSERT INTO kv_writes (transaction_id, map_name, key_name, value_text, version)
          VALUES (?, ?, ?, ?, ?)
        `);
        
        const deleteStmt = db.prepare(`
          INSERT INTO kv_deletes (transaction_id, map_name, key_name, version)
          VALUES (?, ?, ?, ?)
        `);
        
        // Import CBOR decoder
        const { cborArrayToText } = await import('../parser/cose-cbor-to-text');
        const DecodeCborTables = ["public:scitt.entry"];
        
        // Process all transactions in a single transaction
        db.exec('BEGIN IMMEDIATE TRANSACTION');
        
        try {
          for await (const transaction of ledgerChunk.readAllTransactions()) {
            // Insert transaction
            txStmt.bind([
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
            txStmt.stepReset();
            
            // Get transaction ID
            const txIdResult = execSQL(db, 'SELECT last_insert_rowid() as id');
            const txId = (txIdResult[0] as Record<string, unknown>).id as number;
            
            // Insert writes
            for (const write of transaction.publicDomain.writes) {
              let valueText = '';
              if (write.value && write.value.length > 0) {
                try {
                  if (DecodeCborTables.includes(write.mapName || '')) {
                    valueText = cborArrayToText(write.value);
                  } else {
                    valueText = new TextDecoder('utf-8', { fatal: false }).decode(write.value);
                  }
                } catch {
                  valueText = '';
                }
              }
              
              writeStmt.bind([txId, write.mapName || '', write.key, valueText, write.version]);
              writeStmt.stepReset();
            }
            
            // Insert deletes
            for (const del of transaction.publicDomain.deletes) {
              deleteStmt.bind([txId, del.mapName || '', del.key, del.version]);
              deleteStmt.stepReset();
            }
            
            transactionCount++;
            
            // Log progress every 1000 transactions
            if (transactionCount % 1000 === 0) {
              log(`Processed ${transactionCount} transactions...`);
            }
          }
          
          db.exec('COMMIT');
          
          // Finalize statements
          txStmt.finalize();
          writeStmt.finalize();
          deleteStmt.finalize();
          
          log(`Completed: ${transactionCount} transactions inserted`);
          
          result = { fileId, transactionCount };
        } catch (err) {
          db.exec('ROLLBACK');
          txStmt.finalize();
          writeStmt.finalize();
          deleteStmt.finalize();
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
        
        try {
          const stmtMap = new Map();
          
          for (const item of payload.statements) {
            // Reuse prepared statements for the same SQL
            if (!stmtMap.has(item.sql)) {
              stmtMap.set(item.sql, db.prepare(item.sql));
            }
            
            const stmt = stmtMap.get(item.sql);
            if (item.bind && item.bind.length > 0) {
              stmt.bind(item.bind);
            }
            stmt.stepReset();
          }
          
          // Finalize all prepared statements
          for (const stmt of stmtMap.values()) {
            stmt.finalize();
          }
          
          db.exec('COMMIT');
          result = { success: true };
        } catch (err) {
          db.exec('ROLLBACK');
          throw err;
        }
        break;
      }

      case 'close':
        db.close();
        result = { success: true };
        break;

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
