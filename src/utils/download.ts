/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */


/**
 * Trigger a browser download of `parts` as `filename` with MIME type `mime`.
 *
 * Returns the byte size of the assembled blob.
 *
 * Implementation:
 * 1. Build a Blob from `parts` (string | BlobPart accepted).
 * 2. Create an object URL.
 * 3. Click an off-document `<a>` to start the download.
 * 4. Schedule cleanup of the URL on the next tick.
 *
 * The DOM dependencies are accessed via `globalThis` so that under jsdom or
 * in a worker context the function fails gracefully.
 */
export function download(
  filename: string,
  parts: string | BlobPart | readonly BlobPart[],
  mime: string
): number {
  const blobParts: BlobPart[] = Array.isArray(parts)
    ? (parts as BlobPart[])
    : [parts as BlobPart];
  const blob = new Blob(blobParts, { type: mime });

  const doc: Document | undefined = (globalThis as { document?: Document }).document;
  const URLObj: typeof URL | undefined = (globalThis as { URL?: typeof URL }).URL;
  if (!doc || !URLObj || typeof URLObj.createObjectURL !== 'function') {
    // Non-DOM environment (worker / SSR): caller should detect this via the
    // returned Blob size and fall back, but most callers run in the browser.
    return blob.size;
  }

  const url = URLObj.createObjectURL(blob);
  const anchor = doc.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  // Attach to the document so Firefox honours the click in headless mode.
  anchor.style.display = 'none';
  doc.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    doc.body.removeChild(anchor);
    // Defer revocation to give the browser time to start the download.
    setTimeout(() => URLObj.revokeObjectURL(url), 0);
  }

  return blob.size;
}
