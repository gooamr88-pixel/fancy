'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../utils/apiClient';
import { useIsClient } from '../../utils/useIsClient';
import TeamManagement from '../components/TeamManagement';
import DeviceManagement from '../components/DeviceManagement';
import CheckinAppDownload from '../components/CheckinAppDownload';
import CheckinConflicts from '../components/CheckinConflicts';
import CheckinControls from '../components/CheckinControls';
import CheckinLive from '../components/CheckinLive';
import { buildCheckinReadiness, readinessVerdict, BLOCK, WARN } from '../components/checkinReadiness';

const C = {
  gold: '#B8944F', charcoal: '#191B1E', ivory: '#F8F4EC', stone: '#77736A',
  border: '#E8E2D6', white: '#FFFFFF', softBg: '#FAFAF8',
  danger: '#B03A2E', warn: '#C8871B', success: '#2E7D5B',
};

/**
 * The five sections, grouped by WHEN you use them.
 *
 * The previous version showed five equal buttons — Devices, Door team, Live,
 * Checks, Emergency — with nothing to say which came first or what any of them
 * meant. "Checks" in particular named nothing: it is the review queue for
 * guests who were admitted twice.
 *
 * Grouping by time is what makes the page self-explanatory, because it maps to
 * the only two situations an organizer is ever in when they open it: preparing
 * days ahead at a desk, or standing in a venue while the event runs.
 */
const GROUPS = [
  {
    title: 'Start here',
    hint: 'The door runs on a dedicated Android app. Install it before anything else — the step below pairs a tablet that already has it.',
    tabs: [
      { key: 'app', label: 'The app', help: 'Download Fancy Check-in and install it on each tablet' },
    ],
  },
  {
    title: 'Before the event',
    hint: 'Done at a desk, days ahead. Both of these need internet — the tablets will not.',
    tabs: [
      { key: 'devices', label: 'Tablets', help: 'Pair the tablets and load the guest list onto them' },
      { key: 'team', label: 'Door team', help: 'Who works the door, and the PIN each of them uses' },
    ],
  },
  {
    title: 'On the night',
    hint: 'Watch the door from here while it runs. Nothing here is needed to check guests in.',
    tabs: [
      { key: 'live', label: 'Arrivals', help: 'Live count as guests come through the door' },
      { key: 'conflicts', label: 'Admitted twice', help: 'Guests scanned in more than once, to review' },
      { key: 'controls', label: 'If something breaks', help: 'Pause syncing without stopping the door' },
    ],
  },
];

const ALL_TABS = GROUPS.flatMap((g) => g.tabs);

/**
 * Check-in setup (amendment A-16).
 *
 * A separate page rather than a dashboard tab, deliberately: the sidebar's
 * "Check-In" entry routes to `/checkin`, which is the KIOSK an operator runs at
 * the door. Setting up a team and pairing tablets is preparation done days
 * earlier, at a desk, and folding it into the kiosk would put administrative
 * controls on a screen that faces guests.
 */
/**
 * The browser kiosk, as a stated fallback rather than an equal.
 *
 * `/checkin` used to be its own sidebar entry sitting directly beside "Check-In
 * Setup" — two items differing by one word, one of which silently left the
 * dashboard for a full-screen kiosk. The app is the door scanner now, so the link
 * belongs here, beneath the download, framed as what it actually is.
 *
 * It is not deleted, and each reason is a real gap it covers:
 *   • the app is a plan feature (freeDefault: false) while this page is ungated,
 *     so without it an organizer on the wrong tier cannot check anyone in;
 *   • publishing a build is gated again behind an admin switch that defaults off,
 *     so a bad release would close every customer's door at once;
 *   • the app is Android only — there is no iOS build.
 *
 * Naming those three, rather than offering a bare second button, is what stops an
 * organizer using the weaker tool by accident while the better one sits above it.
 */
