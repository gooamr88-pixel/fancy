// Smoke test — 1 VU, a handful of iterations. Run this FIRST to confirm the
// target is reachable, the demo event is live, and the journeys return 2xx
// before you unleash the heavy levels.
//   k6 run -e BASE_URL=http://localhost:5000 -e SLUG=demo scripts/smoke.js
import { guestJourney, organizerJourney } from '../lib/journeys.js';

export const options = {
  vus: 1,
  iterations: 5,
  thresholds: { http_req_failed: ['rate<0.5'] },
};

export default function () {
  guestJourney();
  organizerJourney();
}
