// ORGANIZER load — auth-heavy path (login PBKDF2 → dashboard → optional checkout).
// Keep the level modest: this exercises the CPU-bound password hash and is NOT
// the high-concurrency path in production.
//
//   k6 run -e BASE_URL=http://localhost:5000 -e LEVEL=100 \
//          -e ORG_EMAIL=loadtest@you.com -e ORG_PASSWORD='Secret123' \
//          -e EVENT_ID=<uuid> [-e ENABLE_PAYMENTS=true] \
//          --summary-export results/org-100.json scripts/organizer-journey.js
import { stagesFor, thresholds, LEVEL } from '../lib/common.js';
import { organizerJourney } from '../lib/journeys.js';

export const options = {
  scenarios: {
    organizers: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: stagesFor(LEVEL),
      gracefulRampDown: '20s',
    },
  },
  thresholds,
  summaryTrendStats: ['avg', 'min', 'med', 'p(95)', 'p(99)', 'max'],
};

export default function () {
  organizerJourney();
}
