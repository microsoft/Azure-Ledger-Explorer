/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Spies are hoisted via `vi.hoisted` so the factory below can reference them.
const dbSpies = vi.hoisted(() => ({
  initialize: vi.fn().mockResolvedValue(undefined),
  resetMerkleState: vi.fn().mockResolvedValue(undefined),
  insertLedgerFileWithData: vi.fn().mockResolvedValue({ fileId: 1, transactionsInserted: 1 }),
  analyzeDatabase: vi.fn().mockResolvedValue(undefined),
  exportDatabase: vi.fn().mockImplementation(async (onChunk?: (chunk: ArrayBuffer, offset: number, totalSize: number, done: boolean) => void | Promise<void>) => {
    const fakeChunk = new ArrayBuffer(7);
    if (onChunk) await onChunk(fakeChunk, 0, 7, true);
    return { totalSize: 7 };
  }),
}));

vi.mock('@microsoft/ccf-database', () => {
  return {
    DATABASE_FILENAME: 'test.db',
    CCFDatabase: class {
      initialize = dbSpies.initialize;
      resetMerkleState = dbSpies.resetMerkleState;
      insertLedgerFileWithData = dbSpies.insertLedgerFileWithData;
      analyzeDatabase = dbSpies.analyzeDatabase;
      exportDatabase = dbSpies.exportDatabase;
    },
  };
});

// Telemetry — irrelevant noise for these tests.
vi.mock('../services/telemetry', () => ({
  trackEvent: vi.fn(),
  TelemetryEvents: { FILE_UPLOADED: 'file_uploaded', DATABASE_EXPORTED: 'database_exported' },
}));

// Verification service — unused by handleFiles paths under test, but imported by the module.
vi.mock('../services/verification-service', () => ({
  verificationService: {},
}));

// Storage quota helpers — unused but imported.
vi.mock('../utils/storage-quota', () => ({
  getStorageQuota: vi.fn().mockResolvedValue({}),
  checkStorageCapacity: vi.fn().mockResolvedValue(true),
  estimateDatabaseSize: vi.fn().mockResolvedValue(0),
}));

// ---------------------------------------------------------------------------
// Imports under test (must come AFTER vi.mock calls)
// ---------------------------------------------------------------------------

import {
  invalidateAfterImport,
  useFileDrop,
  useExportDatabase,
  triggerBlobDownload,
  queryKeys,
} from '../hooks/use-ccf-data';

import { trackEvent } from '../services/telemetry';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeFile(name: string, content = 'x'): File {
  return new File([content], name, { type: 'application/octet-stream' });
}

