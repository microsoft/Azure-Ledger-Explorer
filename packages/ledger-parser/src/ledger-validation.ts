/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

/**
 * Basic file info parsed from a ledger filename.
 * This is the base type for all ledger chunk representations.
 */
export interface LedgerFileInfo {
  filename: string;
  startNo: number;
  endNo: number;
  isValid: boolean;
}

/**
 * Extended file info with additional metadata for UI display and selection.
 * Used by ChunkSelector and import views.
 */
export interface ChunkFileInfo extends LedgerFileInfo {
  /** Unique identifier for this file (e.g., hash, path, or generated id) */
  id: string;
  /** File size in bytes (optional) */
  size?: number;
  /** Last modified date (optional) */
  lastModified?: Date;
  /** Whether this file is already loaded in the database */
  isExisting?: boolean;
}

/**
 * Ledger file info as stored in the database.
 * Used by verification worker and database queries.
 */
export interface LedgerChunkRecord {
  /** Database row ID */
  id: number;
  filename: string;
  fileSize: number;
  verified: boolean | null;
  verificationError?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * A gap in the sequence between chunks
 */
export interface SequenceGap {
  startNo: number;
  endNo: number;
}

/**
 * A group of files covering the same sequence range.
 * Generic type T allows grouping any file type (ChunkFileInfo, etc.)
 */
export interface RangeGroup<T extends LedgerFileInfo = LedgerFileInfo> {
  /** The sequence range key, e.g. "1-14" */
  rangeKey: string;
  startNo: number;
  endNo: number;
  /** All files that cover this range */
  files: T[];
  /** Whether this group has multiple files (duplicates from different sources) */
  isDuplicate: boolean;
}

/**
 * Result from analyzing a collection of ledger files.
 * Generic type T allows preserving the original file type in groups.
 */
export interface LedgerSequenceAnalysis<T extends LedgerFileInfo = LedgerFileInfo> {
  /** Files grouped by sequence range, sorted by start number */
  groups: RangeGroup<T>[];
  /** Sorted unique ranges by start number (first file from each group) */
  sortedRanges: T[];
  /** Gaps detected between consecutive ranges */
  gaps: SequenceGap[];
  /** Whether there are overlapping ranges */
  hasOverlaps: boolean;
  /** Details of any overlapping ranges */
  overlaps: Array<{ first: T; second: T }>;
  /** Whether the sequence starts at 1 */
  startsAtOne: boolean;
  /** Whether the sequence is contiguous (no gaps) */
  isContiguous: boolean;
  /** Range keys that appear multiple times (duplicates) */
  duplicateRanges: Set<string>;
}

/**
 * Validation result with human-readable errors.
 */
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
 * Generate a range key from start and end numbers
 */
export function getRangeKey(startNo: number, endNo: number): string {
  return `${startNo}-${endNo}`;
}

/**
 * Analyze a collection of ledger files to detect gaps, overlaps, and duplicates.
 * This is the core validation logic used throughout the application.
 * 
 * @param files - Array of files with filename property (or pre-parsed LedgerFileInfo)
 * @returns Analysis result with groups, gaps, overlaps, and sequence information
 */
export function analyzeLedgerSequence<T extends LedgerFileInfo>(
  files: T[],
): LedgerSequenceAnalysis<T> {
  // Filter to valid files only
  const validFiles = files.filter(info => info.isValid);
  
  // Group files by range
  const groupMap = new Map<string, RangeGroup<T>>();
  
  for (const file of validFiles) {
    const rangeKey = getRangeKey(file.startNo, file.endNo);
    const existing = groupMap.get(rangeKey);
    
    if (existing) {
      existing.files.push(file);
      existing.isDuplicate = true;
    } else {
      groupMap.set(rangeKey, {
        rangeKey,
        startNo: file.startNo,
        endNo: file.endNo,
        files: [file],
        isDuplicate: false,
      });
    }
  }
  
  // Sort groups by start number
  const groups = Array.from(groupMap.values()).sort(
    (a, b) => a.startNo - b.startNo
  );
  
  // Extract sorted ranges (first file from each group)
  const sortedRanges = groups.map(g => g.files[0]);
  
  // Find duplicate ranges
  const duplicateRanges = new Set<string>();
  for (const group of groups) {
    if (group.isDuplicate) {
      duplicateRanges.add(group.rangeKey);
    }
  }
  
  // Detect overlaps
  const overlaps: Array<{ first: T; second: T }> = [];
  for (let i = 0; i < sortedRanges.length - 1; i++) {
    const current = sortedRanges[i];
    const next = sortedRanges[i + 1];
    if (current.endNo >= next.startNo) {
      overlaps.push({ first: current, second: next });
    }
  }
  
  // Detect gaps
  const gaps: SequenceGap[] = [];
  for (let i = 0; i < sortedRanges.length - 1; i++) {
    const current = sortedRanges[i];
    const next = sortedRanges[i + 1];
    const expectedStart = current.endNo + 1;
    
    if (next.startNo > expectedStart) {
      gaps.push({
        startNo: expectedStart,
        endNo: next.startNo - 1,
      });
    }
  }
  
  // Check if starts at 1
  const startsAtOne = sortedRanges.length > 0 && sortedRanges[0].startNo === 1;
  
  return {
    groups,
    sortedRanges,
    gaps,
    hasOverlaps: overlaps.length > 0,
    overlaps,
    startsAtOne,
    isContiguous: gaps.length === 0,
    duplicateRanges,
  };
}

/**
 * Parse files (by filename) and analyze them.
 * Convenience overload that handles parsing from File objects or any object with a filename.
 * 
 * @param files - Array of objects with filename property
 * @returns Analysis result with groups, gaps, overlaps, and sequence information
 */
export function parseAndAnalyzeFiles<T extends { filename: string }>(
  files: T[],
): LedgerSequenceAnalysis<T & LedgerFileInfo> {
  // Parse files and merge with original objects
  const parsed = files.map(file => ({
    ...file,
    ...parseLedgerFilename(file.filename),
  }));
  
  return analyzeLedgerSequence(parsed);
}

/**
 * Validate a collection of ledger files to ensure they are contiguous and sequential.
 * This is the high-level validation function that returns human-readable errors.
 */
export function validateLedgerSequence(files: File[], existingFiles: LedgerFileInfo[] = []): ValidationResult {
  const errors: string[] = [];
  
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
  const allFileInfos = [...existingFiles, ...newFileInfos.filter(info => info.isValid)];
  
  // Use the core analysis function
  const analysis = analyzeLedgerSequence(allFileInfos);
  
  // Convert analysis to errors
  if (analysis.duplicateRanges.size > 0) {
    errors.push(`Duplicate files detected: ${Array.from(analysis.duplicateRanges).join(', ')}`);
  }
  
  for (const overlap of analysis.overlaps) {
    errors.push(
      `Overlapping ranges detected: ${overlap.first.filename} (${overlap.first.startNo}-${overlap.first.endNo}) ` +
      `overlaps with ${overlap.second.filename} (${overlap.second.startNo}-${overlap.second.endNo})`
    );
  }
  
  if (analysis.sortedRanges.length > 0 && !analysis.startsAtOne) {
    errors.push('Ledger sequence must start at 1. Missing initial chunk.');
  }

  for (const gap of analysis.gaps) {
    const beforeFile = analysis.sortedRanges.find(f => f.endNo === gap.startNo - 1);
    const afterFile = analysis.sortedRanges.find(f => f.startNo === gap.endNo + 1);
    errors.push(
      `Missing chunk: ledger_${gap.startNo}-${gap.endNo}.committed ` +
      `(gap between ${beforeFile?.filename || 'start'} and ${afterFile?.filename || 'end'})`
    );
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sortedFiles: analysis.sortedRanges,
    missingRanges: analysis.gaps.map(g => ({ start: g.startNo, end: g.endNo })),
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
