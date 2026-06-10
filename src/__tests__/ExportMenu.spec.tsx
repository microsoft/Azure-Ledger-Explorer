/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { ExportMenu } from '../components/export/ExportMenu';

// Mock the telemetry surface so we can assert event payloads.
vi.mock('../services/telemetry/telemetry-service', () => ({
  trackEvent: vi.fn(),
  trackException: vi.fn(),
  TelemetryEvents: {
    EXPORT_PERFORMED: 'ExportPerformed',
    EXPORT_REPORT_GENERATED: 'ExportReportGenerated',
  },
}));

// Mock the download helper to capture invocations.
vi.mock('../utils/download', () => ({
  download: vi.fn().mockReturnValue(42),
}));

import { trackEvent } from '../services/telemetry/telemetry-service';
import { download } from '../utils/download';

const renderWithProvider = (ui: React.ReactElement) =>
  render(<FluentProvider theme={webLightTheme}>{ui}</FluentProvider>);

const openMenu = async (surface: string) => {
  await act(async () => {
    fireEvent.click(screen.getByTestId(`export-menu-${surface}`));
  });
};

const clickFormat = async (surface: string, format: 'csv' | 'json' | 'ndjson') => {
  const item = await screen.findByTestId(`export-menu-${surface}-${format}`);
  await act(async () => {
    fireEvent.click(item);
  });
};

describe('ExportMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders an Export trigger', () => {
    renderWithProvider(
      <ExportMenu
        surface="test-surface"
        slug="my-slug"
        fetchRows={async () => ({ rows: [] })}
      />
    );
    expect(screen.getByTestId('export-menu-test-surface')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
  });

  it('exports CSV and tracks telemetry on success', async () => {
    const fetchRows = vi.fn().mockResolvedValue({
      rows: [{ a: 1, b: 'two' }, { a: 3, b: 'four' }],
    });
    const onComplete = vi.fn();
    renderWithProvider(
      <ExportMenu
        surface="test-surface"
        slug="my-slug"
        fetchRows={fetchRows}
        onComplete={onComplete}
      />
    );
    await openMenu('test-surface');
    await clickFormat('test-surface', 'csv');

    await waitFor(() => expect(fetchRows).toHaveBeenCalled());
    await waitFor(() => expect(download).toHaveBeenCalled());
    const [filename, content, mime] = (download as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(filename).toMatch(/^test-surface-my-slug-\d{8}-\d{4}\.csv$/);
    expect(typeof content).toBe('string');
    expect(content).toContain('a,b');
    expect(mime).toMatch(/^text\/csv/);
    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({ format: 'csv', rowCount: 2 })
    );
    const eventCalls = (trackEvent as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(eventCalls.length).toBeGreaterThan(0);
    const [eventName, props] = eventCalls[0];
    expect(eventName).toBe('ExportPerformed');
    expect(props).toEqual(
      expect.objectContaining({ format: 'csv', surface: 'test-surface', success: true })
    );
  });

  it('shows the soft-cap dialog when rowCountHint exceeds the threshold', async () => {
    const fetchRows = vi.fn().mockResolvedValue({ rows: [] });
    renderWithProvider(
      <ExportMenu
        surface="big-surface"
        fetchRows={fetchRows}
        rowCountHint={500_000}
      />
    );
    await openMenu('big-surface');
    await clickFormat('big-surface', 'csv');

    expect(await screen.findByText(/Export a large result set/)).toBeInTheDocument();
    expect(fetchRows).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    });
    expect(fetchRows).not.toHaveBeenCalled();
  });

  it('proceeds with the export after user confirms the soft-cap dialog', async () => {
    const fetchRows = vi.fn().mockResolvedValue({ rows: [{ a: 1 }] });
    renderWithProvider(
      <ExportMenu
        surface="big-surface"
        fetchRows={fetchRows}
        rowCountHint={500_000}
      />
    );
    await openMenu('big-surface');
    await clickFormat('big-surface', 'json');
    const confirmBtn = await screen.findByRole('button', { name: 'Export anyway' });
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    await waitFor(() => expect(fetchRows).toHaveBeenCalled());
    await waitFor(() => expect(download).toHaveBeenCalled());
  });

  it('records an unsuccessful telemetry event when fetchRows throws', async () => {
    const onError = vi.fn();
    const fetchRows = vi.fn().mockRejectedValue(new Error('boom'));
    renderWithProvider(
      <ExportMenu
        surface="failing"
        fetchRows={fetchRows}
        onError={onError}
      />
    );
    await openMenu('failing');
    await clickFormat('failing', 'csv');

    await waitFor(() => expect(onError).toHaveBeenCalled());
    expect(download).not.toHaveBeenCalled();
    const eventCalls = (trackEvent as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(eventCalls[0][1]).toEqual(
      expect.objectContaining({ surface: 'failing', success: false })
    );
  });
});
