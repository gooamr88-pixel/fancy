'use client';

import { useEffect, useState } from 'react';
import { publicApiFetch } from './publicApi';

/**
 * Fetches the live subscription tiers from `super_admin_config.pricing_tiers`
 * via the public, customer-safe endpoint — the same data admins edit at
 * /admin/config "Subscription Tiers" and that checkout actually charges
 * against — so marketing pricing surfaces can never drift from real config.
 */
export function usePublicPricing() {
  const [tiers, setTiers] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await publicApiFetch('/payments/public-pricing');
        if (!cancelled) setTiers(Array.isArray(data.tiers) ? data.tiers : []);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load pricing.');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { tiers, error };
}

export function formatTierPrice(tier) {
  if (tier.is_custom) {
    return { price: tier.price_label || 'Custom', period: '' };
  }
  if (!tier.price_cents) {
    return { price: tier.price_label || 'Free', period: '' };
  }
  const dollars = tier.price_cents / 100;
  const price = Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
  return { price, period: '/ event' };
}

export function tierCta(tier) {
  if (tier.cta_label) return tier.cta_label;
  if (tier.is_custom) return 'Contact Sales';
  if (!tier.price_cents) return 'Get Started Free';
  return 'Get Started';
}

export function tierHref(tier) {
  return tier.is_custom ? '/contact' : '/register';
}

export function tierGuestLine(tier) {
  return tier.max_guests > 0 ? `Up to ${tier.max_guests} guests` : 'Unlimited guests';
}
