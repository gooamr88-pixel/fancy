import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(''), usePathname: () => '/pricing' }));
vi.mock('../src/app/components/landing/Navbar', () => ({ default: () => null }));
vi.mock('../src/app/components/landing/FooterSection', () => ({ default: () => null }));

/* ═══════════════════════════════════════════════════════════════════════════
   EACH PLAN CARD LISTS WHAT IT ADDS.

   Tier features are cumulative — an admin ticks the full set on each tier — so
   before this, every card restated everything the cards above it had already
   listed. Measured on a 440px iPhone 16 Pro Max that was 61 bullets and a
   10,020px page, roughly six screens of the plan section alone being mostly
   repetition.

   Two properties are pinned here, and the second one is the one that matters:

   1. when a tier genuinely contains the one below it, the card says
      "Everything in <previous>, plus" and lists only the difference;

   2. when it does NOT — which nothing in the product prevents, because tiers
      are ticked independently — the card must fall back to its full list.
      Printing "Everything in Signature" on a tier that is missing something
      Signature has would be a false claim on a pricing page.
   ═══════════════════════════════════════════════════════════════════════════ */

const mockTiers = vi.hoisted(() => ({ current: [] }));

vi.mock('../src/app/utils/usePublicPricing', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, usePublicPricing: () => ({ tiers: mockTiers.current, error: null }) };
});

const PricingPage = (await import('../src/app/pricing/page')).default;

const ESSENTIAL = ['Basic RSVP forms', 'Email notifications'];
const SIGNATURE = [...ESSENTIAL, 'Seating chart designer', 'Text messaging'];

function tier(name, features, extra = {}) {
  return {
    name,
    price_cents: 9900,
    currency: 'USD',
    max_guests: 100,
    is_custom: false,
    description: `${name} plan`,
    features,
    ...extra,
  };
}

/** The card is the element containing the plan's name heading. */
function cardFor(container, name) {
  const el = [...container.querySelectorAll('.pricing-card')]
    .find((c) => (c.textContent || '').includes(name));
  expect(el, `no card rendered for ${name}`).toBeTruthy();
  return el;
}

describe('a plan card lists what it adds, not everything it has', () => {
  it('says "Everything in <previous>" and drops the inherited features', () => {
    mockTiers.current = [
      tier('Essential', ESSENTIAL),
      tier('Signature', SIGNATURE, { max_guests: 300 }),
    ];
    const { container } = render(<PricingPage />);

    const signature = cardFor(container, 'Signature');
    expect(signature.textContent).toContain('Everything in Essential, plus:');

    // Its own additions are present…
    expect(within(signature).getByText('Seating chart designer')).toBeTruthy();
    expect(within(signature).getByText('Text messaging')).toBeTruthy();

    // …and the two it inherits are NOT repeated on this card.
    expect(within(signature).queryByText('Basic RSVP forms')).toBeNull();
    expect(within(signature).queryByText('Email notifications')).toBeNull();

    // The guest cap is not a feature and must survive the delta.
    expect(signature.textContent).toContain('Up to 300 guests');
  });

  it('the first card never claims to inherit from anything', () => {
    mockTiers.current = [
      tier('Essential', ESSENTIAL),
      tier('Signature', SIGNATURE),
    ];
    const { container } = render(<PricingPage />);
    const essential = cardFor(container, 'Essential');

    expect(essential.textContent).not.toContain('Everything in');
    expect(within(essential).getByText('Basic RSVP forms')).toBeTruthy();
    expect(within(essential).getByText('Email notifications')).toBeTruthy();
  });

  it('falls back to the full list when the tier is NOT a superset', () => {
    /* Enterprise here is missing "Text messaging", which Signature has. Saying
       "Everything in Signature" would be a lie, so the card has to print its
       own list in full instead. */
    const brokenEnterprise = ['Basic RSVP forms', 'Email notifications', 'Seating chart designer', 'Priority email & chat support'];

    mockTiers.current = [
      tier('Signature', SIGNATURE),
      tier('Enterprise', brokenEnterprise, { max_guests: 1000 }),
    ];
    const { container } = render(<PricingPage />);
    const enterprise = cardFor(container, 'Enterprise');

    expect(
      enterprise.textContent,
      'claimed to include everything in Signature while missing one of its features',
    ).not.toContain('Everything in Signature');

    // Every one of its own features is listed, since nothing was elided.
    brokenEnterprise.forEach((f) => {
      expect(within(enterprise).getByText(f), `${f} is missing from the fallback list`).toBeTruthy();
    });
  });

  it('a single tier renders its whole list and no inheritance line', () => {
    mockTiers.current = [tier('Only', ESSENTIAL)];
    const { container } = render(<PricingPage />);
    const only = cardFor(container, 'Only');

    expect(only.textContent).not.toContain('Everything in');
    ESSENTIAL.forEach((f) => expect(within(only).getByText(f)).toBeTruthy());
  });

  it('the phone comparison leads with what DIFFERS, not what everyone has', async () => {
    /* At 440px the table showed 1.8 of its 5 columns, so it was replaced below
       768 by a list naming the plans per feature. That list then opened with
       five consecutive "Every plan" rows — features that cannot help anyone
       choose — pushing the actual differences a screen and a half down. */
    mockTiers.current = [
      tier('Essential', ESSENTIAL),
      tier('Signature', SIGNATURE, { max_guests: 300 }),
    ];
    const { container } = render(<PricingPage />);

    const list = container.querySelector('.cmp-mobile');
    expect(list, 'no phone comparison rendered').toBeTruthy();

    const featureNames = () => [...list.querySelectorAll('.cmp-m-feature')]
      .map((el) => el.textContent.trim());

    // Shared features are hidden behind the toggle…
    expect(featureNames()).not.toContain('Basic RSVP forms');
    // …and the differentiating ones are there.
    expect(featureNames()).toContain('Seating chart designer');

    // The toggle says how many it is holding back.
    const toggle = list.querySelector('.cmp-m-toggle button');
    expect(toggle.textContent).toMatch(/Show \d+ more on every plan/);

    fireEvent.click(toggle);
    expect(featureNames()).toContain('Basic RSVP forms');
    expect(toggle.textContent).toMatch(/Hide what every plan includes/);
  });

  it('the comparison table still credits INHERITED features to the higher tier', () => {
    /* The regression this exists to stop: the cards were changed to list a
       delta, and the table builds its matrix from the same array. Handing it
       the delta marked every inherited feature as absent — a diagonal of ticks
       in a field of dashes, telling a customer that Signature does not include
       the RSVP forms it plainly does.

       The card is a summary. The table is the claim, and it has to be true. */
    mockTiers.current = [
      tier('Essential', ESSENTIAL),
      tier('Signature', SIGNATURE, { max_guests: 300 }),
    ];
    const { container } = render(<PricingPage />);

    // The card elides it…
    const signatureCard = cardFor(container, 'Signature');
    expect(within(signatureCard).queryByText('Basic RSVP forms')).toBeNull();

    // …and the table must still say Signature has it.
    const row = [...container.querySelectorAll('div')].find((d) => {
      const first = d.firstElementChild;
      return first && first.textContent.trim() === 'Basic RSVP forms'
        && d.children.length === 3; // feature + one cell per plan
    });
    expect(row, 'no comparison row found for an inherited feature').toBeTruthy();

    const cells = [...row.children].slice(1).map((c) => c.textContent.trim());
    expect(cells, 'an inherited feature was marked absent on the higher tier')
      .toEqual(['✓', '✓']);
  });
});
