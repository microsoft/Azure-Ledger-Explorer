/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { download } from '../utils/download';

describe('download (jsdom)', () => {
  let createUrlSpy: ReturnType<typeof vi.spyOn>;
  let revokeUrlSpy: ReturnType<typeof vi.spyOn>;
  const createdUrls: string[] = [];
  const revokedUrls: string[] = [];

  beforeEach(() => {
    createdUrls.length = 0;
    revokedUrls.length = 0;
    vi.useFakeTimers();
    createUrlSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockImplementation((b: Blob | MediaSource) => {
        const url = `blob:mock-${createdUrls.length}-size-${
          b instanceof Blob ? b.size : 0
        }`;
        createdUrls.push(url);
        return url;
      });
    revokeUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation((u: string) => {
      revokedUrls.push(u);
    });
  });

  afterEach(() => {
    createUrlSpy.mockRestore();
    revokeUrlSpy.mockRestore();
    vi.useRealTimers();
  });

  it('returns the byte size of the blob', () => {
    const size = download('test.csv', 'a,b\r\n1,2\r\n', 'text/csv;charset=utf-8');
    // 'a,b\r\n1,2\r\n' is 10 ASCII bytes.
    expect(size).toBe(10);
  });

  it('creates a blob URL, clicks an anchor with download attribute, and revokes the URL on next tick', () => {
    let clickCount = 0;
    const origCreate = document.createElement.bind(document);
    const createSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation((tag: string) => {
        const el = origCreate(tag);
        if (tag === 'a') {
          (el as HTMLAnchorElement).click = () => {
            clickCount++;
          };
        }
        return el;
      });

    download('hello.txt', 'hello', 'text/plain');

    expect(createUrlSpy).toHaveBeenCalledTimes(1);
    expect(clickCount).toBe(1);
    // Revocation is deferred via setTimeout(0).
    expect(revokedUrls).toHaveLength(0);
    vi.runAllTimers();
    expect(revokedUrls).toEqual(createdUrls);

    createSpy.mockRestore();
  });

  it('accepts an array of blob parts (for chunked outputs)', () => {
    const size = download('chunked.json', ['{"a":1}', '\n', '{"a":2}\n'], 'application/x-ndjson');
    expect(size).toBe('{"a":1}\n{"a":2}\n'.length);
  });
});
