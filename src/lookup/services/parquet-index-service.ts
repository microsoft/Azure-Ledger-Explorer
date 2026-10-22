/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { parquetMetadata, parquetReadObjects } from 'hyparquet';
import { compressors } from 'hyparquet-compressors';
import type { IndexedEntry, IndexSearchBy, IndexSearchPage, LookupErrorKind } from '../types/lookup-types';
import { LookupError } from './mst-lookup-service';

/**
 * Search a ledger's Parquet index (`mst.index.parquet.v1`) in the browser.
 *
 * The emitter publishes, per ledger, under `{base}/{ledger}/v1/`:
 * - `manifest/head.json`: the mutable head, listing sealed segments, the open
 *   tail of chunk entries, and `manifest_root`.
 * - `manifest/seg-NNNNNN.json`: immutable, sealed groups of chunk entries.
 * - `chunks/ledger_{start}-{end}.parquet`: one immutable file per committed
 *   ledger chunk.
 *
 * Every byte read is checked against the manifest before it is used: segment
 * and chunk-file SHA-256, the per-chunk `entries_root` recomputed from the rows
 * read, and `manifest_root` recomputed from the chunk list. That proves the
 * index is internally consistent and unmodified since it was published. It
 * does not yet prove the ledger vouches for it (no attestation), so results
 * remain unverified pointers until an entry is opened and verified.
 */

export const PARQUET_SCHEMA = 'mst.index.parquet.v1';
export const MANIFEST_SCHEMA = 'mst.index.manifest.v1';

/** Rows shown per page. */
export const PARQUET_PAGE_SIZE = 20;

/** One chunk entry in the manifest (head tail or sealed segment). */
export interface ManifestChunk {
  chunk_name: string;
  start_seqno: number;
  end_seqno: number;
  file: string;
  file_sha256: string;
  file_bytes: number;
  row_count: number;
  repr_sha256: string;
  entries_root: string;
}

interface ManifestSegment {
  file: string;
  sha256: string;
  first_seqno: number;
  last_seqno: number;
  chunk_count: number;
}

interface ManifestHead {
  schema: string;
  ledger_id: string;
  segments: ManifestSegment[];
  tail: ManifestChunk[];
  canonical_seqno: number;
  chunk_count: number;
  entries_count: number;
  manifest_root: string;
  latest_attestation: unknown;
  updated_at: string;
}

/** A verified manifest: every chunk the index covers, oldest first. */
export interface VerifiedManifest {
  ledgerId: string;
  chunks: ManifestChunk[];
  canonicalSeqno: number;
  entriesCount: number;
  manifestRoot: string;
  updatedAt: string;
  attested: boolean;
}

/** One index row, with the fields `entries_root` commits to. */
export interface ParquetIndexRow {
  id: string;
  sequenceNo: number;
  transactionId: string;
  statementHash: string | null;
  issuer: string | null;
  subject: string | null;
  contentType: string | null;
  signedAt: string | null;
  payloadHash: string | null;
}

export interface ParquetFetchOptions {
  signal?: AbortSignal;
}

// ---- hashing and canonical JSON (must match the emitter byte for byte) --------------

function hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(data: ArrayBuffer | Uint8Array): Promise<string> {
  return hex(await globalThis.crypto.subtle.digest('SHA-256', data as BufferSource));
}

/**
 * `sha256:` + hex SHA-256 of JSON with no whitespace. The emitter serialises
 * with Python `json.dumps(sort_keys=True, separators=(",", ":"),
 * ensure_ascii=False)`; `JSON.stringify` escapes strings the same way, so
 * callers only need to build objects with their keys already sorted.
 */
async function sha256Tag(value: unknown): Promise<string> {
  return `sha256:${await sha256Hex(new TextEncoder().encode(JSON.stringify(value)))}`;
}

const byCodeUnit = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** The per-chunk commitment over every field a search result shows. */
export function computeEntriesRoot(rows: ParquetIndexRow[]): Promise<string> {
  const leaves = rows
    .map((r) => [r.id, r.transactionId, r.statementHash, r.issuer, r.subject, r.contentType, r.signedAt, r.payloadHash])
    .sort((a, b) => byCodeUnit(a[0] as string, b[0] as string));
  return sha256Tag(leaves);
}

/** The commitment over the ordered chunk list. */
export function computeManifestRoot(ledgerId: string, chunks: ManifestChunk[]): Promise<string> {
  return sha256Tag({
    chunks: chunks.map((c) => ({
      chunk_name: c.chunk_name,
      end_seqno: c.end_seqno,
      entries_count: c.row_count,
      entries_root: c.entries_root,
      repr_sha256: c.repr_sha256,
      start_seqno: c.start_seqno,
    })),
    ledger_id: ledgerId,
  });
}

