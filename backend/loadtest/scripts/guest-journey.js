// GUEST load — the critical high-volume path (browse → search → RSVP).
// Concurrency level is set via -e LEVEL=100|500|1000|5000.
//
//   k6 run -e BASE_URL=http://localhost:5000 -e SLUG=demo -e LEVEL=100 \
//          --summary-export results/guest-100.json scripts/guest-journey.js
import { stagesFor, thresholds, LEVEL } from '../lib/common.js';
import { guestJourney } from '../lib/journeys.js';

export const options = {
  scenarios: {
    guests: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: stagesFor(LEVEL),
      gracefulRampDown: '20s',
    },
  },
  thresholds,
  // Surface p99 in the end-of-test summary.
  summaryTrendStats: ['avg', 'min', 'med', 'p(95)', 'p(99)', 'max'],
};

export default function () {
  guestJourney();
}
