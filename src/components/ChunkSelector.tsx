/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  makeStyles,
  Text,
  Caption1,
  Button,
  Checkbox,
  RadioGroup,
  Radio,
  Badge,
  MessageBar,
  MessageBarBody,
  Divider,
  tokens,
} from '@fluentui/react-components';
import {
  DocumentRegular,
  Warning16Regular,
  CheckmarkCircle16Regular,
  ErrorCircle16Regular,
  Info16Regular,
} from '@fluentui/react-icons';
import { parseLedgerFilename, type LedgerFileInfo } from '../utils/ledger-validation';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    width: '100%',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chunkList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    maxHeight: '400px',
    overflowY: 'auto',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: '6px',
    padding: '8px',
  },
  chunkRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 12px',
    borderRadius: '4px',
    backgroundColor: tokens.colorNeutralBackground1,
    '&:hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  chunkRowSelected: {
    backgroundColor: tokens.colorNeutralBackground1Selected,
  },
  chunkRowAlreadyLoaded: {
    backgroundColor: tokens.colorPaletteGreenBackground1,
    opacity: 0.8,
  },
  alreadyLoadedBadge: {
    marginLeft: 'auto',
  },
  chunkInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flex: 1,
  },
  chunkName: {
    fontFamily: 'monospace',
    fontSize: '13px',
  },
  chunkMeta: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  duplicateSection: {
    marginLeft: '32px',
    padding: '8px 12px',
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: '4px',
    borderLeft: `3px solid ${tokens.colorPaletteYellowBorder1}`,
  },
  duplicateLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
  },
  gapRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    backgroundColor: tokens.colorPaletteYellowBackground1,
    borderRadius: '4px',
    color: tokens.colorPaletteYellowForeground2,
  },
  summary: {
    padding: '12px',
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: '6px',
  },
  summaryRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '4px',
  },
  actions: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quickActions: {
    display: 'flex',
    gap: '8px',
  },
  importButton: {
    minWidth: '140px',
  },
  sequenceRange: {
    fontFamily: 'monospace',
    fontSize: '12px',
    color: tokens.colorNeutralForeground2,
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  existingDataInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    backgroundColor: tokens.colorPaletteGreenBackground1,
    borderRadius: '6px',
    marginBottom: '8px',
  },
});

/**
 * Extended file info with additional metadata for display
 */
export interface ChunkFileInfo extends LedgerFileInfo {
  /** Unique identifier for this file (e.g., hash, path, or generated id) */
  id: string;
  /** File size in bytes (optional) */
  size?: number;
  /** Last modified date (optional) */
  lastModified?: Date;
}

/**
 * Group of files that cover the same sequence range (duplicates/forks)
 */
interface ChunkGroup {
  /** The sequence range key, e.g. "1-14" */
  rangeKey: string;
  startNo: number;
  endNo: number;
  /** All files that cover this range */
  files: ChunkFileInfo[];
  /** Whether this group has multiple files (is a fork/duplicate) */
  isDuplicate: boolean;
}

/**
 * Gap in the sequence
 */
interface SequenceGap {
  startNo: number;
  endNo: number;
}

/**
 * Selection state for the chunk selector
 */
export interface ChunkSelection {
  /** Map of rangeKey -> selected file id (for resolving duplicates) */
  selectedVersions: Map<string, string>;
  /** Set of rangeKeys that are checked for import */
  checkedRanges: Set<string>;
}

/**
 * Validation result for the current selection
 */
export interface ChunkSelectionValidation {
  /** Whether the selection is valid for import */
  canImport: boolean;
  /** Whether the selection starts from sequence 1 */
  startsFromBeginning: boolean;
  /** Whether the selection is contiguous (no gaps) */
  isContiguous: boolean;
  /** Whether the selection can be fully verified (starts at 1 and no gaps) */
  canFullyVerify: boolean;
  /** Human-readable message about the selection */
  message: string;
}

export interface ChunkSelectorProps {
  /** List of available files to select from */
  files: ChunkFileInfo[];
  /** Callback when selection changes */
  onSelectionChange?: (selection: ChunkSelection) => void;
  /** Callback when import is confirmed - receives selected files, overwrite preference, and auto-verify preference */
  onImport: (selectedFiles: ChunkFileInfo[], overwriteExisting: boolean, autoVerify: boolean) => void;
  /** Whether import is in progress */
  isImporting?: boolean;
  /** Import button label */
  importButtonLabel?: string;
  /** Whether to show the overwrite existing data option */
  showOverwriteOption?: boolean;
  /** Default value for overwrite option */
  defaultOverwrite?: boolean;
  /** Set of range keys that are already loaded in the database */
  existingRanges?: Set<string>;
  /** Callback to clear the database */
  onClearDatabase?: () => Promise<void>;
  /** Whether to show the auto-verify checkbox */
  showAutoVerifyOption?: boolean;
  /** Default value for auto-verify option (will be overridden by localStorage if available) */
  defaultAutoVerify?: boolean;
}

