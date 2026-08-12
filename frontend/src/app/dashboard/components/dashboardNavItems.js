/**
 * THE ORGANIZER DASHBOARD'S DESTINATION MAP — one list, one place.
 *
 * ── Why this is data and not JSX in a page ──
 *
 * The navigation used to be an inline array inside dashboard/page.js, which had
 * three consequences nobody chose:
 *
 *   1. The sidebar existed on exactly ONE of the dashboard's seven pages. Four of
 *      its own items navigate to a different route (`/dashboard/campaigns`,
 *      `/dashboard/checkin-setup`, `/checkin`, `/dashboard/sms-plans`), and every
 *      one of those routes rendered with no sidebar at all — so pressing a nav
 *      item destroyed the navigation.
 *   2. Active state was `activeTab === item.key`, and those four items never set
 *      `activeTab`. They could not highlight, ever.
 *   3. The mobile bottom bar was a second, hand-maintained subset of the same
 *      list, free to drift from it.
 *
 * Describing the destinations once, declaratively, is what lets the same list
 * render in the layout (so it survives navigation), resolve its own active state
 * from the URL, and derive the mobile bar rather than duplicating it.
 *
 * ── `scope` is the field that carries the weight ──
 *
 *   'account' → about the organizer. Always available.
 *   'event'   → about ONE event, and meaningless without one selected. Eleven of
 *               these sat in a flat list beside the account items with nothing
 *               marking the difference, so more than half the dashboard silently
 *               depended on a choice made somewhere else. The nav now disables
 *               them with a reason when no event is selected, rather than letting
 *               them open onto an empty screen.
 *
 * ── `kind` ──
 *
 *   'tab'   → client state on /dashboard, carried in `?tab=`. In the URL rather
 *             than React state so the sidebar can live in the layout, deep links
 *             work, and the browser's back button moves between sections.
 *   'route' → a real page. `external: true` additionally means it LEAVES the
 *             dashboard (the door scanner is a kiosk, not a section), which the
 *             nav marks so nobody arrives there by accident mid-task.
 */

/* Icons kept as plain functions rather than elements so this module stays
   serializable-ish and importable from anywhere without pulling in JSX at the
   top level of a data file. */
const icon = (paths) => paths;