/** Microseconds since the epoch as the emitter's fixed-width `%Y-%m-%dT%H:%M:%S.%fZ`. */
export function formatMicros(micros: bigint): string {
  let seconds = micros / 1_000_000n;
  let fraction = micros % 1_000_000n;
  if (fraction < 0n) {
    fraction += 1_000_000n;
    seconds -= 1n;
  }
  const whole = new Date(Number(seconds) * 1000).toISOString().slice(0, 19);
  return `${whole}.${fraction.toString().padStart(6, '0')}Z`;
}

// ---- fetching ---------------------------------------------------------------------------

function integrityError(message: string): LookupError {
  return new LookupError('integrity', 'search', `The ledger index failed verification: ${message}`);
}

function kindForStatus(status: number): LookupErrorKind {
  if (status === 401 || status === 403) return 'accessDenied';
  if (status === 404) return 'notFound';
  if (status === 503) return 'unavailable';
  return 'http';
}

async function fetchIndexFile(url: string, what: string, options: ParquetFetchOptions, revalidate = false): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, { signal: options.signal, credentials: 'omit', cache: revalidate ? 'no-cache' : 'default' });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new LookupError(
      'network',
      'search',
      'Could not reach the ledger index storage. It may be unreachable, or it may not allow requests ' +
        'from this site (CORS).',
    );
  }
  if (response.ok) return response;
  const message =
    response.status === 401 || response.status === 403
      ? 'The ledger index storage refused the request. It does not allow anonymous reads from this site.'
      : `Fetching the ledger index ${what} failed with HTTP ${response.status}.`;
  throw new LookupError(kindForStatus(response.status), 'search', message, response.status);
}

function indexRoot(base: string, ledger: string): string {
  return `${base.replace(/\/+$/, '')}/${encodeURIComponent(ledger)}/v1`;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isSafeInt = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v);

function checkChunk(c: unknown): ManifestChunk {
  if (
    !isObject(c) ||
    typeof c.chunk_name !== 'string' ||
    !isSafeInt(c.start_seqno) ||
    !isSafeInt(c.end_seqno) ||
    typeof c.file !== 'string' ||
    !/^chunks\/[\w.-]+\.parquet$/.test(c.file) ||
    typeof c.file_sha256 !== 'string' ||
    !isSafeInt(c.file_bytes) ||
    !isSafeInt(c.row_count) ||
    typeof c.repr_sha256 !== 'string' ||
    typeof c.entries_root !== 'string'
  ) {
    throw new LookupError('malformed', 'search', 'The ledger index manifest has an invalid chunk entry.');
  }
  return c as unknown as ManifestChunk;
}

/**
 * Fetch and verify the manifest: the head, every sealed segment it lists, the
 * chunk list's continuity, and `manifest_root`.
 *
 * Sealed segments are immutable, so a verified one is cached for the session.
 */
export async function loadManifest(
  base: string,
  ledger: string,
  options: ParquetFetchOptions = {},
): Promise<VerifiedManifest> {
  const root = indexRoot(base, ledger);
  let head: ManifestHead;
  try {
    head = (await (await fetchIndexFile(`${root}/manifest/head.json`, 'manifest', options, true)).json()) as ManifestHead;
  } catch (error) {
    if (error instanceof LookupError && error.kind === 'notFound') {
      throw new LookupError(
        'notIndexed',
        'search',
        'No Parquet index has been published for this ledger, so it cannot be searched by issuer, ' +
          'subject or payload hash. Check the ledger name, or look entries up by transaction ID instead.',
        404,
      );
    }
    if (error instanceof LookupError || options.signal?.aborted) throw error;
    throw new LookupError('malformed', 'search', 'The ledger index manifest is not valid JSON.');
  }
  if (!isObject(head) || head.schema !== MANIFEST_SCHEMA) {
    throw new LookupError('malformed', 'search', `The ledger index manifest is not ${MANIFEST_SCHEMA}.`);
  }
  if (head.ledger_id !== ledger) {
    throw integrityError(`the manifest is for ledger "${String(head.ledger_id)}".`);
  }
  if (!Array.isArray(head.segments) || !Array.isArray(head.tail)) {
    throw new LookupError('malformed', 'search', 'The ledger index manifest has no chunk list.');
  }

  const chunks: ManifestChunk[] = [];
  for (const segment of head.segments) {
    chunks.push(...(await loadSegment(root, ledger, segment, options)));
  }
  chunks.push(...head.tail.map(checkChunk));

  for (let i = 1; i < chunks.length; i++) {
    if (chunks[i].start_seqno !== chunks[i - 1].end_seqno + 1) {
      throw integrityError(`gap or overlap between ${chunks[i - 1].chunk_name} and ${chunks[i].chunk_name}.`);
    }
  }
  const lastSeqno = chunks.length ? chunks[chunks.length - 1].end_seqno : 0;
  if (head.canonical_seqno !== lastSeqno) throw integrityError('canonical_seqno does not match the last chunk.');
  if (head.chunk_count !== chunks.length) throw integrityError('chunk_count does not match the chunk list.');
  const entriesCount = chunks.reduce((n, c) => n + c.row_count, 0);
  if (head.entries_count !== entriesCount) throw integrityError('entries_count does not match the chunk list.');
  if ((await computeManifestRoot(ledger, chunks)) !== head.manifest_root) {
    throw integrityError('manifest_root does not match the chunk list.');
  }

  return {
    ledgerId: ledger,
    chunks,
    canonicalSeqno: head.canonical_seqno,
    entriesCount,
    manifestRoot: head.manifest_root,
    updatedAt: typeof head.updated_at === 'string' ? head.updated_at : '',
    attested: false,
  };
}

