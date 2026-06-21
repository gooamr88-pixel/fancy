// MIXED / realistic production traffic: a large guest crowd (browse+RSVP) with a
// small concurrent organizer population (login+dashboard). The guest scenario is
// scaled to LEVEL; organizers are ~5% of that (real platforms have far more
// invitees than organizers online at once).
//
//   k6 run -e BASE_URL=http://localhost:5000 -e SLUG=demo -e LEVEL=1000 \
//          -e ORG_EMAIL=loadtest@you.com -e ORG_PASSWORD='Secret123' -e EVENT_ID=<uuid> \
//          --summary-export results/mixed-1000.json scripts/mixed-load.js
import { stagesFor, thresholds, LEVEL } from '../lib/common.js';
import { guestJourney, organizerJourney } from '../lib/journeys.js';

const orgVus = Math.max(1, Math.ceil(LEVEL * 0.05));

export const options = {
  scenarios: {
    guests: {
      executor: 'ramping-vus',
      exec: 'guest',
      startVUs: 0,
      stages: stagesFor(LEVEL),
      gracefulRampDown: '20s',
    },
    organizers: {
      executor: 'constant-vus',
      exec: 'organizer',
      vus: orgVus,
      duration: '5m',
      startTime: '30s', // let the guest ramp begin first
    },
  },
  thresholds,
  summaryTrendStats: ['avg', 'min', 'med', 'p(95)', 'p(99)', 'max'],
};

export function guest() { guestJourney(); }
export function organizer() { organizerJourney(); }
