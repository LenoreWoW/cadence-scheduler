import { test, expect } from '@playwright/test';
import { login, signOut, futureDate } from './helpers';

// End-to-end gatekeeper flow: someone requests a meeting → an approver approves it.
test('guest requests a meeting and an admin approves it', async ({ page }) => {
  const title = `E2E Request ${Date.now()}`;

  // 1) Guest submits a request (on behalf of a named attendee → guaranteed contact details).
  await login(page, 'guest');
  await page.getByRole('link', { name: 'Book' }).click();
  await expect(page.getByRole('heading', { name: 'Book time with the team.' })).toBeVisible();

  await page.locator('select').first().selectOption({ index: 1 }); // first real host
  await page.getByText('Booking for someone else?').click();
  await page.getByLabel('Attendee name').fill('Test Attendee');
  await page.getByLabel('Attendee email').fill('attendee@example.com');
  await page.locator('input[type="date"]').fill(futureDate(7));
  await page.getByRole('button', { name: '10:00', exact: true }).click();
  await page.getByPlaceholder("What's this meeting about?").fill(title);
  await page.getByRole('button', { name: 'Send request' }).click();

  await expect(page.getByRole('heading', { name: 'Request sent' })).toBeVisible();

  // 2) Sign out, sign back in as an approver.
  await signOut(page);
  await expect(page).toHaveURL(/\/login$/);
  await login(page, 'admin');

  // 3) Approve the request from the inbox.
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Requests' }).click();
  const card = page.locator('div').filter({ hasText: title }).filter({
    has: page.getByRole('button', { name: 'Approve' }),
  }).last();
  // Regression: the request card must show a real "Pending" status pill (the
  // /pending-approval endpoint used to omit `status`, rendering an empty pill).
  await expect(card.getByText('Pending')).toBeVisible();
  await card.getByRole('button', { name: 'Approve' }).click();

  await expect(page.getByRole('status')).toContainText('approved');

  // 4) The approved meeting now appears on the schedule.
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Schedule' }).click();
  await expect(page.getByText(title)).toBeVisible();
});
