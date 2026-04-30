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

test('files page button opens add files dialog', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Files', exact: true }).click();
  await page.getByRole('button', { name: 'Get Started' }).click();
  await expect(page.getByRole('heading', { name: 'Add Ledger Files' })).toBeVisible();
});

test('cannot upload invalid file names', async ({ page }) => {
  await page.goto('/files');
  await page.getByRole('button', { name: 'Get Started' }).click();
  // Set files directly on the hidden input
  await page.getByLabel('Upload ledger files').setInputFiles([
    path.join(testfilepath, 'test_files', 'invalidnameledger_1-14.committed'),
  ]);
  // Should show error message for invalid filename format
  await expect(page.getByText('No valid ledger files found')).toBeVisible();
});

test('successfully imports ledger files', async ({ page }) => {
  await page.goto('/files');
  await page.getByRole('button', { name: 'Get Started' }).click();
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