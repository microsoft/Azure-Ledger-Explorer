# CCF Database and Persistence Layer

## Overview

The persistence layer provides a robust, browser-based database solution for storing and querying CCF ledger data. Built on sql.js with OPFS (Origin Private File System) support, it enables efficient storage and retrieval of parsed ledger information directly in the user's browser.

## Architecture

### Core Components

#### 1. CCFDatabase Class (`packages/ccf-database/src/ccf-database.ts`)
The main database facade that provides:
- **Repository Access**: Provides access to domain-specific repositories (files, transactions, kv, stats)
- **SQLite Integration**: Uses sql.js via Web Worker for non-blocking in-browser SQL database
- **OPFS Persistence**: Leverages Origin Private File System for persistent storage
- **Schema Management**: Automatic table creation and migration support
- **Query Interface**: Safe SQL execution with security controls through repositories

#### 2. Database Configuration (`packages/ccf-database/src/types/database-types.ts`)
```typescript
interface DatabaseConfig {
  filename: string;    // Database filename in OPFS
  useOpfs?: boolean;   // Enable persistent storage
}
```

#### 3. Repository Pattern (`packages/ccf-database/src/repositories/`)
The database uses a repository pattern to organize domain-specific data access:
- **FileRepository**: Ledger file metadata operations
- **TransactionRepository**: Transaction CRUD and search operations
- **KVRepository**: Key-value table and write/delete operations
- **StatsRepository**: Database statistics and management operations

Each repository extends `BaseRepository` and accepts typed `ExecFn` and `ExecBatchFn` functions for database access.

### Database Schema

The database uses a normalized schema optimized for CCF ledger data:

#### Tables Structure

```sql
-- Ledger Files Metadata
CREATE TABLE ledger_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL UNIQUE,
  file_size INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Transaction Records
CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL,
  version INTEGER NOT NULL,
  flags INTEGER NOT NULL,
  size INTEGER NOT NULL,
  entry_type INTEGER NOT NULL,
  tx_version INTEGER NOT NULL,
  max_conflict_version INTEGER,
  tx_digest BLOB,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (file_id) REFERENCES ledger_files(id) ON DELETE CASCADE
);

-- Key-Value Write Operations
CREATE TABLE kv_writes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id INTEGER NOT NULL,
  map_name TEXT NOT NULL,
  key_name TEXT NOT NULL,
  value_text TEXT,    -- UTF-8 decoded value
  version INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
);

-- Key-Value Delete Operations
CREATE TABLE kv_deletes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id INTEGER NOT NULL,
  map_name TEXT NOT NULL,
  key_name TEXT NOT NULL,
  version INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
);
```

#### Optimized Indexes

```sql
-- Performance indexes
CREATE INDEX idx_transactions_file_id ON transactions(file_id);
CREATE INDEX idx_kv_writes_transaction_id ON kv_writes(transaction_id);
CREATE INDEX idx_kv_writes_map_key ON kv_writes(map_name, key_name);
CREATE INDEX idx_kv_deletes_transaction_id ON kv_deletes(transaction_id);
CREATE INDEX idx_kv_deletes_map_key ON kv_deletes(map_name, key_name);
```

## Storage Technologies

### 1. SQL.js Integration
- **Web Worker Execution**: Database operations run in a Web Worker to prevent blocking the main thread
- **In-Memory Database**: Fast operations with full SQL support
- **Export/Import**: Serialize database to binary format
- **Cross-Platform**: Works in all modern browsers
- **No Server Required**: Completely client-side solution

### 2. OPFS (Origin Private File System)
- **Persistent Storage**: Data survives browser restarts
- **High Performance**: Native file system access via Access Handle Pool VFS
- **Large Capacity**: Can handle multi-gigabyte databases
- **Privacy**: Data stays local to the user's browser

### 3. Web Worker Architecture (`packages/ccf-database/src/worker/`)
- **DatabaseWorkerClient**: Main thread client for communicating with the worker
- **database-worker.ts**: Worker implementation handling SQL.js initialization and query execution
- **Non-blocking**: All database operations are asynchronous and don't block UI
- **Message-based Communication**: Type-safe message passing between main thread and worker

### 3. Fallback Strategy
```typescript
// Graceful degradation handled by sql.js OPFS VFS
// If OPFS is not available, falls back to in-memory storage
const config: DatabaseConfig = {
  filename: 'ccf-ledger.db',
  useOpfs: true, // Will use OPFS if available, otherwise in-memory
};
```

## Key Features

### 1. Memory Optimization
- **Conservative Settings**: Optimized for minimal memory usage
- **Batch Processing**: Transactions processed in batches to prevent memory spikes
- **Automatic Cleanup**: Proper resource management and cleanup

### 2. Data Integrity
- **Foreign Key Constraints**: Ensures referential integrity
- **Transaction Support**: Atomic operations for data consistency
- **Backup and Restore**: Export/import functionality for data migration

### 3. Security
- **SQL Injection Protection**: Only SELECT queries allowed in public interface
- **Parameter Binding**: Prepared statements for safe query execution
- **Access Control**: Restricted database operations

## API Interface

### Core Methods

