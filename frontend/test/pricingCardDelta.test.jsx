import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

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
});
