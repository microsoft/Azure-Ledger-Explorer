# Database Layer

This folder contains all database-related code for CCF Ledger Explorer.

## Architecture

```
src/database/
├── index.ts                    # Public API - use this for all imports
├── ccf-database.ts             # Main database class (facade pattern)
├── worker/
│   ├── worker-client.ts        # Worker communication layer
│   └── schema.ts               # Database schema definitions
├── queries/                    # Query modules (future organization)
│   └── file-queries.ts         # File operations
└── types/                      # Database-specific types (future)
```

## Usage

Always import from the index file for clean dependencies:

```typescript
import { CCFDatabase } from '@/database';

const db = new CCFDatabase({ filename: 'ccf-ledger.sqlite3' });
await db.initialize();
```

## Components

### CCFDatabase (`ccf-database.ts`)

Main database class that provides the public API for all database operations:

- File management (insert, get, delete ledger files)
- Transaction operations (insert, query, search)
- Key-value operations (writes, deletes, latest state)
- Statistics and analytics
- Database management (drop, clear, integrity checks)

### Worker Layer (`worker/`)

#### worker-client.ts

Communication layer between main thread and database worker. Provides:

- Promise-based API for worker commands
- Message passing and response handling
- ArrayBuffer transfers for large files
- Connection lifecycle management

#### schema.ts

Centralized schema definitions:

- Table creation SQL
- Index definitions
- Schema version management
- Table drop utilities
- Schema verification

### Web Worker (`src/workers/database-worker.ts`)

Runs SQLite operations in a separate thread for:

- OPFS (Origin Private File System) support for persistence
- Non-blocking database operations
- Optimized batch inserts
- Large file processing

## Database Schema

### Tables

**ledger_files**

- Tracks imported ledger files
- Primary key: `id` (auto-increment)
- Unique constraint on `filename`

**transactions**

- Stores ledger transactions
- Primary key: `sequence_no` (from ledger, NOT auto-increment)
- Foreign key: `file_id` → `ledger_files(id)`

**kv_writes**

- Key-value write operations
- Primary key: `id` (auto-increment)
- Foreign key: `sequence_no` → `transactions(sequence_no)`

**kv_deletes**

- Key-value delete operations
- Primary key: `id` (auto-increment)
- Foreign key: `sequence_no` → `transactions(sequence_no)`

### Indexes

- Transaction lookups by file
- KV lookups by sequence number
- KV lookups by map and key names
- Full-text search on value fields

## Key Design Decisions

### 1. Sequence Numbers as Primary Keys

The `transactions` table uses `sequence_no` from the ledger as the primary key instead of auto-increment IDs. This:

- Maintains ledger integrity
- Prevents duplicate sequence numbers
- Simplifies foreign key relationships

### 2. Worker Architecture

Database operations run in a Web Worker to:

- Enable OPFS for persistent browser storage
- Keep UI responsive during large operations
- Support transferable ArrayBuffers for performance

### 3. Schema Module

Centralized schema management:

- Single source of truth for table definitions
- Easier schema migrations
- Reusable across worker and tests

### 4. Facade Pattern

CCFDatabase acts as a facade to:

- Hide complexity from consumers
- Provide a stable public API
- Allow internal refactoring without breaking changes

## Future Improvements

1. **Query Modules**: Split ccf-database.ts into focused query modules
   - `queries/file-queries.ts` - File operations
   - `queries/transaction-queries.ts` - Transaction CRUD
   - `queries/kv-queries.ts` - Key-value operations
   - `queries/search-queries.ts` - Search functionality
   - `queries/stats-queries.ts` - Statistics and analytics

2. **Type Definitions**: Extract database-specific types
   - `types/database-types.ts` - DTOs and query result types

3. **Schema Migrations**: Add version-based migrations
   - Support schema evolution
   - Automatic migration on version mismatch

4. **Query Builder**: Type-safe query construction
   - Replace string SQL with builder pattern
   - Better TypeScript integration

## Performance Tips

- Use batch operations for multiple inserts (`insertTransactionBatch`)
- Leverage ArrayBuffer transfers for large files (`insertLedgerFileWithData`)
- Search queries automatically use indexes
- Use pagination (`limit`/`offset`) for large result sets