const segmentCache = new Map<string, ManifestChunk[]>();

async function loadSegment(
  root: string,
  ledger: string,
  segment: ManifestSegment,
  options: ParquetFetchOptions,
): Promise<ManifestChunk[]> {
  if (!isObject(segment) || typeof segment.file !== 'string' || !/^manifest\/seg-\d+\.json$/.test(segment.file)) {
    throw new LookupError('malformed', 'search', 'The ledger index manifest has an invalid segment entry.');
  }
  const key = `${root}/${segment.file}#${segment.sha256}`;
  const cached = segmentCache.get(key);
  if (cached) return cached;

  const bytes = await (await fetchIndexFile(`${root}/${segment.file}`, 'manifest segment', options)).arrayBuffer();
  if ((await sha256Hex(bytes)) !== segment.sha256) throw integrityError(`${segment.file} does not match its digest.`);
  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new LookupError('malformed', 'search', `${segment.file} is not valid JSON.`);
  }
  if (!isObject(body) || body.schema !== MANIFEST_SCHEMA || body.ledger_id !== ledger || !Array.isArray(body.chunks)) {
    throw integrityError(`${segment.file} is not a segment of this ledger's manifest.`);
  }
  const chunks = body.chunks.map(checkChunk);
  if (
    chunks.length !== segment.chunk_count ||
    chunks[0]?.start_seqno !== segment.first_seqno ||
    chunks[chunks.length - 1]?.end_seqno !== segment.last_seqno
  ) {
    throw integrityError(`${segment.file} does not match its manifest entry.`);
  }
  segmentCache.set(key, chunks);
  return chunks;
}

/** Verified chunk files are immutable; keep the most recently used ones. */
const CHUNK_CACHE_LIMIT = 64;
const chunkCache = new Map<string, ParquetIndexRow[]>();

function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

/**
 * Fetch one chunk file, check it against its manifest entry, and return its
 * rows in file order (ascending sequence number).
 */
