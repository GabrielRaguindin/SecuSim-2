import { test, expect } from '@playwright/test';

test('home page loads and links to the sandbox', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Build the network');
  await page.getByRole('link', { name: 'Open the sandbox' }).click();
  await expect(page).toHaveURL(/\/sandbox$/);
});

test('a device can be added in the sandbox', async ({ page }) => {
  await page.goto('/sandbox');
  await page.getByRole('button', { name: 'Add PC' }).click();
  await expect(page.getByRole('button', { name: /^PC 1/ })).toBeVisible();
});

test('a scenario shows its brief first', async ({ page }) => {
  await page.goto('/simulator/file-sharing');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
});