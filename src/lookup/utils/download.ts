/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

/** Save bytes or text as a file through a temporary object URL. */
export function download(name: string, bytes: Uint8Array | string, type: string): void {
  const blob = new Blob([bytes as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  // Some browsers start the download only after `click` returns, so revoking
  // synchronously can cancel it.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