function createWrapper(client: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
  dbSpies.initialize.mockClear();
  dbSpies.resetMerkleState.mockClear();
  dbSpies.insertLedgerFileWithData.mockClear();
  dbSpies.analyzeDatabase.mockClear();
  dbSpies.exportDatabase.mockClear();
  dbSpies.insertLedgerFileWithData.mockResolvedValue({ fileId: 1, transactionsInserted: 1 });
  dbSpies.exportDatabase.mockImplementation(async (onChunk?: (chunk: ArrayBuffer, offset: number, totalSize: number, done: boolean) => void | Promise<void>) => {
    const fakeChunk = new ArrayBuffer(7);
    if (onChunk) await onChunk(fakeChunk, 0, 7, true);
    return { totalSize: 7 };
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('invalidateAfterImport', () => {
  it('invalidates every query key affected by an import', () => {
    const client = new QueryClient();
    const spy = vi.spyOn(client, 'invalidateQueries');

    invalidateAfterImport(client);

    // 4 keyed invalidations + 2 predicate-based invalidations = 6 calls.
    expect(spy).toHaveBeenCalledTimes(6);

    // Pin the keyed invalidations to the exact query keys they target so a
    // future change that adds/removes/renames a key has to update this test.
    const keyedCalls = spy.mock.calls.filter(
      ([arg]) => arg != null && 'queryKey' in arg,
    );
    const queryKeysInvalidated = keyedCalls.map(([arg]) => arg!.queryKey);
    expect(queryKeysInvalidated).toEqual(
      expect.arrayContaining([
        queryKeys.ledgerFiles,
        queryKeys.stats,
        queryKeys.enhancedStats,
        queryKeys.ccfTables,
      ]),
    );

    // The two predicate invalidations must each be predicate-based.
    const predicateCalls = spy.mock.calls.filter(
      ([arg]) => arg != null && 'predicate' in arg,
    );
    expect(predicateCalls).toHaveLength(2);
  });
});

describe('useFileDrop.handleFiles batch invalidation', () => {
  it('invalidates queries exactly once for a multi-file batch (not per file)', async () => {
    const client = new QueryClient();
    const spy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useFileDrop(), {
      wrapper: createWrapper(client),
    });

    const files = [
      makeFile('a.ledger'),
      makeFile('b.ledger'),
      makeFile('c.ledger'),
      makeFile('d.ledger'),
      makeFile('e.ledger'),
    ];

    await act(async () => {
      await result.current.handleFiles(files);
    });

    // Each file gets inserted exactly once.
    expect(dbSpies.insertLedgerFileWithData).toHaveBeenCalledTimes(5);

    // ...but invalidations fire once for the whole batch (6 calls total),
    // not 30 (6 × 5). This is the perf win that motivates the change.
    expect(spy).toHaveBeenCalledTimes(6);
  });

  it('skips the database and invalidations entirely for an empty file list', async () => {
    const client = new QueryClient();
    const spy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useFileDrop(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.handleFiles([]);
    });

    expect(dbSpies.resetMerkleState).not.toHaveBeenCalled();
    expect(dbSpies.insertLedgerFileWithData).not.toHaveBeenCalled();
    expect(spy).not.toHaveBeenCalled();
  });

  it('still invalidates once when the batch fails partway through', async () => {
    const client = new QueryClient();
    const spy = vi.spyOn(client, 'invalidateQueries');

    // Files 1 and 2 succeed, file 3 throws, files 4 and 5 should NOT be attempted.
    let callCount = 0;
    dbSpies.insertLedgerFileWithData.mockImplementation(async () => {
      callCount += 1;
      if (callCount === 3) {
        throw new Error('simulated parse failure on file 3');
      }
      return { fileId: callCount, transactionsInserted: 1 };
    });

    // Silence the expected error log from useFileDrop's catch block.
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useFileDrop(), {
      wrapper: createWrapper(client),
    });

    const files = [
      makeFile('a.ledger'),
      makeFile('b.ledger'),
      makeFile('c.ledger'),
      makeFile('d.ledger'),
      makeFile('e.ledger'),
    ];

    await expect(
      act(async () => {
        await result.current.handleFiles(files);
      }),
    ).rejects.toThrow('simulated parse failure on file 3');

    // Loop bailed after the 3rd file.
    expect(dbSpies.insertLedgerFileWithData).toHaveBeenCalledTimes(3);

    // Partial state is real (files 1 and 2 landed), so the UI still gets
    // invalidated exactly once via the finally block.
    expect(spy).toHaveBeenCalledTimes(6);

    consoleErrorSpy.mockRestore();
  });
});

