import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('authentication & role gating', () => {
  test('admin sees the approvals nav and the under-control hero', async ({ page }) => {
    await login(page, 'admin');
    await expect(page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Requests' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('under control');
  });

  test('a guest does not see the approvals nav and gets the booking hero', async ({ page }) => {
    await login(page, 'guest');
    await expect(page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Requests' })).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Book time with the team');
  });

  test('sign out returns to the login screen', async ({ page }) => {
    await login(page, 'admin');
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });
});
