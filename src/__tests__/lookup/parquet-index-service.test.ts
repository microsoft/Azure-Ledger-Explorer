/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

/// <reference types="node" />

import { readdirSync, readFileSync } from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearParquetIndexCache,
  formatMicros,
  loadManifest,
  readChunk,
  searchParquetIndex,
  type ParquetIndexRow,
} from '../../lookup/services/parquet-index-service';
import { LookupError } from '../../lookup/services/mst-lookup-service';

// Emitted by MST-Indexer-prototype's mst_parquet_emitter from its generated
// test ledger: 41 entries in 5 chunks, 2 sealed segments of 2 chunks plus a tail.
const FIXTURE = path.resolve(__dirname, 'fixtures/parquet-index');
const BASE = 'https://index.test/container';
const LEDGER = 'fixture-a';

function fixtureFiles(): Map<string, Uint8Array> {
  const files = new Map<string, Uint8Array>();
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else files.set(`${BASE}/${path.relative(FIXTURE, full).split(path.sep).join('/')}`, new Uint8Array(readFileSync(full)));
    }
  };
  walk(FIXTURE);
  return files;
}

let files: Map<string, Uint8Array>;
let requested: string[];

beforeEach(() => {
  clearParquetIndexCache();
  files = fixtureFiles();
  requested = [];
  vi.stubGlobal('fetch', async (url: string) => {
    requested.push(url);
    const body = files.get(url);
    return body ? new Response(body.slice()) : new Response('not found', { status: 404 });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const file = (rel: string) => `${BASE}/${LEDGER}/v1/${rel}`;

function editJson(rel: string, edit: (doc: Record<string, unknown>) => void) {
  const doc = JSON.parse(new TextDecoder().decode(files.get(file(rel))));
  edit(doc);
  files.set(file(rel), new TextEncoder().encode(JSON.stringify(doc)));
}

async function allRows(): Promise<ParquetIndexRow[]> {
  const manifest = await loadManifest(BASE, LEDGER);
  const rows: ParquetIndexRow[] = [];
  for (const chunk of manifest.chunks) rows.push(...(await readChunk(BASE, LEDGER, chunk)));
  return rows;
}

async function expectIntegrityError(promise: Promise<unknown>, message: RegExp) {
  const error = await promise.then(() => null, (e: unknown) => e);
  expect(error).toBeInstanceOf(LookupError);
  expect((error as LookupError).kind).toBe('integrity');
  expect((error as LookupError).message).toMatch(message);
}

describe('loadManifest', () => {
  it('verifies the head, sealed segments and manifest_root the emitter wrote', async () => {
    const manifest = await loadManifest(BASE, LEDGER);
    expect(manifest.chunks.map((c) => c.chunk_name)).toEqual([
      'ledger_1-10.committed',
      'ledger_11-20.committed',
      'ledger_21-30.committed',
      'ledger_31-40.committed',
      'ledger_41-45.committed',
    ]);
    expect(manifest.canonicalSeqno).toBe(45);
    expect(manifest.entriesCount).toBe(41);
    expect(manifest.manifestRoot).toBe('sha256:1432f299cd4ee258d6f6902cabb14285fd96210386fbccd4160f4b86140229ca');
    expect(manifest.attested).toBe(false);
  });

  it('reports a ledger without a published index as not indexed', async () => {
    await expect(loadManifest(BASE, 'other-ledger')).rejects.toMatchObject({ kind: 'notIndexed', step: 'search' });
  });

  it('rejects a head whose manifest_root does not match its chunks', async () => {
    editJson('manifest/head.json', (h) => {
      (h.tail as Record<string, unknown>[])[0].entries_root = `sha256:${'0'.repeat(64)}`;
    });
    await expectIntegrityError(loadManifest(BASE, LEDGER), /manifest_root/);
  });

  it('rejects a modified sealed segment', async () => {
    const seg = files.get(file('manifest/seg-000000.json'))!;
    files.set(file('manifest/seg-000000.json'), new TextEncoder().encode(new TextDecoder().decode(seg).replace('"row_count":9', '"row_count":8')));
    await expectIntegrityError(loadManifest(BASE, LEDGER), /seg-000000\.json does not match its digest/);
  });

  it('rejects a manifest for another ledger', async () => {
    editJson('manifest/head.json', (h) => {
      h.ledger_id = 'someone-else';
    });
    await expectIntegrityError(loadManifest(BASE, LEDGER), /someone-else/);
  });
});

describe('readChunk', () => {
  it('reproduces every entries_root and keeps signed_at to the microsecond', async () => {
    const rows = await allRows();
    expect(rows).toHaveLength(41);
    expect(rows[0]).toMatchObject({
      id: `${LEDGER}_1_public:scitt.entry_6e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d`,
      sequenceNo: 1,
      transactionId: '2.1',
      subject: 'pkg:npm/example-1@1.0.1',
      signedAt: '2026-09-21T14:13:30.000000Z',
    });
  });

  it('rejects a chunk file that does not match its digest', async () => {
    const manifest = await loadManifest(BASE, LEDGER);
    const bytes = files.get(file('chunks/ledger_41-45.parquet'))!;
    bytes[100] ^= 0xff;
    await expectIntegrityError(readChunk(BASE, LEDGER, manifest.chunks[4]), /ledger_41-45\.parquet does not match its digest/);
  });

  it('rejects a chunk file whose metadata disagrees with its manifest entry', async () => {
    const manifest = await loadManifest(BASE, LEDGER);
    const chunk = { ...manifest.chunks[4], entries_root: manifest.chunks[3].entries_root };
    await expectIntegrityError(readChunk(BASE, LEDGER, chunk), /metadata entries_root/);
  });
});

describe('searchParquetIndex', () => {
  it('pages newest first without repeating or skipping entries', async () => {
    const seen: number[] = [];
    let before: number | null = null;
    const pageSizes: number[] = [];
    do {
      const page = await searchParquetIndex(BASE, LEDGER, 'subject', 'example', before);
      pageSizes.push(page.entries.length);
      seen.push(...page.entries.map((e) => e.sequenceNo));
      before = page.nextBefore;
    } while (before !== null);
    expect(pageSizes).toEqual([20, 20, 1]);
    expect(seen).toEqual([...seen].sort((a, b) => b - a));
    expect(new Set(seen).size).toBe(41);
  });

  it('reads only the newest chunks needed for the first page', async () => {
    const page = await searchParquetIndex(BASE, LEDGER, 'subject', 'example', null, {}, 5);
    expect(page.entries.map((e) => e.sequenceNo)).toEqual([45, 44, 43, 42, 41]);
    expect(page.nextBefore).toBe(41);
    // The tail chunk (5 rows) plus one more to learn that another page exists.
    expect(page.snapshot).toMatchObject({ source: 'parquet', chunksRead: 2, canonicalSeqno: 45, chunkCount: 5 });
    expect(requested.filter((u) => u.endsWith('.parquet'))).toHaveLength(2);
  });

  it('matches issuer and subject as case-sensitive substrings', async () => {
    const rows = await allRows();
    const issuer = 'did:x509:0:sha256:fixture1::subject:CN:issuer-1';
    const page = await searchParquetIndex(BASE, LEDGER, 'issuer', 'fixture1');
    expect(page.entries.map((e) => e.sequenceNo)).toEqual(
      rows.filter((r) => r.issuer === issuer).map((r) => r.sequenceNo).reverse(),
    );
    expect((await searchParquetIndex(BASE, LEDGER, 'issuer', 'FIXTURE1')).entries).toEqual([]);
  });

  it('matches a payload hash exactly, whatever its case', async () => {
    const [row] = await allRows();
    const page = await searchParquetIndex(BASE, LEDGER, 'payloadHash', row.payloadHash!.toUpperCase());
    expect(page.entries).toEqual([
      expect.objectContaining({ transactionId: row.transactionId, payloadHash: row.payloadHash }),
    ]);
    expect(page.nextBefore).toBeNull();
  });
});

describe('formatMicros', () => {
  it('formats like the emitter, including before the epoch', () => {
    expect(formatMicros(1_790_000_000_123_456n)).toBe('2026-09-21T14:13:20.123456Z');
    expect(formatMicros(0n)).toBe('1970-01-01T00:00:00.000000Z');
    expect(formatMicros(-1n)).toBe('1969-12-31T23:59:59.999999Z');
  });
});
