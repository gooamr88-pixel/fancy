// Realistic user journeys against the REAL critical endpoints.
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import {
  BASE_URL, SLUG, ENABLE_PAYMENTS, ORG_EMAIL, ORG_PASSWORD, EVENT_ID,
  browseTrend, searchTrend, rsvpTrend, loginTrend, dashTrend, checkoutTrend,
  rsvpDup, bizErrors, JSON_HEADERS, randName, uniqueEmail,
} from './common.js';

// think time — real guests pause between actions (seconds)
const think = (min, max) => sleep(min + Math.random() * (max - min));

/**
 * GUEST JOURNEY (the high-volume path): browse event → search themselves →
 * submit an RSVP. This is what thousands of invitees do simultaneously when an
 * organizer blasts invitations.
 */
export function guestJourney() {
  group('guest: browse event page', () => {
    const res = http.get(`${BASE_URL}/api/v1/public/events/${SLUG}`, { tags: { endpoint: 'browse' } });
    browseTrend.add(res.timings.duration);
    const ok = check(res, { 'browse 200': (r) => r.status === 200 });
    bizErrors.add(!ok);
  });

  think(1, 3);

  group('guest: search for their name', () => {
    const q = randName().split(' ')[1].slice(0, 3);
    const res = http.get(`${BASE_URL}/api/v1/public/events/${SLUG}/rsvp/search?query=${q}`, { tags: { endpoint: 'search' } });
    searchTrend.add(res.timings.duration);
    check(res, { 'search 200': (r) => r.status === 200 });
  });

  think(2, 5); // filling out the form

  group('guest: submit RSVP', () => {
    const attending = Math.random() < 0.75; // ~75% accept
    const partySize = attending ? 1 + Math.floor(Math.random() * 3) : 1;
    const payload = {
      guestName: randName(),
      email: uniqueEmail(),
      phone: '+15551234567',
      response: attending ? 'yes' : 'no',
      partySize,
      additionalGuests: attending && partySize > 1
        ? Array.from({ length: partySize - 1 }, () => ({ fullName: randName() }))
        : [],
    };
    const res = http.post(`${BASE_URL}/api/v1/public/events/${SLUG}/rsvp`, JSON.stringify(payload), {
      headers: JSON_HEADERS, tags: { endpoint: 'rsvp_submit' },
    });
    rsvpTrend.add(res.timings.duration);
    if (res.status === 409) { rsvpDup.add(1); return; } // duplicate email — not an error
    const ok = check(res, { 'rsvp 201': (r) => r.status === 201 });
    bizErrors.add(!ok);
  });

  think(1, 4);
}

/**
 * ORGANIZER JOURNEY (lower volume, heavier per request): log in (PBKDF2),
 * load the dashboard, optionally start a Stripe checkout. k6 keeps a per-VU
 * cookie jar so the session cookie from login is reused automatically.
 */
export function organizerJourney() {
  if (!ORG_EMAIL || !ORG_PASSWORD) { think(1, 2); return; } // not configured → idle

  let authed = false;
  group('organizer: login', () => {
    const res = http.post(`${BASE_URL}/api/v1/auth/login`, JSON.stringify({ email: ORG_EMAIL, password: ORG_PASSWORD }), {
      headers: JSON_HEADERS, tags: { endpoint: 'login' },
    });
    loginTrend.add(res.timings.duration);
    authed = check(res, { 'login 200': (r) => r.status === 200 });
    bizErrors.add(!authed);
  });

  if (!authed) { think(1, 2); return; }
  think(1, 2);

  group('organizer: dashboard list', () => {
    const res = http.get(`${BASE_URL}/api/v1/events?page=1&limit=50`, { tags: { endpoint: 'dashboard' } });
    dashTrend.add(res.timings.duration);
    check(res, { 'events 200': (r) => r.status === 200 });
  });

  if (EVENT_ID) {
    think(1, 2);
    group('organizer: event stats', () => {
      const res = http.get(`${BASE_URL}/api/v1/events/${EVENT_ID}/stats`, { tags: { endpoint: 'dashboard' } });
      dashTrend.add(res.timings.duration);
      check(res, { 'stats 200': (r) => r.status === 200 });
    });

    if (ENABLE_PAYMENTS) {
      think(1, 2);
      group('organizer: create checkout (Stripe TEST mode)', () => {
        const res = http.post(`${BASE_URL}/api/v1/payments/events/${EVENT_ID}/create-checkout`,
          JSON.stringify({ tierName: 'Essential' }), { headers: JSON_HEADERS, tags: { endpoint: 'checkout' } });
        checkoutTrend.add(res.timings.duration);
        check(res, { 'checkout 200': (r) => r.status === 200 });
      });
    }
  }

  think(2, 5);
}
