/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { describe, it, expect } from 'vitest';
import {
  toCsv,
  toCsvAsync,
  toNdjson,
  toNdjsonAsync,
  toJson,
  normalizeExportValue,
  sanitizeSpreadsheetCell,
  slugify,
  formatTimestamp,
  buildExportFilename,
  mimeFor,
} from '../utils/export';

describe('normalizeExportValue', () => {
  it('preserves JSON-native primitives', () => {
    expect(normalizeExportValue(42)).toBe(42);
    expect(normalizeExportValue('hi')).toBe('hi');
    expect(normalizeExportValue(true)).toBe(true);
    expect(normalizeExportValue(false)).toBe(false);
  });

  it('coerces null and undefined to null', () => {
    expect(normalizeExportValue(null)).toBeNull();
    expect(normalizeExportValue(undefined)).toBeNull();
  });

  it('serializes BigInt as a decimal string', () => {
    expect(normalizeExportValue(123n)).toBe('123');
    expect(normalizeExportValue(2n ** 64n)).toBe('18446744073709551616');
  });

  it('serializes Date as ISO-8601', () => {
    const d = new Date('2026-05-04T12:00:00.000Z');
    expect(normalizeExportValue(d)).toBe('2026-05-04T12:00:00.000Z');
  });

  it('returns null for an invalid Date', () => {
    expect(normalizeExportValue(new Date('not a date'))).toBeNull();
  });

  it('serializes Uint8Array as lowercase hex', () => {
    expect(normalizeExportValue(new Uint8Array([0, 1, 15, 16, 254, 255]))).toBe(
      '00010f10feff'
    );
  });

  it('serializes ArrayBuffer as lowercase hex', () => {
    const buf = new Uint8Array([0xab, 0xcd]).buffer;
    expect(normalizeExportValue(buf)).toBe('abcd');
  });

  it('recurses into arrays and plain objects', () => {
    const out = normalizeExportValue({
      a: 1n,
      b: [new Date('2026-01-01T00:00:00.000Z'), null],
      c: { d: new Uint8Array([0xff]) },
    });
    expect(out).toEqual({
      a: '1',
      b: ['2026-01-01T00:00:00.000Z', null],
      c: { d: 'ff' },
    });
  });

  it('drops functions and symbols', () => {
    expect(normalizeExportValue(() => 0)).toBeNull();
    expect(normalizeExportValue(Symbol('s'))).toBeNull();
  });
});

describe('sanitizeSpreadsheetCell', () => {
  const triggers = ['=', '+', '-', '@', '\t', '\r'];
  it.each(triggers)('prefixes a cell starting with %j with a single quote', (t) => {
    expect(sanitizeSpreadsheetCell(`${t}SUM(A1:A2)`)).toBe(`'${t}SUM(A1:A2)`);
  });

  it('leaves a benign cell unchanged', () => {
    expect(sanitizeSpreadsheetCell('hello, world')).toBe('hello, world');
    expect(sanitizeSpreadsheetCell('123')).toBe('123');
  });

  it('handles the empty string', () => {
    expect(sanitizeSpreadsheetCell('')).toBe('');
  });
});

describe('toCsv', () => {
  it('emits header + rows separated by CRLF', () => {
    const csv = toCsv([{ a: 1, b: 'two' }, { a: 3, b: 'four' }]);
    expect(csv).toBe('\uFEFFa,b\r\n1,two\r\n3,four\r\n');
  });

  it('includes BOM exactly once when bom=true (default)', () => {
    const csv = toCsv([{ a: 1 }]);
    const bomCount = (csv.match(/\uFEFF/g) || []).length;
    expect(bomCount).toBe(1);
    expect(csv.startsWith('\uFEFF')).toBe(true);
  });

  it('omits BOM when bom=false', () => {
    const csv = toCsv([{ a: 1 }], undefined, { bom: false });
    expect(csv.startsWith('\uFEFF')).toBe(false);
  });

  it('quotes cells containing commas', () => {
    const csv = toCsv([{ a: 'hello, world' }], undefined, { bom: false });
    expect(csv).toBe('a\r\n"hello, world"\r\n');
  });

  it('escapes embedded double quotes by doubling them', () => {
    const csv = toCsv([{ a: 'she said "hi"' }], undefined, { bom: false });
    expect(csv).toBe('a\r\n"she said ""hi"""\r\n');
  });

  it('quotes cells with embedded LF or CRLF', () => {
    const csv = toCsv([{ a: 'line1\nline2' }, { a: 'line1\r\nline2' }], undefined, {
      bom: false,
    });
    expect(csv).toBe('a\r\n"line1\nline2"\r\n"line1\r\nline2"\r\n');
  });

  it('sanitizes formula-injection candidates by default', () => {
    const csv = toCsv([{ formula: '=cmd|"evil"!A1' }], undefined, { bom: false });
    // The cell now begins with `'`, and the original `=` is preserved as text.
    // It also contains a `"` which forces RFC quoting.
    expect(csv).toContain(`"'=cmd|""evil""!A1"`);
  });

  it('skips formula sanitization when sanitizeFormulas=false', () => {
    const csv = toCsv([{ a: '=A1' }], undefined, {
      bom: false,
      sanitizeFormulas: false,
    });
    expect(csv).toBe('a\r\n=A1\r\n');
  });

  it('emits empty cell for null / undefined', () => {
    const csv = toCsv([{ a: null, b: undefined, c: 'x' }], undefined, { bom: false });
    expect(csv).toBe('a,b,c\r\n,,x\r\n');
  });

  it('serializes BigInt / Date / Uint8Array via normalizeExportValue', () => {
    const csv = toCsv(
      [{ big: 1n, when: new Date('2026-05-04T00:00:00.000Z'), bytes: new Uint8Array([0xff]) }],
      undefined,
      { bom: false }
    );
    expect(csv).toBe('big,when,bytes\r\n1,2026-05-04T00:00:00.000Z,ff\r\n');
  });

  it('emits compact JSON for nested objects / arrays', () => {
    const csv = toCsv([{ a: { b: 1, c: [2, 3] } }], undefined, { bom: false });
    expect(csv).toBe('a\r\n"{""b"":1,""c"":[2,3]}"\r\n');
  });

  it('honours explicit columns in order with custom headers', () => {
    const csv = toCsv(
      [{ a: 1, b: 2, c: 3 }],
      [
        { key: 'b', header: 'BEE' },
        { key: 'a' },
      ],
      { bom: false }
    );
    expect(csv).toBe('BEE,a\r\n2,1\r\n');
  });

  it('infers union of keys when columns are omitted', () => {
    const csv = toCsv(
      [
        { a: 1 },
        { a: 2, b: 3 },
      ],
      undefined,
      { bom: false }
    );
    expect(csv).toBe('a,b\r\n1,\r\n2,3\r\n');
  });

  it('handles unicode beyond BMP without corruption', () => {
    const csv = toCsv([{ a: 'résumé 𓂀' }], undefined, { bom: false });
    expect(csv).toBe('a\r\nrésumé 𓂀\r\n');
  });
});

