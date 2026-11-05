/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Body1,
  Button,
  Card,
  Caption1,
  Checkbox,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Spinner,
  Switch,
  Text,
  tokens,
} from '@fluentui/react-components';
import {
  buildDensityBuckets as buildDensityBucketsImpl,
  CATEGORY_ORDER,
  categoryDisplayName,
  type GovernanceCategory,
  type GovernanceEventDetail,
  type GovernanceEventMeta,
} from '../../utils/governance-events';
import { useGovernanceEventDetail } from '../../hooks/use-ccf-data';
import {
  trackEvent,
  TelemetryEvents,
} from '../../services/telemetry/telemetry-service';

export interface GovernanceTimelineProps {
  events: readonly GovernanceEventMeta[];
  isLoading: boolean;
  error: Error | null;
}

const TIMELINE_HEIGHT = 120;
const TIMELINE_PAD_X = 24;
const TIMELINE_PAD_Y = 16;
const DENSITY_HEIGHT = 36;
const MAX_RENDERED_EVENTS = 5000;
const DENSITY_BUCKET_COUNT = 50;

const CATEGORY_COLORS: Record<GovernanceCategory, string> = {
  service: '#0078d4',
  constitution: '#5c2e91',
  proposals: '#107c10',
  members: '#d83b01',
  users: '#bf6b00',
  nodes: '#038387',
  jwt: '#8e562e',
  tls: '#5c2d2d',
  recovery: '#a4262c',
  scitt: '#525e54',
  modules: '#8a8886',
  history: '#605e5c',
  other: '#3b3a39',
};

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
  },
  controls: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground2,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
  },
  controlsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
  },
  chips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalXS,
  },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    paddingLeft: tokens.spacingHorizontalS,
    paddingRight: tokens.spacingHorizontalS,
    paddingTop: '2px',
    paddingBottom: '2px',
    borderRadius: tokens.borderRadiusCircular,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    backgroundColor: tokens.colorNeutralBackground1,
    cursor: 'pointer',
    fontSize: tokens.fontSizeBase200,
    userSelect: 'none',
  },
  chipActive: {
    backgroundColor: tokens.colorBrandBackground2,
    border: `1px solid ${tokens.colorBrandStroke1}`,
  },
  chipSwatch: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    display: 'inline-block',
  },
  timelineCard: {
    padding: tokens.spacingVerticalL,
  },
  timelineSvg: {
    width: '100%',
    height: `${TIMELINE_HEIGHT + DENSITY_HEIGHT + 32}px`,
    display: 'block',
  },
  timelineDot: {
    cursor: 'pointer',
    transition: 'r 80ms linear',
  },
  detailCard: {
    padding: tokens.spacingVerticalL,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  detailHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    flexWrap: 'wrap',
  },
  payloadBlock: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    backgroundColor: tokens.colorNeutralBackground3,
    padding: tokens.spacingVerticalM,
    borderRadius: tokens.borderRadiusMedium,
    overflow: 'auto',
    maxHeight: '320px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  metaRow: {
    display: 'flex',
    flexWrap: 'wrap',
    columnGap: tokens.spacingHorizontalXL,
    rowGap: tokens.spacingVerticalXS,
  },
  emptyState: {
    padding: tokens.spacingVerticalXXL,
    textAlign: 'center',
  },
});

/**
 * Build seqno-bucketed counts for the density strip above the timeline.
 * Local helper (not exported because react-refresh only allows component exports).
 */
function buildDensityBuckets(
  events: readonly GovernanceEventMeta[],
  bucketCount = DENSITY_BUCKET_COUNT
): { counts: number[]; min: number; max: number } {
  return buildDensityBucketsImpl(events, bucketCount);
}

