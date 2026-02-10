/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testfilepath = path.dirname(fileURLToPath(import.meta.url));
const TEST_DOMAIN = 'test-ledger.confidential-ledger.azure.com';

// Helper function to navigate to the config page
const goToConfigPage = async (page: Page) => {
  await page.getByRole('tab', { name: 'Configuration' }).click();
  await expect(page.getByText('Ledger data configuration')).toBeVisible();
};

test.describe('Configuration Page - Domain Persistence', () => {

  // Before each test, start from the home page
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Clear local storage before each test to ensure a clean state
    await page.evaluate(() => localStorage.clear());
  });

  test('should display fallback message on initial load', async ({ page }) => {
    await goToConfigPage(page);
    await expect(page.getByText('No ledger domain information available')).toBeVisible();
  });

  test('should persist domain after page reload', async ({ page }) => {
    // Simulate an MST import by setting the domain in localStorage
    await page.evaluate(domain => {
      localStorage.setItem('ledger_domain', domain);
      localStorage.setItem('ledger_import_type', 'MST');
      localStorage.setItem('ledger_import_date', new Date().toISOString());
    }, TEST_DOMAIN);

    // Go to config page and verify domain is displayed
    await goToConfigPage(page);
    await expect(page.getByText('Imported Ledger Domain:')).toBeVisible();
    await expect(page.getByText(TEST_DOMAIN)).toBeVisible();
    await expect(page.getByText(/Source: MST/)).toBeVisible();

    // Reload the page to test persistence
    await page.reload();
    
    // Navigate back to config page after reload
    await goToConfigPage(page);
    
    // Verify domain is still visible after reload
    await expect(page.getByText('Imported Ledger Domain:')).toBeVisible();
    await expect(page.getByText(TEST_DOMAIN)).toBeVisible();
    await expect(page.getByText(/Source: MST/)).toBeVisible();
  });

  test('should clear domain when database is dropped', async ({ page }) => {
    // First, set a domain in localStorage to simulate a previous import
    await page.evaluate(domain => {
      localStorage.setItem('ledger_domain', domain);
      localStorage.setItem('ledger_import_type', 'MST');
      localStorage.setItem('ledger_import_date', new Date().toISOString());
    }, TEST_DOMAIN);

    // Go to config page and verify it's there
    await goToConfigPage(page);
    await expect(page.getByText(TEST_DOMAIN)).toBeVisible();

    // Drop the database
    await page.getByRole('button', { name: 'Drop DB' }).click();
    await page.getByRole('button', { name: 'Drop Database' }).click();

    // Wait a bit for the operation to complete
    await page.waitForTimeout(1000);

    // Verify the domain info is gone and the fallback is shown
    await expect(page.getByText(TEST_DOMAIN)).not.toBeVisible();
    await expect(page.getByText('No ledger domain information available')).toBeVisible();
  });

  test('should show fallback message after manual file upload', async ({ page }) => {
    // Go to Files tab
    await page.getByRole('tab', { name: 'Files' }).click();
    
    // Click Add Files button to open the wizard
    await page.getByRole('button', { name: 'Add Files' }).click();
    
    // Set files directly on the hidden input
    await page.getByLabel('Upload CCF ledger files').setInputFiles([
      path.join(testfilepath, 'test_files', 'ledger_1-14.committed'),
    ]);

    // Click Import button to import selected files - use dispatchEvent to bypass overlay
    await page.getByRole('button', { name: /Import Selected/ }).dispatchEvent('click');
    // Wait a moment for import to start, then close dialog with Escape
    await page.waitForTimeout(1000);
    await page.keyboard.press('Escape');
    // Wait for the visualization to show
    await expect(page.getByText('Total: 14 transactions')).toBeVisible({ timeout: 30000 });

    // Go to config page and verify fallback message is shown (no domain since it was manual upload)
    await goToConfigPage(page);
    await expect(page.getByText('No ledger domain information available')).toBeVisible();
  });
});


test.describe('Configuration Page - Sage agent configuration', () => {
  // These tests require VITE_ENABLE_SAGE=true at build time so the Sage config card is visible.
  // Skip when running against a default (CCF Ledger Chat) build.
  test.skip(!process.env.VITE_ENABLE_SAGE, 'Sage UI is not enabled in this build');

  const TEST_BASE_URL = 'https://api.example.test/health';

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('should display base url from localStorage on load', async ({ page }) => {
    await page.addInitScript(({ baseUrl }) => {
      localStorage.setItem('chat_base_url', baseUrl);
    }, { baseUrl: TEST_BASE_URL });

    await page.goto('/');
    await goToConfigPage(page);

    const input = page.getByLabel('Base URL for chat integration');
    await expect(input).toHaveValue(TEST_BASE_URL);
  });

  test('should persist base url to localStorage when updated', async ({ page }) => {
    await page.goto('/');
    await goToConfigPage(page);

    const input = page.getByLabel('Base URL for chat integration');
    await input.fill(TEST_BASE_URL);

    await page.waitForFunction((baseUrl) => {
      return localStorage.getItem('chat_base_url') === baseUrl;
    }, TEST_BASE_URL);
  });

  test('should show api health status for a successful response', async ({ page }) => {
    await page.route(TEST_BASE_URL, async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok', configured: true }),
      });
    });

    await page.goto('/');
    await goToConfigPage(page);

    const input = page.getByLabel('Base URL for chat integration');
    await input.fill(TEST_BASE_URL);

    await expect(page.getByText('Status: ok • Configured: yes')).toBeVisible();
  });

  test('should show api health error on failed response', async ({ page }) => {
    await page.route(TEST_BASE_URL, async route => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'error' }),
      });
    });

    await page.goto('/');
    await goToConfigPage(page);

    const input = page.getByLabel('Base URL for chat integration');
    await input.fill(TEST_BASE_URL);

    await expect(page.getByText(/Failed to fetch health status: Failed to fetch health:/)).toBeVisible();
  });
});