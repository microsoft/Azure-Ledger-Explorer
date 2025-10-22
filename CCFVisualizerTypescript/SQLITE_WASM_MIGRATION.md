# SQLite WASM Migration Guide

## Summary

This document outlines the migration from `sql.js` to the official `@sqlite.org/sqlite-wasm` package with OPFS support.

## Completed Steps

1. ✅ **Updated package.json** - Removed `sql.js` dependency
2. ✅ **Updated vite.config.ts** - Added required CORS headers for OPFS
3. ✅ **Created database-worker.ts** - Web Worker that runs SQLite with OPFS
4. ✅ **Created database-worker-client.ts** - Client to communicate with the worker

## Remaining Steps

### 5. Complete CCFDatabase Refactor

The `ccf-database.ts` file needs to be completely rewritten to use the worker client. Here's the approach:

**Key Changes:**
- Replace all direct `sql.js` database calls with worker client calls
- Remove the `save()` method logic (OPFS handles persistence automatically)
- Simplify initialization (no more manual OPFS file handling)
- All SQL execution goes through the `exec()` and `execBatch()` methods

**Implementation Pattern:**

```typescript
// Old approach (sql.js):
const result = this.db.exec(`SELECT * FROM table WHERE id = ?`, [id]);
const rows = result[0].values;

// New approach (worker client):
const rows = await this.exec(`SELECT * FROM table WHERE id = ?`, [id]);
```

**Batch Operations:**

```typescript
// Old approach:
this.db.exec('BEGIN TRANSACTION');
// ... multiple operations
this.db.exec('COMMIT');

// New approach:
await this.execBatch([
  { sql: 'INSERT INTO...', bind: [...] },
  { sql: 'UPDATE...', bind: [...] },
]);
```

### 6. Update verification-worker.ts

Remove sql.js imports from `src/workers/verification-worker.ts`. The verification worker should not directly access the database - all database operations should go through the CCFDatabase class which uses the database worker.

### 7. Remove sql.js type declarations

Delete `src/types/sql.d.ts` as it's no longer needed.

### 8. Testing

After the refactor:
1. Start the dev server: `npm run dev`
2. Test database initialization
3. Test loading ledger files
4. Test querying transactions
5. Verify OPFS persistence (data should persist across page reloads)

## Benefits of This Migration

1. **Official Support**: Using the official SQLite WASM package maintained by the SQLite team
2. **Better OPFS Integration**: Native OPFS support built-in
3. **Better Performance**: Optimized for Web Workers and modern browsers
4. **Smaller Bundle**: More efficient WASM module
5. **Active Maintenance**: Regular updates aligned with SQLite releases

## Key Architectural Changes

### Before (sql.js):
```
Main Thread
  ↓
CCFDatabase (sql.js) ← Direct DB access
  ↓
OPFS (manual save/load)
```

### After (@sqlite.org/sqlite-wasm):
```
Main Thread
  ↓
CCFDatabase (client API)
  ↓
DatabaseWorkerClient (messaging)
  ↓
Database Worker (sqlite-wasm)
  ↓
OPFS (automatic persistence)
```

## Migration Tips

- The worker client returns Promises, so all database operations are now async
- Results come back as arrays of objects (not sql.js result format)
- OPFS persistence is automatic - no need to manually save
- Transactions are handled with `BEGIN`/`COMMIT` statements in execBatch

## Troubleshooting

### Headers Not Set
If you see errors about SharedArrayBuffer or cross-origin isolation:
- Ensure vite.config.ts has the CORS headers
- Check browser dev tools → Network → Response Headers
- Headers must be: `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`

### Worker Not Loading
- Check the browser console for module loading errors
- Ensure the worker path is correct in database-worker-client.ts
- Verify @sqlite.org/sqlite-wasm is installed: `npm list @sqlite.org/sqlite-wasm`

### OPFS Not Available
- OPFS requires a secure context (HTTPS or localhost)
- Not all browsers support OPFS (check caniuse.com)
- The worker will fall back to in-memory DB if OPFS is not available

## Next Steps

1. Complete the CCFDatabase refactor (copy all methods from the old implementation)
2. Test thoroughly with real ledger files
3. Remove old backup files
4. Update documentation
