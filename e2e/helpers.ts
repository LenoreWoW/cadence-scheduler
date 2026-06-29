import { Page, expect } from '@playwright/test';

// Role → the Arabic-free English label shown on the dev quick-login buttons.
export const ROLE_BUTTON = {
  admin: 'Admin',
  manager: 'Manager',
  sub: 'Subordinate',
  guest: 'Guest',
} as const;

export type RoleKey = keyof typeof ROLE_BUTTON;

// Log in via the dev quick-login buttons and land on the home dashboard.
export async function login(page: Page, role: RoleKey) {
  await page.goto('/login');
  // Ensure English so button labels match regardless of a persisted choice.
  const toggle = page.getByRole('button', { name: 'Switch language' });
  if (await page.evaluate(() => document.documentElement.lang === 'ar')) {
    await toggle.click();
  }
  await page.getByRole('button', { name: ROLE_BUTTON[role], exact: true }).click();
  await expect(page).toHaveURL('http://localhost:5173/');
}

// Open the header account dropdown.
export async function openAccountMenu(page: Page) {
  await page.getByTestId('account-button').click();
}

// Sign out via the account dropdown.
export async function signOut(page: Page) {
  await openAccountMenu(page);
  await page.getByTestId('account-signout').click();
}

// A YYYY-MM-DD date `days` in the future (local).
export function futureDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