// LocalStorage key for auto-verify preference
const AUTO_VERIFY_PREFERENCE_KEY = 'ccf-auto-verify-on-import';

/**
 * Smart chunk selector component that handles duplicates, gaps, and validation
 */
export const ChunkSelector: React.FC<ChunkSelectorProps> = ({
  files,
  onSelectionChange,
  onImport,
  isImporting = false,
  importButtonLabel = 'Import',
  showOverwriteOption = false,
  defaultOverwrite = false,
  existingRanges = new Set(),
  onClearDatabase,
  showAutoVerifyOption = true,
  defaultAutoVerify = true,
}) => {
  const styles = useStyles();
  const [overwriteExisting, setOverwriteExisting] = useState(defaultOverwrite);
  const [isClearing, setIsClearing] = useState(false);
  
  // Initialize auto-verify from localStorage, falling back to defaultAutoVerify
  const [autoVerify, setAutoVerify] = useState(() => {
    try {
      const saved = localStorage.getItem(AUTO_VERIFY_PREFERENCE_KEY);
      return saved !== null ? JSON.parse(saved) : defaultAutoVerify;
    } catch {
      return defaultAutoVerify;
    }
  });
  
  // Persist auto-verify preference to localStorage
  const handleAutoVerifyChange = useCallback((checked: boolean) => {
    setAutoVerify(checked);
    try {
      localStorage.setItem(AUTO_VERIFY_PREFERENCE_KEY, JSON.stringify(checked));
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Group files by sequence range and detect duplicates
  const { chunkGroups, gaps } = useMemo(() => {
    const groupMap = new Map<string, ChunkGroup>();

    // Parse and group files
    for (const file of files) {
      const parsed = parseLedgerFilename(file.filename);
      if (!parsed.isValid) continue;

      const rangeKey = `${parsed.startNo}-${parsed.endNo}`;
      const existing = groupMap.get(rangeKey);

      if (existing) {
        existing.files.push(file);
        existing.isDuplicate = true;
      } else {
        groupMap.set(rangeKey, {
          rangeKey,
          startNo: parsed.startNo,
          endNo: parsed.endNo,
          files: [file],
          isDuplicate: false,
        });
      }
    }

    // Sort groups by start number
    const sortedGroups = Array.from(groupMap.values()).sort(
      (a, b) => a.startNo - b.startNo
    );

    // Detect gaps
    const detectedGaps: SequenceGap[] = [];
    for (let i = 0; i < sortedGroups.length - 1; i++) {
      const current = sortedGroups[i];
      const next = sortedGroups[i + 1];
      const expectedStart = current.endNo + 1;

      if (next.startNo > expectedStart) {
        detectedGaps.push({
          startNo: expectedStart,
          endNo: next.startNo - 1,
        });
      }
    }

    return { chunkGroups: sortedGroups, gaps: detectedGaps };
  }, [files]);

  // Initialize selection state
  const [selection, setSelection] = useState<ChunkSelection>(() => {
    const selectedVersions = new Map<string, string>();
    const checkedRanges = new Set<string>();

    // Default: select first version of each group, check all
    for (const group of chunkGroups) {
      selectedVersions.set(group.rangeKey, group.files[0].id);
      checkedRanges.add(group.rangeKey);
    }

    return { selectedVersions, checkedRanges };
  });

  // Update selection when files change
  useEffect(() => {
    const newSelectedVersions = new Map<string, string>();
    const newCheckedRanges = new Set<string>();

    for (const group of chunkGroups) {
      // Keep existing version selection if still valid
      const existingVersion = selection.selectedVersions.get(group.rangeKey);
      if (existingVersion && group.files.some(f => f.id === existingVersion)) {
        newSelectedVersions.set(group.rangeKey, existingVersion);
      } else {
        newSelectedVersions.set(group.rangeKey, group.files[0].id);
      }

      // Keep existing checked state if still valid
      if (selection.checkedRanges.has(group.rangeKey)) {
        newCheckedRanges.add(group.rangeKey);
      }
    }

    // If this is initial load (nothing was checked), check all
    if (selection.checkedRanges.size === 0) {
      for (const group of chunkGroups) {
        newCheckedRanges.add(group.rangeKey);
      }
    }

    setSelection({ selectedVersions: newSelectedVersions, checkedRanges: newCheckedRanges });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chunkGroups]);

  // Notify parent of selection changes
  useEffect(() => {
    onSelectionChange?.(selection);
  }, [selection, onSelectionChange]);

  // Toggle a range's checked state
  const toggleRange = useCallback((rangeKey: string) => {
    setSelection(prev => {
      const newChecked = new Set(prev.checkedRanges);
      if (newChecked.has(rangeKey)) {
        newChecked.delete(rangeKey);
      } else {
        newChecked.add(rangeKey);
      }
      return { ...prev, checkedRanges: newChecked };
    });
  }, []);

  // Set selected version for a duplicate group
  const setSelectedVersion = useCallback((rangeKey: string, fileId: string) => {
    setSelection(prev => {
      const newVersions = new Map(prev.selectedVersions);
      newVersions.set(rangeKey, fileId);
      return { ...prev, selectedVersions: newVersions };
    });
  }, []);

  // Select all contiguous from start
  const selectContiguousFromStart = useCallback(() => {
    const newChecked = new Set<string>();
    let expectedStart = 1;

    for (const group of chunkGroups) {
      // Check if this group starts where we expect
      if (group.startNo <= expectedStart && group.endNo >= expectedStart) {
        newChecked.add(group.rangeKey);
        expectedStart = group.endNo + 1;
      } else if (group.startNo > expectedStart) {
        // Gap detected, stop here
        break;
      }
    }

    setSelection(prev => ({ ...prev, checkedRanges: newChecked }));
  }, [chunkGroups]);

  // Select all
  const selectAll = useCallback(() => {
    const newChecked = new Set<string>();
    for (const group of chunkGroups) {
      newChecked.add(group.rangeKey);
    }
    setSelection(prev => ({ ...prev, checkedRanges: newChecked }));
  }, [chunkGroups]);

  // Clear all
  const clearAll = useCallback(() => {
    setSelection(prev => ({ ...prev, checkedRanges: new Set() }));
  }, []);

  // Compute validation state
  const validation = useMemo(() => {
    const selectedGroups = chunkGroups.filter(g => selection.checkedRanges.has(g.rangeKey));
    const sortedSelected = [...selectedGroups].sort((a, b) => a.startNo - b.startNo);

    if (sortedSelected.length === 0) {
      return { state: 'empty' as const, message: 'No chunks selected' };
    }

    // Check for unresolved duplicates
    const unresolvedDuplicates = sortedSelected.filter(
      g => g.isDuplicate && !selection.selectedVersions.has(g.rangeKey)
    );
    if (unresolvedDuplicates.length > 0) {
      return {
        state: 'error' as const,
        message: `Select a version for: ${unresolvedDuplicates.map(g => g.rangeKey).join(', ')}`,
      };
    }

    // Check for gaps in selection
    const selectedGaps: SequenceGap[] = [];
    for (let i = 0; i < sortedSelected.length - 1; i++) {
      const current = sortedSelected[i];
      const next = sortedSelected[i + 1];
      const expectedStart = current.endNo + 1;

      if (next.startNo > expectedStart) {
        selectedGaps.push({ startNo: expectedStart, endNo: next.startNo - 1 });
      }
    }

    // Build sequence range string
    const firstChunk = sortedSelected[0];
    const lastChunk = sortedSelected[sortedSelected.length - 1];
    const rangeStr = `sequences ${firstChunk.startNo}–${lastChunk.endNo}`;

    // Check if selection starts from sequence 1
    const startsFromBeginning = firstChunk.startNo === 1;

    if (selectedGaps.length > 0) {
      return {
        state: 'warning' as const,
        message: `Selection has ${selectedGaps.length} gap(s) - ${rangeStr}`,
        range: rangeStr,
        gapCount: selectedGaps.length,
        startsFromBeginning,
        canFullyValidate: false,
      };
    }

    return {
      state: 'valid' as const,
      message: `Selection is contiguous - ${rangeStr}`,
      range: rangeStr,
      startsFromBeginning,
      canFullyValidate: startsFromBeginning,
    };
  }, [chunkGroups, selection]);

  // Get selected files for import
  const getSelectedFiles = useCallback((): ChunkFileInfo[] => {
    const result: ChunkFileInfo[] = [];

    for (const group of chunkGroups) {
      if (!selection.checkedRanges.has(group.rangeKey)) continue;

      const selectedId = selection.selectedVersions.get(group.rangeKey);
      const file = group.files.find(f => f.id === selectedId) || group.files[0];
      result.push(file);
    }

    return result.sort((a, b) => a.startNo - b.startNo);
  }, [chunkGroups, selection]);

  // Handle import click
  const handleImport = useCallback(() => {
    const selectedFiles = getSelectedFiles();
    // Only pass autoVerify=true if the selection can be fully verified
    const canVerify = validation.state === 'valid' && 
                      'startsFromBeginning' in validation && 
                      validation.startsFromBeginning;
    onImport(selectedFiles, overwriteExisting, autoVerify && canVerify);
  }, [getSelectedFiles, onImport, overwriteExisting, autoVerify, validation]);

  // Handle clear database
  const handleClearDatabase = useCallback(async () => {
    if (!onClearDatabase) return;
    setIsClearing(true);
    try {
      await onClearDatabase();
    } finally {
      setIsClearing(false);
    }
  }, [onClearDatabase]);

  // Format file size
  const formatSize = (bytes?: number): string => {
    if (bytes === undefined) return '';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Render a gap indicator
  const renderGap = (gap: SequenceGap) => (
    <div key={`gap-${gap.startNo}`} className={styles.gapRow}>
      <Warning16Regular />
      <Caption1>
        Gap: sequences {gap.startNo}–{gap.endNo} not available
      </Caption1>
    </div>
  );

  // Render a chunk group (possibly with duplicates)
  const renderChunkGroup = (group: ChunkGroup) => {
    const isChecked = selection.checkedRanges.has(group.rangeKey);
    const selectedId = selection.selectedVersions.get(group.rangeKey);
    const isAlreadyLoaded = existingRanges.has(group.rangeKey);

    return (
      <div key={group.rangeKey}>
        <div
          className={`${styles.chunkRow} ${isChecked ? styles.chunkRowSelected : ''} ${isAlreadyLoaded ? styles.chunkRowAlreadyLoaded : ''}`}
        >
          <Checkbox
            checked={isChecked}
            onChange={() => toggleRange(group.rangeKey)}
          />
          <div className={styles.chunkInfo}>
            <DocumentRegular />
            <Text className={styles.chunkName}>
              ledger_{group.rangeKey}.committed
            </Text>
            {group.isDuplicate && (
              <Badge appearance="tint" color="warning" size="small">
                {group.files.length} versions
              </Badge>
            )}
            {isAlreadyLoaded && (
              <Badge appearance="tint" color="success" size="small" className={styles.alreadyLoadedBadge}>
                Already loaded
              </Badge>
            )}
          </div>
          <div className={styles.chunkMeta}>
            {!group.isDuplicate && group.files[0].size !== undefined && (
              <Caption1>{formatSize(group.files[0].size)}</Caption1>
            )}
          </div>
        </div>

        {/* Duplicate version selector */}
        {group.isDuplicate && isChecked && (
          <div className={styles.duplicateSection}>
            <div className={styles.duplicateLabel}>
              <Warning16Regular />
              <Caption1>Multiple versions found – select one:</Caption1>
            </div>
            <RadioGroup
              value={selectedId}
              onChange={(_, data) => setSelectedVersion(group.rangeKey, data.value)}
            >
              {group.files.map((file, idx) => (
                <Radio
                  key={file.id}
                  value={file.id}
                  label={
                    <span>
                      Version {String.fromCharCode(65 + idx)}
                      {file.size !== undefined && ` (${formatSize(file.size)})`}
                      {file.lastModified && ` – ${file.lastModified.toLocaleDateString()}`}
                      <Caption1 style={{ marginLeft: 8, fontFamily: 'monospace' }}>
                        {file.id.substring(0, 8)}...
                      </Caption1>
                    </span>
                  }
                />
              ))}
            </RadioGroup>
          </div>
        )}
      </div>
    );
  };

  // Build the display list with gaps inserted
  const displayItems = useMemo(() => {
    const items: React.ReactNode[] = [];
    let gapIndex = 0;

    for (const group of chunkGroups) {
      // Insert any gaps before this group
      while (gapIndex < gaps.length && gaps[gapIndex].endNo < group.startNo) {
        items.push(renderGap(gaps[gapIndex]));
        gapIndex++;
      }

      items.push(renderChunkGroup(group));
    }

    return items;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chunkGroups, gaps, selection]);

  const selectedCount = selection.checkedRanges.size;
  const canImport = selectedCount > 0 && validation.state !== 'error';

  const existingCount = existingRanges.size;

  return (
    <div className={styles.container}>
      {/* Existing data info bar */}
      {existingCount > 0 && (
        <div className={styles.existingDataInfo}>
          <CheckmarkCircle16Regular primaryFill={tokens.colorPaletteGreenForeground1} />
          <Text size={200}>
            {existingCount} chunk(s) already loaded in database
          </Text>
          {onClearDatabase && (
            <Button
              size="small"
              appearance="subtle"
              onClick={handleClearDatabase}
              disabled={isClearing || isImporting}
              style={{ marginLeft: 'auto' }}
            >
              {isClearing ? 'Clearing...' : 'Clear Database'}
            </Button>
          )}
        </div>
      )}

      {/* Header with count */}
      <div className={styles.header}>
        <Text weight="semibold">Available Chunks ({chunkGroups.length})</Text>
        <div className={styles.quickActions}>
          <Button size="small" appearance="subtle" onClick={selectContiguousFromStart}>
            Select contiguous from start
          </Button>
          <Button size="small" appearance="subtle" onClick={selectAll}>
            Select all
          </Button>
          <Button size="small" appearance="subtle" onClick={clearAll}>
            Clear
          </Button>
        </div>
      </div>

      {/* Chunk list */}
      <div className={styles.chunkList}>
        {displayItems}
      </div>

      {/* Validation summary */}
      <div className={styles.summary}>
        <div className={styles.summaryRow}>
          {validation.state === 'valid' && (
            <>
              <CheckmarkCircle16Regular primaryFill={tokens.colorPaletteGreenForeground1} />
              <Text>{selectedCount} chunk(s) selected</Text>
            </>
          )}
          {validation.state === 'warning' && (
            <>
              <Warning16Regular primaryFill={tokens.colorPaletteYellowForeground1} />
              <Text>{selectedCount} chunk(s) selected</Text>
            </>
          )}
          {validation.state === 'error' && (
            <>
              <ErrorCircle16Regular primaryFill={tokens.colorPaletteRedForeground1} />
              <Text>{validation.message}</Text>
            </>
          )}
          {validation.state === 'empty' && (
            <>
              <Info16Regular />
              <Text>{validation.message}</Text>
            </>
          )}
        </div>
        {validation.state !== 'empty' && validation.state !== 'error' && (
          <Caption1 className={styles.sequenceRange}>
            {validation.message}
          </Caption1>
        )}
      </div>

      {/* Warning for gaps */}
      {validation.state === 'warning' && (
        <MessageBar intent="warning">
          <MessageBarBody>
            Your selection has gaps. The ledger may not be fully analyzable.
          </MessageBarBody>
        </MessageBar>
      )}

      {/* Warning for not starting from sequence 1 */}
      {validation.state !== 'empty' && validation.state !== 'error' && 
       'startsFromBeginning' in validation && !validation.startsFromBeginning && (
        <MessageBar intent="warning">
          <MessageBarBody>
            Selection doesn't start from sequence 1. Cryptographic verification of the ledger chain will not be possible without a complete sequence from the beginning.
          </MessageBarBody>
        </MessageBar>
      )}

      {/* Overwrite option */}
      {showOverwriteOption && (
        <Checkbox
          checked={overwriteExisting}
          onChange={(_, data) => setOverwriteExisting(data.checked === true)}
          label="Replace existing data (unchecked = append to existing)"
        />
      )}

      {/* Auto-verify option */}
      {showAutoVerifyOption && (() => {
        const canVerify = validation.state === 'valid' && 
                          'startsFromBeginning' in validation && 
                          validation.startsFromBeginning;
        return (
          <Checkbox
            checked={autoVerify && canVerify}
            onChange={(_, data) => handleAutoVerifyChange(data.checked === true)}
            disabled={!canVerify}
            label={
              canVerify 
                ? "Verify ledger integrity after import (runs in background)"
                : "Verify ledger integrity after import (requires contiguous ledger starting from sequence 1)"
            }
          />
        );
      })()}

      <Divider />

      {/* Actions */}
      <div className={styles.actions}>
        <div />
        <Button
          appearance="primary"
          className={styles.importButton}
          disabled={!canImport || isImporting}
          onClick={handleImport}
        >
          {isImporting ? 'Importing...' : `${importButtonLabel} (${selectedCount})`}
        </Button>
      </div>
    </div>
  );
};

export default ChunkSelector;