export async function readChunk(
  base: string,
  ledger: string,
  chunk: ManifestChunk,
  options: ParquetFetchOptions = {},
): Promise<ParquetIndexRow[]> {
  const root = indexRoot(base, ledger);
  const key = `${root}/${chunk.file}#${chunk.file_sha256}`;
  const cached = chunkCache.get(key);
  if (cached) {
    chunkCache.delete(key);
    chunkCache.set(key, cached);
    return cached;
  }

  const buffer = await (await fetchIndexFile(`${root}/${chunk.file}`, 'chunk file', options)).arrayBuffer();
  if (buffer.byteLength !== chunk.file_bytes || (await sha256Hex(buffer)) !== chunk.file_sha256) {
    throw integrityError(`${chunk.file} does not match its digest.`);
  }

  let meta: Record<string, string>;
  let raw: Record<string, unknown>[];
  try {
    const metadata = parquetMetadata(buffer);
    meta = Object.fromEntries((metadata.key_value_metadata ?? []).map((kv) => [kv.key, kv.value ?? '']));
    raw = (await parquetReadObjects({
      file: buffer,
      metadata,
      compressors,
      rowFormat: 'object',
      // Keep microseconds: entries_root commits to them, and a Date drops them.
      parsers: { timestampFromMicroseconds: (micros: bigint) => micros },
    })) as Record<string, unknown>[];
  } catch (error) {
    throw new LookupError(
      'malformed',
      'search',
      `${chunk.file} could not be read: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (meta['mst.schema'] !== PARQUET_SCHEMA) {
    throw new LookupError('malformed', 'search', `${chunk.file} is not ${PARQUET_SCHEMA}.`);
  }
  for (const [k, expected] of [
    ['ledger_id', ledger],
    ['chunk_name', chunk.chunk_name],
    ['entries_root', chunk.entries_root],
    ['repr_sha256', chunk.repr_sha256],
  ] as const) {
    if (meta[k] !== expected) throw integrityError(`${chunk.file} metadata ${k} does not match the manifest.`);
  }

  const rows = raw.map((r): ParquetIndexRow => {
    const seq = r.sequence_no;
    const sequenceNo = typeof seq === 'bigint' ? Number(seq) : (seq as number);
    const signedAt = r.signed_at;
    return {
      id: `${ledger}_${sequenceNo}_${String(r.map_name)}_${String(r.key_hash)}`,
      sequenceNo,
      transactionId: String(r.transaction_id),
      statementHash: str(r.statement_hash),
      issuer: str(r.issuer),
      subject: str(r.subject),
      contentType: str(r.content_type),
      signedAt: typeof signedAt === 'bigint' ? formatMicros(signedAt) : null,
      payloadHash: str(r.payload_hash),
    };
  });
  if (rows.length !== chunk.row_count) throw integrityError(`${chunk.file} has the wrong number of rows.`);
  if (rows.some((r) => !(r.sequenceNo >= chunk.start_seqno && r.sequenceNo <= chunk.end_seqno))) {
    throw integrityError(`${chunk.file} has rows outside its chunk.`);
  }
  if ((await computeEntriesRoot(rows)) !== chunk.entries_root) {
    throw integrityError(`${chunk.file} rows do not match entries_root.`);
  }

  chunkCache.set(key, rows);
  if (chunkCache.size > CHUNK_CACHE_LIMIT) chunkCache.delete(chunkCache.keys().next().value as string);
  return rows;
}

/** For tests: forget cached segments and chunk files. */
export function clearParquetIndexCache(): void {
  segmentCache.clear();
  chunkCache.clear();
}

// ---- search -----------------------------------------------------------------------------

export function matches(by: IndexSearchBy, value: string, row: ParquetIndexRow): boolean {
  switch (by) {
    case 'issuer':
      return row.issuer?.includes(value) ?? false;
    case 'subject':
      return row.subject?.includes(value) ?? false;
    case 'payloadHash':
      return row.payloadHash?.toLowerCase() === value.toLowerCase();
  }
}

function toEntry(row: ParquetIndexRow): IndexedEntry {
  return {
    sequenceNo: row.sequenceNo,
    transactionId: row.transactionId,
    issuer: row.issuer,
    subject: row.subject,
    signedAt: row.signedAt,
    payloadHash: row.payloadHash,
  };
}

/**
 * Search one ledger's Parquet index, newest first, a page at a time.
 *
 * Chunks are read newest first and only as far as needed to fill the page and
 * learn whether another exists. Rows sharing a sequence number stay on one page.
 *
 * @param before - Return only entries with a lower sequence number, or `null`
 *   for the first page.
 */
export async function searchParquetIndex(
  base: string,
  ledger: string,
  by: IndexSearchBy,
  value: string,
  before: number | null = null,
  options: ParquetFetchOptions = {},
  pageSize = PARQUET_PAGE_SIZE,
): Promise<IndexSearchPage> {
  const manifest = await loadManifest(base, ledger, options);
  const candidates = manifest.chunks.filter((c) => before === null || c.start_seqno < before).reverse();

  const found: IndexedEntry[] = [];
  let chunksRead = 0;
  for (const chunk of candidates) {
    const rows = await readChunk(base, ledger, chunk, options);
    chunksRead++;
    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i];
      if ((before === null || row.sequenceNo < before) && matches(by, value, row)) found.push(toEntry(row));
    }
    // Enough once a match exists below the last sequence number on the page.
    if (found.length > pageSize && found[found.length - 1].sequenceNo < found[pageSize - 1].sequenceNo) break;
  }

  let end = Math.min(pageSize, found.length);
  while (end < found.length && found[end].sequenceNo === found[end - 1].sequenceNo) end++;
  const entries = found.slice(0, end);
  const more = end < found.length;
  return {
    entries,
    nextBefore: more ? entries[entries.length - 1].sequenceNo : null,
    snapshot: {
      source: 'parquet',
      canonicalSeqno: manifest.canonicalSeqno,
      entriesCount: manifest.entriesCount,
      chunkCount: manifest.chunks.length,
      chunksRead,
      manifestRoot: manifest.manifestRoot,
      updatedAt: manifest.updatedAt,
      attested: manifest.attested,
    },
  };
}
