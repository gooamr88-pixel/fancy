'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { apiFetch, logout } from '../../utils/apiClient';
import LogoutModal from '../../components/LogoutModal';
import {
  NAV_GROUPS, MOBILE_BAR_KEYS, NAV_BY_KEY, resolveActiveKey,
} from './dashboardNavItems';

/**
 * The dashboard's navigation — sidebar, mobile drawer and bottom tab bar.
 *
 * ── Why it lives in the layout ──
 *
 * It used to be markup inside dashboard/page.js, so it existed on that one page
 * and vanished on the six others (`/dashboard/campaigns`, `/dashboard/sms-plans`,
 * `/dashboard/checkin-setup`, `/dashboard/analytics`, `/dashboard/seating-map`,
 * `/dashboard/create-event`). Four sidebar items navigate to those pages, which
 * meant pressing a navigation item was the way to lose the navigation. Rendering
 * from the layout is the fix, and it is only possible because the active section
 * now lives in the URL rather than in that page's React state.
 *
 * ── Why it reads its own event list ──
 *
 * It needs two things page.js also has: the draft count for the badge, and the
 * event list for the switcher. Taking them from page.js would tie the nav back to
 * the one page it must outlive. One small request, made once per page load, buys
 * a navigation that behaves identically everywhere — including on the pages where
 * page.js is not mounted at all and there would otherwise be nothing to read.
 */

const COLORS = {
  gold: '#B8944F',
  charcoal: '#191B1E',
  ivory: '#F8F4EC',
  stone: '#77736A',
  border: '#E8E2D6',
  white: '#FFFFFF',
  hover: '#FDFCF9',
};

/** Renders one icon's raw path string. */
function NavIcon({ paths, size = 18 }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2"
      dangerouslySetInnerHTML={{ __html: paths }}
    />
  );
}

