/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseWorkerClient } from '../worker/database-worker-client';

// ---------------------------------------------------------------------------
// Fake Worker
// ---------------------------------------------------------------------------
// The real client constructs `new Worker(new URL('./database-worker.js', ...))`
// which cannot run under the node test environment. We replace the global
// Worker with a controllable fake that records posted messages and lets the
// test drive responses back to the client.

type Listener = (event: { data: unknown }) => void;

interface PostedMessage {
  message: Record<string, unknown>;
  transfer?: unknown[];
}

class FakeWorker {
  onmessage: Listener | null = null;
  private listeners: Listener[] = [];
  readonly posted: PostedMessage[] = [];
  terminated = false;

  constructor(public url: unknown, public options?: unknown) {}

  addEventListener(type: string, cb: Listener): void {
    if (type === 'message') this.listeners.push(cb);
  }

  removeEventListener(type: string, cb: Listener): void {
    if (type === 'message') this.listeners = this.listeners.filter((l) => l !== cb);
  }

  postMessage(message: Record<string, unknown>, transfer?: unknown[]): void {
    this.posted.push({ message, transfer });
  }

  terminate(): void {
    this.terminated = true;
  }

  /** Deliver a message from the "worker" to the client. */
  emit(data: unknown): void {
    this.onmessage?.({ data });
    for (const cb of [...this.listeners]) cb({ data });
  }

  postedOfType(type: string): PostedMessage[] {
    return this.posted.filter((p) => p.message.type === type);
  }
}

/** Flush pending microtasks + one macrotask so the client's async
 * chunk-handling (onChunk → ACK) settles before assertions. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

let originalWorker: unknown;

beforeEach(() => {
  originalWorker = (globalThis as unknown as { Worker?: unknown }).Worker;
  (globalThis as unknown as { Worker: unknown }).Worker = FakeWorker;
});

afterEach(() => {
  (globalThis as unknown as { Worker: unknown }).Worker = originalWorker;
});

/** Build a ready client and return it together with its fake worker. */
function makeClient(): { client: DatabaseWorkerClient; worker: FakeWorker } {
  const client = new DatabaseWorkerClient();
  const worker = (client as unknown as { worker: FakeWorker }).worker;
  worker.emit({ type: 'ready' });
  return { client, worker };
}

describe('DatabaseWorkerClient.exportDatabase', () => {
  it('delivers chunks in order and ACKs each non-final chunk', async () => {
    const { client, worker } = makeClient();

    const received: Array<{ offset: number; done: boolean; size: number }> = [];
    const promise = client.exportDatabase(async (chunk, offset, _total, done) => {
      received.push({ offset, done, size: chunk.byteLength });
    });

    // Let readyPromise resolve so the export handler registers and the
    // initial 'exportDatabase' message is posted.
    await flush();

    const start = worker.postedOfType('exportDatabase')[0];
    expect(start).toBeDefined();
    const id = start.message.id as number;

    // First (non-final) chunk → client must ACK before the next is sent.
    worker.emit({ type: 'exportChunk', id, chunk: new ArrayBuffer(4), offset: 0, totalSize: 8, done: false });
    await flush();
    const acks = worker.postedOfType('exportAck');
    expect(acks).toHaveLength(1);
    expect(acks[0].message.id).toBe(id);

    // Final chunk → resolves the promise, no further ACK.
    worker.emit({ type: 'exportChunk', id, chunk: new ArrayBuffer(4), offset: 4, totalSize: 8, done: true });

    await expect(promise).resolves.toEqual({ totalSize: 8 });
    expect(worker.postedOfType('exportAck')).toHaveLength(1);
    expect(received).toEqual([
      { offset: 0, done: false, size: 4 },
      { offset: 4, done: true, size: 4 },
    ]);
  });

  it('ignores messages whose id does not match the in-flight export', async () => {
    const { client, worker } = makeClient();

    const received: number[] = [];
    const promise = client.exportDatabase(async (_chunk, offset) => {
      received.push(offset);
    });
    await flush();
    const id = worker.postedOfType('exportDatabase')[0].message.id as number;

    // A stray chunk from a different id must be ignored.
    worker.emit({ type: 'exportChunk', id: id + 999, chunk: new ArrayBuffer(4), offset: 0, totalSize: 4, done: true });
    await flush();
    expect(received).toHaveLength(0);
    expect(worker.postedOfType('exportAck')).toHaveLength(0);

    // The correct final chunk resolves the export.
    worker.emit({ type: 'exportChunk', id, chunk: new ArrayBuffer(4), offset: 0, totalSize: 4, done: true });
    await expect(promise).resolves.toEqual({ totalSize: 4 });
    expect(received).toEqual([0]);
  });

  it('resolves without a callback', async () => {
    const { client, worker } = makeClient();
    const promise = client.exportDatabase();
    await flush();
    const id = worker.postedOfType('exportDatabase')[0].message.id as number;

    worker.emit({ type: 'exportChunk', id, chunk: new ArrayBuffer(0), offset: 0, totalSize: 0, done: true });
    await expect(promise).resolves.toEqual({ totalSize: 0 });
  });

  it('aborts the worker and rejects when the consumer callback throws', async () => {
    const { client, worker } = makeClient();

    const promise = client.exportDatabase(async () => {
      throw new Error('write failed');
    });
    await flush();
    const id = worker.postedOfType('exportDatabase')[0].message.id as number;

    worker.emit({ type: 'exportChunk', id, chunk: new ArrayBuffer(4), offset: 0, totalSize: 8, done: false });

    await expect(promise).rejects.toThrow('write failed');
    const aborts = worker.postedOfType('exportAbort');
    expect(aborts).toHaveLength(1);
    expect(aborts[0].message.id).toBe(id);
    // A failed chunk must not be ACKed.
    expect(worker.postedOfType('exportAck')).toHaveLength(0);
  });

  it('rejects when the worker reports an error', async () => {
    const { client, worker } = makeClient();

    const promise = client.exportDatabase(async () => {});
    await flush();
    const id = worker.postedOfType('exportDatabase')[0].message.id as number;

    worker.emit({ type: 'error', id, error: 'export boom' });

    await expect(promise).rejects.toThrow('export boom');
  });

  it('does not ACK or resolve twice once settled', async () => {
    const { client, worker } = makeClient();

    const promise = client.exportDatabase(async () => {});
    await flush();
    const id = worker.postedOfType('exportDatabase')[0].message.id as number;

    worker.emit({ type: 'exportChunk', id, chunk: new ArrayBuffer(4), offset: 0, totalSize: 4, done: true });
    await expect(promise).resolves.toEqual({ totalSize: 4 });

    // A late duplicate chunk after settling must be ignored (no ACK emitted).
    worker.emit({ type: 'exportChunk', id, chunk: new ArrayBuffer(4), offset: 0, totalSize: 4, done: false });
    await flush();
    expect(worker.postedOfType('exportAck')).toHaveLength(0);
  });
});
