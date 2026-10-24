import { expect, test } from '@playwright/test';

test('navigation, API connectivity and preference persistence', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Your scene starts here.' }),
  ).toBeVisible();
  await expect(page.getByText('Local API connected')).toBeVisible();
  await page.getByRole('link', { name: 'Explore the build plan' }).click();
  await expect(
    page.getByRole('heading', { name: 'The path to SceneCraft.' }),
  ).toBeVisible();
  for (const section of ['Projects', 'Assets', 'AI Models', 'Settings']) {
    await page
      .getByRole('navigation')
      .getByRole('link', { name: section, exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: section, exact: true }),
    ).toBeVisible();
  }
  await page
    .getByRole('combobox', { name: 'Appearance' })
    .selectOption('light');
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Appearance' })).toHaveValue(
    'light',
  );
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole('navigation')
    .getByRole('link', { name: 'AI Models', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Add provider' }),
  ).toBeDisabled();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
});

test('an unavailable API is reported honestly and can be retried', async ({
  page,
}) => {
  await page.route('**/api/v1/health', (route) =>
    route.fulfill({ status: 503, body: '{}' }),
  );
  await page.goto('/');
  await expect(page.getByText('Local API offline')).toBeVisible();
  await page.unroute('**/api/v1/health');
  await page.getByRole('button', { name: 'Check API connection' }).click();
  await expect(page.getByText('Local API connected')).toBeVisible();
});