export const GovernanceTimeline: React.FC<GovernanceTimelineProps> = ({
  events,
  isLoading,
  error,
}) => {
  const styles = useStyles();
  const navigate = useNavigate();
  const [activeCategories, setActiveCategories] = useState<
    Set<GovernanceCategory>
  >(() => new Set(CATEGORY_ORDER));
  const [showDeletes, setShowDeletes] = useState(true);
  const [showNoisy, setShowNoisy] = useState(false);
  const [selected, setSelected] = useState<GovernanceEventMeta | null>(null);

  const categoriesPresent = useMemo(() => {
    const present = new Set<GovernanceCategory>();
    for (const ev of events) present.add(ev.category);
    return present;
  }, [events]);

  const filteredAll = useMemo(() => {
    return events.filter((ev) => {
      if (!activeCategories.has(ev.category)) return false;
      if (!showDeletes && ev.op === 'delete') return false;
      if (!showNoisy && ev.noisy) return false;
      return true;
    });
  }, [events, activeCategories, showDeletes, showNoisy]);

  const filtered = useMemo(() => {
    if (filteredAll.length <= MAX_RENDERED_EVENTS) return filteredAll;
    return filteredAll.slice(0, MAX_RENDERED_EVENTS);
  }, [filteredAll]);

  const truncated = filteredAll.length > filtered.length;

  const handleToggleCategory = useCallback(
    (cat: GovernanceCategory) => {
      const next = new Set(activeCategories);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      setActiveCategories(next);
      trackEvent(TelemetryEvents.GOVERNANCE_FILTER_APPLIED, {
        categories: Array.from(next).join(','),
        eventCount: events.length,
        includeDeletes: showDeletes,
        includeNoisy: showNoisy,
      });
    },
    [activeCategories, events.length, showDeletes, showNoisy]
  );

  const handleSelect = useCallback((ev: GovernanceEventMeta) => {
    setSelected(ev);
    trackEvent(TelemetryEvents.GOVERNANCE_EVENT_CLICKED, {
      kind: ev.kind,
      category: ev.category,
      seqno: ev.seqno,
    });
  }, []);

  if (isLoading) {
    return (
      <div className={styles.container}>
        <Spinner label="Loading governance events…" />
      </div>
    );
  }

  if (error) {
    return (
      <MessageBar intent="error">
        <MessageBarBody>
          Failed to load governance events: {error.message}
        </MessageBarBody>
      </MessageBar>
    );
  }

  if (events.length === 0) {
    return (
      <Card className={styles.emptyState}>
        <Text size={500} weight="semibold">
          No governance events
        </Text>
        <Body1>
          The currently imported ledgers contain no governance writes or
          deletes. Import a ledger that covers governance proposals, member
          changes, or service config updates to see them here.
        </Body1>
        <div>
          <Button
            appearance="primary"
            onClick={() => navigate('/files')}
            data-testid="governance-empty-go-to-files"
          >
            Go to Files
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.controls}>
        <div className={styles.controlsRow}>
          <Caption1>
            <strong>Categories:</strong>
          </Caption1>
          <div className={styles.chips}>
            {CATEGORY_ORDER.map((cat) => {
              const present = categoriesPresent.has(cat);
              const active = activeCategories.has(cat);
              if (!present) return null;
              return (
                <span
                  key={cat}
                  className={
                    active ? `${styles.chip} ${styles.chipActive}` : styles.chip
                  }
                  onClick={() => handleToggleCategory(cat)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleToggleCategory(cat);
                    }
                  }}
                  aria-pressed={active}
                  data-testid={`governance-chip-${cat}`}
                >
                  <span
                    className={styles.chipSwatch}
                    style={{ backgroundColor: CATEGORY_COLORS[cat] }}
                  />
                  {categoryDisplayName(cat)}
                </span>
              );
            })}
          </div>
        </div>
        <div className={styles.controlsRow}>
          <Switch
            checked={showDeletes}
            onChange={(_, d) => setShowDeletes(!!d.checked)}
            label="Show deletes"
            data-testid="governance-show-deletes"
          />
          <Checkbox
            checked={showNoisy}
            onChange={(_, d) => setShowNoisy(!!d.checked)}
            label="Show noisy tables (history, bytecode, …)"
            data-testid="governance-show-noisy"
          />
          <Caption1>
            Showing {filtered.length} of {events.length} events
            {truncated && ` (capped at ${MAX_RENDERED_EVENTS})`}
          </Caption1>
        </div>
      </div>

      <Card className={styles.timelineCard}>
        <Text size={400} weight="semibold">
          Timeline by sequence number
        </Text>
        <Caption1>
          Wall-clock time is unavailable (the imported timestamp is the row's
          insertion time, not the ledger time). Hover or click a marker for
          details.
        </Caption1>
        <TimelineSvg
          events={filtered}
          onSelect={handleSelect}
          selectedSeqno={selected?.seqno ?? null}
        />
      </Card>

      {selected && <DetailPanel meta={selected} onClose={() => setSelected(null)} />}
    </div>
  );
};

interface TimelineSvgProps {
  events: readonly GovernanceEventMeta[];
  onSelect: (ev: GovernanceEventMeta) => void;
  selectedSeqno: number | null;
}

