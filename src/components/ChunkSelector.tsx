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
  tokens,
} from '@fluentui/react-components';
import {
  DocumentRegular,
  Warning16Regular,
  CheckmarkCircle16Regular,
  ErrorCircle16Regular,
  Info16Regular,
} from '@fluentui/react-icons';
import { analyzeLedgerSequence, type SequenceGap, type RangeGroup } from '@ccf/ledger-parser';
import type { ChunkFileInfo } from '../types/chunk-types';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100%',
    minHeight: 0,
    overflow: 'hidden',
    boxSizing: 'border-box',
  },
  scrollableContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    overflowX: 'hidden',
    paddingRight: '4px',
    boxSizing: 'border-box',
    '> *': {
      textOverflow: 'ellipsis',
    },
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0,
  },
  chunkList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flex: 1,
    minHeight: '120px',
    overflowY: 'auto',
    overflowX: 'hidden',
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
  overlapRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    backgroundColor: tokens.colorPaletteRedBackground1,
    borderRadius: '4px',
    color: tokens.colorPaletteRedForeground2,
  },
  summary: {
    padding: '12px',
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: '6px',
    boxSizing: 'border-box',
    width: '100%',
  },
  summaryRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '4px',
  },
  stickyFooter: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    flexShrink: 0,
    paddingTop: '12px',
    backgroundColor: tokens.colorNeutralBackground1,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    boxSizing: 'border-box',
    width: '100%',
    position: 'relative',
    zIndex: 10,
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: '12px',
    paddingTop: '8px',
  },
  quickActions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  importButton: {
    minWidth: '160px',
    fontWeight: 600,
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

// Use the shared RangeGroup type for chunk groups
type ChunkGroup = RangeGroup<ChunkFileInfo>;

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
  /** Default value for auto-verify option */
  defaultAutoVerify?: boolean;
}

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
  const [autoVerify, setAutoVerify] = useState(defaultAutoVerify);

  // Group files by sequence range and detect duplicates/gaps using shared validation logic
  const { chunkGroups, gaps } = useMemo(() => {
    const analysis = analyzeLedgerSequence(files);
    return {
      chunkGroups: analysis.groups,
      gaps: analysis.gaps,
    };
  }, [files]);

  // Initialize selection state
  const [selection, setSelection] = useState<ChunkSelection>(() => {
    const selectedVersions = new Map<string, string>();
    const checkedRanges = new Set<string>();

    // Default: select first version of each group, check only non-existing ranges
    for (const group of chunkGroups) {
      selectedVersions.set(group.rangeKey, group.files[0].id);
      // Don't pre-check ranges that are already loaded
      if (!existingRanges.has(group.rangeKey)) {
        checkedRanges.add(group.rangeKey);
      }
    }

    return { selectedVersions, checkedRanges };
  });

  // Compute validation state and selected overlaps together (single source of truth)
  const { validation, selectedOverlaps } = useMemo(() => {
    const selectedGroups = chunkGroups.filter(g => selection.checkedRanges.has(g.rangeKey));

    if (selectedGroups.length === 0) {
      return {
        validation: { state: 'empty' as const, message: 'No chunks selected' },
        selectedOverlaps: [] as Array<{ first: ChunkFileInfo; second: ChunkFileInfo }>,
      };
    }

    // Check for unresolved duplicates
    const unresolvedDuplicates = selectedGroups.filter(
      g => g.isDuplicate && !selection.selectedVersions.has(g.rangeKey)
    );
    if (unresolvedDuplicates.length > 0) {
      return {
        validation: {
          state: 'error' as const,
          message: `Select a version for: ${unresolvedDuplicates.map(g => g.rangeKey).join(', ')}`,
        },
        selectedOverlaps: [] as Array<{ first: ChunkFileInfo; second: ChunkFileInfo }>,
      };
    }

    // Get selected files (one per group, based on version selection)
    const selectedFiles = selectedGroups.map(g => {
      const selectedId = selection.selectedVersions.get(g.rangeKey);
      return g.files.find(f => f.id === selectedId) || g.files[0];
    });

    // Use shared validation logic to detect gaps, overlaps, etc.
    const analysis = analyzeLedgerSequence(selectedFiles);

    // If there are overlaps, return error immediately
    if (analysis.hasOverlaps) {
      return {
        validation: {
          state: 'error' as const,
          message: `Cannot import ${analysis.overlaps.length} overlapping chunk(s) - please deselect one file from each overlapping pair.`,
          overlapCount: analysis.overlaps.length,
        },
        selectedOverlaps: analysis.overlaps,
      };
    }

    // Build sequence range string
    const firstChunk = analysis.sortedRanges[0];
    const lastChunk = analysis.sortedRanges[analysis.sortedRanges.length - 1];
    const rangeStr = `sequences ${firstChunk.startNo}–${lastChunk.endNo}`;

    // Check for gaps
    if (!analysis.isContiguous) {
      return {
        validation: {
          state: 'warning' as const,
          message: `Selection has ${analysis.gaps.length} gap(s) - ${rangeStr}`,
          range: rangeStr,
          gapCount: analysis.gaps.length,
          startsFromBeginning: analysis.startsAtOne,
          canFullyValidate: false,
        },
        selectedOverlaps: [] as Array<{ first: ChunkFileInfo; second: ChunkFileInfo }>,
      };
    }

    return {
      validation: {
        state: 'valid' as const,
        message: `Selection is contiguous - ${rangeStr}`,
        range: rangeStr,
        startsFromBeginning: analysis.startsAtOne,
        canFullyValidate: analysis.startsAtOne,
      },
      selectedOverlaps: [] as Array<{ first: ChunkFileInfo; second: ChunkFileInfo }>,
    };
  }, [chunkGroups, selection]);

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

      // Keep existing checked state if still valid, but never check already-loaded ranges
      if (selection.checkedRanges.has(group.rangeKey) && !existingRanges.has(group.rangeKey)) {
        newCheckedRanges.add(group.rangeKey);
      }
    }

    // If this is initial load (nothing was checked), check all non-existing ranges
    if (selection.checkedRanges.size === 0) {
      for (const group of chunkGroups) {
        if (!existingRanges.has(group.rangeKey)) {
          newCheckedRanges.add(group.rangeKey);
        }
      }
    }

    setSelection({ selectedVersions: newSelectedVersions, checkedRanges: newCheckedRanges });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chunkGroups, existingRanges]);

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

  // Compute whether verification is possible considering existing data + new selection
  const canVerifyWithExisting = useMemo(() => {
    // Convert existing ranges to objects with filename format
    const existingAsFiles = Array.from(existingRanges).map(rangeKey => ({
      filename: `ledger_${rangeKey}.committed`,
    }));

    // Get selected new chunks
    const selectedGroups = chunkGroups.filter(g => selection.checkedRanges.has(g.rangeKey));
    const selectedAsFiles = selectedGroups.map(g => ({ filename: g.files[0].filename }));

    // Combine and analyze using shared validation logic
    const allFiles = [...existingAsFiles, ...selectedAsFiles];

    if (allFiles.length === 0) return false;

    const analysis = analyzeLedgerSequence(allFiles);

    // Can verify if: starts at 1, no gaps, no overlaps
    return analysis.startsAtOne && analysis.isContiguous && !analysis.hasOverlaps;
  }, [existingRanges, chunkGroups, selection]);

  // Get selected files for import (excludes already-loaded files)
  const getSelectedFiles = useCallback((): ChunkFileInfo[] => {
    const result: ChunkFileInfo[] = [];

    for (const group of chunkGroups) {
      if (!selection.checkedRanges.has(group.rangeKey)) continue;
      // Skip already-loaded ranges
      if (existingRanges.has(group.rangeKey)) continue;

      const selectedId = selection.selectedVersions.get(group.rangeKey);
      const file = group.files.find(f => f.id === selectedId) || group.files[0];
      // Also skip if the file itself is marked as existing
      if (file.isExisting) continue;
      result.push(file);
    }

    return result.sort((a, b) => a.startNo - b.startNo);
  }, [chunkGroups, selection, existingRanges]);

  // Handle import click
  const handleImport = useCallback(() => {
    const selectedFiles = getSelectedFiles();
    // Only pass autoVerify=true if combined existing + new data can be verified
    onImport(selectedFiles, overwriteExisting, autoVerify && canVerifyWithExisting);
  }, [getSelectedFiles, onImport, overwriteExisting, autoVerify, canVerifyWithExisting]);

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

  // Render an overlap indicator between two chunks
  const renderOverlap = (first: ChunkFileInfo, second: ChunkFileInfo) => (
    <div key={`overlap-${first.startNo}-${first.endNo}-${second.startNo}-${second.endNo}`} className={styles.overlapRow}>
      <ErrorCircle16Regular />
      <Caption1>
        Overlap: sequences {second.startNo}–{first.endNo} covered by both files above and below
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
            checked={isChecked || isAlreadyLoaded}
            disabled={isAlreadyLoaded}
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

  // Build the display list with gaps and overlaps inserted
  const displayItems = useMemo(() => {
    const items: React.ReactNode[] = [];
    let gapIndex = 0;

    // Build a map of overlaps keyed by the "second" chunk's range for quick lookup
    const overlapsBySecond = new Map<string, typeof selectedOverlaps[0]>();
    for (const overlap of selectedOverlaps) {
      const secondKey = `${overlap.second.startNo}-${overlap.second.endNo}`;
      overlapsBySecond.set(secondKey, overlap);
    }

    for (const group of chunkGroups) {
      // Insert any gaps before this group
      while (gapIndex < gaps.length && gaps[gapIndex].endNo < group.startNo) {
        items.push(renderGap(gaps[gapIndex]));
        gapIndex++;
      }

      // Insert overlap indicator if this group is the "second" in an overlap pair
      const overlap = overlapsBySecond.get(group.rangeKey);
      if (overlap) {
        items.push(renderOverlap(overlap.first, overlap.second));
      }

      items.push(renderChunkGroup(group));
    }

    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chunkGroups, gaps, selectedOverlaps]);

  const selectedCount = selection.checkedRanges.size;
  const canImport = selectedCount > 0 && validation.state !== 'error';

  const existingCount = existingRanges.size;

  return (
    <div className={styles.container}>
      {/* Scrollable content area */}
      <div className={styles.scrollableContent}>
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
              Select contiguous
            </Button>
            <Button size="small" appearance="subtle" onClick={selectAll}>
              Select all
            </Button>
            <Button size="small" appearance="subtle" onClick={clearAll}>
              Clear
            </Button>
          </div>
        </div>

        {/* Chunk list - this is the only vertically scrollable area */}
        <div className={styles.chunkList}>
          {displayItems}
        </div>

        {/* Validation summary - consolidated messages */}
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
                <Text>{selectedCount} chunk(s) selected — {validation.message}</Text>
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
          {/* Warning when verification isn't possible */}
          {validation.state !== 'empty' && validation.state !== 'error' && !canVerifyWithExisting && (
            <Caption1 style={{ marginTop: '4px', color: tokens.colorPaletteYellowForeground2 }}>
              Combined data doesn't start from sequence 1 or has gaps. The ledger may not be fully analyzable.
            </Caption1>
          )}
          {selectedOverlaps.length > 0 && (
            <Caption1 style={{ marginTop: '4px', color: tokens.colorPaletteRedForeground2 }}>
              <strong>Overlapping files:</strong> {selectedOverlaps.map(o =>
                `${o.first.filename} ↔ ${o.second.filename}`
              ).join('; ')}.
            </Caption1>
          )}
        </div>

        {/* Overwrite option */}
        {showOverwriteOption && (
          <Checkbox
            checked={overwriteExisting}
            onChange={(_, data) => setOverwriteExisting(data.checked === true)}
            label="Replace existing data (unchecked = append to existing)"
          />
        )}

        {/* Auto-verify option */}
        {showAutoVerifyOption && (
          <Checkbox
            checked={autoVerify && canVerifyWithExisting}
            onChange={(_, data) => setAutoVerify(data.checked === true)}
            disabled={!canVerifyWithExisting}
            label={
              canVerifyWithExisting
                ? "Verify ledger integrity after import (runs in background)"
                : "Verify ledger integrity after import (requires contiguous ledger starting from sequence 1)"
            }
          />
        )}

        {/* Actions */}
        {/* Sticky footer - always visible */}
        <div className={styles.stickyFooter}>
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
      </div>
    </div>

  );
};

export default ChunkSelector;
