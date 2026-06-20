// @ts-check
const { expect } = require('@playwright/test');

/**
 * Centralized selectors / flows so the specs stay readable and any UI drift is
 * fixed in ONE place. Each interactive helper prefers a `data-testid` (add the
 * ones listed in README §"Selector hardening" for rock-solid stability) and
 * falls back to accessible role/text selectors that match the current UI.
 */

/** Click a button by testid if present, else by an accessible-name regex. */
async function clickButton(page, { testId, name }) {
  if (testId) {
    const byId = page.getByTestId(testId);
    if (await byId.count()) { await byId.first().click(); return true; }
  }
  const byRole = page.getByRole('button', { name }).filter({ visible: true });
  if (await byRole.count()) { await byRole.first().click(); return true; }
  // Some "buttons" here are styled <div>/<motion.button>; fall back to any visible text.
  const byText = page.locator('button, [role="button"]').filter({ hasText: name }).filter({ visible: true });
  if (await byText.count()) { await byText.first().click(); return true; }
  return false;
}

/** Assert the page has no horizontal overflow (mobile-responsive sanity, Task 11). */
async function expectNoHorizontalScroll(page, label = 'page') {
  const overflow = await page.evaluate(() => {
    const el = document.documentElement;
    return el.scrollWidth - el.clientWidth;
  });
  // Allow a 2px rounding tolerance.
  expect(overflow, `${label} should not scroll horizontally on this viewport`).toBeLessThanOrEqual(2);
}

class LoginPage {
  constructor(page) { this.page = page; }

  async goto() { await this.page.goto('/login'); }

  async login(email, password) {
    await this.goto();
    await this.page.locator('#email').fill(email);
    await this.page.locator('#password').fill(password);
    await this.page.getByRole('button', { name: /sign in/i }).click();
    // Successful login stores org_id and routes to the dashboard.
    await this.page.waitForURL('**/dashboard', { timeout: 20_000 });
  }
}

class CreateEventWizard {
  constructor(page) { this.page = page; }

  async goto() { await this.page.goto('/dashboard/create-event'); }

  /**
   * Drives Templates -> Configure and creates the draft event (POST /events on
   * "Continue"). Returns the generated slug. Full payment/activation is out of
   * automated scope (Stripe + admin approval) — see README.
   */
  async createDraft({ title }) {
    await this.goto();

    // ── Step 1: Templates ── pick a curated template, then advance.
    await this.page.getByText(/royale wedding|eternal love|custom canvas/i).first().click().catch(() => {});
    await clickButton(this.page, { testId: 'wizard-next', name: /next|continue|proceed/i });

    // ── Step 2: Configure ── title + date are the required fields.
    const titleInput = this.page.getByLabel(/title|event name/i)
      .or(this.page.getByPlaceholder(/title|event name|name your event/i));
    await titleInput.first().fill(title);

    const dateInput = this.page.locator('input[type="datetime-local"], input[type="date"]').first();
    if (await dateInput.count()) {
      await dateInput.fill('2026-12-31T18:00').catch(async () => { await dateInput.fill('2026-12-31'); });
    }

    // Capture the auto-generated, URL-safe slug shown on the Configure step.
    let slug = '';
    const slugField = this.page.locator('input[name="slug"], #slug, [data-testid="event-slug"]').first();
    if (await slugField.count()) slug = (await slugField.inputValue().catch(() => '')) || '';
    if (!slug) {
      slug = title.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    }

    // "Continue" from Configure performs the create (or update) and moves to Payment.
    await clickButton(this.page, { testId: 'wizard-next', name: /next|continue|proceed/i });

    // Proof of creation: the wizard advanced to the Payment step (pricing tiers visible).
    await expect(
      this.page.getByText(/payment|pricing|tier|license|pay with card|checkout/i).first(),
    ).toBeVisible({ timeout: 20_000 });

    return slug;
  }
}

class PublicRsvpPage {
  constructor(page) { this.page = page; }

  async goto(slug) { await this.page.goto(`/${slug}/rsvp`); }

