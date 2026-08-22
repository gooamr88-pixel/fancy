/**
 * The zones offered in the organizer's Time Zone picker.
 *
 * A CURATED LIST, NOT THE FULL IANA DATABASE.
 *
 * `Intl.supportedValuesOf('timeZone')` returns well over four hundred names,
 * most of which are historical aliases nobody would recognise as their own
 * ("America/Indiana/Vevay", "Etc/GMT+7"). Presenting that is not more
 * flexibility, it is a worse chance of picking the right one — and picking the
 * wrong one here moves the advertised start time of every event this organizer
 * creates.
 *
 * So this covers the places this platform actually serves — the United States
 * first, since that is where it operates — and the picker falls back to showing
 * a detected zone verbatim when it is not on the list, so nobody is ever shown
 * a value that misrepresents what their account is set to. Adding a market
 * means adding a line here.
 *
 * Ids are IANA names because that is what the column stores and what
 * `Intl.DateTimeFormat` resolves; the labels are what a human recognises. Never
 * store the label, and never store a UTC offset — an offset cannot express
 * daylight saving, and San Diego is UTC-8 for four months of the year and
 * UTC-7 for the other eight.
 */
export const ORGANIZER_TIMEZONES = [
  { id: 'America/Los_Angeles', label: 'Pacific Time — Los Angeles, San Diego' },
  { id: 'America/Denver', label: 'Mountain Time — Denver' },
  { id: 'America/Phoenix', label: 'Arizona — Phoenix (no daylight saving)' },
  { id: 'America/Chicago', label: 'Central Time — Chicago, Houston' },
  { id: 'America/New_York', label: 'Eastern Time — New York, Miami' },
  { id: 'America/Anchorage', label: 'Alaska — Anchorage' },
  { id: 'Pacific/Honolulu', label: 'Hawaii — Honolulu' },
  { id: 'America/Toronto', label: 'Eastern Time — Toronto' },
  { id: 'America/Vancouver', label: 'Pacific Time — Vancouver' },
  { id: 'America/Mexico_City', label: 'Mexico City' },
  { id: 'Europe/London', label: 'United Kingdom — London' },
  { id: 'Europe/Paris', label: 'Central Europe — Paris, Madrid, Rome' },
  { id: 'Africa/Cairo', label: 'Egypt — Cairo' },
  { id: 'Asia/Riyadh', label: 'Saudi Arabia — Riyadh' },
  { id: 'Asia/Dubai', label: 'United Arab Emirates — Dubai' },
  { id: 'Asia/Amman', label: 'Jordan — Amman' },
  { id: 'Asia/Beirut', label: 'Lebanon — Beirut' },
  { id: 'Asia/Karachi', label: 'Pakistan — Karachi' },
  { id: 'Asia/Kolkata', label: 'India — Mumbai, Delhi' },
  { id: 'Asia/Singapore', label: 'Singapore' },
  { id: 'Australia/Sydney', label: 'Australia — Sydney' },
];
