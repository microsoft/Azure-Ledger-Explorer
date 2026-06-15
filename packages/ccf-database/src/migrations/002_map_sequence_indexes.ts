/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import type { Migration } from '../types/migration-types';

/**
 * Add (map_name, sequence_no) composite indexes on kv_writes and kv_deletes.
 *
 * Motivation: large append-only maps (e.g. SCITT entries on a multi-GB ledger)
 * page through hundreds of thousands of rows ordered by sequence_no. The
 * pre-existing indexes order rows by (map_name, key_name, version DESC,
 * sequence_no, ...), which is wrong for "order by sequence_no" pagination —
 * SQLite has to materialise the whole result and sort, then skip OFFSET rows.
 * That blows up wasm heap on the deep-page query (OOM at e.g. page 4238 of
 * public:scitt.entry on a 1.5 GB ledger).
 *
 * With this index, SQLite can stream rows in (map_name, sequence_no) order
 * directly out of the index, so OFFSET becomes a cheap index skip and the
 * sort step disappears.
 */
export const migration: Migration = {
  version: 2,
  name: 'map_sequence_indexes',
  statements: [
    `CREATE INDEX IF NOT EXISTS idx_kv_writes_map_seq
       ON kv_writes(map_name, sequence_no)`,
    `CREATE INDEX IF NOT EXISTS idx_kv_deletes_map_seq
       ON kv_deletes(map_name, sequence_no)`,
  ],
};
