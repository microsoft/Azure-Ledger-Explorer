/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { describe, expect, it } from 'vitest';
import { readParams } from '../../lookup/hooks/use-mst-lookup';

describe('readParams', () => {
  it('reads a valid ledger and transaction ID', () => {
    const p = readParams('?ledger=my-ledger&tx=2.15');
    expect(p.ledger).toBe('my-ledger');
    expect(p.entry).toEqual({ by: 'txId', value: '2.15' });
    expect(p.invalid).toBe(false);
  });

  it('keeps an invalid entry as a draft so the form can show it', () => {
    const p = readParams('?ledger=my-ledger&tx=15');
    expect(p.entry).toBeNull();
    expect(p.draft.entry).toEqual({ by: 'txId', value: '15' });
    expect(p.invalid).toBe(true);
  });

  it('keeps an invalid ledger as a draft', () => {
    const p = readParams('?ledger=not%20a%20ledger&tx=2.15');
    expect(p.ledger).toBeNull();
    expect(p.draft.ledger).toBe('not a ledger');
    expect(p.invalid).toBe(true);
  });

  it('treats an empty URL as idle, not invalid', () => {
    expect(readParams('').invalid).toBe(false);
  });
});
