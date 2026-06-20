// @ts-check
const { test, expect } = require('@playwright/test');
const {
  LoginPage, CreateEventWizard, PublicRsvpPage, Dashboard, expectNoHorizontalScroll,
} = require('../pages/pageObjects');

/**
 * FULL END-TO-END JOURNEY (Task 20), exercised across the cross-browser + mobile
 * matrix (Tasks 10 & 11). Steps:
 *   1. Organizer logs in.
 *   2. Organizer creates an event (draft) via the wizard.
 *   3. A guest opens the public RSVP link.
 *   4. The guest fills + submits the RSVP (responsiveness asserted on mobile).
 *   5. The organizer's dashboard reflects the new RSVP (live, with reload fallback).
 *
 * Why a separate event for steps 3–5: a freshly created event is "pending review"
 * until paid + admin-approved (a deliberate platform gate), so guests can't RSVP
 * to it yet. Steps 3–5 therefore run against an ACTIVE event the organizer owns
 * (LIVE_SLUG; the always-live `demo` event by default). See README.
 */
const ORG_EMAIL = process.env.ORG_EMAIL;
const ORG_PASSWORD = process.env.ORG_PASSWORD;
const LIVE_SLUG = process.env.LIVE_SLUG || 'demo';

test.describe('Organizer + Guest end-to-end journey', () => {
  test.skip(!ORG_EMAIL || !ORG_PASSWORD, 'Set ORG_EMAIL / ORG_PASSWORD in e2e/.env to run the E2E journey.');

  // The whole journey is one user story; give it room across slower mobile engines.
  test.setTimeout(150_000);

  test('login → create event → public RSVP → guest submits → dashboard live update', async ({ page, browser }, testInfo) => {
    const stamp = Date.now();
    const guestName = `E2E Guest ${stamp}`;
    const guestEmail = `e2e+${stamp}@loadtest.example`;
    const dash = new Dashboard(page);

    // A separate, anonymous context for the guest (kept open across steps 3–5 so
    // the organizer's dashboard can observe the realtime push it produces).
    const guestContext = await browser.newContext({
      viewport: page.viewportSize() || undefined,
      userAgent: await page.evaluate(() => navigator.userAgent),
    });
    const guestPage = await guestContext.newPage();

    try {
      // ── Step 1: Organizer logs in ─────────────────────────────────────────
      await test.step('1. Organizer logs in', async () => {
        await new LoginPage(page).login(ORG_EMAIL, ORG_PASSWORD);
        await expect(page).toHaveURL(/\/dashboard/);
      });

      // ── Step 2: Organizer creates an event (draft) ────────────────────────
      await test.step('2. Organizer creates an event', async () => {
        const slug = await new CreateEventWizard(page).createDraft({ title: `E2E Wedding ${stamp}` });
        testInfo.annotations.push({ type: 'created-event-slug', description: slug });
        expect(slug, 'a URL-safe slug should be generated for the new event').toMatch(/^[a-z0-9-]+$/);
      });

      // ── Step 3: Guest navigates to the public RSVP link ───────────────────
      await test.step('3. Guest opens the public RSVP link', async () => {
        await new PublicRsvpPage(guestPage).goto(LIVE_SLUG);
        // Task 11: no horizontal overflow on this project's viewport (mobile incl.).
        await expectNoHorizontalScroll(guestPage, 'public RSVP page');
      });

      // Organizer opens the live event's RSVP board so the next submit pushes LIVE.
      await dash.openEventRsvps(LIVE_SLUG);

      // ── Step 4: Guest fills + submits the RSVP ────────────────────────────
      await test.step('4. Guest fills and submits the RSVP', async () => {
        await new PublicRsvpPage(guestPage).submitAsNewGuest({ slug: LIVE_SLUG, name: guestName, email: guestEmail });
      });

      // ── Step 5: Organizer dashboard reflects the new RSVP (live) ──────────
      await test.step('5. Organizer dashboard updates live with the new RSVP', async () => {
        await dash.expectGuestVisibleLive(LIVE_SLUG, guestName);
      });
    } finally {
      await guestContext.close();
    }
  });
});