const TimelineSvg: React.FC<TimelineSvgProps> = ({ events, onSelect, selectedSeqno }) => {
  const styles = useStyles();
  const [width, setWidth] = useState<number>(800);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 800;
      setWidth(Math.max(320, Math.floor(w)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { counts, min, max } = useMemo(() => buildDensityBuckets(events), [events]);
  const span = Math.max(1, max - min);
  const innerWidth = width - TIMELINE_PAD_X * 2;

  const seqToX = useCallback(
    (seq: number) => TIMELINE_PAD_X + ((seq - min) / span) * innerWidth,
    [min, span, innerWidth]
  );

  const densityMax = counts.reduce((a, b) => (b > a ? b : a), 0);

  const dotsByCategory = useMemo(() => {
    const out = new Map<GovernanceCategory, GovernanceEventMeta[]>();
    for (const ev of events) {
      const arr = out.get(ev.category);
      if (arr) arr.push(ev);
      else out.set(ev.category, [ev]);
    }
    return out;
  }, [events]);

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      <svg
        className={styles.timelineSvg}
        viewBox={`0 0 ${width} ${TIMELINE_HEIGHT + DENSITY_HEIGHT + 32}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Governance event timeline"
        data-testid="governance-timeline-svg"
      >
        {counts.length > 0 && (
          <g transform={`translate(${TIMELINE_PAD_X}, 0)`}>
            {counts.map((c, i) => {
              const bw = innerWidth / counts.length;
              const h = densityMax > 0 ? (c / densityMax) * (DENSITY_HEIGHT - 4) : 0;
              return (
                <rect
                  key={i}
                  x={i * bw}
                  y={DENSITY_HEIGHT - h}
                  width={Math.max(1, bw - 1)}
                  height={h}
                  fill={tokens.colorBrandBackground2Hover}
                  opacity={0.85}
                />
              );
            })}
          </g>
        )}
        <line
          x1={TIMELINE_PAD_X}
          x2={width - TIMELINE_PAD_X}
          y1={DENSITY_HEIGHT + TIMELINE_PAD_Y + TIMELINE_HEIGHT / 2}
          y2={DENSITY_HEIGHT + TIMELINE_PAD_Y + TIMELINE_HEIGHT / 2}
          stroke={tokens.colorNeutralStroke2}
          strokeWidth={1}
        />
        {Array.from(dotsByCategory.entries()).map(([cat, arr]) => (
          <g key={cat} fill={CATEGORY_COLORS[cat]}>
            {arr.map((ev) => {
              const cx = seqToX(ev.seqno);
              const cy = DENSITY_HEIGHT + TIMELINE_PAD_Y + TIMELINE_HEIGHT / 2;
              const isSelected = ev.seqno === selectedSeqno;
              const r = isSelected ? 7 : 4;
              const isDelete = ev.op === 'delete';
              return (
                <circle
                  key={`${ev.seqno}-${ev.mapName}-${ev.keyName}-${ev.op}`}
                  cx={cx}
                  cy={cy}
                  r={r}
                  className={styles.timelineDot}
                  fillOpacity={isDelete ? 0.35 : 1}
                  stroke={isSelected ? tokens.colorBrandStroke1 : 'none'}
                  strokeWidth={2}
                  onClick={() => onSelect(ev)}
                  data-testid={`governance-dot-${ev.seqno}`}
                >
                  <title>
                    {`#${ev.seqno} ${ev.label}${isDelete ? ' (delete)' : ''}`}
                  </title>
                </circle>
              );
            })}
          </g>
        ))}
        <text
          x={TIMELINE_PAD_X}
          y={DENSITY_HEIGHT + TIMELINE_PAD_Y + TIMELINE_HEIGHT - 4}
          fontSize="11"
          fill={tokens.colorNeutralForeground2}
        >
          seqno {min}
        </text>
        <text
          x={width - TIMELINE_PAD_X}
          y={DENSITY_HEIGHT + TIMELINE_PAD_Y + TIMELINE_HEIGHT - 4}
          fontSize="11"
          textAnchor="end"
          fill={tokens.colorNeutralForeground2}
        >
          seqno {max}
        </text>
      </svg>
    </div>
  );
};

interface DetailPanelProps {
  meta: GovernanceEventMeta;
  onClose: () => void;
}

const DetailPanel: React.FC<DetailPanelProps> = ({ meta, onClose }) => {
  const styles = useStyles();
  const navigate = useNavigate();
  const { data, isLoading, error } = useGovernanceEventDetail(meta, true);

  return (
    <Card className={styles.detailCard}>
      <div className={styles.detailHeaderRow}>
        <Text size={400} weight="semibold">
          {meta.label}
        </Text>
        <Caption1>
          seqno #{meta.seqno} · {meta.mapName} · {meta.op}
        </Caption1>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          <Button
            size="small"
            appearance="secondary"
            onClick={() => navigate(`/transaction/${meta.transactionId}`)}
          >
            View transaction
          </Button>
          <Button size="small" appearance="subtle" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
      <div className={styles.metaRow}>
        <Caption1>
          <strong>Category:</strong> {categoryDisplayName(meta.category)}
        </Caption1>
        <Caption1>
          <strong>Key:</strong> <code>{meta.keyName}</code>
        </Caption1>
        <Caption1>
          <strong>Transaction:</strong> <code>{meta.transactionId}</code>
        </Caption1>
      </div>
      {isLoading && <Spinner size="extra-small" label="Loading payload…" />}
      {error && (
        <MessageBar intent="error">
          <MessageBarBody>Failed to load value: {error.message}</MessageBarBody>
        </MessageBar>
      )}
      {data && <DetailPayload detail={data} />}
    </Card>
  );
};

const DetailPayload: React.FC<{ detail: GovernanceEventDetail }> = ({ detail }) => {
  const styles = useStyles();
  const body = useMemo(() => {
    if (detail.rawKind === 'json' && detail.parsed !== undefined) {
      return JSON.stringify(detail.parsed, null, 2);
    }
    if (detail.text) return detail.text;
    if (detail.hexPreview) return `(hex preview)\n${detail.hexPreview}`;
    return '(empty)';
  }, [detail]);

  return (
    <>
      <Body1>{detail.summary}</Body1>
      <pre className={styles.payloadBlock}>{body}</pre>
    </>
  );
};

export default GovernanceTimeline;
