/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { parseLedgerFilename, type LedgerFileInfo } from '@microsoft/ccf-ledger-parser';

export interface DownloadProgress {
  currentFile: number;
  totalFiles: number;
  currentFilename: string;
}

// NGINX directory listing response interfaces
interface NginxFileEntry {
  name: string;
  type: 'file' | 'directory';
  mtime: string;
  size?: number;
}

type NginxDirectoryResponse = NginxFileEntry[];

// File info interface for MstClient
interface FileInfo {
  name: string;
  kind: 'file' | 'directory';
  url: string;
  /** File size in bytes (from the NGINX directory listing). */
  size?: number;
}

interface IMstClient {
  listAllLedgerFiles(): AsyncGenerator<FileInfo>;
  downloadFile(filename: string, signal?: AbortSignal): Promise<Blob>;
}

/**
 * Options for the resilient blob fetcher.
 *
 * Defaults are tuned for typical MST chunk sizes (10-60 MB) over potentially
 * slow corporate links. The watchdog is a *no-progress* timeout, not a total
 * timeout — it resets on every chunk read, so large files on slow links
 * complete as long as bytes keep arriving.
 */
interface FetchBlobOptions {
  signal?: AbortSignal;
  /** Aborts the request if no bytes arrive within this window. Resets on each read. */
  noProgressTimeoutMs?: number;
  /** Number of retries on top of the initial attempt. */
  maxRetries?: number;
  /** Initial backoff between retries; doubled each retry, plus small jitter. */
  initialBackoffMs?: number;
}

interface AnnotatedFetchError extends Error {
  status?: number;
  retryable?: boolean;
  timedOut?: boolean;
}

const DEFAULT_NO_PROGRESS_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_INITIAL_BACKOFF_MS = 1_000;

const isRetryableStatus = (status: number): boolean =>
  status >= 500 || status === 408 || status === 429;

const annotate = (
  err: Error,
  fields: Partial<Pick<AnnotatedFetchError, 'status' | 'retryable' | 'timedOut'>>,
): AnnotatedFetchError => Object.assign(err, fields);

/**
 * Single fetch attempt that streams the response body so we can apply a
 * per-chunk no-progress watchdog. If `response.body` is not a stream
 * (e.g., in some test environments), falls back to `response.blob()` with
 * a single total-time timeout equal to the no-progress window.
 */
async function fetchBlobOnce(
  url: string,
  { signal, noProgressTimeoutMs = DEFAULT_NO_PROGRESS_TIMEOUT_MS }: FetchBlobOptions,
): Promise<Blob> {
  const controller = new AbortController();
  let timedOut = false;
  let timerId: ReturnType<typeof setTimeout> | undefined;

  const resetTimer = () => {
    if (timerId !== undefined) clearTimeout(timerId);
    timerId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, noProgressTimeoutMs);
  };

  const onUserAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    signal.addEventListener('abort', onUserAbort, { once: true });
  }

  try {
    resetTimer();
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw annotate(new Error(`HTTP ${response.status} ${response.statusText} for ${url}`), {
        status: response.status,
        retryable: isRetryableStatus(response.status),
      });
    }

    // Stream the body if we can, so the no-progress timer applies to bytes
    // actually arriving instead of just the headers handshake.
    if (response.body && typeof response.body.getReader === 'function') {
      const reader = response.body.getReader();
      const chunks: BlobPart[] = [];
      const contentType = response.headers.get('content-type') ?? '';
      try {
        for (;;) {
          resetTimer();
          const { done, value } = await reader.read();
          if (done) break;
          if (value) chunks.push(value as BlobPart);
        }
      } finally {
        // Release the lock so the connection can be reused or closed.
        try { reader.releaseLock(); } catch { /* already released */ }
      }
      return new Blob(chunks, contentType ? { type: contentType } : undefined);
    }

    // No streaming body available (e.g., mocked fetch). Use blob() with the
    // same timeout as a total-time fallback.
    return await response.blob();
  } catch (err) {
    const e = err as AnnotatedFetchError;
    if (timedOut) {
      throw annotate(new Error(`No progress within ${noProgressTimeoutMs}ms while fetching ${url}`), {
        timedOut: true,
        retryable: true,
      });
    }
    // User abort vs our abort
    if (signal?.aborted) throw e;
    // Network errors (TypeError from fetch on connection failure) are retryable
    if (e instanceof TypeError && e.retryable === undefined) {
      throw annotate(new Error(e.message), { retryable: true });
    }
    throw e;
  } finally {
    if (timerId !== undefined) clearTimeout(timerId);
    if (signal) signal.removeEventListener('abort', onUserAbort);
  }
}