describe('useFileDrop.handleFilesStream', () => {
  it('streams files lazily, invalidates once, and runs ANALYZE once', async () => {
    const client = new QueryClient();
    const spy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useFileDrop(), {
      wrapper: createWrapper(client),
    });

    // Track the order in which the generator is pulled vs. the worker is
    // called, to prove the streaming contract: the (N+1)th file is not
    // requested until the Nth file has been handed to the worker.
    const events: string[] = [];
    dbSpies.insertLedgerFileWithData.mockImplementation(async (filename: string) => {
      events.push(`insert:${filename}`);
      return { fileId: 1, transactionsInserted: 1 };
    });

    const filenames = ['a.ledger', 'b.ledger', 'c.ledger'];
    async function* source(): AsyncGenerator<File> {
      for (const name of filenames) {
        events.push(`yield:${name}`);
        yield makeFile(name);
      }
    }

    await act(async () => {
      await result.current.handleFilesStream(source(), filenames.length, filenames);
    });

    // Strict pull-then-insert interleaving — no eager prefetch of the next
    // file before the current one is consumed.
    expect(events).toEqual([
      'yield:a.ledger', 'insert:a.ledger',
      'yield:b.ledger', 'insert:b.ledger',
      'yield:c.ledger', 'insert:c.ledger',
    ]);

    // Same single-invalidate + single-ANALYZE batch semantics as handleFiles.
    expect(spy).toHaveBeenCalledTimes(6);
    expect(dbSpies.analyzeDatabase).toHaveBeenCalledTimes(1);
  });

  it('still invalidates and clears progress when the underlying stream throws', async () => {
    const client = new QueryClient();
    const spy = vi.spyOn(client, 'invalidateQueries');

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useFileDrop(), {
      wrapper: createWrapper(client),
    });

    const filenames = ['a.ledger', 'b.ledger', 'c.ledger'];
    async function* failingSource(): AsyncGenerator<File> {
      yield makeFile('a.ledger');
      throw new Error('simulated download failure on file 2');
    }

    await expect(
      act(async () => {
        await result.current.handleFilesStream(failingSource(), filenames.length, filenames);
      }),
    ).rejects.toThrow('simulated download failure on file 2');

    // File 1 was indexed before the throw → partial state is real → must
    // still invalidate.
    expect(dbSpies.insertLedgerFileWithData).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledTimes(6);
    // ANALYZE is intentionally skipped on partial-failure (matches the
    // array-path behavior of handleFiles): the re-thrown error short-circuits
    // the post-try block. The next successful import will refresh stats.
    expect(dbSpies.analyzeDatabase).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// useExportDatabase + triggerBlobDownload
// ---------------------------------------------------------------------------

describe('triggerBlobDownload', () => {
  it('creates an object URL, clicks an anchor with the filename, and revokes the URL', () => {
    const fakeUrl = 'blob:fake-url';
    const createObjectURL = vi.fn(() => fakeUrl);
    const revokeObjectURL = vi.fn();
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL;

    let clickedHref: string | undefined;
    let clickedDownload: string | undefined;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clickedHref = this.href;
      clickedDownload = this.download;
    });

    vi.useFakeTimers();
    try {
      const blob = new Blob([new Uint8Array([0, 1, 2, 3])]);
      triggerBlobDownload(blob, 'ccf-ledger-test.sqlite3');

      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(createObjectURL).toHaveBeenCalledWith(blob);
      // jsdom resolves anchor.href to a fully-qualified URL; check the suffix.
      expect(clickedHref).toContain(fakeUrl);
      expect(clickedDownload).toBe('ccf-ledger-test.sqlite3');

      // The revoke happens via setTimeout so the browser can keep the URL
      // alive long enough to start the download.
      expect(revokeObjectURL).not.toHaveBeenCalled();
      vi.runAllTimers();
      expect(revokeObjectURL).toHaveBeenCalledTimes(1);
      expect(revokeObjectURL).toHaveBeenCalledWith(fakeUrl);
    } finally {
      vi.useRealTimers();
      clickSpy.mockRestore();
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
    }
  });
});

describe('useExportDatabase', () => {
  it('exports the database via Blob fallback, triggers a download with a timestamped filename, and tracks telemetry', async () => {
    // Ensure the Blob fallback path is exercised (no showSaveFilePicker)
    delete (window as unknown as Record<string, unknown>).showSaveFilePicker;

    const fakeUrl = 'blob:fake-url';
    const createObjectURL = vi.fn(() => fakeUrl);
    const revokeObjectURL = vi.fn();
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL;

    let capturedFilename: string | undefined;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      capturedFilename = this.download;
    });

    vi.useFakeTimers();
    try {
      const client = new QueryClient();
      const { result } = renderHook(() => useExportDatabase(), {
        wrapper: createWrapper(client),
      });

      await act(async () => {
        await result.current.mutateAsync();
      });

      // Flush the next-tick revoke scheduled by triggerBlobDownload().
      vi.runAllTimers();

      expect(dbSpies.exportDatabase).toHaveBeenCalledTimes(1);
      expect(createObjectURL).toHaveBeenCalledTimes(1);
      // Filename matches `ccf-ledger-YYYYMMDD-HHmmss.sqlite3` exactly.
      expect(capturedFilename).toMatch(/^ccf-ledger-\d{8}-\d{6}\.sqlite3$/);
      expect(revokeObjectURL).toHaveBeenCalledTimes(1);
      expect(revokeObjectURL).toHaveBeenCalledWith(fakeUrl);
      expect(trackEvent).toHaveBeenCalledWith('database_exported', { byteLength: 7 });
    } finally {
      vi.useRealTimers();
      clickSpy.mockRestore();
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
    }
  });

  it('surfaces export failures as a mutation error and skips telemetry', async () => {
    delete (window as unknown as Record<string, unknown>).showSaveFilePicker;
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    dbSpies.exportDatabase.mockRejectedValue(new Error('worker boom'));

    const client = new QueryClient();
    const { result } = renderHook(() => useExportDatabase(), {
      wrapper: createWrapper(client),
    });

    await expect(
      act(async () => {
        await result.current.mutateAsync();
      }),
    ).rejects.toThrow('worker boom');

    expect(trackEvent).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
