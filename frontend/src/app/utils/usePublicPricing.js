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

/* formatTierPrice / tierCta / tierHref lived here and are gone.
   They existed only for /pricing, which now fetches on the server and derives
   its own presentation in pricing/pricingData.js — where the price is split
   into an amount and a caption that says "once, per event" rather than the old
   "/ event", the notation a monthly subscription uses too and the single most
   common misreading of that page. Nothing else imported them. */

/** "Up to 100 guests" / "Unlimited guests", for the surfaces that want the
 *  cap as a SENTENCE — /solutions/corporate, which prints it as one bullet in
 *  a prose list.
 *
 *  Not for a comparison table. Feeding this string into a tier's feature list
 *  is how /pricing came to claim that its $299 plan did not include "Up to 100
 *  guests": the table matched features by exact string, so every tier got a
 *  tick on its own capacity sentence and a dash on all the others. Capacity is
 *  a scalar — see capacityOf() in pricing/pricingData.js. */
export function tierGuestLine(tier) {
  return tier.max_guests > 0
    ? `Up to ${Number(tier.max_guests).toLocaleString('en-US')} guests`
    : 'Unlimited guests';
}
