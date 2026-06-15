/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testfilepath = path.dirname(fileURLToPath(import.meta.url));

test.beforeEach(async ({ page }) => {
  // Importing large ledger files can take well over the default 30s test timeout.
  test.setTimeout(180000);
  await page.goto('/files');
  await page.getByRole('button', { name: 'Upload files' }).click();
  // Set files directly on the hidden input
  await page.getByLabel('Upload ledger files').setInputFiles([
    path.join(testfilepath, 'test_files', 'mst_eu_ledger_files', 'ledger_1-15.committed'),
    path.join(testfilepath, 'test_files', 'mst_eu_ledger_files', 'ledger_16-8200.committed'),
  ]);
  // Click Import button to import selected files - use dispatchEvent to bypass overlay
  await expect(page.getByTestId('import-button')).toBeEnabled({ timeout: 15000 });

  await page.getByTestId('import-button').scrollIntoViewIfNeeded();
  await page.getByTestId('import-button').click();
  // Wait for the visualization to show
  await expect(page.getByText('Total: 15 transactions')).toBeVisible({ timeout: 60000 });
  // make sure file is fully processed
  await expect(page.getByTestId('file-item-ledger_16-8200.committed-verified')).toBeVisible({ timeout: 60000 });
});

test('finds maa entries', async ({ page }) => {
  await page.goto('/tables/public%3Ascitt.entry');
  // Wait for the sidebar title to load first (indicates page is ready)
  await expect(page.getByRole('button', { name: 'Tables' })).toBeVisible({ timeout: 15000 });
  // Target the main content header (the first one, sidebar item is after the main heading loads)
  await expect(page.getByText('public:scitt.entry').first()).toBeVisible({ timeout: 15000 });

  await expect(
    page.locator('[data-testid="table-search-box"]')
  ).toBeVisible({ timeout: 30000 });

  // search by MAA subject id
  await page.locator('[data-testid="table-search-box"]').fill('4377f503-9a93-4584-b6bb-d75c33b8bbd2');

  const table = page.getByRole('table').first();
  await expect(table).toBeVisible();
  const groups = table.getByRole('rowgroup');
  const bodyGroup = groups.nth(1);
  const rows = bodyGroup.getByRole('row');
  const rowCount = await rows.count();
  expect(rowCount).toBe(8);

  // first row contains the transaction id 368.8148 in the second column from the left
  // (DESC sort by sequence is the default — newest first)
  const firstRow = rows.nth(0);
  const firstSecondCell = firstRow.getByRole('cell').nth(1);
  await expect(firstSecondCell).toHaveText('368.8148');

  // last row contains the transaction id 350.8006 in the second column from the left
  const lastRow = rows.nth(rowCount - 1);
  const secondCell = lastRow.getByRole('cell').nth(1);
  await expect(secondCell).toHaveText('350.8006');

  // check transaction renders data correctly when clicked
  await page.locator('[data-testid="details-button-8148"]').click();

  

  // wait for multiple "data-testid="value-viewer-editor"" to load and check the first has content in the monaco editor:
  // "iss": "did:x509:0:sha256:I__iuL25oXEVFdTP_aBLx_eT1RPHbCQ_ECBQfYZpt9s::eku:1.3.6.1.4.1.311.76.59.1.1",
  // "sub": "4377f503-9a93-4584-b6bb-d75c33b8bbd2",
  // "iat": "2025-09-18T18:22:14.000Z",
  // "svn": 1

  const valueViewers = page.getByTestId('value-viewer-editor');
  await expect(valueViewers.first()).toBeVisible({ timeout: 15000 });
  await expect(valueViewers.first()).toContainText('did:x509:0:sha256:I__iuL25oXEVFdTP_aBLx_eT1RPHbCQ_ECBQfYZpt9s::eku:1.3.6.1.4.1.311.76.59.1.1');
  await expect(valueViewers.first()).toContainText('"iss": "did:x509:0:sha256:I__iuL25oXEVFdTP_aBLx_eT1RPHbCQ_ECBQfYZpt9s::eku:1.3.6.1.4.1.311.76.59.1.1"');
  
});