export const NAV_GROUPS = [
  {
    id: 'home',
    // No heading: a single item does not need one, and giving it one would imply
    // there is something else in the group.
    label: null,
    items: [
      {
        key: 'overview', kind: 'tab', scope: 'account',
        label: 'Dashboard',
        icon: icon('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'),
      },
      {
        // Drafts folded in. It was a separate nav item for the same list under a
        // different status filter — two destinations for one concept, and the
        // one place an unfinished event could hide from its own owner. The count
        // badge moves here so nothing is lost by the merge.
        key: 'events', kind: 'tab', scope: 'account',
        label: 'Your events',
        badge: 'drafts',
        icon: icon('<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>'),
      },
    ],
  },
  {
    id: 'build',
    label: 'Build the guest list',
    items: [
      {
        // "Guests" and "RSVPs" are the two halves of one workflow — build the
        // list, then reach it — and the code has said so in comments for months
        // while the UI said two nouns that mean almost the same thing in English.
        // The labels now carry the distinction the architecture already had.
        key: 'guests', kind: 'tab', scope: 'event',
        label: 'Guest list',
        // "Add" left this hint with the button. Adding one guest is now
        // "Send an invitation", under Invitations & replies — a hint that still
        // promised it here would send people to the one screen that no longer
        // does it.
        hint: 'Import and organise who is invited',
        icon: icon('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
      },
      {
        key: 'form-builder', kind: 'tab', scope: 'event',
        label: 'RSVP form',
        hint: 'What you ask your guests',
        icon: icon('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>'),
      },
      {
        key: 'settings', kind: 'tab', scope: 'event',
        label: 'Event details',
        hint: 'Date, venue, design and privacy',
        icon: icon('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>'),
      },
    ],
  },
  {
    id: 'reach',
    label: 'Reach your guests',
    items: [
      {
        key: 'rsvps', kind: 'tab', scope: 'event',
        label: 'Invitations & replies',
        hint: 'Invite guests, see who answered',
        icon: icon('<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>'),
      },
      {
        key: 'share', kind: 'tab', scope: 'event',
        label: 'Share & QR code',
        hint: 'Your public invitation link',
        icon: icon('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>'),
      },
      {
        // "Texting & pricing" was a sibling nav item — an explainer page sitting
        // at the same weight as a control panel. It is now a link inside this
        // page, where somebody wondering what texting costs actually is.
        key: 'campaigns', kind: 'route', scope: 'event',
        href: '/dashboard/campaigns',
        label: 'Text messages',
        hint: 'Balance, history and what sends itself',
        icon: icon('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
      },
    ],
  },
  {
    id: 'day',
    label: 'On the day',
    items: [
      {
        key: 'seating', kind: 'tab', scope: 'event',
        label: 'Seating',
        hint: 'Tables and who sits where',
        icon: icon('<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>'),
      },
      {
        // Renamed from "Check-In Setup". The old pair — "Check-In" and "Check-In
        // Setup" — sat adjacent and differed by one word, while one is a live
        // door kiosk and the other is desk preparation done days earlier. The
        // code comment beside them already admitted the names did not carry it.
        key: 'checkin-setup', kind: 'route', scope: 'event',
        href: '/dashboard/checkin-setup',
        label: 'Prepare check-in',
        hint: 'Pair tablets and add door staff',
        icon: icon('<rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18"/>'),
      },
      /**
       * "Open door scanner" (`/checkin`) is NO LONGER a sidebar entry.
       *
       * The Android app is the door scanner now, and a top-level link to the
       * browser kiosk beside "Prepare check-in" made the two look like equals —
       * two adjacent items differing by one word, one of which silently left the
       * dashboard for a full-screen kiosk.
       *
       * The page is deliberately NOT deleted, and the reasons are load-bearing:
       *   • `checkin_app` is a plan feature with freeDefault:false, while
       *     `/checkin` is ungated — removing it would leave every organizer whose
       *     tier lacks the app with no way to check anyone in at all;
       *   • publishing the app is gated AGAIN behind an admin switch that defaults
       *     off (checkinAppController.readReleaseConfig), so a bad build would take
       *     the door away from every customer at once;
       *   • the app is Android only (there is no ios/ directory). An organizer on
       *     the door with an iPhone has no app, and the browser works anywhere.
       *
       * So it survives as a stated fallback inside "Prepare check-in", next to the
       * app download, where somebody who needs it will be looking.
       */
    ],
  },
  {
    id: 'account',
    label: 'Your account',
    items: [
      {
        key: 'referrals', kind: 'tab', scope: 'account',
        label: 'Referrals',
        badge: 'reward',
        icon: icon('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>'),
      },
      {
        key: 'profile', kind: 'tab', scope: 'account',
        label: 'Profile',
        icon: icon('<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2"/>'),
      },
    ],
  },
];

/** Flat list, in visual order. */
export const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

export const NAV_BY_KEY = new Map(NAV_ITEMS.map((i) => [i.key, i]));

/** Keys that are `?tab=` values on /dashboard rather than their own routes. */
export const TAB_KEYS = NAV_ITEMS.filter((i) => i.kind === 'tab').map((i) => i.key);

/**
 * Tabs that page.js renders but which are not their own nav entry.
 *
 * `drafts` is now reached from inside "Your events" rather than from the
 * sidebar, and it must stay a legal `?tab=` value: existing links, bookmarks and
 * the draft-count badge all still point at it. A tab that stopped resolving
 * would render the overview instead and look like the link was wrong.
 */
export const EXTRA_TAB_KEYS = ['drafts'];

export const ALL_TAB_KEYS = [...TAB_KEYS, ...EXTRA_TAB_KEYS];

/** The four destinations the mobile bottom bar surfaces, derived — never a second list. */
export const MOBILE_BAR_KEYS = ['overview', 'guests', 'rsvps', 'seating'];

/**
 * Which nav key a given URL is showing.
 *
 * Route items are matched on pathname; everything else falls back to `?tab=`.
 * This is the whole reason active state now works for the route items — nothing
 * has to remember to keep a `activeTab` variable in sync with a `router.push`.
 */
export function resolveActiveKey(pathname, tabParam) {
  const routeItem = NAV_ITEMS.find(
    (i) => i.kind === 'route' && (pathname === i.href || pathname.startsWith(`${i.href}/`)),
  );
  if (routeItem) return routeItem.key;

  // Sub-pages that are not nav entries of their own still belong to a section,
  // so the sidebar keeps something sensible highlighted instead of nothing.
  if (pathname.startsWith('/dashboard/seating-map')) return 'seating';
  if (pathname.startsWith('/dashboard/sms-plans')) return 'campaigns';
  if (pathname.startsWith('/dashboard/analytics')) return 'overview';

  if (pathname === '/dashboard' || pathname === '/dashboard/') {
    if (tabParam === 'drafts') return 'events';
    return ALL_TAB_KEYS.includes(tabParam) ? tabParam : 'overview';
  }
  return null;
}
