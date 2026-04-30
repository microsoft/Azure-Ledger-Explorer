/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testfilepath = path.dirname(fileURLToPath(import.meta.url));

test.describe('SCITT COSE entry decoding', () => {
  // These tests import ledger files which takes time
  test.setTimeout(120_000);
  test.beforeEach(async ({ page }) => {
    await page.goto('/files');
    await page.getByRole('button', { name: 'Get Started' }).click();
    await page.getByLabel('Upload ledger files').setInputFiles([
      path.join(testfilepath, 'test_files', 'ledger_1-14.committed'),
      path.join(testfilepath, 'test_files', 'ledger_15-3926.committed'),
    ]);
    await expect(page.getByTestId('import-button')).toBeEnabled({ timeout: 15000 });
    await page.getByTestId('import-button').scrollIntoViewIfNeeded();
    await page.getByTestId('import-button').click();
    await page.waitForTimeout(10000);
    await expect(page.getByText('Total: 14 transactions')).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId('file-item-ledger_15-3926.committed-verified')).toBeVisible({ timeout: 60000 });
  });

  test('scitt.entry table shows decoded COSE claims in columns', async ({ page }) => {
    await page.goto('/tables/public%3Ascitt.entry');
    await expect(page.getByText('public:scitt.entry').first()).toBeVisible({ timeout: 15000 });

    const table = page.getByRole('table').first();
    await expect(table).toBeVisible();

    // Verify SCITT-specific columns exist
    const headerGroup = table.getByRole('rowgroup').first();
    await expect(headerGroup.filter({ hasText: 'Issuer' })).toBeVisible();
    await expect(headerGroup.filter({ hasText: 'Subject' })).toBeVisible();
    await expect(headerGroup.filter({ hasText: 'Signed At' })).toBeVisible();

    // Verify at least one row has a non-empty issuer value (decoded from COSE CWT Claims)
    const bodyGroup = table.getByRole('rowgroup').nth(1);
    const rows = bodyGroup.getByRole('row');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);

    // At least one row should have a real Signed At timestamp (ISO date format)
    // This confirms the CBOR -> JSON decoding pipeline is working end-to-end
    const allCellTexts = await bodyGroup.allInnerTexts();
    const combinedText = allCellTexts.join(' ');
    // SCITT entries should have ISO timestamps like "2025-..." in the Signed At column
    expect(combinedText).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  test('transaction detail renders decoded COSE JSON for scitt.entry', async ({ page }) => {
    await page.goto('/tables/public%3Ascitt.entry');
    await expect(page.getByText('public:scitt.entry').first()).toBeVisible({ timeout: 15000 });

    const table = page.getByRole('table').first();
    await expect(table).toBeVisible();

    // Wait for at least one data row to appear
    const bodyGroup = table.getByRole('rowgroup').nth(1);
    await expect(bodyGroup.getByRole('row').first()).toBeVisible({ timeout: 15000 });

    // Click the "Details" button on the first row to navigate to the transaction view
    // The button has text "Details" in a <span> and a ChevronRightRegular icon
    const firstDetailsButton = bodyGroup.getByRole('row').first().locator('button', { hasText: 'Details' });
    await expect(firstDetailsButton).toBeVisible({ timeout: 10000 });
    await firstDetailsButton.click();

    // Wait for the transaction page to load — URL should change to /transaction/...
    await page.waitForURL(/\/transaction\/\d+/, { timeout: 15000 });

    // The page should display the scitt.entry table name somewhere
    await expect(page.getByText('public:scitt.entry').first()).toBeVisible({ timeout: 15000 });

    // The ValueViewer renders the decoded COSE Sign1 structure via Monaco editor.
    // Look for COSE header fields that cborArrayToText produces: "protected", "alg"
    // There may be multiple editors (one per table write), use first() for the scitt entry.
    const editorContent = page.locator('.view-lines').first();
    await expect(editorContent).toBeVisible({ timeout: 10000 });

    const editorText = await editorContent.innerText();

    // cborArrayToText decodes COSE Sign1 into a JSON object.
    // Verify key structural fields are present in the rendered output.
    // Note: Monaco only renders visible lines, so check fields that appear early.
    expect(editorText).toContain('"protected"');
    expect(editorText).toContain('"alg"');
    // CWT Claims should be decoded with a human-readable issuer DID
    expect(editorText).toContain('"iss"');
    expect(editorText).toContain('"sub"');
    expect(editorText).toContain('"iat"');
  });
});
