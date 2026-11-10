/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

/**
 * Browser proof for the SCITT transparent statement verifier.
 *
 * The Rust conformance suite and the Node harness both exercise the same
 * `scitt-receipt` core, but neither proves the thing that actually has to work
 * here: that the WebAssembly module instantiates inside a module worker in a
 * real browser, alongside the sqlite-wasm instance the rest of the app runs,
 * and produces the same pinned answers. Node's loader and Chromium's are
 * different enough that this can only be settled by running it.
 *
 * The expected values are pinned from `corpus/README.md` in
 * microsoft/scitt-verifier. They are cross-implementation constants, so a
 * change here means either the fixtures moved or something is wrong.
 */

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testfilepath = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => path.join(testfilepath, 'test_files', 'scitt', name);

/** Pinned in corpus/README.md at microsoft/scitt-verifier v0.5.0. */
const CLAIM_DIGEST = '6f7607e4d68fd01298c47897357a093944de8c033c99bbb3284b8243aa0e6d11';
const MERKLE_ROOT = 'c8dee06dcaa9268cd2910ca78d24a18490789a9d24acba96534dfe8f3b788c14';
const KEYS = 'mst-test-scitt-keys.cbor';
/** The SHA-256 of the root CA the statement's own `x5chain` ends at. */
const CHAIN_ROOT_SHA256 = '5464191baac908d158542c089145443d6d6e3c4852252e632f970fac5a722a02';

const verify = async (
  page: Page,
  statement: string,
  keySet: string,
  trustedRoots?: string,
) => {
  const fileInputs = page.locator('input[type="file"]');
  await fileInputs.nth(0).setInputFiles(fixture(statement));
  await fileInputs.nth(1).setInputFiles(fixture(keySet));

  if (trustedRoots) {
    await fileInputs.nth(2).setInputFiles(fixture(trustedRoots));
  }

  await page.getByRole('button', { name: 'Verify' }).click();
};

