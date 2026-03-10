/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import type { Migration } from '../types/migration-types';

/**
 * Migration 002 - Add covering indexes for table latest-state queries.
 *
 * The table view's "latest state" query needs to:
 *   1. Find the MAX(version) per key_name within a map_name
 *   2. Re-join to fetch the full row (value_text, sequence_no) for that version
 *
 * The original (map_name, key_name) index forces SQLite to do a table scan
 * for the version column and a second scan for the re-join.  The new
 * covering indexes include version (DESC for MAX), sequence_no, and
 * value_text so both steps can be satisfied from the index alone.
 *
 * Also adds ANALYZE so the query planner has up-to-date statistics for
 * any data that was inserted before this migration ran.
 */
export const migration: Migration = {
  version: 2,
  name: 'covering_indexes_for_latest_state',
  statements: [
    // Covering index for kv_writes: serves latest-state lookup without touching the table
    `CREATE INDEX IF NOT EXISTS idx_kv_writes_map_key_ver
       ON kv_writes(map_name, key_name, version DESC, sequence_no, value_text)`,

    // Covering index for kv_deletes: same pattern (no value_text column in deletes)
    `CREATE INDEX IF NOT EXISTS idx_kv_deletes_map_key_ver
       ON kv_deletes(map_name, key_name, version DESC, sequence_no)`,

    // Refresh query-planner statistics after adding new indexes
    `ANALYZE`,
  ],
};
