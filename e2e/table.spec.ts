/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testfilepath = path.dirname(fileURLToPath(import.meta.url));

test.beforeEach(async ({ page }) => {
  await page.goto('/files');
  await page.getByRole('button', { name: 'Add Files' }).click();
  // Set files directly on the hidden input
  await page.getByLabel('Upload CCF ledger files').setInputFiles([
    path.join(testfilepath, 'test_files', 'ledger_1-14.committed'),
    path.join(testfilepath, 'test_files', 'ledger_15-3926.committed'),
  ]);
  // Click Import button to import selected files
  await page.getByRole('button', { name: /Import Selected/ }).click();
  // Wait a moment for import to start, then close dialog with Escape
  await page.waitForTimeout(1000);
  await page.keyboard.press('Escape');
  // Wait for the visualization to show
  await expect(page.getByText('Total: 14 transactions')).toBeVisible({ timeout: 30000 });
  // make sure file is fully processed
  await expect(page.getByText('ledger_15-3926.committed')).toBeVisible();
});

test('shows scitt entry columns', async ({ page }) => {
  await page.goto('/tables/public%3Ascitt.entry');
  // Wait for the sidebar title to load first (indicates page is ready)
  await expect(page.getByRole('tab', { name: 'Tables' })).toBeVisible({ timeout: 15000 });
  // Target the main content header (the first one, sidebar item is after the main heading loads)
  await expect(page.getByText('public:scitt.entry').first()).toBeVisible({ timeout: 15000 });

  const table = page.getByRole('table').first();

  await expect(table).toBeVisible();

  const groups = table.getByRole('rowgroup');
  const headerGroup = groups.first();
  await expect(headerGroup.filter({ hasText: 'Sequence' })).toBeVisible();
  await expect(headerGroup.filter({ hasText: 'Transaction ID' })).toBeVisible();
  await expect(headerGroup.filter({ hasText: 'Key' })).toBeVisible();
  await expect(headerGroup.filter({ hasText: 'Value' })).toBeVisible();
  await expect(headerGroup.filter({ hasText: 'Issuer' })).toBeVisible();
  await expect(headerGroup.filter({ hasText: 'Subject' })).toBeVisible();
  await expect(headerGroup.filter({ hasText: 'Signed At' })).toBeVisible();
  await expect(headerGroup.filter({ hasText: 'Actions' })).toBeVisible();

  const bodyGroup = groups.nth(1);
  const rowCount = await bodyGroup.getByRole('row').count();
  expect(rowCount).toBeGreaterThan(10);
});
