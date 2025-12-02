# @ccf/ledger-parser

A TypeScript parser for CCF (Confidential Consortium Framework) ledger chunk files in the LedgerChunkV2 format.

## Installation

```bash
npm install @ccf/ledger-parser
```

## Usage

### Parsing a Ledger File

```typescript
import { LedgerChunkV2 } from '@ccf/ledger-parser';

// Read a ledger file
const file = await fetch('ledger_1-100.committed');
const buffer = await file.arrayBuffer();

// Create parser instance
const chunk = new LedgerChunkV2('ledger_1-100.committed', buffer);

// Iterate over all transactions
for await (const transaction of chunk.readAllTransactions()) {
  console.log('Sequence Number:', transaction.gcmHeader.seqNo);
  console.log('View:', transaction.gcmHeader.view);
  console.log('Entry Type:', transaction.publicDomain.entryType);
  console.log('Writes:', transaction.publicDomain.writes.length);
  console.log('Deletes:', transaction.publicDomain.deletes.length);
}
```

### Reading a Single Transaction

```typescript
const chunk = new LedgerChunkV2(fileName, buffer);

while (chunk.hasMore) {
  const transaction = await chunk.readSingleTransaction();
  if (transaction) {
    // Process transaction
  }
}
```

### Decoding CBOR/COSE Data

The package includes utilities for decoding CBOR-encoded data, particularly COSE Sign1 structures:

```typescript
import { cborArrayToText, uint8ArrayToHexString } from '@ccf/ledger-parser';

// Decode a COSE Sign1 structure to readable JSON
const readable = cborArrayToText(coseData);
console.log(readable);

// Convert binary data to hex
const hex = uint8ArrayToHexString(binaryData);
```

## API Reference

### `LedgerChunkV2`

Main class for parsing CCF ledger chunks.

#### Constructor

```typescript
new LedgerChunkV2(fileName: string, buffer: ArrayBuffer)
```

#### Methods

- `readSingleTransaction(): Promise<Transaction | null>` - Reads the next transaction
- `readAllTransactions(): AsyncGenerator<Transaction>` - Async iterator for all transactions

#### Properties

- `fileName: string` - Name of the ledger file
- `position: number` - Current read position in the buffer
- `hasMore: boolean` - Whether there are more transactions to read

### Types

#### `Transaction`

```typescript
interface Transaction {
  header: TransactionHeader;
  gcmHeader: GcmHeader;
  publicDomain: PublicDomain;
  txDigest: Uint8Array;
}
```

#### `EntryType`

```typescript
const EntryType = {
  WriteSet: 0,
  Snapshot: 1,
  WriteSetWithClaims: 2,
  WriteSetWithCommitEvidence: 3,
  WriteSetWithCommitEvidenceAndClaims: 4
} as const;
```

## License

Apache-2.0
