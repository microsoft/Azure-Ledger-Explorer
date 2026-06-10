/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */


/** Canonical export format identifiers. */
export type ExportFormat = 'csv' | 'json' | 'ndjson';

/** Row passed to the formatters: a plain dictionary of values. */
export type ExportRow = Record<string, unknown>;

/** Optional column ordering / header overrides. */
export interface ExportColumn {
  /** The key in the row object. */
  key: string;
  /** Optional display header (defaults to `key`). */
  header?: string;
}

/** Options for CSV output. */
export interface CsvOptions {
  /** Prepend UTF-8 BOM so Excel reads UTF-8 reliably. Default: true. */
  bom?: boolean;
  /** Sanitize formula-injection candidates (=, +, -, @, leading tab, CR). Default: true. */
  sanitizeFormulas?: boolean;
  /** Yield to the event loop every N rows during chunked assembly. Default: 5000. */
  chunkSize?: number;
}

/** Options for JSON output. */
export interface JsonOptions {
  /** Pretty-print (2-space indent). Default: true. */
  pretty?: boolean;
}

const DEFAULT_CHUNK_SIZE = 5000;
const CSV_LINE_END = '\r\n'; // RFC 4180
const UTF8_BOM = '\uFEFF';

const FORMULA_TRIGGER_PATTERN = /^[=+\-@\t\r]/;

/**
 * Normalize an unknown value into something all three formatters can emit.
 *
 * Returns a JSON-serializable value (string | number | boolean | null | Array | plain object).
 * - BigInt -> decimal string (preserves precision; JSON cannot serialize BigInt directly).
 * - Date -> ISO-8601 string.
 * - Uint8Array / ArrayBuffer -> lowercase hex string.
 * - undefined -> null (so JSON.stringify doesn't drop the key).
 * - Plain objects / arrays are recursed.
 * - Anything else (numbers, booleans, strings, null) is returned as-is.
 */
export function normalizeExportValue(value: unknown): unknown {
  if (value === undefined) return null;
  if (value === null) return null;

  // Primitives that JSON handles natively.
  const t = typeof value;
  if (t === 'number' || t === 'boolean' || t === 'string') return value;

  if (t === 'bigint') return (value as bigint).toString(10);

  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isNaN(time) ? null : value.toISOString();
  }

  if (value instanceof Uint8Array) return uint8ToHex(value);
  if (value instanceof ArrayBuffer) return uint8ToHex(new Uint8Array(value));

  // Recurse into arrays and plain objects.
  if (Array.isArray(value)) return value.map(normalizeExportValue);

  if (t === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = normalizeExportValue(v);
    }
    return out;
  }

  // functions, symbols, etc. — drop them.
  return null;
}

function uint8ToHex(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) {
    const h = bytes[i].toString(16);
    s += h.length === 1 ? '0' + h : h;
  }
  return s;
}

/**
 * Convert a normalized value to a CSV cell string.
 *
 * For objects / arrays, emit JSON; otherwise emit the value's string form.
 * `null` becomes the empty string. The caller is responsible for quoting.
 */
function valueToCsvText(normalized: unknown): string {
  if (normalized === null) return '';
  if (typeof normalized === 'string') return normalized;
  if (typeof normalized === 'number' || typeof normalized === 'boolean') {
    return String(normalized);
  }
  // arrays / objects -> compact JSON
  return JSON.stringify(normalized);
}

/**
 * Defend against spreadsheet formula injection.
 *
 * Excel / Google Sheets evaluate cells beginning with `=`, `+`, `-`, `@`,
 * a leading tab (`\t`), or a leading CR (`\r`) as formulas. Prefix such
 * cells with a single quote so they are treated as text.
 */
export function sanitizeSpreadsheetCell(cell: string): string {
  if (!cell) return cell;
  return FORMULA_TRIGGER_PATTERN.test(cell) ? `'${cell}` : cell;
}

/**
 * Apply RFC 4180 quoting: wrap in double quotes and double internal quotes
 * if the cell contains `,`, `"`, CR, or LF. Otherwise return the cell raw.
 */
function csvEscape(cell: string): string {
  if (cell === '') return '';
  if (/[",\r\n]/.test(cell)) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

/**
 * Resolve the column list from an explicit list or by scanning the rows.
 *
 * When `columns` is omitted, the column order is the union of all keys in
 * insertion order from the first time each key is seen.
 */
function resolveColumns(
  rows: readonly ExportRow[],
  columns?: readonly ExportColumn[]
): ExportColumn[] {
  if (columns && columns.length > 0) return columns.map((c) => ({ ...c }));
  const seen: ExportColumn[] = [];
  const seenKeys = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        seen.push({ key });
      }
    }
  }
  return seen;
}

/**
 * Format an array of rows as RFC 4180 CSV (CRLF line endings).
 *
 * Synchronous; for very large rowsets prefer {@link toCsvAsync} which yields
 * to the event loop between chunks.
 */