function BrowserFallback({ eventId }) {
  return (
    <div style={{
      marginTop: 24, paddingTop: 20, borderTop: `1px solid ${C.border}`,
      fontFamily: 'var(--font-sans)',
    }}>
      <p style={{
        margin: '0 0 6px', fontSize: 12, color: C.stone,
        textTransform: 'uppercase', letterSpacing: '0.09em', fontWeight: 700,
      }}>
        No Android tablet? Use a browser
      </p>
      <p style={{ margin: '0 0 14px', fontSize: 13.5, color: C.stone, lineHeight: 1.65, maxWidth: 560 }}>
        The app is faster at the door and keeps working with no internet, so use it
        when you can. The browser version scans and searches the same guest list and
        runs on an iPhone, an iPad or any laptop — reach for it if your plan does not
        include the app, if you are on iOS, or if something goes wrong on the night.
        It needs a connection.
      </p>
      <Link
        href={`/checkin${eventId ? `?event=${eventId}` : ''}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '10px 18px', borderRadius: 9,
          border: `1px solid ${C.border}`, background: '#FFFFFF',
          color: C.charcoal, fontSize: 12.5, fontWeight: 700, textDecoration: 'none',
        }}
      >
        Open the browser scanner
        {/* Marked because it opens a full-screen kiosk in a new tab — an organizer
            mid-setup should not lose this page to it. */}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.6 }}>
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </Link>
    </div>
  );
}

export default function CheckinSetupPage() {
  const router = useRouter();
  const isClient = useIsClient();
  const [eventId, setEventId] = useState('');
  const [events, setEvents] = useState([]);
  const [tab, setTab] = useState('app');
  const [loading, setLoading] = useState(true);

  // Readiness for the header. Fetched here rather than lifted out of the
  // Tablets tab so the verdict is on screen before anyone clicks anything —
  // "am I ready?" was previously only answerable by opening a tab and reading
  // a list, which is why nobody discovered an unprepared tablet until the venue.
  const [readiness, setReadiness] = useState(null);

  const orgId = isClient ? localStorage.getItem('org_id') : null;

  useEffect(() => {
    if (isClient && !orgId) router.push('/login');
  }, [isClient, orgId, router]);

  useEffect(() => {
    if (!isClient || !orgId) return;
    (async () => {
      try {
        const res = await apiFetch('/events');
        const list = res?.events || [];
        setEvents(list);
        const saved = localStorage.getItem('active_event_id');
        setEventId(saved && list.some((e) => e.id === saved) ? saved : (list[0]?.id || ''));
      } catch {
        // apiFetch already redirects on 401 and toasts otherwise.
      } finally {
        setLoading(false);
      }
    })();
  }, [isClient, orgId]);

  useEffect(() => {
    if (!eventId) return undefined;
    let cancelled = false;

    (async () => {
      try {
        const [gateRes, deviceRes, staffRes] = await Promise.all([
          apiFetch(`/checkin/events/${eventId}/gates`),
          apiFetch(`/checkin/events/${eventId}/devices`),
          apiFetch(`/checkin/events/${eventId}/staff`),
        ]);
        if (cancelled) return;
        setReadiness(buildCheckinReadiness({
          gates: gateRes?.data?.gates || [],
          devices: deviceRes?.data?.devices || [],
          staff: staffRes?.data?.staff || [],
        }));
      } catch {
        // A header that cannot load is hidden, never guessed at. Showing
        // "ready" because a request failed is the one wrong answer here.
        if (!cancelled) setReadiness(null);
      }
    })();

    return () => { cancelled = true; };
  }, [eventId, tab]);

  const onPickEvent = (id) => {
    setEventId(id);
    if (isClient) localStorage.setItem('active_event_id', id);
  };

  if (!isClient || loading) {
    return <div style={{ minHeight: '100dvh', background: C.ivory }} />;
  }

  const active = ALL_TABS.find((t) => t.key === tab);

  return (
    <div style={{ minHeight: '100dvh', background: C.ivory }}>
      <div className="fx-container fx-gutter" style={{ paddingTop: '32px', paddingBottom: '64px' }}>
        <Link href="/dashboard" style={{ fontSize: '14px', color: C.stone, textDecoration: 'none' }}>
          ← Back to dashboard
        </Link>

        <h1 style={{ margin: '16px 0 4px', fontSize: '30px', color: C.charcoal, fontFamily: 'var(--font-serif)' }}>
          Check-in setup
        </h1>
        <p style={{ margin: 0, fontSize: '15px', color: C.stone, lineHeight: 1.6, maxWidth: '640px' }}>
          Everything behind the tablets your staff use at the door. Get this right
          before you leave for the venue — once you are there, the tablets work
          without internet, but this page does not.
        </p>

        {events.length > 1 && (
          <select
            value={eventId}
            onChange={(e) => onPickEvent(e.target.value)}
            style={{
              marginTop: '20px', background: C.white, border: `1px solid ${C.border}`,
              borderRadius: '10px', padding: '12px 14px', fontSize: '15px', color: C.charcoal,
            }}
          >
            {events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
        )}

        {!eventId ? (
          <div style={{
            marginTop: '32px', background: C.white, border: `1px solid ${C.border}`,
            borderRadius: '14px', padding: '40px', textAlign: 'center', color: C.stone,
          }}>
            Create an event first, then come back to set up check-in.
          </div>
        ) : (
          <>
            {readiness && (
              <ReadinessHeader
                verdict={readinessVerdict(readiness)}
                onOpenTablets={() => setTab('devices')}
              />
            )}

            {GROUPS.map((group) => (
              <div key={group.title} style={{ marginTop: '28px' }}>
                <h2 style={{
                  margin: 0, fontSize: '13px', color: C.stone, textTransform: 'uppercase',
                  letterSpacing: '0.09em', fontWeight: 700,
                }}>
                  {group.title}
                </h2>
                <p style={{ margin: '4px 0 12px', fontSize: '14px', color: C.stone, lineHeight: 1.6 }}>
                  {group.hint}
                </p>
                <div className="fx-row" style={{ gap: '10px', flexWrap: 'wrap' }}>
                  {group.tabs.map((t) => (
                    <TabButton
                      key={t.key}
                      tab={t}
                      selected={tab === t.key}
                      onSelect={() => setTab(t.key)}
                    />
                  ))}
                </div>
              </div>
            ))}

            {/* Padding shrinks on a phone. A flat 28px here plus another 28px
                inside whatever panel is showing spent 112px of a 320px screen on
                margin, which is what pushed the pairing code off the edge. */}
            <div style={{
              marginTop: '28px', background: C.white, border: `1px solid ${C.border}`,
              borderRadius: '16px', padding: 'clamp(18px, 4vw, 28px)',
            }}>
              {/* Names the panel you are looking at. With five entry points and
                  no heading, it was easy to act on the wrong one. */}
              <p style={{
                margin: '0 0 20px', fontSize: '13px', color: C.stone,
                textTransform: 'uppercase', letterSpacing: '0.09em', fontWeight: 700,
              }}>
                {active?.label}
              </p>

              {tab === 'app' && (
                <>
                  <CheckinAppDownload eventId={eventId} />
                  <BrowserFallback eventId={eventId} />
                </>
              )}
              {tab === 'devices' && <DeviceManagement eventId={eventId} />}
              {tab === 'team' && <TeamManagement eventId={eventId} />}
              {tab === 'live' && <CheckinLive eventId={eventId} />}
              {tab === 'conflicts' && <CheckinConflicts eventId={eventId} />}
              {tab === 'controls' && <CheckinControls eventId={eventId} />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * The verdict, at the top, before any tab is opened.
 *
 * One sentence naming the single most important problem, not a list — the list
 * lives in the Tablets tab and this links to it. A header that recites six
 * warnings is a header nobody reads.
 */
function ReadinessHeader({ verdict, onOpenTablets }) {
  const tone = verdict.tone === BLOCK ? C.danger : verdict.tone === WARN ? C.warn : C.success;

  return (
    <div style={{
      marginTop: '24px', background: C.white,
      border: `1px solid ${C.border}`, borderLeft: `4px solid ${tone}`,
      borderRadius: '14px', padding: '20px 24px',
      display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap',
    }}>
      <div style={{ flex: '1 1 340px', minWidth: 0 }}>
        <div style={{ fontSize: '18px', color: tone, fontWeight: 600 }}>
          {verdict.headline}
        </div>
        <p style={{ margin: '4px 0 0', fontSize: '15px', color: C.stone, lineHeight: 1.6 }}>
          {verdict.detail}
          {verdict.more > 0 && (
            <span style={{ color: C.stone }}>
              {' '}And {verdict.more} other {verdict.more === 1 ? 'thing' : 'things'}.
            </span>
          )}
        </p>
      </div>

      {verdict.tone !== 'ok' && (
        <button
          onClick={onOpenTablets}
          style={{
            background: 'transparent', color: C.charcoal, border: `1px solid ${C.border}`,
            borderRadius: '10px', padding: '12px 20px', cursor: 'pointer', fontSize: '15px',
          }}
        >
          See what is missing
        </button>
      )}
    </div>
  );
}

/**
 * A tab that says what it does.
 *
 * The old buttons carried a single word each. Two of those words — "Checks",
 * "Emergency" — did not describe their contents at all, so the only way to find
 * anything was to click all five.
 */
function TabButton({ tab, selected, onSelect }) {
  return (
    <button
      onClick={onSelect}
      aria-pressed={selected}
      style={{
        flex: '1 1 260px',
        textAlign: 'left',
        background: selected ? C.charcoal : C.white,
        color: selected ? C.ivory : C.charcoal,
        border: `1px solid ${selected ? C.charcoal : C.border}`,
        borderRadius: '12px',
        padding: '14px 18px',
        cursor: 'pointer',
      }}
    >
      <span style={{ display: 'block', fontSize: '16px', fontWeight: 600 }}>
        {tab.label}
      </span>
      <span style={{
        display: 'block', marginTop: '3px', fontSize: '13px', lineHeight: 1.5,
        color: selected ? 'rgba(248,244,236,0.75)' : C.stone,
      }}>
        {tab.help}
      </span>
    </button>
  );
}
