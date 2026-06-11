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
}));

vi.mock('@microsoft/ccf-database', () => {
  return {
    DATABASE_FILENAME: 'test.db',
    CCFDatabase: class {
      initialize = dbSpies.initialize;
      resetMerkleState = dbSpies.resetMerkleState;
      insertLedgerFileWithData = dbSpies.insertLedgerFileWithData;
      analyzeDatabase = dbSpies.analyzeDatabase;
    },
  };
});

// Telemetry — irrelevant noise for these tests.
vi.mock('../services/telemetry', () => ({
  trackEvent: vi.fn(),
  TelemetryEvents: { FILE_UPLOADED: 'file_uploaded' },
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
  queryKeys,
} from '../hooks/use-ccf-data';

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
  dbSpies.insertLedgerFileWithData.mockResolvedValue({ fileId: 1, transactionsInserted: 1 });
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