export function toCsv(
  rows: readonly ExportRow[],
  columns?: readonly ExportColumn[],
  options: CsvOptions = {}
): string {
  const { bom = true, sanitizeFormulas = true } = options;
  const cols = resolveColumns(rows, columns);
  const parts: string[] = [];
  if (bom) parts.push(UTF8_BOM);
  parts.push(buildCsvHeader(cols));
  for (const row of rows) {
    parts.push(buildCsvRow(row, cols, sanitizeFormulas));
  }
  return parts.join('');
}

/**
 * Async variant that yields between chunks of `chunkSize` rows so the main
 * thread can paint / handle input during very large exports.
 */
export async function toCsvAsync(
  rows: readonly ExportRow[],
  columns?: readonly ExportColumn[],
  options: CsvOptions = {}
): Promise<string> {
  const { bom = true, sanitizeFormulas = true, chunkSize = DEFAULT_CHUNK_SIZE } = options;
  const cols = resolveColumns(rows, columns);
  const parts: string[] = [];
  if (bom) parts.push(UTF8_BOM);
  parts.push(buildCsvHeader(cols));
  for (let i = 0; i < rows.length; i++) {
    parts.push(buildCsvRow(rows[i], cols, sanitizeFormulas));
    if ((i + 1) % chunkSize === 0) {
      await yieldToEventLoop();
    }
  }
  return parts.join('');
}

function buildCsvHeader(columns: readonly ExportColumn[]): string {
  return (
    columns
      .map((c) => csvEscape(c.header ?? c.key))
      .join(',') + CSV_LINE_END
  );
}

function buildCsvRow(
  row: ExportRow,
  columns: readonly ExportColumn[],
  sanitizeFormulas: boolean
): string {
  const cells: string[] = [];
  for (const col of columns) {
    const normalized = normalizeExportValue(row[col.key]);
    let text = valueToCsvText(normalized);
    if (sanitizeFormulas) text = sanitizeSpreadsheetCell(text);
    cells.push(csvEscape(text));
  }
  return cells.join(',') + CSV_LINE_END;
}

/** Convert rows to NDJSON: one normalized JSON object per line, `\n`-separated. */
export function toNdjson(rows: readonly ExportRow[]): string {
  const parts: string[] = [];
  for (const row of rows) {
    parts.push(JSON.stringify(normalizeExportValue(row)));
    parts.push('\n');
  }
  return parts.join('');
}

/** Async chunked variant of {@link toNdjson}. */
export async function toNdjsonAsync(
  rows: readonly ExportRow[],
  chunkSize = DEFAULT_CHUNK_SIZE
): Promise<string> {
  const parts: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    parts.push(JSON.stringify(normalizeExportValue(rows[i])));
    parts.push('\n');
    if ((i + 1) % chunkSize === 0) {
      await yieldToEventLoop();
    }
  }
  return parts.join('');
}

/** Convert rows to a JSON document (array of normalized objects). */
export function toJson(
  rows: readonly ExportRow[],
  options: JsonOptions = {}
): string {
  const { pretty = true } = options;
  const normalized = rows.map(normalizeExportValue);
  return JSON.stringify(normalized, null, pretty ? 2 : 0);
}

/**
 * Make a filesystem-safe slug: lowercase, ASCII alnum + `-`, max 64 chars.
 * Empty / non-string inputs become `untitled`.
 */
export function slugify(input: string | null | undefined): string {
  if (typeof input !== 'string' || input.length === 0) return 'untitled';
  const slug = input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 64);
  return slug || 'untitled';
}

/** Format a Date as `YYYYMMDD-HHmm` in UTC. */
export function formatTimestamp(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = date.getUTCFullYear();
  const m = pad(date.getUTCMonth() + 1);
  const d = pad(date.getUTCDate());
  const h = pad(date.getUTCHours());
  const min = pad(date.getUTCMinutes());
  return `${y}${m}${d}-${h}${min}`;
}

/** Build a deterministic export filename. */
export function buildExportFilename(
  surface: string,
  slug: string | null | undefined,
  format: ExportFormat | 'md',
  date: Date = new Date()
): string {
  const ts = formatTimestamp(date);
  const safeSurface = slugify(surface);
  const safeSlug = slugify(slug);
  return `${safeSurface}-${safeSlug}-${ts}.${format}`;
}

/** Yield once to the event loop. Microtask-deferred enough to let paint run. */
function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof queueMicrotask === 'function') {
      // setTimeout(0) lets the browser handle paint/input; microtask alone does not.
      setTimeout(resolve, 0);
    } else {
      setTimeout(resolve, 0);
    }
  });
}

/** MIME type for each export format. */
export function mimeFor(format: ExportFormat | 'md'): string {
  switch (format) {
    case 'csv':
      return 'text/csv;charset=utf-8';
    case 'json':
      return 'application/json;charset=utf-8';
    case 'ndjson':
      return 'application/x-ndjson;charset=utf-8';
    case 'md':
      return 'text/markdown;charset=utf-8';
  }
}
