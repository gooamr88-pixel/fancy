import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import {
  REFUND_SUMMARY,
  REFUND_TERMS,
  REFUND_WINDOW_DAYS,
  PAYMENT_MODEL,
  REFUND_HOW,
} from '../src/app/utils/refundPolicy';
import { REFUND_REQUEST_HREF } from '../src/app/utils/company';
import { FAQS } from '../src/app/components/landing/faqContent';
import { buildFaqs } from '../src/app/pricing/pricingData';

/* ═══════════════════════════════════════════════════════════════════════════
   ONE REFUND POLICY.

   On 2026-08-21 this site answered "can I get a refund?" three ways, in three
   documents a customer can open in three tabs:

     /pricing  "refunds are handled case-by-case rather than automatically"
     homepage  "a full refund within 14 days … pro-rated credit for an active one"
     /terms    "Annual subscriptions may be refunded within 14 days …
                Monthly subscriptions are generally non-refundable"

   The third explains the other two. /terms §7 was written for a SUBSCRIPTION
   — billing cycles, renewals, failed recurring payments — and this product has
   never sold one: there is a free tier and a one-time fee per event. A refund
   clause turning on renewal dates cannot be applied to a product with none, so
   each surface improvised, and each improvised differently.

   These cases do not pin the POLICY, which is a commercial decision and may
   change. They pin that there is exactly one of it, and that no surface has
   started wording it itself again.
   ═══════════════════════════════════════════════════════════════════════════ */

const ROOT = process.cwd();
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const readRepo = (rel) => fs.readFileSync(path.join(ROOT, '..', rel), 'utf8');
const stripComments = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^[ \t]*\/\/.*$/gm, ' ');

const TERMS = stripComments(read('src/app/terms/page.js'));
const FAQ_SRC = stripComments(read('src/app/components/landing/faqContent.js'));
const PRICING_SRC = stripComments(read('src/app/pricing/pricingData.js'));

const TIERS = [
  { key: 'free', name: 'Free', price_cents: 0, max_guests: 100, max_events: 0, is_custom: false, features: [] },
];

const refundAnswers = () => {
  const home = FAQS.find((f) => /refund/i.test(f.q));
  const pricing = buildFaqs(TIERS).find((f) => /refund/i.test(f.q));
  return { home, pricing };
};

describe('the site gives one answer about refunds', () => {
  it('has a refund answer on both the homepage and pricing', () => {
    const { home, pricing } = refundAnswers();
    expect(home, 'the homepage lost its refund question').toBeTruthy();
    expect(pricing, 'pricing lost its refund question').toBeTruthy();
  });

  it('prints the same words in both, from the shared module', () => {
    const { home, pricing } = refundAnswers();
    expect(home.a).toContain(REFUND_SUMMARY);
    expect(pricing.a).toContain(REFUND_SUMMARY);
  });

  it('gives each answer the next step its reader actually needs', () => {
    /* Not the same link on both, deliberately.

       Someone reading the homepage FAQ has decided they want a refund, so the
       useful next step is the REQUEST — handing them a legal document to read
       instead of a form to fill in is the wrong move. Someone on /pricing is
       still deciding whether to buy, so the useful next step is the TERMS.
       Both answers carry the same policy text; only the door differs. */
    const { home, pricing } = refundAnswers();
    expect(home.link).toMatchObject({ href: REFUND_REQUEST_HREF });
    expect(pricing.link).toMatchObject({ href: '/terms' });
  });

  it('explains HOW to ask, not only whether one is owed', () => {
    /* A policy with no route is a rule without a door: the previous version
       ended at a bare mailto buried in Terms §7. */
    const { home, pricing } = refundAnswers();
    [home.a, pricing.a].forEach((answer) => {
      expect(answer).toContain(REFUND_HOW);
    });
    expect(REFUND_HOW).toMatch(/business days/);
    expect(REFUND_HOW).toMatch(/returned to the card/);
  });

  it('promises a refund route the backend can actually honour', () => {
    // stripeRefundService issues the card refund and records a book-keeping
    // refund for a manually paid event; the admin endpoint exposes it.
    const svc = readRepo('backend/services/stripeRefundService.js');
    expect(svc.length).toBeGreaterThan(0);
    expect(readRepo('backend/controllers/adminController.js'))
      .toMatch(/refundEventPayment/);
  });

  it('does not let a surface write its own version', () => {
    /* The failure mode is not a wrong policy, it is a SECOND policy: someone
       edits one page's answer in place and the other two keep the old one.
       Every surface must reach the wording through the import. */
    [['faqContent.js', FAQ_SRC], ['pricingData.js', PRICING_SRC], ['terms/page.js', TERMS]]
      .forEach(([name, src]) => {
        expect(src, `${name} does not import the shared policy`).toMatch(/refundPolicy/);
      });
    // and the window is a number in one place, not a literal typed three times
    expect(REFUND_WINDOW_DAYS).toBe(14);
    expect(REFUND_SUMMARY).toContain(String(REFUND_WINDOW_DAYS));
    expect(REFUND_TERMS).toContain(String(REFUND_WINDOW_DAYS));
  });

  it('states the condition the whole policy turns on', () => {
    // "as long as the event has not gone live" is the condition, and the terms
    // must define where that line is rather than leaving a customer to guess.
    expect(REFUND_SUMMARY).toMatch(/gone live/i);
    expect(REFUND_TERMS).toMatch(/"Gone live" means/);
    expect(REFUND_TERMS).toMatch(/published/i);
  });
});

describe('the terms describe the product that exists', () => {
  it('says plainly that there is no subscription', () => {
    expect(PAYMENT_MODEL).toMatch(/not a subscription/i);
    expect(PAYMENT_MODEL).toMatch(/one-time fee/i);
  });

  it('no longer bills on a monthly or annual cycle', () => {
    /* The exact language that caused this: monthly and annual billing cycles,
       renewals, and a downgrade on a failed recurring payment — for a product
       that charges once, per event, and renews nothing. */
    expect(TERMS).not.toMatch(/monthly or annual/i);
    expect(TERMS).not.toMatch(/billing cycle/i);
    expect(TERMS).not.toMatch(/prepaid subscription/i);
    expect(TERMS).not.toMatch(/next billing/i);
  });

  it('carries the refund clause itself, not a retelling of it', () => {
    expect(TERMS).toMatch(/REFUND_TERMS/);
    expect(TERMS).toMatch(/PAYMENT_MODEL/);
  });

  it('keeps the metered add-ons out of the licence refund', () => {
    // Texts already sent and goods already produced are a real cost incurred
    // on the customer's behalf; folding them into "full refund" would promise
    // something the business cannot do.
    expect(REFUND_TERMS).toMatch(/text\s+messages sent/i);
    expect(REFUND_TERMS).toMatch(/not refundable/i);
  });
});
