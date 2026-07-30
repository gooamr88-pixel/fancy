'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../utils/apiClient';
import { useIsClient } from '../../utils/useIsClient';
import TeamManagement from '../components/TeamManagement';
import DeviceManagement from '../components/DeviceManagement';
import CheckinConflicts from '../components/CheckinConflicts';
import CheckinControls from '../components/CheckinControls';
import CheckinLive from '../components/CheckinLive';

const C = {
  gold: '#B8944F', charcoal: '#191B1E', ivory: '#F8F4EC', stone: '#77736A',
  border: '#E8E2D6', white: '#FFFFFF',
};

const TABS = [
  { key: 'devices', label: 'Devices' },
  { key: 'team', label: 'Door team' },
  { key: 'live', label: 'Live' },
  { key: 'conflicts', label: 'Checks' },
  { key: 'controls', label: 'Emergency' },
];

/**
 * Check-in setup (amendment A-16).
 *
 * A separate page rather than a dashboard tab, deliberately: the sidebar's
 * "Check-In" entry routes to `/checkin`, which is the KIOSK an operator runs at
 * the door. Setting up a team and pairing tablets is preparation done days
 * earlier, at a desk, and folding it into the kiosk would put administrative
 * controls on a screen that faces guests.
 *
 * Ordering is deliberate too: Devices first, because §21.7's readiness panel lives
 * there and "are we ready tonight?" is the question this page exists to answer.
 */
export default function CheckinSetupPage() {
  const router = useRouter();
  const isClient = useIsClient();
  const [eventId, setEventId] = useState('');
  const [events, setEvents] = useState([]);
  const [tab, setTab] = useState('devices');
  const [loading, setLoading] = useState(true);

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

  const onPickEvent = (id) => {
    setEventId(id);
    if (isClient) localStorage.setItem('active_event_id', id);
  };

  if (!isClient || loading) {
    return <div style={{ minHeight: '100dvh', background: C.ivory }} />;
  }

  return (
    <div style={{ minHeight: '100dvh', background: C.ivory }}>
      <div className="fx-container fx-gutter" style={{ paddingTop: '32px', paddingBottom: '64px' }}>
        <Link href="/dashboard" style={{ fontSize: '14px', color: C.stone, textDecoration: 'none' }}>
          ← Back to dashboard
        </Link>

        <h1 style={{ margin: '16px 0 4px', fontSize: '30px', color: C.charcoal, fontFamily: 'var(--font-serif)' }}>
          Check-in setup
        </h1>
        <p style={{ margin: 0, fontSize: '15px', color: C.stone, lineHeight: 1.6 }}>
          Get the door ready: pair the tablets, add the people working it, and check
          everything is in place before you leave for the venue.
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
            <div className="fx-row" style={{ gap: '8px', marginTop: '24px', flexWrap: 'wrap' }}>
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  style={{
                    background: tab === t.key ? C.charcoal : C.white,
                    color: tab === t.key ? C.ivory : C.charcoal,
                    border: `1px solid ${tab === t.key ? C.charcoal : C.border}`,
                    borderRadius: '10px', padding: '10px 20px',
                    fontSize: '15px', cursor: 'pointer',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div style={{
              marginTop: '24px', background: C.white, border: `1px solid ${C.border}`,
              borderRadius: '16px', padding: '28px',
            }}>
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
