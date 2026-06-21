// Shared config + helpers for the k6 load scripts.
// All tunables come from env so the same scripts drive every concurrency level.
import { Trend, Rate, Counter } from 'k6/metrics';

export const BASE_URL = (__ENV.BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
export const SLUG = __ENV.SLUG || 'demo'; // the 'demo' event bypasses the payment gate (see submitPublicRSVP)
export const LEVEL = Number(__ENV.LEVEL || 100); // target simultaneous users
export const ENABLE_PAYMENTS = __ENV.ENABLE_PAYMENTS === 'true'; // hits Stripe (test mode) — off by default
export const ORG_EMAIL = __ENV.ORG_EMAIL || '';
export const ORG_PASSWORD = __ENV.ORG_PASSWORD || '';
export const EVENT_ID = __ENV.EVENT_ID || ''; // an owned event id for organizer/dashboard calls

// ── Per-endpoint latency trends (tagged so the summary breaks them out) ──
export const browseTrend = new Trend('t_browse', true);
export const searchTrend = new Trend('t_search', true);
export const rsvpTrend = new Trend('t_rsvp_submit', true);
export const loginTrend = new Trend('t_login', true);
export const dashTrend = new Trend('t_dashboard', true);
export const checkoutTrend = new Trend('t_checkout', true);

export const rsvpDup = new Counter('rsvp_duplicate_409');
export const bizErrors = new Rate('business_errors'); // non-2xx that aren't expected 409s

// Ramp profile for a given concurrency level: warm up, hold steady (the real
// measurement window), then drain. Steady state is where you read avg/p95/p99.
export function stagesFor(level) {
  const target = Number(level) || 100;
  return [
    { duration: '30s', target: Math.ceil(target * 0.5) }, // ramp to 50%
    { duration: '1m', target },                            // ramp to 100%
    { duration: '3m', target },                            // ← STEADY STATE (measure here)
    { duration: '30s', target: 0 },                        // drain
  ];
}

// Global pass/fail gates. A run that breaches these marks the level as the
// breaking point. Tighten per your SLO.
export const thresholds = {
  http_req_failed: ['rate<0.01'],                 // <1% hard errors
  http_req_duration: ['p(95)<800', 'p(99)<1500'], // overall
  t_browse: ['p(95)<500'],
  t_rsvp_submit: ['p(95)<1200'],
  t_login: ['p(95)<2000'],                        // PBKDF2 is intentionally slow
  business_errors: ['rate<0.02'],
};

export const JSON_HEADERS = { 'Content-Type': 'application/json' };

const FIRST = ['Alex', 'Sam', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Jamie', 'Avery', 'Quinn'];
const LAST = ['Smith', 'Lee', 'Patel', 'Garcia', 'Khan', 'Nguyen', 'Brown', 'Diaz', 'Ali', 'Cohen'];
export const pick = (a) => a[Math.floor(Math.random() * a.length)];
export const randName = () => `${pick(FIRST)} ${pick(LAST)}`;

// Unique per (VU, iteration, time) so RSVP inserts never collide on the partial
// unique email index (which would return a 409 and skew the numbers).
export function uniqueEmail() {
  return `lt_${__VU}_${__ITER}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@loadtest.example`;
}
