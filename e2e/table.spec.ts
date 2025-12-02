/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { test, expect } from '@playwright/test';
import path from 'node:path';

const testfilepath = import.meta.url.replace('file://', '');

test.beforeEach(async ({ page }) => {
  await page.goto('/files');
  await page.getByRole('button', { name: 'Add Files' }).click();
  await page.getByRole('button', { name: 'Browse Files' }).click();
  await page.getByLabel('Upload CCF ledger files').setInputFiles([
    path.join(testfilepath, '../test_files', 'ledger_1-14.committed'),
    path.join(testfilepath, '../test_files', 'ledger_15-3926.committed'),
  ]);
  await expect(page.getByText('Total: 14 transactions')).toBeVisible();
  // make sure file is fully processed
  await expect(page.getByText('ledger_15-3926.committed')).toBeVisible();
});

test('shows scitt entry columns', async ({ page }) => {
  await page.goto('/tables/public%3Ascitt.entry');
  await expect(page.getByText('public:scitt.entry')).toBeVisible();

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