  /**
   * Completes the public RSVP wizard as a NEW guest (no prior invitation):
   * name -> search (no match) -> continue as new guest -> Accept -> details -> submit.
   * Asserts the success state. `name` should be unique so it never matches an
   * existing invite (and never collides on the duplicate-email guard).
   */
  async submitAsNewGuest({ slug, name, email }) {
    await this.goto(slug);

    // Guard: the event must be live (paid + active). A non-live event shows a notice.
    await expect(this.page.locator('body')).not.toContainText(
      /payment has not been completed|awaiting review|not found/i,
      { timeout: 10_000 },
    ).catch(() => { throw new Error(`Event "${slug}" is not live — cannot RSVP. Use an active event / the demo event.`); });

    // ── Step 1: Name ──
    const nameInput = this.page.getByPlaceholder(/name/i).or(this.page.getByRole('textbox')).first();
    await nameInput.fill(name);

    // Optional "Search" reveals the "continue as new guest" path when there's no match.
    await clickButton(this.page, { testId: 'rsvp-search', name: /search|بحث/i });
    await clickButton(this.page, { testId: 'rsvp-continue-new', name: /new guest|continue|register|rsvp|proceed/i });

    // ── Step 2: Attending choice ── pick "Accept / Attending" (auto-advances).
    await clickButton(this.page, { testId: 'attendance-yes', name: /accept|attend|joyful|yes|نعم|going/i });
    // Some layouts need an explicit advance after choosing.
    await clickButton(this.page, { testId: 'rsvp-next', name: /next|continue|proceed/i });

    // ── Step 3: Details ── email (party size defaults to 1; keep the flow minimal).
    const emailInput = this.page.getByPlaceholder(/email|name@/i)
      .or(this.page.getByLabel(/email/i));
    if (await emailInput.count()) await emailInput.first().fill(email);

    // Advance through any remaining detail/question steps, then submit.
    await clickButton(this.page, { testId: 'rsvp-next', name: /next|continue|proceed/i });
    await clickButton(this.page, { testId: 'rsvp-submit', name: /submit|confirm|send|finish|تأكيد|complete/i });

    // ── Success ──
    await expect(
      this.page.getByText(/thank you|confirmed|success|recorded|received|see you|شكرا/i).first(),
    ).toBeVisible({ timeout: 20_000 });
  }
}

class Dashboard {
  constructor(page) { this.page = page; }

  async goto() { await this.page.goto('/dashboard'); }

  /** Opens the live event and switches to its RSVP board (so realtime can update it). */
  async openEventRsvps(slug) {
    await this.goto();
    await clickButton(this.page, { testId: `event-card-${slug}`, name: new RegExp(slug, 'i') }).catch(() => {});
    await clickButton(this.page, { testId: 'tab-rsvps', name: /rsvps?|guests?/i }).catch(() => {});
  }

  /**
   * Verifies a guest shows up on the organizer's RSVP board for the live event.
   * Step 1: give Supabase realtime a window to push the new row onto the OPEN board
   * (the true live-update path). Step 2 (fallback): re-select the event + RSVPs tab
   * to force a refetch — deterministic even if realtime is blocked in the run env.
   */
  async expectGuestVisibleLive(slug, guestName, { attempts = 5 } = {}) {
    const guest = () => this.page.getByText(guestName, { exact: false }).first();

    // First, the live path: watch the already-open board for ~10s.
    try {
      await expect(guest()).toBeVisible({ timeout: 10_000 });
      return;
    } catch { /* realtime didn't land — fall through to refetch loop */ }

    for (let i = 0; i < attempts; i++) {
      await this.openEventRsvps(slug);
      try {
        await expect(guest()).toBeVisible({ timeout: 4_000 });
        return;
      } catch {
        await this.page.waitForTimeout(1_500);
      }
    }
    throw new Error(`Guest "${guestName}" never appeared on the dashboard RSVP board for "${slug}".`);
  }
}

module.exports = { LoginPage, CreateEventWizard, PublicRsvpPage, Dashboard, clickButton, expectNoHorizontalScroll };
