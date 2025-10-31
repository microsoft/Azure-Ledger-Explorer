// Utility functions for validating CCF ledger file sequences

export interface LedgerFileInfo {
  filename: string;
  startNo: number;
  endNo: number;
  isValid: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sortedFiles: LedgerFileInfo[];
  missingRanges: Array<{ start: number; end: number }>;
}

/**
 * Parse a ledger filename to extract start and end numbers
 * Expected format: ledger_<start>-<end>.committed
 */
export function parseLedgerFilename(filename: string): LedgerFileInfo {
  const regex = /^ledger_(\d+)-(\d+)\.committed$/;
  const match = filename.match(regex);
  
  if (!match) {
    return {
      filename,
      startNo: -1,
      endNo: -1,
      isValid: false,
    };
  }
  
  const startNo = parseInt(match[1], 10);
  const endNo = parseInt(match[2], 10);
  
  return {
    filename,
    startNo,
    endNo,
    isValid: startNo > 0 && endNo >= startNo,
  };
}

/**
 * Validate a collection of ledger files to ensure they are contiguous and sequential
 */
export function validateLedgerSequence(files: File[], existingFiles: LedgerFileInfo[] = []): ValidationResult {
  const errors: string[] = [];
  const allFileInfos: LedgerFileInfo[] = [];
  
  // Parse new files
  const newFileInfos = files.map(file => parseLedgerFilename(file.name));
  
  // Check for invalid filenames
  const invalidFiles = newFileInfos.filter(info => !info.isValid);
  if (invalidFiles.length > 0) {
    errors.push(
      `Invalid filename format: ${invalidFiles.map(f => f.filename).join(', ')}. ` +
      'Expected format: ledger_<start>-<end>.committed (e.g., ledger_1-18.committed)'
    );
  }
  
  // Combine existing and new valid files
  const validNewFiles = newFileInfos.filter(info => info.isValid);
  allFileInfos.push(...existingFiles, ...validNewFiles);
  
  // Check for duplicates
  const fileMap = new Map<string, LedgerFileInfo>();
  const duplicates: string[] = [];
  
  for (const fileInfo of allFileInfos) {
    if (fileMap.has(fileInfo.filename)) {
      duplicates.push(fileInfo.filename);
    } else {
      fileMap.set(fileInfo.filename, fileInfo);
    }
  }
  
  if (duplicates.length > 0) {
    errors.push(`Duplicate files detected: ${duplicates.join(', ')}`);
  }
  
  // Sort files by start number
  const sortedFiles = Array.from(fileMap.values()).sort((a, b) => a.startNo - b.startNo);
  
  // Check for overlapping ranges
  for (let i = 0; i < sortedFiles.length - 1; i++) {
    const current = sortedFiles[i];
    const next = sortedFiles[i + 1];
    
    if (current.endNo >= next.startNo) {
      errors.push(
        `Overlapping ranges detected: ${current.filename} (${current.startNo}-${current.endNo}) ` +
        `overlaps with ${next.filename} (${next.startNo}-${next.endNo})`
      );
    }
  }
  
  // Check sequence must start at 1
  if (sortedFiles.length > 0 && sortedFiles[0].startNo !== 1) {
    errors.push('Ledger sequence must start at 1. Missing initial chunk.');
  }
  
  // Check for gaps in sequence
  const missingRanges: Array<{ start: number; end: number }> = [];
  for (let i = 0; i < sortedFiles.length - 1; i++) {
    const current = sortedFiles[i];
    const next = sortedFiles[i + 1];
    const expectedStart = current.endNo + 1;
    
    if (next.startNo > expectedStart) {
      missingRanges.push({
        start: expectedStart,
        end: next.startNo - 1,
      });
      errors.push(
        `Missing chunk: ledger_${expectedStart}-${next.startNo - 1}.committed ` +
        `(gap between ${current.filename} and ${next.filename})`
      );
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sortedFiles,
    missingRanges,
  };
}

/**
 * Format a file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format a date string in a user-friendly format
 */
export function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}
