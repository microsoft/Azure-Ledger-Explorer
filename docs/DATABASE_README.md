# CCF Database and Persistence Layer

## Overview

The persistence layer provides a robust, browser-based database solution for storing and querying CCF ledger data. Built on sql.js with OPFS (Origin Private File System) support, it enables efficient storage and retrieval of parsed ledger information directly in the user's browser.

## Architecture

### Core Components

#### 1. CCFDatabase Class (`src/database/ccf-database.ts`)
The main database abstraction that provides:
- **SQLite Integration**: Uses sql.js for in-browser SQL database
- **OPFS Persistence**: Leverages Origin Private File System for persistent storage
- **Schema Management**: Automatic table creation and migration
- **Query Interface**: Safe SQL execution with security controls

#### 2. Database Configuration
```typescript
interface DatabaseConfig {
  filename: string;    // Database filename in OPFS
  useOpfs?: boolean;   // Enable persistent storage
}
```

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
- **In-Memory Database**: Fast operations with full SQL support
- **Export/Import**: Serialize database to binary format
- **Cross-Platform**: Works in all modern browsers
- **No Server Required**: Completely client-side solution

### 2. OPFS (Origin Private File System)
- **Persistent Storage**: Data survives browser restarts
- **High Performance**: Native file system access
- **Large Capacity**: Can handle multi-gigabyte databases
- **Privacy**: Data stays local to the user's browser

### 3. Fallback Strategy
```typescript
// Graceful degradation for unsupported browsers
if (this.config.useOpfs && navigator.storage && navigator.storage.getDirectory) {
  // Use OPFS for persistence
  await this.loadFromOpfs();
} else {
  // Use in-memory database
  this.db = new this.sql.Database();
}
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
// Initialize database
await database.initialize();

// Save to persistent storage
await database.save();

// Close and cleanup
await database.close();
```

#### Data Insertion
```typescript
// Insert ledger file
const fileId = await database.insertLedgerFile(filename, fileSize);

// Insert single transaction
const txId = await database.insertTransaction(fileId, transaction);

// Batch insert transactions (memory optimized)
await database.insertTransactionsBatch(fileId, transactions);
```

#### Data Retrieval
```typescript
// Get ledger files
const files = await database.getLedgerFiles();

// Get transactions with pagination
const transactions = await database.getTransactions(fileId, limit, offset);

// Get transaction details
const writes = await database.getTransactionWrites(transactionId);
const deletes = await database.getTransactionDeletes(transactionId);
```

#### Analytics and Statistics
```typescript
// Basic statistics
const stats = await database.getStats();

// Enhanced analytics
const enhancedStats = await database.getEnhancedStats();

// CCF table analysis
const tables = await database.getCCFTables();
```

### Safe Query Execution
```typescript
// Execute user queries safely (SELECT only)
const results = await database.executeQuery(sqlQuery);
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

### Export Functionality
```typescript
// Export entire database
const binaryData = database.export();

// Save to file
const blob = new Blob([binaryData], { type: 'application/octet-stream' });
```

### Import Functionality
```typescript
// Import from binary data
const database = new CCFDatabase(config);
await database.initialize();
await database.import(binaryData);
```

### Reset Operations
```typescript
// Clear all data (keep schema)
await database.clearAllData();

// Complete database reset
await database.dropDatabase();
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

The database layer integrates seamlessly with TanStack Query:

```typescript
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
      return db.getLedgerFiles();
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
- **Database Versioning**: Schema migration support
- **Compression**: Database compression for storage efficiency
- **Encryption**: Optional client-side encryption
- **Synchronization**: Multi-tab synchronization support

### Performance Improvements
- **Web Workers**: Background processing for large imports
- **Streaming**: Streaming database operations
- **IndexedDB Fallback**: Alternative storage for older browsers

---

**⚠️ IMPORTANT**: When modifying the database schema or persistence layer, always ensure backward compatibility and test thoroughly across different browsers. Database migrations should be carefully planned and tested. Keep this documentation updated with any schema changes or new features.
