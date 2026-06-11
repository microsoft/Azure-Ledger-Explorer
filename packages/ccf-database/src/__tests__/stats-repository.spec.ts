/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { describe, it, expect, vi } from 'vitest';
import { StatsRepository } from '../repositories/stats-repository';
import type { ExecFn, ExecBatchFn } from '../types/repository-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRepo(execImpl: ExecFn): { repo: StatsRepository; capturedQueries: string[] } {
  const capturedQueries: string[] = [];
  const wrappedExec: ExecFn = async (sql, bind) => {
    capturedQueries.push(sql);
    return execImpl(sql, bind);
  };
  const execBatch: ExecBatchFn = vi.fn().mockResolvedValue(undefined);
  return { repo: new StatsRepository(wrappedExec, execBatch), capturedQueries };
}

// Canned values used by the result-mapping test. Match the column names that
// `getEnhancedStats` selects.
const CANNED_ROW = {
  file_count: 7,
  transaction_count: 4242,
  write_count: 5000,
  delete_count: 250,
  user_write_count: 4500,
  table_count: 19,
  unique_key_count: 631,
  avg_transaction_size: 1234.6,
  largest_transaction_size: 9999,
  smallest_transaction_size: 100,
  total_data_size: 1_000_000,
  oldest_transaction: '2024-01-01T00:00:00.000Z',
  newest_transaction: '2024-12-31T23:59:59.000Z',
};

// ---------------------------------------------------------------------------
// Phase 3 — index-friendly enhanced-stats query
// ---------------------------------------------------------------------------

describe('StatsRepository.getEnhancedStats — index-friendly query', () => {
  it('pushes DISTINCT down to each side of the UNION (so SQLite can index-scan)', async () => {
    const { repo, capturedQueries } = makeRepo(async () => [CANNED_ROW]);

    await repo.getEnhancedStats();

    expect(capturedQueries).toHaveLength(1);
    const sql = capturedQueries[0];

    // Each branch must DISTINCT its own rows so SQLite can satisfy the branch
    // with an index-only scan against idx_kv_writes_map_key /
    // idx_kv_deletes_map_key, returning O(distinct) rows instead of O(total).
    expect(sql).toMatch(/SELECT\s+DISTINCT\s+map_name\s+FROM\s+kv_writes/i);
    expect(sql).toMatch(/SELECT\s+DISTINCT\s+map_name\s+FROM\s+kv_deletes/i);
    expect(sql).toMatch(/SELECT\s+DISTINCT\s+map_name,\s*key_name\s+FROM\s+kv_writes/i);
    expect(sql).toMatch(/SELECT\s+DISTINCT\s+map_name,\s*key_name\s+FROM\s+kv_deletes/i);
  });

  it('no longer uses the planner-hostile `key_name || map_name` concat', async () => {
    const { repo, capturedQueries } = makeRepo(async () => [CANNED_ROW]);

    await repo.getEnhancedStats();

    const sql = capturedQueries[0];
    // The previous implementation did COUNT(DISTINCT key_name || map_name).
    // The string concat blocks the (map_name, key_name) covering index from
    // being used; the tuple-projected DISTINCT is the index-friendly form.
    expect(sql).not.toMatch(/key_name\s*\|\|\s*map_name/i);
    expect(sql).not.toMatch(/map_name\s*\|\|\s*key_name/i);
  });

  it('preserves the EnhancedStats result shape (mapping unchanged)', async () => {
    const { repo } = makeRepo(async () => [CANNED_ROW]);

    const stats = await repo.getEnhancedStats();

    expect(stats).toEqual({
      fileCount: 7,
      transactionCount: 4242,
      writeCount: 5000,
      deleteCount: 250,
      userWriteCount: 4500,
      tableCount: 19,
      uniqueKeyCount: 631,
      // avg_transaction_size 1234.6 -> round to 1235
      averageTransactionSize: 1235,
      largestTransactionSize: 9999,
      smallestTransactionSize: 100,
      totalDataSize: 1_000_000,
      oldestTransaction: new Date('2024-01-01T00:00:00.000Z'),
      newestTransaction: new Date('2024-12-31T23:59:59.000Z'),
    });
  });

  it('returns zeroed stats when the underlying query returns no rows', async () => {
    const { repo } = makeRepo(async () => []);

    const stats = await repo.getEnhancedStats();

    expect(stats).toEqual({
      fileCount: 0,
      transactionCount: 0,
      writeCount: 0,
      deleteCount: 0,
      userWriteCount: 0,
      tableCount: 0,
      uniqueKeyCount: 0,
      averageTransactionSize: 0,
      largestTransactionSize: 0,
      smallestTransactionSize: 0,
      totalDataSize: 0,
      oldestTransaction: null,
      newestTransaction: null,
    });
  });
});
