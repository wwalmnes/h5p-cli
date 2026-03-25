import { test, expect } from '@playwright/test';

test('dashboard loads and renders the New button', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.locator('#newContentButton')).toBeVisible();
});
