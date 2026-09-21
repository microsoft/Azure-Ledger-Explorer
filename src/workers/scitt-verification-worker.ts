/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

/**
 * Worker hosting the SCITT verification WASM module.
 *
 * Verification runs off the main thread for the same reason database work
 * does: the pure-Rust crypto backend is synchronous, so an RSA-PSS check over
 * a four-certificate chain would block paint if it ran inline.
 *
 * This worker owns a WASM instance entirely separate from the sqlite-wasm
 * instance in the database worker. Two WASM modules cannot interfere with each
 * other — each gets its own linear memory — but keeping them in separate
 * workers also keeps their lifecycles independent, so a verification failure
 * cannot disturb an in-progress ledger import.
 */

import init, {
  verifyStatement,
  inspectStatement,
} from '@microsoft/scitt-wasm';
import type {
  ScittWorkerInMessage,
  ScittWorkerOutMessage,
  StatementFacts,
  StatementInspection,
} from '../types/scitt-types';

let ready: Promise<unknown> | null = null;

/** Instantiate once per worker; `init()` is idempotent but not free. */
const ensureReady = (): Promise<unknown> => {
  ready ??= init();
  return ready;
};

const post = (message: ScittWorkerOutMessage) => {
  self.postMessage(message);
};

self.onmessage = async (event: MessageEvent<ScittWorkerInMessage>) => {
  const message = event.data;

  try {
    await ensureReady();

    switch (message.type) {
      case 'verify': {
        const facts = JSON.parse(
          verifyStatement(
            new Uint8Array(message.statement),
            new Uint8Array(message.keySet),
            message.issuer,
          ),
        ) as StatementFacts;
        post({ type: 'verified', requestId: message.requestId, facts });
        break;
      }

      case 'inspect': {
        const inspection = JSON.parse(
          inspectStatement(new Uint8Array(message.statement)),
        ) as StatementInspection;
        post({ type: 'inspected', requestId: message.requestId, inspection });
        break;
      }
    }
  } catch (error) {
    // A statement that parses but fails verification is a *result*, not an
    // error, and never lands here. This path means the bytes were not a
    // statement, or the key set was unusable — both worth showing verbatim,
    // since the core's messages already explain what was wrong.
    post({
      type: 'error',
      requestId: message.requestId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