export default function DashboardNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState([]);
  /**
   * null = we do not know yet (still loading, or the request failed).
   *
   * Deliberately not a boolean. `loaded && events.length === 0` would treat a
   * network blip as "this organizer has no events" and disable half the
   * navigation — punishing a transient failure with a dead sidebar. Unknown means
   * the items stay clickable and the section's own empty state explains itself.
   */
  const [knownEmpty, setKnownEmpty] = useState(null);
  // Logout moved here with the rest of the sidebar footer. It was in page.js, so
  // on the six pages that had no sidebar there was no way to log out at all.
  const [logoutOpen, setLogoutOpen] = useState(false);

  const eventId = searchParams.get('event') || '';
  const tabParam = searchParams.get('tab') || '';
  const activeKey = resolveActiveKey(pathname, tabParam);

  /**
   * The event the nav believes is selected.
   *
   * `?event=` is the source of truth so it survives every navigation — the old
   * code pushed `/dashboard/campaigns` with no event at all, so an organizer
   * working on one event could land on the Text messages page showing another and
   * never be told. When the URL says nothing, fall back to the first live event,
   * which is what the dashboard itself defaults to.
   */
  const selected = events.find((e) => e.id === eventId)
    || events.find((e) => e.status !== 'draft')
    || events[0]
    || null;
  const effectiveEventId = eventId || selected?.id || '';

  const draftCount = events.filter((e) => e.status === 'draft').length;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // apiFetch resolves to the PARSED body, not a Response — it already did
        // the .json() and handles 401 by redirecting to /login. Calling
        // `res.json()` on it throws, which would have left this list empty and
        // silently disabled every event-scoped nav item.
        const data = await apiFetch('/events');
        if (cancelled) return;
        if (data?.success && Array.isArray(data.events)) {
          setEvents(data.events);
          setKnownEmpty(data.events.length === 0);
        }
      } catch {
        // A navigation that cannot count drafts is still a navigation. Nothing
        // here is allowed to stop the organizer moving around, so `knownEmpty`
        // stays null and every item remains reachable.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /* The drawer is closed by the thing that closes it — every nav link's own
     onClick below, the X, and the overlay.
   *
   * It was an effect on [pathname, tabParam], which is a synchronous setState in
   * an effect body: a cascading render, and an error under this repo's
   * react-hooks/set-state-in-effect rule. Closing a drawer is a response to a
   * click, not a synchronisation with an external system — so it belongs in the
   * handler. (React's own guidance: you might not need an effect.) */

  /**
   * Where a nav item points — always carrying the current event, whatever its scope.
   *
   * ── Why `event` rides along even on account-scoped destinations ──
   *
   * This used to set it only `if (item.scope === 'event')`, which reintroduced the
   * exact bug the whole restructure exists to remove:
   *
   *   1. on Guest list with ?tab=guests&event=X, press "Dashboard" (account scope)
   *   2. the href drops `event`, so the URL becomes plain /dashboard
   *   3. this component re-reads `?event=` as empty and `effectiveEventId` falls
   *      back to the FIRST live event
   *   4. every event-scoped link in the sidebar now points at that one
   *   5. press "Guest list" and you are silently looking at a different event
   *
   * Meanwhile dashboard/page.js still held X in `pickedEventId`, so for the whole
   * time you were on the overview the page and the sidebar disagreed about which
   * event was selected — with nothing on screen admitting it.
   *
   * An account-scoped page simply ignores the parameter. Carrying it costs a few
   * characters and is the entire reason the selection feels sticky.
   *
   * Built fresh rather than copied from the current query on purpose: `saved` and
   * `forceReset` are one-shot signals that must not survive a navigation.
   */
  const hrefFor = useCallback((item) => {
    const q = new URLSearchParams();
    if (effectiveEventId) q.set('event', effectiveEventId);
    if (item.kind === 'tab') {
      if (item.key !== 'overview') q.set('tab', item.key);
      const qs = q.toString();
      return `/dashboard${qs ? `?${qs}` : ''}`;
    }
    const qs = q.toString();
    return `${item.href}${qs ? `?${qs}` : ''}`;
  }, [effectiveEventId]);

  /**
   * An event-scoped item with no event is disabled rather than opened.
   *
   * Only the seating tab ever guarded this; the other seven rendered with an
   * empty id, producing a screen with a heading, no content and no explanation.
   * Refusing at the door and saying why is the smaller failure — and it explains
   * the ONE thing the organizer has to do to proceed.
   */
  const blocked = (item) => item.scope === 'event' && knownEmpty === true;

  const itemStyle = (isActive, isBlocked) => ({
    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
    borderRadius: 8, border: 'none', cursor: isBlocked ? 'not-allowed' : 'pointer',
    textAlign: 'left', width: '100%', textDecoration: 'none',
    background: isActive ? COLORS.ivory : 'transparent',
    color: isActive ? COLORS.gold : COLORS.stone,
    borderLeft: `3px solid ${isActive ? COLORS.gold : 'transparent'}`,
    fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: isActive ? 600 : 400,
    opacity: isBlocked ? 0.45 : 1,
    transition: 'all 0.2s ease',
  });

  const renderItem = (item) => {
    const isActive = activeKey === item.key;
    const isBlocked = blocked(item);

    const inner = (
      <>
        <span style={{ display: 'flex', width: 18, height: 18, flexShrink: 0 }}>
          <NavIcon paths={item.icon} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>{item.label}</span>

        {item.badge === 'drafts' && draftCount > 0 && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            minWidth: 18, height: 18, padding: '0 6px', borderRadius: 9,
            background: isActive ? COLORS.gold : 'rgba(184, 148, 79, 0.14)',
            color: isActive ? COLORS.white : COLORS.gold,
            fontSize: 10, fontWeight: 700, lineHeight: 1, flexShrink: 0,
          }}>{draftCount}</span>
        )}

        {/* Marked because it leaves the dashboard for a full-screen kiosk. An
            organizer who taps it mid-task should know that before, not after. */}
        {item.external && (
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" style={{ flexShrink: 0, opacity: 0.6 }} aria-hidden="true"
          >
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        )}
      </>
    );

    if (isBlocked) {
      return (
        <span
          key={item.key}
          title="Create an event first — this section is about one event."
          aria-disabled="true"
          style={itemStyle(false, true)}
        >
          {inner}
        </span>
      );
    }

    return (
      <Link
        key={item.key}
        href={hrefFor(item)}
        data-testid={`tab-${item.key}`}
        aria-current={isActive ? 'page' : undefined}
        // A real anchor, not a button calling router.push. Middle-click, ⌘-click
        // and "open in new tab" all worked nowhere in this dashboard before,
        // because every destination was an onClick.
        {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        // Closes the mobile drawer as part of the tap that navigates, so it never
        // stays open over the page it just opened. No-op on desktop.
        onClick={() => setOpen(false)}
        style={itemStyle(isActive, false)}
        onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = COLORS.hover; e.currentTarget.style.color = COLORS.charcoal; } }}
        onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = COLORS.stone; } }}
      >
        {inner}
      </Link>
    );
  };

  return (
    <>
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="dnav-overlay"
          style={{ display: 'none', position: 'fixed', inset: 0, zIndex: 49, background: 'rgba(0,0,0,0.3)' }}
        />
      )}

      {/* ═══ SIDEBAR ═══ */}
      <aside
        className="dnav-sidebar"
        style={{
          width: 240, minHeight: '100vh', background: COLORS.white,
          borderRight: `1px solid ${COLORS.border}`,
          display: 'flex', flexDirection: 'column',
          position: 'fixed', top: 0, left: 0, zIndex: 50,
          transform: open ? 'translateX(0)' : undefined,
          transition: 'transform 0.3s ease',
          overflowY: 'auto',
        }}
      >
        {/* Logo + mobile dismiss */}
        <div style={{
          padding: '24px 20px', borderBottom: `1px solid ${COLORS.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          flexShrink: 0,
        }}>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close navigation menu"
            className="dnav-close"
            style={{
              display: 'none', order: 2, width: 36, height: 36, flexShrink: 0,
              borderRadius: 8, border: `1px solid ${COLORS.border}`, background: COLORS.white,
              cursor: 'pointer', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COLORS.charcoal} strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <svg width="24" height="20" viewBox="0 0 38 32" fill="none" style={{ flexShrink: 0 }}>
              <rect x="2" y="8" width="34" height="22" rx="2" stroke="#B8944F" strokeWidth="2" fill="none" />
              <path d="M2 10L19 22L36 10" stroke="#B8944F" strokeWidth="2" fill="none" strokeLinejoin="round" />
              <path d="M4 8L19 0L34 8" stroke="#B8944F" strokeWidth="2" fill="none" strokeLinejoin="round" />
            </svg>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontFamily: 'var(--font-script)', fontSize: 26, fontWeight: 400, color: COLORS.gold, lineHeight: 1 }}>Fancy</span>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 600, color: COLORS.charcoal, letterSpacing: '1.5px', textTransform: 'uppercase', lineHeight: 1 }}>RSVP</span>
            </div>
          </Link>
        </div>

        {/**
         * WHICH EVENT — stated once, at the top, above everything scoped to it.
         *
         * Eleven of the fifteen old nav items were about one event and nothing in
         * the navigation said so. The switcher existed only in the page header of
         * some tabs, so on the pages that had no header (and no sidebar) there was
         * no way to tell which event you were editing.
         */}
        {events.length > 0 && (
          <div style={{
            padding: '12px 16px', borderBottom: `1px solid ${COLORS.border}`, flexShrink: 0,
          }}>
            <div style={{
              fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: COLORS.stone, fontFamily: 'var(--font-sans)', marginBottom: 6,
            }}>
              Working on
            </div>
            <select
              value={effectiveEventId}
              onChange={(e) => {
                // Rewrites the CURRENT url's event, so switching events keeps you
                // on the section you were already looking at instead of throwing
                // you back to the overview.
                const q = new URLSearchParams(searchParams.toString());
                q.set('event', e.target.value);
                router.push(`${pathname}?${q.toString()}`);
              }}
              aria-label="Choose which event you are working on"
              style={{
                width: '100%', boxSizing: 'border-box', padding: '8px 10px',
                border: `1px solid ${COLORS.border}`, borderRadius: 8,
                background: COLORS.white, color: COLORS.charcoal,
                fontSize: 12.5, fontFamily: 'var(--font-sans)', fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}{e.status === 'draft' ? ' (draft)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <nav style={{ flex: 1, padding: '12px 12px 24px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV_GROUPS.map((group) => (
            <div key={group.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {group.label && (
                <div style={{
                  fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                  color: '#A8A296', fontFamily: 'var(--font-sans)',
                  padding: '14px 14px 6px',
                }}>
                  {group.label}
                </div>
              )}
              {group.items.map(renderItem)}
            </div>
          ))}
        </nav>

        {/* Bottom: Log Out */}
        <div style={{ padding: '16px 12px', borderTop: `1px solid ${COLORS.border}`, flexShrink: 0 }}>
          <button
            onClick={() => setLogoutOpen(true)}
            aria-label="Log out"
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', width: '100%',
              background: 'transparent', border: `1px solid ${COLORS.border}`, borderRadius: 8, cursor: 'pointer',
              fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, color: COLORS.stone,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.charcoal; e.currentTarget.style.borderColor = COLORS.charcoal; e.currentTarget.style.color = COLORS.white; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.color = COLORS.stone; }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Log Out
          </button>
        </div>
      </aside>

      <LogoutModal isOpen={logoutOpen} onClose={() => setLogoutOpen(false)} onConfirm={logout} />

      {/* ═══ MOBILE BOTTOM TAB BAR ═══
          Four highest-frequency destinations plus More, within one thumb's
          reach. Derived from NAV_ITEMS rather than hand-listed, so it can no
          longer drift from the sidebar it summarises. */}
      <nav className="dnav-bottombar" aria-label="Primary">
        {MOBILE_BAR_KEYS.map((key) => {
          const item = NAV_BY_KEY.get(key);
          if (!item) return null;
          const isActive = activeKey === item.key;
          const isBlocked = blocked(item);
          const label = item.key === 'overview' ? 'Home'
            : item.key === 'guests' ? 'Guests'
              : item.key === 'rsvps' ? 'Replies' : item.label;

          if (isBlocked) {
            return (
              <span key={key} aria-disabled="true" className="dnav-bottomtab" style={{ color: COLORS.stone, opacity: 0.4 }}>
                <NavIcon paths={item.icon} size={20} />
                <span>{label}</span>
              </span>
            );
          }
          return (
            <Link
              key={key}
              href={hrefFor(item)}
              aria-current={isActive ? 'page' : undefined}
              className="dnav-bottomtab"
              style={{ color: isActive ? COLORS.gold : COLORS.stone }}
            >
              <NavIcon paths={item.icon} size={20} />
              <span>{label}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setOpen(true)}
          aria-label="More navigation options"
          className="dnav-bottomtab"
          style={{ color: COLORS.stone, background: 'none', border: 'none' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
          </svg>
          <span>More</span>
        </button>
      </nav>
    </>
  );
}