#### Database Lifecycle
```typescript
// Initialize database (creates worker and repositories)
await database.initialize();

// Close and cleanup
await database.close();
```

#### Repository Access
The database provides access to domain-specific repositories:
```typescript
// Access file repository
const files = await database.files.getLedgerFiles();
const fileId = await database.files.insertLedgerFile(filename, fileSize);

// Access transaction repository
const transactions = await database.transactions.getTransactions(fileId, limit, offset);
const txId = await database.transactions.insertTransaction(fileId, transaction);
await database.transactions.insertTransactionsBatch(fileId, transactions);

// Access KV repository
const writes = await database.kv.getTransactionWrites(transactionId);
const deletes = await database.kv.getTransactionDeletes(transactionId);
const tables = await database.kv.getCCFTables();
const latestState = await database.kv.getTableLatestState(tableName, sortColumn, sortDirection);

// Access stats repository
const stats = await database.stats.getStats();
const enhancedStats = await database.stats.getEnhancedStats();
await database.stats.clearAllData();
```

#### Combined Operations
```typescript
// Insert ledger file with transaction data (high-level operation)
const result = await database.insertLedgerFileWithData(
  filename,
  fileSize,
  transactions
);
// Returns: { fileId, transactionCount }

// Clear all data
await database.clearAllData();
```

## Performance Optimization

### Memory Management
- **Page Size**: Optimized page size for browser environment
- **Cache Size**: Conservative cache settings to minimize memory usage
- **Temporary Storage**: Configured for minimal memory impact

### Query Optimization
- **Prepared Statements**: Reused for better performance
- **Efficient Indexes**: Strategic indexing for common query patterns
- **Batch Operations**: Minimize transaction overhead

### Storage Efficiency
- **Normalized Schema**: Reduces data duplication
- **Compressed Values**: Efficient storage of binary data
- **Auto-Vacuum**: Automatic space reclamation

## Data Migration and Backup

### Schema Migrations (`packages/ccf-database/src/migrations/`)
The database supports versioned schema migrations:
```typescript
// Migrations are defined in separate files (e.g., 001_initial.ts)
export const migration001: Migration = {
  version: 1,
  name: 'Initial schema',
  up: (db: SqlJsDatabase) => {
    // Create tables and indexes
  },
};

// Migrations run automatically on initialization
await database.initialize(); // Applies pending migrations
```

### Export Functionality
```typescript
// Export entire database (via worker)
const binaryData = await database.export();

// Save to file
const blob = new Blob([binaryData], { type: 'application/octet-stream' });
```

### Reset Operations
```typescript
// Clear all data (keep schema)
await database.clearAllData();

// Complete database reset (handled by worker)
await database.close();
await resetDatabase(); // Helper in src/hooks/use-ccf-data.ts
```

## Error Handling and Recovery

### Database Corruption
- **Integrity Checks**: Regular database integrity validation
- **Recovery Procedures**: Automatic recovery from minor corruption
- **Backup Strategies**: Regular backup recommendations

### Memory Issues
- **Memory Monitoring**: Track memory usage during operations
- **Graceful Degradation**: Fallback to basic functionality when memory is constrained
- **Error Reporting**: Comprehensive error logging and reporting

## Integration with React Query

The database layer integrates seamlessly with TanStack Query through the `@ccf/database` package:

```typescript
// Import the database from the package
import { CCFDatabase } from '@ccf/database';

// Query keys for efficient caching
export const queryKeys = {
  ledgerFiles: ['ledgerFiles'] as const,
  transactions: (fileId: number) => ['transactions', fileId] as const,
  transactionDetails: (transactionId: number) => ['transactionDetails', transactionId] as const,
};

// React hooks for database operations
export const useLedgerFiles = () => {
  return useQuery({
    queryKey: queryKeys.ledgerFiles,
    queryFn: async () => {
      const db = await getDatabase();
      return db.files.getLedgerFiles();
    },
  });
};
```

## Browser Compatibility

### Supported Browsers
- **Chrome/Edge**: Full OPFS support
- **Firefox**: Limited OPFS support, fallback to in-memory
- **Safari**: Partial support with graceful degradation

### Feature Detection
```typescript
// Check for OPFS support
const hasOpfs = 'storage' in navigator && 'getDirectory' in navigator.storage;

// Check for SQL.js compatibility
const hasSqlJs = typeof WebAssembly !== 'undefined';
```

## Future Enhancements

### Planned Features
- **Enhanced Migration System**: More sophisticated schema versioning and rollback support
- **Multiple Storage Backends**: Support for alternative storage mechanisms beyond OPFS
- **Compression**: Database compression for storage efficiency
- **Encryption**: Optional client-side encryption
- **Synchronization**: Multi-tab synchronization support

### Performance Improvements
- **Query Optimization**: Advanced query plan optimization in repositories
- **Streaming**: Streaming database operations for very large datasets
- **Caching**: Additional caching layers for frequently accessed data

---

**⚠️ IMPORTANT**: When modifying the database schema or persistence layer, always ensure backward compatibility and test thoroughly across different browsers. Database migrations should be carefully planned and tested. The database code is now in the `packages/ccf-database` workspace - keep this documentation updated with any schema changes or new features.
