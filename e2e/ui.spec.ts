import { test, expect } from '@playwright/test';
import { login, openAccountMenu } from './helpers';

test.describe('navigation, i18n & theme', () => {
  test('admin can reach every primary screen', async ({ page }) => {
    await login(page, 'admin');
    const nav = page.getByRole('navigation', { name: 'Primary' });

    await nav.getByRole('link', { name: 'Schedule' }).click();
    await expect(page.getByRole('heading', { name: 'Schedule', level: 1 })).toBeVisible();

    await nav.getByRole('link', { name: 'Book' }).click();
    await expect(page.getByRole('heading', { name: 'Book time with the team.' })).toBeVisible();

    await nav.getByRole('link', { name: 'Requests' }).click();
    await expect(page.getByRole('heading', { name: 'Requests', level: 1 })).toBeVisible();

    await openAccountMenu(page);
    await page.getByTestId('account-profile').click();
    await expect(page.getByRole('heading', { name: 'Profile', level: 1 })).toBeVisible();
  });

  test('schedule month view renders a calendar grid', async ({ page }) => {
    await login(page, 'admin');
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Schedule' }).click();
    await page.getByRole('button', { name: 'Month' }).click();
    for (const d of ['Sun', 'Mon', 'Sat']) {
      await expect(page.getByText(d, { exact: true })).toBeVisible();
    }
  });

  test('language toggle flips the document to RTL Arabic and back', async ({ page }) => {
    await login(page, 'admin');

    await openAccountMenu(page);
    await page.getByTestId('account-language').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.getByRole('navigation', { name: 'التنقل الرئيسي' })).toBeVisible();

    await openAccountMenu(page);
    await page.getByTestId('account-language').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  });

  test('dark mode preference persists across reloads', async ({ page }) => {
    await login(page, 'admin');
    await openAccountMenu(page);
    await page.getByTestId('account-profile').click();

    await page.getByRole('switch', { name: 'Toggle dark mode' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    await page.reload();
    await expect(page.locator('html')).toHaveClass(/dark/);
  });
});
