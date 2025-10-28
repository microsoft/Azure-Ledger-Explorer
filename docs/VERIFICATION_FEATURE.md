# CCF Ledger Verification Feature

## Overview

The CCF Ledger Verification feature provides a robust, background verification system for CCF ledger files with automatic checkpointing and progress tracking. The verification runs in a web worker to avoid blocking the main thread.

## Key Features

### 🔧 Web Worker Processing
- Runs verification in a separate thread to keep the UI responsive
- Can be started, stopped, paused, and resumed
- Automatic cleanup on completion or error

### 📊 Progress Tracking
- Real-time progress updates every 50 transactions (configurable)
- Detailed statistics including current file, transaction count, and elapsed time
- Visual progress bar and status indicators

### 💾 Automatic Checkpointing
- Saves verification state every 100 transactions (configurable)
- Uses IndexedDB for persistent storage (separate from main SQLite database)
- Checkpoint data includes transaction number, file name, timestamp, and status

### 🛡️ Failure Handling
- Stops immediately when verification fails
- Creates a failure checkpoint with error details
- Prevents resumption after failure (safety feature)
- Clear error reporting with specific transaction and file information

### ⚙️ Configurable Options
- Checkpoint interval (default: 100 transactions)
- Progress report interval (default: 50 transactions)
- Resume from checkpoint capability

## Usage

### Basic Usage

```typescript
import { useVerification } from '../hooks/use-verification';

function MyComponent() {
  const {
    isRunning,
    progress,
    checkpoints,
    error,
    startVerification,
    stopVerification,
    pauseVerification,
    resumeVerification
  } = useVerification();

  const handleStart = async () => {
    const files = [/* your File objects */];
    const config = {
      checkpointInterval: 100,
      progressReportInterval: 50
    };
    
    try {
      const sessionId = await startVerification(files, config);
      console.log('Started verification with session:', sessionId);
    } catch (error) {
      console.error('Failed to start verification:', error);
    }
  };

  return (
    <div>
      <button onClick={handleStart} disabled={isRunning}>
        Start Verification
      </button>
      <button onClick={pauseVerification} disabled={!isRunning}>
        Pause
      </button>
      <button onClick={resumeVerification} disabled={!isRunning}>
        Resume
      </button>
      <button onClick={stopVerification} disabled={!isRunning}>
        Stop
      </button>
      
      {progress && (
        <div>
          <p>Status: {progress.status}</p>
          <p>Progress: {progress.currentTransaction} / {progress.totalTransactions}</p>
          <p>Current File: {progress.currentFileName}</p>
        </div>
      )}
      
      {error && (
        <div style={{ color: 'red' }}>
          Error: {error}
        </div>
      )}
    </div>
  );
}
```

### Advanced Configuration

```typescript
const config = {
  checkpointInterval: 200,        // Checkpoint every 200 transactions
  progressReportInterval: 25,     // Report progress every 25 transactions
  resumeFromCheckpoint: true      // Enable resume functionality
};

await startVerification(files, config, 'my-custom-session-id');
```

### Managing Checkpoints

```typescript
// Get all checkpoints
const allCheckpoints = await verificationService.getAllCheckpoints();

// Get latest checkpoint for a session
const checkpoint = await verificationService.getLatestCheckpoint('session-id');

// Check if a session failed
const hasFailed = await verificationService.hasFailedCheckpoint('session-id');

// Clear all checkpoints
await verificationService.clearAllCheckpoints();

// Delete specific checkpoint
await verificationService.deleteCheckpoint('session-id');
```

## Data Structures

### VerificationProgress
```typescript
interface VerificationProgress {
  currentTransaction: number;      // Current transaction being processed
  totalTransactions: number;       // Total estimated transactions
  processedFiles: number;          // Number of files completed
  totalFiles: number;             // Total number of files
  currentFileName: string;        // Name of current file being processed
  status: 'running' | 'paused' | 'completed' | 'failed' | 'stopped';
  startTime: number;              // Timestamp when verification started
  lastCheckpoint: number;         // Last transaction that was checkpointed
  errorMessage?: string;          // Error message if status is 'failed'
}
```

### VerificationCheckpoint
```typescript
interface VerificationCheckpoint {
  id: string;                     // Unique session identifier
  timestamp: number;              // When checkpoint was created
  lastVerifiedTransaction: number; // Last successfully verified transaction
  lastVerifiedFile: string;       // File being processed at checkpoint
  status: 'pass' | 'fail';       // Verification status
  totalTransactionsProcessed: number;
  failureDetails?: {              // Only present if status is 'fail'
    transactionNumber: number;
    fileName: string;
    errorMessage: string;
    timestamp: number;
  };
}
```

## Verification Logic

The current verification implementation includes:

1. **Structure Validation**: Ensures transactions have required fields (header, gcmHeader, publicDomain, txDigest)
2. **Digest Length Validation**: Verifies transaction digests are exactly 32 bytes
3. **Extensible Design**: Easy to add more validation rules

### Extending Verification

To add custom verification logic, modify the `verifyTransaction` method in `verification-worker.ts`:

```typescript
private async verifyTransaction(transaction: any, transactionNumber: number, fileName: string): Promise<VerificationResult> {
  // Basic validations...
  
  // Add your custom validations here
  if (/* your condition */) {
    return {
      transactionNumber,
      fileName,
      passed: false,
      errorMessage: 'Your custom error message'
    };
  }
  
  // Add digest re-calculation and comparison
  // const recalculatedDigest = await this.recalculateDigest(transaction);
  // if (!this.compareDigests(transaction.txDigest, recalculatedDigest)) {
  //   return { passed: false, errorMessage: 'Digest mismatch' };
  // }
  
  return { transactionNumber, fileName, passed: true };
}
```

## Error Handling

The verification system has comprehensive error handling:

- **Worker Errors**: Caught and reported via the error event
- **Verification Failures**: Stops processing and creates failure checkpoint
- **IndexedDB Errors**: Gracefully handled with console warnings
- **File Reading Errors**: Reported with specific file and transaction context

## Best Practices

1. **Memory Management**: The worker automatically cleans up resources
2. **Large Files**: Progress reporting prevents UI freezing
3. **Error Recovery**: Always check for existing failed checkpoints before starting
4. **Performance**: Adjust checkpoint and progress intervals based on your needs
5. **Storage**: Checkpoints are stored separately from main database data

## Limitations

1. **No Resume After Failure**: This is by design for data integrity
2. **Estimation**: Transaction count estimation is approximate until files are processed
3. **Browser Storage**: IndexedDB has browser storage limits
4. **Single Session**: Only one verification can run at a time per browser tab

## Integration with Main Application

The verification feature is designed to be independent of the main CCF database and can be easily integrated into existing applications. It uses its own IndexedDB database for checkpoints and doesn't interfere with the main SQLite database used for ledger data storage.
