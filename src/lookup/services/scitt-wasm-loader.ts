/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import init, {
  decodeClaim,
  initSync,
  inspectStatement,
  statementPayload,
  verifyStatementWithServiceCert,
  version,
} from '../vendor/scitt-wasm/scitt_wasm.js';
import wasmUrl from '../vendor/scitt-wasm/scitt_wasm_bg.wasm?url';

/**
 * The scitt-wasm crate version the page's reading of its JSON was written
 * against. Keep in sync with `vendor/scitt-wasm/README.md`.
 */
export const SCITT_WASM_VERSION = '0.4.0';

let ready: Promise<unknown> | null = null;

function checkVersion(): void {
  const loaded = version();
  if (loaded !== SCITT_WASM_VERSION) {
    throw new Error(`Loaded scitt-wasm ${loaded}, but this page expects ${SCITT_WASM_VERSION}.`);
  }
}

/** Load the verifier once; later calls reuse the same instance. */
export function loadScittWasm(): Promise<unknown> {
  ready ??= init({ module_or_path: wasmUrl })
    .then(checkVersion)
    .catch((error: unknown) => {
      ready = null;
      throw error;
    });
  return ready;
}

/** Initialise from bytes already in memory, for tests that run outside a browser. */
export function loadScittWasmSync(bytes: BufferSource): void {
  initSync({ module: bytes });
  checkVersion();
  ready = Promise.resolve();
}

export { decodeClaim, inspectStatement, statementPayload, verifyStatementWithServiceCert };