test.describe('SCITT transparent statement verification', () => {
  // Instantiating the wasm module on a cold cache dominates the first run.
  test.setTimeout(60_000);

  test.beforeEach(async ({ page }) => {
    await page.goto('/mst-receipt');
    await expect(
      page.getByText('Signing Transparency Receipt Verification'),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('verifies a genuine transparent statement and reproduces the pinned values', async ({
    page,
  }) => {
    await verify(page, 'transparent-statement.cose', KEYS);

    await expect(page.getByText('Transparent', { exact: true })).toBeVisible({ timeout: 30_000 });

    // The claim digest is what the receipt actually commits to. Reproducing it
    // in the browser is the single strongest signal that the wasm build agrees
    // with the Rust CLI, because every later check is derived from it.
    await expect(page.getByText(CLAIM_DIGEST)).toBeVisible();
    await expect(page.getByText(MERKLE_ROOT)).toBeVisible();

    // Statement is PS256, receipt is ES384. These differ on purpose and were
    // mis-documented once already, so pin both.
    await expect(page.getByText('PS256')).toBeVisible();
    await expect(page.getByText('ES384')).toBeVisible();

    await expect(page.getByText('4 certificates')).toBeVisible();
    await expect(page.getByText('Root signature verified')).toBeVisible();
    await expect(page.getByText('Receipt commits to this statement')).toBeVisible();

    // No trusted roots were supplied, so the chain holds but anchoring never
    // ran — and the summary must not imply the signer was identified.
    await expect(page.getByText(CHAIN_ROOT_SHA256)).toBeVisible();
    await expect(page.getByText("Signer's certificate chain validates")).toBeVisible();
    await expect(
      page.getByText("Signer's chain is anchored to a trusted root — no trusted roots supplied"),
    ).toBeVisible();
    await expect(page.getByText('not anchored to a root you trust', { exact: false })).toBeVisible();
  });

  test('anchors the signer chain to a supplied trusted root', async ({ page }) => {
    // `corpus-root-ca.pem` is the root the statement's own `x5chain` ends at,
    // extracted from the fixture. Supplying it turns a consistent chain into
    // an identified one.
    await verify(page, 'transparent-statement.cose', KEYS, 'corpus-root-ca.pem');

    await expect(page.getByText('Transparent', { exact: true })).toBeVisible({ timeout: 30_000 });
    // Exact: the unanchored variant of this row carries a "did not run" suffix.
    await expect(
      page.getByText("Signer's chain is anchored to a trusted root", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText('no trusted roots supplied', { exact: false })).toHaveCount(0);
    await expect(page.getByText('leads to a trusted root you supplied', { exact: false })).toBeVisible();
  });

  test('reports a signer chain that misses the supplied roots as not transparent', async ({
    page,
  }) => {
    // The receipt still verifies — the statement really was registered — but
    // the user asked whether the signer chains to a root they trust, and the
    // answer is no. Mirrors the upstream CLI, which exits untrusted here.
    await verify(page, 'transparent-statement.cose', KEYS, 'mst-test-service-cert.pem');

    await expect(page.getByText('Not transparent', { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText('none of the 1 supplied trusted root(s)', { exact: false }).first()).toBeVisible();
  });

  test('reports a payload-tampered statement as not transparent', async ({ page }) => {
    // The most instructive fixture: the receipt is genuine, its inclusion proof
    // is valid, and its root signature verifies. It is still not evidence about
    // this payload, because the claims digest no longer matches. Any verifier
    // that omits the binding check accepts this file.
    await verify(page, 'payload-tampered.cose', KEYS);

    await expect(page.getByText('Not transparent', { exact: true })).toBeVisible({
      timeout: 30_000,
    });

    // The root signature must show as verified even though the verdict fails —
    // that is what makes this a binding failure rather than a forgery.
    await expect(page.getByText('Root signature verified')).toBeVisible();
    await expect(page.getByText('Receipt commits to this statement')).toBeVisible();
  });

  test('reports a statement whose only receipt fails as unevaluable', async ({ page }) => {
    // `tampered-statement.cose` has a byte flipped inside the receipt, so the
    // root signature fails while the Issuer's signature still verifies. The
    // corpus pins this as cannot-evaluate rather than untrusted: the bytes are
    // exactly what the Issuer signed, and what is missing is proof of
    // registration. Collapsing this into a failure is the mistake this test
    // exists to catch.
    await verify(page, 'tampered-statement.cose', KEYS);

    await expect(page.getByText('Cannot evaluate', { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText("Issuer's signature over the statement")).toBeVisible();
  });

  test('still passes when a broken receipt is appended beside a genuine one', async ({ page }) => {
    // Receipts travel in the unprotected header, so anyone can append one
    // without a key. If that could flip the verdict, every mirror and cache
    // would hold a veto. RFC 9943 §7.1 asks for at least one verified receipt.
    await verify(page, 'appended-receipt.cose', KEYS);

    await expect(page.getByText('Transparent', { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('2 / 1')).toBeVisible();
    await expect(page.getByText('Receipt 2')).toBeVisible();
  });

  test('reports a key set that does not cover the receipt as unevaluable rather than as a failure', async ({
    page,
  }) => {
    // The distinction the whole design rests on. A key set from another
    // service, or one that predates a rotation, cannot resolve the receipt's
    // kid, which proves nothing about the statement — rendering it as a
    // failure would report routine key rotation as an attack.
    await verify(page, 'transparent-statement.cose', 'other-service-scitt-keys.cbor');

    await expect(page.getByText('Cannot evaluate', { exact: true })).toBeVisible({
      timeout: 30_000,
    });

    // The checks downstream of key resolution must show as "did not run", not
    // as failures.
    await expect(page.getByText('unknown-kid')).toBeVisible();
    await expect(page.getByText('Root signature verified — did not run')).toBeVisible();
  });

  test('runs alongside the sqlite-wasm ledger database without interference', async ({ page }) => {
    // Two independent wasm modules in one origin, each with its own linear
    // memory and its own worker. This is the interop question that motivated
    // the prototype, and it is only meaningfully answered in a browser.
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    await page.goto('/files');
    await expect(page.getByRole('button', { name: 'Upload files' })).toBeVisible({
      timeout: 15_000,
    });

    await page.goto('/mst-receipt');
    await verify(page, 'transparent-statement.cose', KEYS);
    await expect(page.getByText('Transparent', { exact: true })).toBeVisible({ timeout: 30_000 });

    const memoryErrors = consoleErrors.filter((text) =>
      /wasm|memory|out of bounds|RuntimeError/i.test(text),
    );
    expect(memoryErrors).toEqual([]);
  });
});
