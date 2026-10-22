/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

/// <reference types="node" />

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SCITT_WASM_VERSION } from '../../lookup/services/scitt-wasm-loader';

const vendorDir = resolve(__dirname, '../../lookup/vendor/scitt-wasm');
const readme = readFileSync(resolve(vendorDir, 'README.md'), 'utf8');

/** The value in the README's provenance table for a row whose label contains `label`. */
function tableValue(label: string): string {
  const row = readme.split('\n').find((line) => line.startsWith('|') && line.includes(label));
  expect(row, `README row for ${label}`).toBeDefined();
  return row!.split('|')[2].trim().replace(/`/g, '');
}

// The vendored verifier makes every trust decision on the page, so its bytes
// must be exactly the build the README records.
describe('vendored scitt-wasm', () => {
  it.each(['scitt_wasm_bg.wasm', 'scitt_wasm.js'])('%s matches the sha-256 in README.md', (file) => {
    const actual = createHash('sha256').update(readFileSync(resolve(vendorDir, file))).digest('hex');
    expect(actual).toBe(tableValue(`\`${file}\` sha-256`));
  });

  it('is the crate version the page expects', () => {
    expect(tableValue('Crate version')).toBe(SCITT_WASM_VERSION);
  });
});