/**
 * Fetches a URL into a Blob with retries and a per-chunk no-progress
 * watchdog. Retries network errors, 5xx, 408, and 429 with exponential
 * backoff (+ small jitter). Does not retry user-initiated aborts or
 * non-retryable 4xx responses.
 */
export async function fetchBlobWithRetry(
  url: string,
  options: FetchBlobOptions = {},
): Promise<Blob> {
  const {
    signal,
    maxRetries = DEFAULT_MAX_RETRIES,
    initialBackoffMs = DEFAULT_INITIAL_BACKOFF_MS,
  } = options;

  let lastError: AnnotatedFetchError | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    try {
      return await fetchBlobOnce(url, options);
    } catch (err) {
      const e = err as AnnotatedFetchError;
      lastError = e;

      // Caller-initiated abort: never retry.
      if (signal?.aborted) throw e;
      // Non-retryable (e.g., 404, 401, 403) — bail immediately.
      if (e.retryable !== true) throw e;
      // Out of retries.
      if (attempt >= maxRetries) break;

      const backoff = initialBackoffMs * 2 ** attempt + Math.floor(Math.random() * 250);
      await new Promise<void>((resolve) => setTimeout(resolve, backoff));
    }
  }

  throw lastError ?? new Error(`Failed to fetch ${url}`);
}

// MstClient implementation using fetch to access NGINX-indexed ledger files
class MstClient implements IMstClient {
  private ledgerFilesUrl: string;

  constructor(domain: string) {
    // Prefix domain with 'ledger-files-' and construct base URL
    // parse domain to avoid double protocol
    if (domain.startsWith('http://')) {
      domain = domain.slice('http://'.length);
    } else if (domain.startsWith('https://')) {
      domain = domain.slice('https://'.length);
    }
    // remove trailing slash if present
    if (domain.endsWith('/')) {
      domain = domain.slice(0, -1);
    }
    // try parsing domain to ensure it's valid
    try {
      new URL(`https://${domain}`);
    } catch {
      throw new Error(`Invalid domain provided: ${domain}`);
    }
    this.ledgerFilesUrl = `https://ledger-files-${domain}/ledger/`;
  }

  async *listAllLedgerFiles(): AsyncGenerator<FileInfo> {
    yield* this.listFilesRecursively('/');
  }

  private async *listFilesRecursively(path: string): AsyncGenerator<FileInfo> {
    try {
      const targetUrl = `${this.ledgerFilesUrl}${path.startsWith('/') ? path.slice(1) : path}`;      
      const response = await fetch(targetUrl, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to list files at ${path}: ${response.status} ${response.statusText}`);
      }

      const data: NginxDirectoryResponse = await response.json();

      // check if response is array
      if (!Array.isArray(data)) {
        throw new Error(`Unexpected response format at ${path}: ${JSON.stringify(data)}`);
      }

      for (const entry of data) {
        // Skip parent directory entries
        if (entry.name === '../' || entry.name === './') {
          continue;
        }

        const fullPath = path === '/' ? entry.name : `${path}/${entry.name}`;
        const fileInfo: FileInfo = {
          name: entry.name,
          kind: entry.type,
          url: `${this.ledgerFilesUrl}${fullPath.startsWith('/') ? fullPath.slice(1) : fullPath}`,
          size: entry.size,
        };

        if (entry.type === 'file') {
          yield fileInfo;
        } else if (entry.type === 'directory') {
          // Recursively search directories
          yield* this.listFilesRecursively(fullPath);
        }
      }
    } catch (error) {
      console.error(`Error listing files in ${path}:`, error);
      throw new Error(
        `Failed to access directory ${path}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { cause: error }
      );
    }
  }

