import { test, expect } from '@playwright/test';
import path from 'node:path';

const testfilepath = import.meta.url.replace('file://', '');

test('main page has title', async ({ page }) => {
  await page.goto('/');
  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Explorer/);
});

test('files page button opens add files dialog', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Files' }).click();
  await page.getByRole('button', { name: 'Add Files' }).click();
  await page.getByRole('button', { name: 'Select .committed Files' }).click();
  await expect(page.getByRole('heading', { name: 'Add Ledger Files' })).toBeVisible();
});

test('cannot upload invalid file names', async ({ page }) => {
  await page.goto('/files');
  await page.getByRole('button', { name: 'Add Files' }).click();
  await page.getByRole('button', { name: 'Select .committed Files' }).click();
  await page.getByLabel('Upload CCF ledger files').setInputFiles([
    path.join(testfilepath, '../test_files', 'invalidnameledger_1-14.committed'),
  ]);
  await expect(page.getByRole('group', { name: 'Invalid File Sequence' })).toBeVisible();
});

test('successfully imports ledger files', async ({ page }) => {
  await page.goto('/files');
  await page.getByRole('button', { name: 'Add Files' }).click();
  await page.getByRole('button', { name: 'Select .committed Files' }).click();
  await page.getByLabel('Upload CCF ledger files').setInputFiles([
    path.join(testfilepath, '../test_files', 'ledger_1-14.committed'),
    path.join(testfilepath, '../test_files', 'ledger_15-3926.committed'),
  ]);
  await expect(page.getByText('Total: 14 transactions')).toBeVisible();
});