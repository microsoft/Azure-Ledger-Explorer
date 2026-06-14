/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchBlobWithRetry, MstFilesService } from '../../services/MstFilesService';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Build a mocked `Response`-shaped object that streams `chunks` via
 * `body.getReader()`. Each chunk is delivered on its own microtask tick so
 * tests can interleave fake-timer advances between them.
 */
function streamedResponse(
  chunks: Uint8Array[],
  { status = 200, statusText = 'OK', contentType = 'application/octet-stream', delayMs = 0 }:
    { status?: number; statusText?: string; contentType?: string; delayMs?: number } = {},
): Response {
  let i = 0;
  const reader = {
    async read() {
      if (delayMs > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
      }
      if (i >= chunks.length) return { done: true, value: undefined };
      const value = chunks[i++];
      return { done: false, value };
    },
    releaseLock() { /* noop */ },
  };
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers: new Headers({ 'content-type': contentType }),
    body: { getReader: () => reader },
    blob: async () => new Blob(chunks as BlobPart[]),
  } as unknown as Response;
}

function errorResponse(status: number, statusText: string): Response {
  return {
    ok: false,
    status,
    statusText,
    headers: new Headers(),
    body: null,
    blob: async () => new Blob([]),
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// fetchBlobWithRetry
// ---------------------------------------------------------------------------

describe('fetchBlobWithRetry', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns a Blob containing the streamed bytes on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      streamedResponse([new Uint8Array([1, 2, 3]), new Uint8Array([4, 5])]),
    );
    vi.stubGlobal('fetch', fetchMock);

    const blob = await fetchBlobWithRetry('https://example.test/x');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(blob.size).toBe(5);
    const buf = new Uint8Array(await blob.arrayBuffer());
    expect(Array.from(buf)).toEqual([1, 2, 3, 4, 5]);
  });

  it('retries once on a 503 and then succeeds, with no caller-visible failure', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(errorResponse(503, 'Service Unavailable'))
      .mockResolvedValueOnce(streamedResponse([new Uint8Array([42])]));
    vi.stubGlobal('fetch', fetchMock);

    // Keep initialBackoffMs tiny so the test does not depend on fake timers
    // — we just want to confirm a retry happens.
    const blob = await fetchBlobWithRetry('https://example.test/x', { initialBackoffMs: 1 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(blob.size).toBe(1);
  });

  it('does NOT retry on a 404', async () => {
    const fetchMock = vi.fn().mockResolvedValue(errorResponse(404, 'Not Found'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      fetchBlobWithRetry('https://example.test/missing', { initialBackoffMs: 1 }),
    ).rejects.toThrow(/HTTP 404/);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('honors a pre-aborted caller AbortSignal without issuing a fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const controller = new AbortController();
    controller.abort();

    await expect(
      fetchBlobWithRetry('https://example.test/x', { signal: controller.signal }),
    ).rejects.toThrow(/abort/i);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does NOT retry when the caller aborts mid-flight', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        const sig = init?.signal as AbortSignal | undefined;
        sig?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const promise = fetchBlobWithRetry('https://example.test/x', {
      signal: controller.signal,
      initialBackoffMs: 1,
    });
    // Abort after a microtask so the fetch is in-flight.
    queueMicrotask(() => controller.abort());

    await expect(promise).rejects.toThrow();
    // Crucially: only the first attempt was issued — the caller-initiated
    // abort bypasses the retry loop.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('treats no-progress as retryable and surfaces a timeout error after retries are exhausted', async () => {
    // Stalled response: headers arrive immediately, but `read()` never
    // resolves on its own — only the inner AbortController firing (via the
    // watchdog) will reject the pending read. This matches real-browser
    // behavior where aborting a fetch tears down its body stream.
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      const sig = init?.signal as AbortSignal | undefined;
      const reader = {
        read: () => new Promise<{ done: boolean; value?: Uint8Array }>((_, reject) => {
          if (sig?.aborted) {
            reject(new DOMException('Aborted', 'AbortError'));
            return;
          }
          sig?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          }, { once: true });
        }),
        releaseLock() { /* noop */ },
      };
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/octet-stream' }),
        body: { getReader: () => reader },
        blob: async () => new Blob([]),
      } as unknown as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    vi.useFakeTimers();

    const promise = fetchBlobWithRetry('https://example.test/x', {
      noProgressTimeoutMs: 1_000,
      maxRetries: 1,
      initialBackoffMs: 10,
    });
    // Attach a rejection handler immediately to prevent the
    // "unhandled rejection" warning while we advance timers.
    const recorded = promise.catch((e) => e);

    // First attempt: headers arrive, watchdog starts, fires at 1s → inner
    // abort → read() rejects → fetchBlobOnce throws as timeout error
    // → fetchBlobWithRetry waits 10ms + jitter, then retries.
    await vi.advanceTimersByTimeAsync(1_100);
    await vi.advanceTimersByTimeAsync(260); // backoff window
    // Second attempt: same stall → same timeout → no more retries → reject.
    await vi.advanceTimersByTimeAsync(1_100);

    const err = await recorded;
    expect(err).toBeInstanceOf(Error);
    expect(String((err as Error).message)).toMatch(/No progress/);
    expect(fetchMock).toHaveBeenCalledTimes(2); // initial + 1 retry
  });
});

