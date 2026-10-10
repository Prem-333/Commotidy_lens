import { test, expect } from '@playwright/test';

test('landing renders computed observations and opens the workspace', async ({ page }) => {
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Gold has one price. MCX has four.' })).toBeVisible();
  await expect(page.locator('.preview-quotes>div')).toHaveCount(4);
  await page.screenshot({ path: '../artifacts/landing-desktop.png', fullPage: true });
  await page.getByRole('link', { name: 'Open Dashboard', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'The market, in perspective.' })).toBeVisible();
  await expect(page.locator('.contract-card')).toHaveCount(4);
  await expect(page.locator('.js-plotly-plot')).toHaveCount(1);
  await expect(page.getByText('Sample data', { exact: true })).toBeVisible();
  await page.screenshot({ path: '../artifacts/dashboard-desktop.png', fullPage: true });
  expect(failures).toEqual([]);
});

test('all analytics views load without runtime errors', async ({ page }) => {
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(error.message));
  for (const [route, heading] of [
    ['normalizer', 'One gram. One standard.'],
    ['relative-value', 'Find the difference that matters.'],
    ['term-structure', 'A longer view of gold.'],
    ['liquidity', 'A price is only half the story.'],
    ['contracts', 'Know what you’re comparing.'],
    ['settings', 'Your research environment.'],
  ]) {
    await page.goto(`/app/${route}`);
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    await expect(page.locator('.method')).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.locator('.method summary').click();
    await expect(page.locator('.method')).toHaveAttribute('open', '');
  }
  expect(failures).toEqual([]);
});

test('walk-forward execution, changed-parameter notice and CSV export', async ({ page }) => {
  await page.goto('/app/backtest?date=2026-10-09&month=2026-10&entry_z=1.2&exit_z=0.4');
  await page.getByRole('button', { name: 'Run walk-forward test' }).click();
  await expect(page.getByRole('heading', { name: 'Gross promise. Net reality.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Trade ledger' })).toBeVisible();
  await expect(page.locator('.js-plotly-plot')).toHaveCount(2);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'CSV', exact: true }).click();
  expect((await download).suggestedFilename()).toContain('trades');
  await page.getByLabel('Entry z-score').fill('2.5');
  await expect(page.getByText('Parameters changed.', { exact: false })).toBeVisible();
});

test('palette, URL filters, theme and chart export', async ({ page }) => {
  await page.goto('/app/overview');
  await expect(page.locator('.contract-card')).toHaveCount(4);
  await page.getByRole('button', { name: 'Open command palette' }).click();
  await page.getByRole('textbox', { name: 'Search pages' }).fill('relative');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /Relative Value/ })
    .click();
  await expect(page).toHaveURL(/relative-value/);
  await page.getByLabel('Contract pair').selectOption('GOLDM/GOLDGUINEA');
  await expect(page).toHaveURL(/pair=GOLDM%2FGOLDGUINEA/);
  await expect(page.locator('.js-plotly-plot')).toHaveCount(2);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Normalized spread PNG' }).click();
  expect((await download).suggestedFilename()).toContain('.png');
  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.screenshot({ path: '../artifacts/dashboard-light.png', fullPage: true });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('mobile dashboard and navigation have no horizontal page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/app/overview');
  await expect(page.locator('.contract-card')).toHaveCount(4);
  await expect(page.locator('.js-plotly-plot')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
  await page.screenshot({ path: '../artifacts/dashboard-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('link', { name: 'Normalizer', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'One gram. One standard.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
  await page.goto('/');
  await expect(page.locator('.preview-quotes>div')).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
  await page.screenshot({ path: '../artifacts/landing-mobile.png', fullPage: true });
});

test('failed API provides a visible recovery state', async ({ page }) => {
  await page.route('**/api/health', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Data service temporarily unavailable' }),
    }),
  );
  await page.goto('/app/overview');
  await expect(page.getByRole('alert')).toContainText('Data service temporarily unavailable');
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});

test('empty imported source provides an honest empty state', async ({ page }) => {
  await page.route('**/api/health', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'empty',
        source: 'imported',
        rows: 0,
        dates: [],
        last_bhavcopy_date: null,
        age_days: null,
        specs_verified: false,
        warning: 'No imported records',
      }),
    }),
  );
  await page.goto('/app/overview');
  await expect(page.getByRole('heading', { name: 'No observations have been loaded' })).toBeVisible();
  await expect(page.locator('.skeleton')).toHaveCount(0);
  await expect(page.getByText('Imported EOD', { exact: true })).toBeVisible();
});
