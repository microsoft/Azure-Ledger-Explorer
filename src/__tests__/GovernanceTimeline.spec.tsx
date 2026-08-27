/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { GovernanceTimeline } from '../components/governance/GovernanceTimeline';
import {
  buildDensityBuckets,
  type GovernanceEventMeta,
} from '../utils/governance-events';

// Stub the detail hook so DetailPanel doesn't try to hit a real DB.
vi.mock('../hooks/use-ccf-data', async () => {
  return {
    useGovernanceEventDetail: () => ({
      data: {
        rawKind: 'json' as const,
        text: '{"status":"ACTIVE"}',
        hexPreview: null,
        parsed: { status: 'ACTIVE' },
        summary: 'public:ccf.gov.members.info ▸ mem1: status=ACTIVE',
      },
      isLoading: false,
      error: null,
    }),
  };
});

import type * as TelemetryServiceModule from '../services/telemetry/telemetry-service';

vi.mock('../services/telemetry/telemetry-service', async (importOriginal) => {
  const actual = await importOriginal<typeof TelemetryServiceModule>();
  return {
    ...actual,
    trackEvent: vi.fn(),
    trackException: vi.fn(),
  };
});

function renderTimeline(events: GovernanceEventMeta[]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <FluentProvider theme={webLightTheme}>
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <GovernanceTimeline events={events} isLoading={false} error={null} />
        </MemoryRouter>
      </QueryClientProvider>
    </FluentProvider>
  );
}

const sampleEvents: GovernanceEventMeta[] = [
  {
    seqno: 5,
    transactionId: '2.5',
    mapName: 'public:ccf.gov.members.certs',
    keyName: 'mem1',
    op: 'write',
    category: 'members',
    kind: 'members:write',
    label: 'Member added or updated (mem1)',
    noisy: false,
  },
  {
    seqno: 12,
    transactionId: '2.12',
    mapName: 'public:ccf.gov.proposals',
    keyName: 'p1',
    op: 'delete',
    category: 'proposals',
    kind: 'proposals:delete',
    label: 'Proposal body removed (p1)',
    noisy: false,
  },
  {
    seqno: 20,
    transactionId: '2.20',
    mapName: 'public:ccf.gov.cose_history',
    keyName: 'h1',
    op: 'write',
    category: 'history',
    kind: 'history:write',
    label: 'Cose history appended',
    noisy: true,
  },
];

describe('GovernanceTimeline', () => {
  it('shows the empty state with a Go to Files CTA when no events', () => {
    renderTimeline([]);
    expect(screen.getByText(/No governance events/i)).toBeTruthy();
    expect(screen.getByTestId('governance-empty-go-to-files')).toBeTruthy();
  });

  it('renders one dot per visible event (noisy hidden by default)', () => {
    renderTimeline(sampleEvents);
    // Default filters: noisy off → cose_history hidden. Two visible.
    expect(screen.queryAllByTestId(/^governance-dot-/)).toHaveLength(2);
  });

  it('reveals noisy events when "Show noisy tables" is enabled', () => {
    renderTimeline(sampleEvents);
    const noisyToggle = screen.getByTestId('governance-show-noisy');
    act(() => {
      fireEvent.click(noisyToggle);
    });
    expect(screen.queryAllByTestId(/^governance-dot-/)).toHaveLength(3);
  });

  it('hides delete events when "Show deletes" is turned off', () => {
    renderTimeline(sampleEvents);
    const deletesToggle = screen.getByTestId('governance-show-deletes');
    act(() => {
      fireEvent.click(deletesToggle);
    });
    expect(screen.queryAllByTestId(/^governance-dot-/)).toHaveLength(1);
  });

  it('opens the detail panel when a dot is clicked', () => {
    renderTimeline(sampleEvents);
    const dot = screen.getByTestId('governance-dot-5');
    act(() => {
      fireEvent.click(dot);
    });
    expect(screen.getByRole('button', { name: /View transaction/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Close/i })).toBeTruthy();
  });

  it('toggles a category off via filter chip', () => {
    renderTimeline(sampleEvents);
    const chip = screen.getByTestId('governance-chip-members');
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    act(() => {
      fireEvent.click(chip);
    });
    expect(chip.getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryAllByTestId(/^governance-dot-/)).toHaveLength(1);
  });
});

describe('buildDensityBuckets', () => {
  it('returns empty for empty input', () => {
    expect(buildDensityBuckets([])).toEqual({ counts: [], min: 0, max: 0 });
  });

  it('puts all events into a single bucket when min === max', () => {
    const ev: GovernanceEventMeta = {
      seqno: 7,
      transactionId: '2.7',
      mapName: 'public:ccf.gov.members.certs',
      keyName: 'k',
      op: 'write',
      category: 'members',
      kind: 'members:write',
      label: 'l',
      noisy: false,
    };
    const r = buildDensityBuckets([ev, ev, ev]);
    expect(r.counts).toEqual([3]);
    expect(r.min).toBe(7);
    expect(r.max).toBe(7);
  });

  it('distributes events across buckets', () => {
    const evs: GovernanceEventMeta[] = [];
    for (let s = 0; s < 100; s += 10) {
      evs.push({
        seqno: s,
        transactionId: String(s),
        mapName: 'public:ccf.gov.members.certs',
        keyName: 'k',
        op: 'write',
        category: 'members',
        kind: 'members:write',
        label: 'l',
        noisy: false,
      });
    }
    const r = buildDensityBuckets(evs, 10);
    expect(r.min).toBe(0);
    expect(r.max).toBe(90);
    expect(r.counts.length).toBe(10);
    expect(r.counts.reduce((a, b) => a + b, 0)).toBe(10);
  });
});
