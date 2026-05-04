/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testfilepath = path.dirname(fileURLToPath(import.meta.url));

test('main page has title', async ({ page }) => {
  await page.goto('/');
  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Explorer/);
});

test('files page hero opens add files dialog on Local card click', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Files', exact: true }).click();
  // Welcome hero is the empty state; Local files card has an "Upload files" CTA.
  await page.getByRole('button', { name: 'Upload files' }).click();
  await expect(page.getByRole('heading', { name: 'Add Ledger Files' })).toBeVisible();
});

test('cannot upload invalid file names', async ({ page }) => {
  await page.goto('/files');
  await page.getByRole('button', { name: 'Upload files' }).click();
  // Set files directly on the hidden input
  await page.getByLabel('Upload ledger files').setInputFiles([
    path.join(testfilepath, 'test_files', 'invalidnameledger_1-14.committed'),
  ]);
  // Should show error message for invalid filename format
  await expect(page.getByText('No valid ledger files found')).toBeVisible();
});

test('successfully imports ledger files', async ({ page }) => {
  await page.goto('/files');
  await page.getByRole('button', { name: 'Upload files' }).click();
  // Set files directly on the hidden input
  await page.getByLabel('Upload ledger files').setInputFiles([
    path.join(testfilepath, 'test_files', 'ledger_1-14.committed'),
    path.join(testfilepath, 'test_files', 'ledger_15-3926.committed'),
  ]);
  // Click Import button to import selected files - use dispatchEvent to bypass overlay
  await page.getByRole('button', { name: /Import Selected/ }).dispatchEvent('click');
  // Wait a moment for import to start, then close dialog with Escape
  await page.waitForTimeout(1000);
  await page.keyboard.press('Escape');
  // Wait for the visualization to show
  await expect(page.getByText('Total: 14 transactions')).toBeVisible({ timeout: 30000 });
});

test('Welcome hero shows the default (non-MST) import paths and How-it-works', async ({ page }) => {
  await page.goto('/files');
  await expect(page.getByRole('heading', { name: /welcome to ledger explorer/i })).toBeVisible();
  await expect(page.getByText(/no data leaves your machine/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Upload files' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Connect with SAS' })).toBeVisible();
  // MST is preview-gated and hidden by default.
  await expect(page.getByRole('button', { name: 'Fetch from MST' })).toHaveCount(0);
  await expect(page.getByRole('list', { name: /how it works/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /load sample ledger/i })).toBeVisible();
});

test('?mst=true reveals the Signing Transparency card and wizard tab', async ({ page }) => {
  await page.goto('/files?mst=true');
  // Card is now visible on the hero.
  await expect(page.getByRole('button', { name: 'Fetch from MST' })).toBeVisible();
  // Wizard tab is also visible when entering through the MST card.
  await page.getByRole('button', { name: 'Fetch from MST' }).click();
  await expect(page.getByRole('heading', { name: 'Add Ledger Files' })).toBeVisible();
  await expect(
    page.getByRole('tab', { name: /Microsoft's Signing Transparency/ })
  ).toBeVisible();
});

test('?mst=false (or unset) hides the Signing Transparency wizard tab', async ({ page }) => {
  // Open the wizard via the visible Local card; the MST tab should not appear.
  await page.goto('/files');
  await page.getByRole('button', { name: 'Upload files' }).click();
  await expect(page.getByRole('heading', { name: 'Add Ledger Files' })).toBeVisible();
  await expect(
    page.getByRole('tab', { name: /Microsoft's Signing Transparency/ })
  ).toHaveCount(0);
});

test('/mst-receipt redirects to /files when MST is gated off', async ({ page }) => {
  await page.goto('/mst-receipt');
  // The route should bounce to the files page rather than render the MST
  // verification surface.
  await expect(page).toHaveURL(/\/files$/);
  await expect(page.getByRole('heading', { name: /welcome to ledger explorer/i })).toBeVisible();
});

test('Azure card opens wizard pre-selected to the Azure tab', async ({ page }) => {
  await page.goto('/files');
  await page.getByRole('button', { name: 'Connect with SAS' }).click();
  await expect(page.getByRole('heading', { name: 'Add Ledger Files' })).toBeVisible();
  // The wizard's Azure tab uses a Tooltip with relationship="label" whose
  // content is "Azure Confidential Ledger Backup", so that is the tab's
  // accessible name (not the visible text "Azure Ledger Backup").
  await expect(
    page.getByRole('tab', { name: /Azure Confidential Ledger Backup/ })
  ).toHaveAttribute('aria-selected', 'true');
});

test('Load sample ledger imports the bundled file and populates the tree', async ({ page }) => {
  await page.goto('/files');
  await page.getByRole('button', { name: /load sample ledger/i }).click();
  // The sample file is parsed via the same useFileDrop pipeline; the file tree
  // should eventually show the imported chunk. Use the file-item testid to
  // disambiguate from chunk-selector / breadcrumb references.
  await expect(
    page.locator('[data-testid^="file-item-ledger_1-14.committed"]')
  ).toBeVisible({ timeout: 30000 });
});