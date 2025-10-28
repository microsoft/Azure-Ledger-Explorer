# CCF Ledger Parser System

## Overview

The CCF Ledger Parser is responsible for reading and parsing CCF (Confidential Consortium Framework) ledger files in the `.committed` format. The parser is implemented in TypeScript and ported from the original C# implementation, ensuring compatibility with the official CCF ledger format.

## Architecture

The parser system consists of several key components:

### 1. LedgerChunkV2 Class (`src/parser/ledger-chunk.ts`)

The main parser class that handles:
- **File Reading**: Processes binary ledger files using ArrayBuffer and DataView
- **Transaction Parsing**: Extracts individual transactions from the ledger stream
- **Header Processing**: Parses transaction headers, GCM headers, and public domain data
- **Cryptographic Verification**: Calculates transaction digests using SHA-256

### 2. Type Definitions (`src/types/ccf-types.ts`)

Comprehensive TypeScript interfaces that define:
- **TransactionHeader**: Version, flags, and size information
- **GcmHeader**: GCM tag, sequence number, and view data
- **PublicDomain**: Entry type, version, digests, and key-value operations
- **LedgerKeyValue**: Individual key-value pairs with versioning
- **Transaction**: Complete transaction structure

### 3. Entry Types

The parser supports all CCF entry types:
- `WriteSet` (0): Basic key-value operations
- `Snapshot` (1): Ledger snapshots
- `WriteSetWithClaims` (2): Operations with claims
- `WriteSetWithCommitEvidence` (3): Operations with commit evidence
- `WriteSetWithCommitEvidenceAndClaims` (4): Full featured operations

## Parsing Process

### 1. File Structure Reading
```typescript
// Read file size from first 8 bytes
const fileSize = view.getBigUint64(0, true);
```

### 2. Transaction Header Parsing
```typescript
const header = {
  version: view.getUint8(0),
  flags: view.getUint8(1),
  size: view.getUint32(2, true)
};
```

### 3. GCM Header Processing
```typescript
const gcmHeader = {
  gcmTag: new Uint8Array(buffer.slice(0, 16)),
  seqNo: view.getUint32(16, true),
  view: view.getUint32(20, true)
};
```

### 4. Public Domain Extraction
- Reads domain size
- Parses entry type and transaction version
- Extracts key-value operations (writes and deletes)
- Processes cryptographic digests

### 5. Transaction Digest Calculation
Uses SHA-256 to calculate transaction digests for integrity verification.

## Key Features

### Streaming Parser
- **Memory Efficient**: Processes large files without loading everything into memory
- **Async Iteration**: Uses generator functions for incremental parsing
- **Error Handling**: Graceful handling of corrupted or invalid transactions

### Binary Data Handling
- **Little Endian**: Properly handles CCF's little-endian byte ordering
- **Type Safety**: Strong TypeScript typing for all binary structures
- **Buffer Management**: Efficient ArrayBuffer and DataView usage

### Key-Value Processing
- **Map Name Extraction**: Identifies CCF table names from operations
- **Value Decoding**: Attempts UTF-8 decoding of binary values
- **Version Tracking**: Maintains version information for all operations

## Usage Examples

### Basic Parsing
```typescript
const ledgerChunk = new LedgerChunkV2(filename, arrayBuffer);

// Read all transactions
for await (const transaction of ledgerChunk.readAllTransactions()) {
  console.log(`Transaction ${transaction.gcmHeader.seqNo}`);
  
  // Process writes
  transaction.publicDomain.writes.forEach(write => {
    console.log(`Write: ${write.key} = ${write.value}`);
  });
  
  // Process deletes
  transaction.publicDomain.deletes.forEach(del => {
    console.log(`Delete: ${del.key}`);
  });
}
```

### Single Transaction Reading
```typescript
const transaction = await ledgerChunk.readSingleTransaction();
if (transaction) {
  console.log(`Entry Type: ${transaction.publicDomain.entryType}`);
  console.log(`TX Version: ${transaction.publicDomain.txVersion}`);
}
```

## Performance Considerations

### Memory Usage
- Uses streaming approach to minimize memory footprint
- Processes transactions one at a time
- Efficient buffer management with proper cleanup

### Processing Speed
- Optimized binary parsing with DataView
- Minimal data copying during parsing
- Batched database operations for better performance

## Error Handling

The parser includes comprehensive error handling for:
- **Corrupted Files**: Invalid headers or unexpected data
- **Truncated Files**: Incomplete transactions at file end
- **Invalid Formats**: Non-CCF file formats
- **Memory Errors**: Buffer overflow protection

## Integration with Database Layer

The parser integrates seamlessly with the database layer:
1. **Transaction Insertion**: Parsed data is stored in SQLite database
2. **Batch Processing**: Multiple transactions processed in batches
3. **Index Creation**: Automatic indexing of key-value operations
4. **Error Logging**: Database errors are logged and handled gracefully

## Validation and Testing

### File Format Validation
- Verifies CCF file headers and structure
- Validates transaction sequence numbers
- Checks cryptographic integrity

### Compatibility Testing
- Tested against official CCF ledger files
- Compatibility with different CCF versions
- Performance testing with large files

## Future Enhancements

- **Parallel Processing**: Multi-threaded parsing for large files
- **Incremental Parsing**: Resume parsing from specific positions
- **Schema Evolution**: Support for future CCF format changes
- **Compression Support**: Handle compressed ledger files

---

**⚠️ IMPORTANT**: When modifying the parser code, always ensure compatibility with the official CCF ledger format. Run comprehensive tests against known good ledger files before deploying changes. Keep this documentation updated with any changes to the parsing logic or supported formats.
