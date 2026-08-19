import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/* ═══════════════════════════════════════════════════════════════════════════
   THE CLIENT MUST IDENTIFY A PLAN BY ITS KEY, NOT BY ITS NAME.

   A pricing tier had no identity: the display name was the primary key, so an
   admin renaming "Enterprise" detached every event that had bought it —
   revoking paid features, charging the next upgrade full price, hiding the
   upgrade button, and turning that plan's promo codes into unlimited-guest
   grants. The backend now resolves plans by a stable `key`
   (backend/utils/tierResolver.js).

   That fix is only as good as what the client sends. These are source-level
   assertions on purpose: the failure they guard against is silent — the
   request still succeeds, it just quietly goes back to being name-based, and
   no rendered output looks any different.
   ═══════════════════════════════════════════════════════════════════════════ */

const EVENTS_TAB = read('src/app/dashboard/components/EventsTab.js');
const WIZARD = read('src/app/dashboard/create-event/page.js');
const ADMIN_EVENTS = read('src/app/admin/(panel)/events/page.js');
const ADMIN_PROMOS = read('src/app/admin/(panel)/promo-codes/page.js');
const ADMIN_CONFIG = read('src/app/admin/(panel)/config/page.js');
const PRICING = read('src/app/pricing/page.js');

describe('every purchase path sends the plan key', () => {
  it('card checkout and bank transfer, from the events tab', () => {
    expect(EVENTS_TAB).toMatch(/create-checkout[\s\S]{0,400}tierKey: selectedTier\.key/);
    expect(EVENTS_TAB).toMatch(/manual-payment[\s\S]{0,400}tierKey: selectedTier\.key/);
  });

  it('card checkout and bank transfer, from the creation wizard', () => {
    // The wizard tracks its selection by name (the SMS estimates map is keyed
    // that way), so it resolves the key from the loaded tiers at submit time.
    expect(WIZARD).toMatch(/const selectedTierKey =/);
    expect((WIZARD.match(/tierKey: selectedTierKey/g) || []).length)
      .toBeGreaterThanOrEqual(2);
  });

  it('resolves that key AFTER the state it reads is declared', () => {
    /* A derived `const` placed above the `useState` it reads is a temporal
       dead zone ReferenceError at render — the whole page white-screens. This
       exact ordering bug was introduced and caught here once already. */
    expect(WIZARD.indexOf('const [selectedTierName'))
      .toBeLessThan(WIZARD.indexOf('const selectedTierKey ='));
  });

  it('the admin comp grant and promo codes name a plan by key', () => {
    expect(ADMIN_EVENTS).toMatch(/tierKey: selectedTierKey/);
    expect(ADMIN_EVENTS).not.toMatch(/tierName: selectedTierName/);
    expect(ADMIN_PROMOS).toMatch(/const \[tierKey, setTierKey\]/);
    expect(ADMIN_PROMOS).toMatch(/tierKey,/);
  });
});

describe('the current plan is matched by key, not by string equality on the name', () => {
  it('the events tab resolves through one helper', () => {
    // `all.find(t => t.name === event.tier_name)` — with `===`, while the
    // backend compared lowercased — meant even a capitalisation-only rename
    // broke the client and not the server.
    expect(EVENTS_TAB).toMatch(/function findTier\(tiers, key, name\)/);
    expect(EVENTS_TAB).not.toMatch(/\.find\(t => t\.name === event\.tier_name\)/);
    expect(EVENTS_TAB).not.toMatch(/\.find\(t => t\.name === upgradeFromTier\)/);
  });

  it('still offers an upgrade path when the plan itself is gone', () => {
    // Showing NO upgrade is how a customer whose plan was deleted got stuck,
    // unable to move even onto a plan that still exists.
    expect(EVENTS_TAB).toMatch(/curPrice != null\) \? billable\.filter\(t => t\.price_cents > curPrice\) : billable/);
  });
});

describe('nothing keys behaviour off a plan NAME', () => {
  it('the pricing page routes Contact Sales from is_custom, not from "Enterprise"', () => {
    // `plan.name === "Enterprise" ? "/contact" : "/register"` sent every
    // enterprise lead to self-serve signup the moment that plan was renamed.
    expect(PRICING).not.toMatch(/name === ["']Enterprise["']/);
  });

  it('no tier name is hardcoded anywhere in these screens', () => {
    const HARDCODED = /["'](Enterprise|Signature|Essential|Professional|Premium|Starter)["']\s*(===|==|\.includes)/;
    [['EventsTab', EVENTS_TAB], ['wizard', WIZARD], ['admin events', ADMIN_EVENTS],
     ['admin promos', ADMIN_PROMOS], ['pricing', PRICING]].forEach(([name, src]) => {
      expect(HARDCODED.test(src), `${name} compares against a hardcoded plan name`).toBe(false);
    });
  });
});

describe('the admin config screen', () => {
  it('round-trips the whole tier object, so the key survives a save', () => {
    // If the form posted a rebuilt object without `key`, every save would mint
    // new identities and detach every event — the original bug, restored.
    expect(ADMIN_CONFIG).toMatch(/pricingTiers,/);
    expect(ADMIN_CONFIG).toMatch(/setPricingTiers\(pricingRes\.config\.pricing_tiers \|\| \[\]\)/);
  });

  it('tells the admin that renaming is safe, and shows the identity', () => {
    expect(ADMIN_CONFIG).toMatch(/Display name only/);
    expect(ADMIN_CONFIG).toMatch(/currentTier\.key/);
  });

  it('warns accurately about deleting instead', () => {
    // The old confirm claimed events "keep their previously-granted limits" —
    // true for the cap, false for the features, which all vanished.
    expect(ADMIN_CONFIG).toMatch(/keep the guest cap AND the features they paid for/);
  });
});
