/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoadSampleButton } from '../../components/onboarding/LoadSampleButton';

// Capture handleFiles so we can assert on it without re-mocking per-test.
const handleFilesMock = vi.fn().mockResolvedValue(undefined);

vi.mock('../../hooks/use-ccf-data', () => ({
  useFileDrop: () => ({
    handleFiles: handleFilesMock,
    isUploading: false,
    uploadProgress: null,
  }),
}));

const trackEventMock = vi.fn();
vi.mock('../../services/telemetry', () => ({
  trackEvent: (...args: unknown[]) => trackEventMock(...args),
  TelemetryEvents: {
    ONBOARDING_SAMPLE_LOADED: 'OnboardingSampleLoaded',
  },
}));

function renderButton(props: Partial<React.ComponentProps<typeof LoadSampleButton>> = {}) {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <LoadSampleButton {...props} />
    </QueryClientProvider>
  );
}

describe('LoadSampleButton', () => {
  beforeEach(() => {
    handleFilesMock.mockClear();
    trackEventMock.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the CTA in idle state', () => {
    renderButton();
    expect(screen.getByRole('button', { name: /load sample ledger/i })).toBeEnabled();
  });

  it('fetches the bundled sample, hands it to handleFiles, and emits success telemetry', async () => {
    const fakeBlob = new Blob([new Uint8Array([1, 2, 3])], { type: 'application/octet-stream' });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      blob: () => Promise.resolve(fakeBlob),
    });
    vi.stubGlobal('fetch', fetchMock);

    const onLoaded = vi.fn();
    renderButton({ onLoaded });

    fireEvent.click(screen.getByRole('button', { name: /load sample ledger/i }));

    await waitFor(() => expect(handleFilesMock).toHaveBeenCalledTimes(1));
    const passed = handleFilesMock.mock.calls[0][0] as File[];
    expect(passed).toHaveLength(1);
    expect(passed[0].name).toBe('ledger_1-14.committed');

    expect(onLoaded).toHaveBeenCalled();
    expect(trackEventMock).toHaveBeenCalledWith('OnboardingSampleLoaded', { success: true });
  });

  it('reports error and emits failure telemetry when the fetch fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      blob: () => Promise.reject(new Error('should not be called')),
    });
    vi.stubGlobal('fetch', fetchMock);

    const onError = vi.fn();
    renderButton({ onError });

    fireEvent.click(screen.getByRole('button', { name: /load sample ledger/i }));

    await waitFor(() => expect(onError).toHaveBeenCalled());
    const message = onError.mock.calls[0][0] as string;
    expect(message).toMatch(/404/);
    expect(handleFilesMock).not.toHaveBeenCalled();
    expect(trackEventMock).toHaveBeenCalledWith(
      'OnboardingSampleLoaded',
      expect.objectContaining({ success: false })
    );
  });

  it('reports error when fetch throws (offline / network error)', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);

    const onError = vi.fn();
    renderButton({ onError });

    fireEvent.click(screen.getByRole('button', { name: /load sample ledger/i }));

    await waitFor(() => expect(onError).toHaveBeenCalled());
    expect(onError).toHaveBeenCalledWith('network down');
    expect(handleFilesMock).not.toHaveBeenCalled();
    expect(trackEventMock).toHaveBeenCalledWith(
      'OnboardingSampleLoaded',
      expect.objectContaining({ success: false, error: 'network down' })
    );
  });
});
