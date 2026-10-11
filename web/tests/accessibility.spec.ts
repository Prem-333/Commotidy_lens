import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
for (const theme of ['dark', 'light']) {
  test(`WCAG A/AA automated checks: ${theme}`, async ({ page }) => {
    test.setTimeout(120000);
    await page.addInitScript((selected) => {
      localStorage.setItem(
        'commoditylens-preferences',
        JSON.stringify({ state: { theme: selected }, version: 1 }),
      );
    }, theme);
    for (const route of ['/', '/app/overview', '/app/relative-value', '/app/backtest', '/app/settings']) {
      await page.goto(route);
      await expect(page.locator('.skeleton')).toHaveCount(0);
      if (route === '/') {
        await expect(page.locator('.preview-quotes>div')).toHaveCount(4);
        await expect(page.locator('.hero-copy')).toHaveCSS('opacity', '1');
        await expect(page.locator('.hero-preview')).toHaveCSS('opacity', '1');
      } else await expect(page.locator('.method')).toBeVisible();
      const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(
        result.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
        })),
        route,
      ).toEqual([]);
    }
  });
}
