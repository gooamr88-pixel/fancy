// @ts-check
const { test, expect } = require('@playwright/test');
const { LoginPage, expectNoHorizontalScroll } = require('../pages/pageObjects');

/**
 * SMOKE (Task 15): the fast post-deploy health check. Tagged @smoke so it can be
 * run on its own — e.g. `npm run test:smoke:chrome` after every deploy.
 * Keeps to read-only / login checks so it's safe to run against any environment.
 */
const ORG_EMAIL = process.env.ORG_EMAIL;
const ORG_PASSWORD = process.env.ORG_PASSWORD;
const LIVE_SLUG = process.env.LIVE_SLUG || 'demo';

test.describe('@smoke post-deploy health', () => {
  test('public event page renders and is responsive @smoke', async ({ page }) => {
    const res = await page.goto(`/${LIVE_SLUG}`);
    expect(res?.status(), 'event page should respond 2xx/3xx').toBeLessThan(400);
    await expect(page.locator('body')).toBeVisible();
    // Task 11 (responsive): no horizontal overflow on this project's viewport.
    await expectNoHorizontalScroll(page, 'public event page');
  });

  test('public RSVP page renders and is responsive @smoke', async ({ page }) => {
    await page.goto(`/${LIVE_SLUG}/rsvp`);
    await expect(page.locator('body')).toBeVisible();
    // At least one text input (the guest name field) should be present.
    await expect(page.getByRole('textbox').first()).toBeVisible({ timeout: 15_000 });
    await expectNoHorizontalScroll(page, 'public RSVP page');
  });

  test('organizer can log in and reach the dashboard @smoke', async ({ page }) => {
    test.skip(!ORG_EMAIL || !ORG_PASSWORD, 'Set ORG_EMAIL / ORG_PASSWORD to run the login smoke check.');
    await new LoginPage(page).login(ORG_EMAIL, ORG_PASSWORD);
    await expect(page).toHaveURL(/\/dashboard/);
    await expectNoHorizontalScroll(page, 'dashboard');
  });
});
