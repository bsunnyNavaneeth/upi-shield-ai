import { expect, test } from '@playwright/test';

test('analyze a suspicious payment message and review its warning signals', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('textbox', { name: 'Message or URL to analyze' }).fill(
    'Urgent, verify account immediately: http://192.0.2.4/claim',
  );
  await page.getByRole('button', { name: 'Analyze safely' }).click();

  await expect(page.getByText('CRITICAL RISK')).toBeVisible();
  await expect(page.getByText('89', { exact: true })).toBeVisible();
  await expect(page.getByText('Link does not use HTTPS')).toBeVisible();
  await expect(page.getByText('Link uses a numeric IP address')).toBeVisible();
  await expect(page.getByText('Risk score is an estimate, not proof of fraud.')).toBeVisible();
});