  async downloadFile(filename: string, signal?: AbortSignal): Promise<Blob> {
    const targetUrl = `${this.ledgerFilesUrl}${filename}`;
    try {
      return await fetchBlobWithRetry(targetUrl, { signal });
    } catch (error) {
      console.error(`Error downloading file ${filename}:`, error);
      throw new Error(
        `Failed to download file ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { cause: error }
      );
    }
  }
}

export interface StreamedLedgerFile {
  file: File;
  info: LedgerFileInfo;
}

export class MstFilesService {
  private mstClient: IMstClient | null = null;

  async initialize(domain: string): Promise<void> {
    try {
      this.mstClient = new MstClient(domain);
    } catch (error) {
      console.error('Initialization error:', error);
      throw new Error(
        'Failed to initialize MST client. Please ensure your domain is correct.',
        { cause: error }
      );
    }
  }

  async listLedgerFiles(): Promise<(LedgerFileInfo & { size?: number })[]> {
    if (!this.mstClient) {
      throw new Error('File share client not initialized');
    }

    const files: (LedgerFileInfo & { size?: number })[] = [];

    for await (const f of this.mstClient.listAllLedgerFiles()) {
      if (f.kind === "file" && f.name.endsWith('.committed')) {
        files.push({
          ...parseLedgerFilename(f.name),
          size: f.size,
        });
      }
    }
    
    // Sort by start number and return all files (including duplicates - let UI handle selection)
    return files
      .filter(f => f.isValid)
      .sort((a, b) => a.startNo - b.startNo);
  }

  /**
   * Stream selected files one at a time.
   *
   * This is the streaming counterpart to the old `downloadSelectedFiles`. It
   * avoids accumulating every Blob in memory simultaneously: the consumer
   * receives one `File` per `yield`, hands its bytes off to the indexing
   * worker, and only then does the next `fetch` start. Peak memory therefore
   * scales with a single chunk, not with the whole batch.
   *
   * Each download uses {@link fetchBlobWithRetry} for transient-error
   * resilience. The `signal` flows through to the underlying `fetch` so
   * callers can cancel mid-batch.
   */
  async *streamSelectedFiles(
    filenames: string[],
    onProgress?: (progress: DownloadProgress) => void,
    signal?: AbortSignal,
  ): AsyncGenerator<StreamedLedgerFile> {
    if (!this.mstClient) {
      throw new Error('File share client not initialized');
    }

    const totalFiles = filenames.length;
    let currentFile = 0;

    for (const filename of filenames) {
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      currentFile++;
      onProgress?.({ currentFile, totalFiles, currentFilename: filename });

      const info = parseLedgerFilename(filename);
      const blob = await this.mstClient.downloadFile(filename, signal);
      const file = new File([blob], filename, { type: blob.type });

      yield { file, info };
    }
  }

  /**
   * Stream all available ledger files. Thin wrapper over
   * {@link streamSelectedFiles} that first lists the directory.
   */
  async *streamAllLedgerFiles(
    onProgress?: (progress: DownloadProgress) => void,
    signal?: AbortSignal,
  ): AsyncGenerator<StreamedLedgerFile> {
    const ledgerFileListFromStorage = await this.listLedgerFiles();
    if (ledgerFileListFromStorage.length === 0) {
      throw new Error('No ledger files found in the file share');
    }
    const filenames = ledgerFileListFromStorage.map((f) => f.filename);
    yield* this.streamSelectedFiles(filenames, onProgress, signal);
  }

  async blobToFile(blob: Blob, fileName: string): Promise<File> {
    const file = new File([blob], fileName, { type: blob.type });
    return file;
  }

}