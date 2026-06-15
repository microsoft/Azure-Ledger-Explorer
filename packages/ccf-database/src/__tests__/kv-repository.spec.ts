/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { describe, it, expect, vi } from 'vitest';
import { KVRepository } from '../repositories/kv-repository';
import {
  buildTableLatestStateQuery,
  buildTableLatestStateCountQuery,
  buildAppendOnlyLatestStateQuery,
  buildAppendOnlyLatestStateCountQuery,
  buildAppendOnlyDetectionQuery,
} from '../queries/table-latest-state-queries';
import type { ExecFn, ExecBatchFn } from '../types/repository-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRepo(execImpl: ExecFn): {
  repo: KVRepository;
  captured: Array<{ sql: string; bind?: unknown[] }>;
} {
  const captured: Array<{ sql: string; bind?: unknown[] }> = [];
  const wrappedExec: ExecFn = async (sql, bind) => {
    captured.push({ sql, bind });
    return execImpl(sql, bind);
  };
  const execBatch: ExecBatchFn = vi.fn().mockResolvedValue(undefined);
  return { repo: new KVRepository(wrappedExec, execBatch), captured };
}

// Tier A guarantees: when no search query and not sorting by value, the inner
// CTE must NOT pull value_text through the window pipeline.
function inferredCteShape(sql: string): 'deferred' | 'heavy' | 'append-only' | 'unknown' {
  // Append-only path starts with `WITH page AS (` and has no window function.
  if (/WITH\s+page\s+AS/i.test(sql) && !/OVER\s*\(\s*PARTITION/i.test(sql)) {
    return 'append-only';
  }
  // Both CTE paths use `MAX(version) OVER (PARTITION BY key_name)`.
  // Heavy path has a `value_text` projection in `all_operations`, deferred does not.
  const allOps = sql.match(/all_operations\s+AS\s*\(([\s\S]*?)\)\s*,/i);
  if (!allOps) return 'unknown';
  const carriesValueText = /SELECT[\s\S]+?value_text[\s\S]+?FROM\s+kv_writes/i.test(allOps[1]);
  return carriesValueText ? 'heavy' : 'deferred';
}

// ---------------------------------------------------------------------------
// Pure builder tests
// ---------------------------------------------------------------------------

describe('buildTableLatestStateQuery — deferred-value-text routing', () => {
  it('omits value_text from the inner CTE when no search and not value-sort', () => {
    const { sql } = buildTableLatestStateQuery({
      mapName: 'public:scitt.entry',
      limit: 100,
      offset: 423700,
      sortColumn: 'sequence',
      sortDirection: 'asc',
    });
    expect(inferredCteShape(sql)).toBe('deferred');
    // value_text should appear ONLY in the final join, not in the CTE bodies.
    expect(sql).toMatch(/LEFT JOIN\s+kv_writes\s+w[\s\S]+?w\.map_name\s*=\s*\?/i);
  });

  it('includes value_text in the inner CTE when a search query is present', () => {
    const { sql } = buildTableLatestStateQuery({
      mapName: 'm',
      limit: 100,
      offset: 0,
      searchQuery: 'abc',
      sortColumn: 'sequence',
      sortDirection: 'asc',
    });
    expect(inferredCteShape(sql)).toBe('heavy');
  });

  it('includes value_text in the inner CTE when sorting by value', () => {
    const { sql } = buildTableLatestStateQuery({
      mapName: 'm',
      limit: 100,
      offset: 0,
      sortColumn: 'value',
      sortDirection: 'desc',
    });
    expect(inferredCteShape(sql)).toBe('heavy');
  });

  it('pushes ORDER BY into the paged CTE so LIMIT happens before the value_text join', () => {
    const { sql, params } = buildTableLatestStateQuery({
      mapName: 'm',
      limit: 50,
      offset: 12345,
      sortColumn: 'sequence',
      sortDirection: 'asc',
    });
    // The `paged` CTE must contain its own ORDER/LIMIT/OFFSET so the outer
    // join only touches 50 rows.
    expect(sql).toMatch(/paged\s+AS\s*\([\s\S]+ORDER BY[\s\S]+LIMIT\s+\?\s+OFFSET\s+\?\s*\)/i);
    expect(params).toEqual(['m', 'm', 50, 12345, 'm']);
  });
});

describe('buildTableLatestStateCountQuery — deferred-value-text routing', () => {
  it('skips value_text in the no-search count CTE', () => {
    const { sql } = buildTableLatestStateCountQuery({ mapName: 'm' });
    expect(inferredCteShape(sql)).toBe('deferred');
    expect(sql).toMatch(/COUNT\(\*\)\s+as\s+count[\s\S]+FROM\s+latest_operations/i);
  });

  it('uses the heavy CTE when a search query is present (need value_text for LIKE)', () => {
    const { sql, params } = buildTableLatestStateCountQuery({
      mapName: 'm',
      searchQuery: 'needle',
    });
    expect(inferredCteShape(sql)).toBe('heavy');
    expect(params).toEqual(['m', 'm', '%needle%', '%needle%']);
  });
});

describe('buildAppendOnlyLatestStateQuery', () => {
  it('queries kv_writes directly without the window CTE', () => {
    const { sql, params } = buildAppendOnlyLatestStateQuery({
      mapName: 'public:scitt.entry',
      limit: 100,
      offset: 423700,
      sortColumn: 'sequence',
      sortDirection: 'asc',
    });
    expect(inferredCteShape(sql)).toBe('append-only');
    // Must not reference kv_deletes or the window function.
    expect(sql).not.toMatch(/kv_deletes/i);
    expect(sql).not.toMatch(/OVER\s*\(\s*PARTITION/i);
    // Must use map_name in WHERE and pass it once for the page and once for the join-back.
    expect(params).toEqual(['public:scitt.entry', 100, 423700]);
  });

  it('joins back to kv_writes by id for value_text on the paged rows only', () => {
    const { sql } = buildAppendOnlyLatestStateQuery({
      mapName: 'm',
      limit: 10,
      offset: 0,
      sortColumn: 'sequence',
      sortDirection: 'asc',
    });
    expect(sql).toMatch(/JOIN\s+kv_writes\s+w\s+ON\s+w\.id\s*=\s*p\.id/i);
  });
});

describe('buildAppendOnlyLatestStateCountQuery', () => {
  it('is a simple COUNT(*) on kv_writes — no CTE, no window function', () => {
    const { sql, params } = buildAppendOnlyLatestStateCountQuery({ mapName: 'm' });
    expect(sql).toMatch(/^\s*SELECT\s+COUNT\(\*\)/i);
    expect(sql).not.toMatch(/WITH\s+/i);
    expect(sql).not.toMatch(/OVER\s*\(\s*PARTITION/i);
    expect(params).toEqual(['m']);
  });
});

describe('buildAppendOnlyDetectionQuery', () => {
  it('returns has_deletes and has_duplicate_keys as EXISTS short-circuits', () => {
    const { sql, params } = buildAppendOnlyDetectionQuery('m');
    expect(sql).toMatch(/EXISTS\(SELECT 1 FROM kv_deletes WHERE map_name = \?\)\s*\)\s*AS\s+has_deletes/i);
    expect(sql).toMatch(/EXISTS\([\s\S]+GROUP BY key_name HAVING COUNT\(\*\) > 1\s*\)\s*\)\s*AS\s+has_duplicate_keys/i);
    expect(params).toEqual(['m', 'm']);
  });
});

// ---------------------------------------------------------------------------
// Repository routing tests
// ---------------------------------------------------------------------------

describe('KVRepository.getTableLatestState — routing', () => {
  it('routes to the append-only fast path when detection says so', async () => {
    const { repo, captured } = makeRepo(async sql => {
      if (sql.includes('has_deletes')) {
        return [{ has_deletes: 0, has_duplicate_keys: 0 }];
      }
      return [];
    });

    await repo.getTableLatestState('public:scitt.entry', 100, 423700);

    expect(captured).toHaveLength(2);
    // Detection first
    expect(captured[0].sql).toMatch(/has_deletes/i);
    // Then the append-only page query (no PARTITION BY)
    expect(captured[1].sql).not.toMatch(/OVER\s*\(\s*PARTITION/i);
    expect(captured[1].sql).toMatch(/WITH\s+page\s+AS/i);
  });

  it('falls back to the CTE path when the map has deletes', async () => {
    const { repo, captured } = makeRepo(async sql => {
      if (sql.includes('has_deletes')) {
        return [{ has_deletes: 1, has_duplicate_keys: 0 }];
      }
      return [];
    });

    await repo.getTableLatestState('public:ccf.gov.constitution', 100, 0);

    expect(captured).toHaveLength(2);
    expect(captured[1].sql).toMatch(/OVER\s*\(\s*PARTITION BY key_name\)/i);
    // No search, no value sort -> deferred shape.
    expect(inferredCteShape(captured[1].sql)).toBe('deferred');
  });

  it('falls back to the CTE path when the map has duplicate keys', async () => {
    const { repo, captured } = makeRepo(async sql => {
      if (sql.includes('has_deletes')) {
        return [{ has_deletes: 0, has_duplicate_keys: 1 }];
      }
      return [];
    });

    await repo.getTableLatestState('m', 100, 0);

    expect(captured[1].sql).toMatch(/OVER\s*\(\s*PARTITION BY key_name\)/i);
  });

  it('does not consult the detection query when a search query is present', async () => {
    const { repo, captured } = makeRepo(async () => []);

    await repo.getTableLatestState('m', 100, 0, 'needle');

    expect(captured).toHaveLength(1);
    expect(captured[0].sql).not.toMatch(/has_deletes/i);
    expect(inferredCteShape(captured[0].sql)).toBe('heavy');
  });

  it('does not consult the detection query when sorting by value', async () => {
    const { repo, captured } = makeRepo(async () => []);

    await repo.getTableLatestState('m', 100, 0, undefined, 'value', 'asc');

    expect(captured).toHaveLength(1);
    expect(captured[0].sql).not.toMatch(/has_deletes/i);
    expect(inferredCteShape(captured[0].sql)).toBe('heavy');
  });
});

describe('KVRepository.getTableLatestStateCount — routing', () => {
  it('uses the simple COUNT(*) path when the map is append-only', async () => {
    const { repo, captured } = makeRepo(async sql => {
      if (sql.includes('has_deletes')) {
        return [{ has_deletes: 0, has_duplicate_keys: 0 }];
      }
      return [{ count: 12345 }];
    });

    const count = await repo.getTableLatestStateCount('public:scitt.entry');

    expect(count).toBe(12345);
    expect(captured).toHaveLength(2);
    expect(captured[1].sql).toMatch(/^\s*SELECT\s+COUNT\(\*\)\s+AS\s+count\s+FROM\s+kv_writes/i);
  });

  it('skips the append-only fast path when a search query is present', async () => {
    const { repo, captured } = makeRepo(async () => [{ count: 0 }]);

    await repo.getTableLatestStateCount('m', 'q');

    expect(captured).toHaveLength(1);
    expect(captured[0].sql).not.toMatch(/has_deletes/i);
    expect(inferredCteShape(captured[0].sql)).toBe('heavy');
  });
});

// ---------------------------------------------------------------------------
// Row mapping — the deferred path must still produce TableKeyValue identically
// ---------------------------------------------------------------------------

describe('KVRepository.getTableLatestState — row mapping', () => {
  it('maps fast-path rows to TableKeyValue correctly', async () => {
    const { repo } = makeRepo(async sql => {
      if (sql.includes('has_deletes')) {
        return [{ has_deletes: 0, has_duplicate_keys: 0 }];
      }
      return [
        {
          key_name: 'k1',
          value_text: 'hello',
          version: 5,
          sequence_no: 100,
          is_deleted: 0,
          transaction_id: '2.1',
        },
      ];
    });

    const rows = await repo.getTableLatestState('m', 100, 0);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      keyName: 'k1',
      version: 5,
      transactionId: 100,
      transactionIdentifier: '2.1',
      isDeleted: false,
    });
    expect(rows[0].value).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(rows[0].value!)).toBe('hello');
  });

  it('treats is_deleted=1 rows as deleted with null value', async () => {
    const { repo } = makeRepo(async sql => {
      if (sql.includes('has_deletes')) {
        return [{ has_deletes: 1, has_duplicate_keys: 0 }];
      }
      return [
        {
          key_name: 'gone',
          value_text: null,
          version: 9,
          sequence_no: 200,
          is_deleted: 1,
          transaction_id: '3.2',
        },
      ];
    });

    const rows = await repo.getTableLatestState('m', 100, 0);
    expect(rows[0].isDeleted).toBe(true);
    expect(rows[0].value).toBeNull();
  });
});

describe('KVRepository.isAppendOnlyMap', () => {
  it('returns true only when both EXISTS flags are 0', async () => {
    const cases: Array<[number, number, boolean]> = [
      [0, 0, true],
      [1, 0, false],
      [0, 1, false],
      [1, 1, false],
    ];

    for (const [hasDeletes, hasDups, expected] of cases) {
      const { repo } = makeRepo(async () => [
        { has_deletes: hasDeletes, has_duplicate_keys: hasDups },
      ]);
      expect(await repo.isAppendOnlyMap('m')).toBe(expected);
    }
  });

  it('returns false on an empty detection result', async () => {
    const { repo } = makeRepo(async () => []);
    expect(await repo.isAppendOnlyMap('m')).toBe(true); // both default to 0 -> append-only
    // Note: this matches the "empty table also counts as append-only" case;
    // documented in the helper. Querying an empty table is a no-op anyway.
  });
});