describe('toCsvAsync', () => {
  it('matches toCsv output for the same input', async () => {
    const rows = Array.from({ length: 50 }, (_, i) => ({ i, label: `row ${i}` }));
    const sync = toCsv(rows, undefined, { bom: false });
    const async_ = await toCsvAsync(rows, undefined, { bom: false });
    expect(async_).toBe(sync);
  });
});

describe('toNdjson', () => {
  it('emits one JSON object per line ending in \\n', () => {
    const out = toNdjson([{ a: 1 }, { a: 2 }]);
    expect(out).toBe('{"a":1}\n{"a":2}\n');
  });

  it('escapes embedded newlines inside string values', () => {
    const out = toNdjson([{ a: 'line1\nline2' }]);
    // The newline inside the string is escaped by JSON.stringify, so the
    // record stays on one line.
    expect(out.split('\n').filter(Boolean)).toHaveLength(1);
    expect(out).toBe('{"a":"line1\\nline2"}\n');
  });

  it('serializes BigInt and Uint8Array', () => {
    const out = toNdjson([{ big: 99n, bytes: new Uint8Array([0xab]) }]);
    expect(out).toBe('{"big":"99","bytes":"ab"}\n');
  });

  it('handles an empty input array', () => {
    expect(toNdjson([])).toBe('');
  });
});

describe('toNdjsonAsync', () => {
  it('matches toNdjson output for the same input', async () => {
    const rows = Array.from({ length: 50 }, (_, i) => ({ i }));
    expect(await toNdjsonAsync(rows)).toBe(toNdjson(rows));
  });
});

describe('toJson', () => {
  it('produces a pretty array by default', () => {
    const out = toJson([{ a: 1 }]);
    expect(out).toBe('[\n  {\n    "a": 1\n  }\n]');
  });

  it('produces compact output when pretty=false', () => {
    expect(toJson([{ a: 1 }], { pretty: false })).toBe('[{"a":1}]');
  });

  it('serializes BigInt without throwing', () => {
    expect(() => toJson([{ a: 1n }])).not.toThrow();
    expect(toJson([{ a: 1n }], { pretty: false })).toBe('[{"a":"1"}]');
  });
});

describe('slugify', () => {
  it('lowercases and replaces non-alnum with hyphens', () => {
    expect(slugify('Hello, World!')).toBe('hello-world');
  });

  it('strips leading and trailing hyphens', () => {
    expect(slugify('---abc---')).toBe('abc');
  });

  it('caps at 64 characters', () => {
    const long = 'a'.repeat(200);
    expect(slugify(long)).toHaveLength(64);
  });

  it('returns "untitled" for empty / non-string', () => {
    expect(slugify('')).toBe('untitled');
    expect(slugify(null)).toBe('untitled');
    expect(slugify(undefined)).toBe('untitled');
  });

  it('strips diacritics so filenames stay ASCII', () => {
    expect(slugify('résumé')).toBe('resume');
  });
});

describe('formatTimestamp', () => {
  it('formats UTC date as YYYYMMDD-HHmm', () => {
    expect(formatTimestamp(new Date('2026-05-04T14:02:00.000Z'))).toBe('20260504-1402');
  });

  it('zero-pads single-digit components', () => {
    expect(formatTimestamp(new Date('2026-01-02T03:04:00.000Z'))).toBe('20260102-0304');
  });
});

describe('buildExportFilename', () => {
  it('produces a deterministic slug-based filename', () => {
    const f = buildExportFilename(
      'tables',
      'public:ccf.gov.members',
      'csv',
      new Date('2026-05-04T14:02:00.000Z')
    );
    expect(f).toBe('tables-public-ccf-gov-members-20260504-1402.csv');
  });

  it('handles md format for the verification report', () => {
    const f = buildExportFilename('verification-report', '', 'md', new Date('2026-05-04T00:00:00.000Z'));
    expect(f).toBe('verification-report-untitled-20260504-0000.md');
  });
});

describe('mimeFor', () => {
  it('returns the correct MIME for each format', () => {
    expect(mimeFor('csv')).toMatch(/^text\/csv/);
    expect(mimeFor('json')).toMatch(/^application\/json/);
    expect(mimeFor('ndjson')).toMatch(/^application\/x-ndjson/);
    expect(mimeFor('md')).toMatch(/^text\/markdown/);
  });
});