// ---------------------------------------------------------------------------
// MstFilesService.streamSelectedFiles
// ---------------------------------------------------------------------------

describe('MstFilesService.streamSelectedFiles', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('yields one file at a time, reports progress per file, and does not pre-buffer', async () => {
    // Build a sequence of three responses, recording when each fetch starts.
    const startedAt: number[] = [];
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      startedAt.push(Date.now());
      const seq = Number(url.match(/ledger_(\d+)/)?.[1] ?? 0);
      return streamedResponse([new Uint8Array([seq])]);
    });
    vi.stubGlobal('fetch', fetchMock);

    const svc = new MstFilesService();
    await svc.initialize('mytest.confidential-ledger.azure.com');

    const filenames = ['ledger_1-15.committed', 'ledger_16-32.committed', 'ledger_33-50.committed'];
    const progress: Array<{ currentFile: number; totalFiles: number; currentFilename: string }> = [];

    const yielded: string[] = [];
    for await (const { file } of svc.streamSelectedFiles(filenames, (p) => progress.push({ ...p }))) {
      yielded.push(file.name);
      // Consumer-side "indexing" delay so we can verify the NEXT fetch does
      // not start until the consumer signals readiness.
      await new Promise<void>((resolve) => setTimeout(resolve, 5));
    }

    expect(yielded).toEqual(filenames);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // Progress is reported exactly once per file, in order.
    expect(progress.map((p) => p.currentFilename)).toEqual(filenames);
    expect(progress.map((p) => p.currentFile)).toEqual([1, 2, 3]);
    expect(progress.every((p) => p.totalFiles === 3)).toBe(true);

    // Sequential: each fetch starts AFTER the previous consumer-await
    // released (separated by at least our ~5ms gap). This is the streaming
    // contract — no eager batching.
    expect(startedAt.length).toBe(3);
    expect(startedAt[1] - startedAt[0]).toBeGreaterThanOrEqual(4);
    expect(startedAt[2] - startedAt[1]).toBeGreaterThanOrEqual(4);
  });

  it('propagates a caller AbortSignal between files', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => streamedResponse([new Uint8Array([1])]));
    vi.stubGlobal('fetch', fetchMock);

    const svc = new MstFilesService();
    await svc.initialize('mytest.confidential-ledger.azure.com');

    const controller = new AbortController();
    const filenames = ['ledger_1-15.committed', 'ledger_16-32.committed', 'ledger_33-50.committed'];

    const yielded: string[] = [];
    const consume = async () => {
      for await (const { file } of svc.streamSelectedFiles(
        filenames,
        undefined,
        controller.signal,
      )) {
        yielded.push(file.name);
        // Abort after the first chunk has been yielded.
        if (yielded.length === 1) controller.abort();
      }
    };

    await expect(consume()).rejects.toThrow();
    // Only the first file should have been downloaded.
    expect(yielded.length).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
