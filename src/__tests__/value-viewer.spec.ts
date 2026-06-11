/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { describe, it, expect } from 'vitest';
import { unwrapJsonEncodedString } from '../utils/ccf-value-decoding';

describe('unwrapJsonEncodedString', () => {
  it('returns plain text untouched when not a JSON-quoted string', () => {
    expect(unwrapJsonEncodedString('const x = 1;')).toBe('const x = 1;');
  });

  it('returns empty input untouched', () => {
    expect(unwrapJsonEncodedString('')).toBe('');
  });

  it('unescapes a JSON-encoded JS module (constitution-style)', () => {
    // Represents the ledger bytes: a JSON string literal containing JS source
    // with a regex (\s), escaped quotes, a backslash literal, a newline and a tab.
    const source = 'const r = /\\s+/;\nconst q = "a\\\\b";\n\tx';
    const onLedger = JSON.stringify(source);

    const result = unwrapJsonEncodedString(onLedger);

    expect(result).toBe(source);
    // Sanity: the regex backslash must survive as a single backslash.
    expect(result).toContain('/\\s+/');
    // The doubled backslash inside the string literal must remain doubled
    // (it was a literal `\\` in source), not be collapsed to a single one.
    expect(result).toContain('"a\\\\b"');
  });

  it('unescapes a JSON-encoded JSON string (double-encoded JSON)', () => {
    const innerJson = '{"a":"b\\\\c","d":"e\\"f"}';
    const onLedger = JSON.stringify(innerJson);

    const result = unwrapJsonEncodedString(onLedger);

    expect(result).toBe(innerJson);
    // Result is valid JSON we can re-parse.
    expect(JSON.parse(result)).toEqual({ a: 'b\\c', d: 'e"f' });
  });

  it('does not collapse \\\\n into a raw newline (regression for greedy regex bug)', () => {
    // Ledger value: the JS source text `\n` (backslash + n), JSON-encoded.
    const source = 'a\\nb'; // 4 chars: a, \, n, b
    const onLedger = JSON.stringify(source); // -> "a\\nb"

    const result = unwrapJsonEncodedString(onLedger);

    expect(result).toBe(source);
    expect(result).not.toContain('\n');
  });

  it('returns the original text when JSON parsing fails', () => {
    // Starts and ends with a quote but is not valid JSON.
    const malformed = '"unterminated';
    expect(unwrapJsonEncodedString(malformed)).toBe(malformed);
  });

  it('returns the original text when the JSON value is not a string', () => {
    // Quoted on both ends but parses to an array, not a string.
    const arrayLike = '[1,2,3]';
    expect(unwrapJsonEncodedString(arrayLike)).toBe(arrayLike);
  });
});
