### Uploading Local Files

Upload CCF ledger files from your local system for analysis and exploration.

### Supported File Types

- **Only .committed files** - Files must have the .committed extension
- **Sequential naming required** - Files must be named: ledger_<start>-<end>.committed
- **Examples**: ledger_1-18.committed, ledger_19-25.committed, ledger_26-40.committed

### File Sequence Requirements

1. **Must start at 1**: The first file must be ledger_1-X.committed
2. **Must be contiguous**: No gaps between file ranges
3. **No overlaps**: File ranges cannot overlap
4. **Sequential order**: Files will be processed in sequence order

### How to Upload

1. **Drag and Drop**: Simply drag .committed files from your file system into the upload area
2. **Browse Files**: Click "Select .committed Files" to open a file browser
3. **Multiple Files**: You can upload multiple sequential files at once

### File Processing

After upload, the application will:
- Validate file sequence and naming
- Parse the ledger structure in sequential order
- Extract transactions and key-value pairs
- Index data for fast searching
- Store everything locally in your browser

### Validation

The system will check for:
- Correct .committed file extension
- Proper naming format (ledger_X-Y.committed)
- Sequential and contiguous ranges
- No duplicate or overlapping files
