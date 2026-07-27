'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '../../utils/apiClient';
import { useIsClient } from '../../utils/useIsClient';
import {
  VIZ, Card, Hero, Stat, Meter, BarList, StackedBar, LinePanel, Empty, StatusNote,
  compact, duration,
} from './viz';

/* ═══════════════════════════════════════════════════════════════════════════
   ORGANIZER ANALYTICS

   GET /events/:id/analytics has existed for a long time and, until now, had
   no consumer anywhere in the app — every number it computes was being
   thrown away. This is that surface.

   Reading order is deliberate and goes outside-in, because that is the order
   an organizer actually asks the questions in:

     1. how many people are coming            (hero — the one number)
     2. how many showed up to look            (KPI row)
     3. did they get past the envelope        (reveal funnel)
     4. where did they fall out of the form   (RSVP funnel)
     5. what did they answer                  (response mix)
     6. when did it all happen                (timeline)
     7. what else did they do                 (engagement, reasons, sources)

   Charts do not own filters — one control row at the top scopes everything
   below it, so every card is always showing the same slice.
   ═══════════════════════════════════════════════════════════════════════════ */

const C = {
  gold: '#B8944F', charcoal: '#191B1E', ivory: '#F8F4EC', stone: '#77736A',
  border: '#E8E2D6', white: '#FFFFFF', softBg: '#FAFAF8',
};
const SANS = 'var(--font-sans)';

const RANGES = [
  { key: 'all', label: 'All time', days: null },
  { key: '7d', label: 'Last 7 days', days: 7 },
  { key: '30d', label: 'Last 30 days', days: 30 },
  { key: '90d', label: 'Last 90 days', days: 90 },
];

const ENGAGEMENT_LABELS = {
  calendar_added: 'Added to calendar',
  share_clicked: 'Shared the invitation',
  directions_clicked: 'Asked for directions',
  guest_pass_downloaded: 'Downloaded their pass',
  gallery_viewed: 'Opened the gallery',
  music_played: 'Played the music',
  seating_searched: 'Looked up their seat',
};

export default function AnalyticsPage() {
  const isClient = useIsClient();

  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState(null);
  const [range, setRange] = useState('all');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  /* ─── Event list. The dashboard's own convention: the active event is
     remembered in localStorage, so landing here follows whatever the
     organizer was last working on rather than defaulting to the newest. ─── */
  useEffect(() => {
    if (!isClient) return;
    (async () => {
      try {
        const res = await apiFetch('/events');
        const list = res?.events || res?.data || [];
        setEvents(list);
        const stored = localStorage.getItem('active_event_id');
        const initial = list.find((e) => e.id === stored)?.id || list[0]?.id || null;
        setEventId(initial);
        if (!initial) setLoading(false);
      } catch (err) {
        setError(err.message || 'Could not load your events.');
        setLoading(false);
      }
    })();
  }, [isClient]);

  /* A monotonically increasing token, not a boolean: switching events twice
     in quick succession leaves two requests in flight, and without this the
     slower one can land last and paint the wrong event's numbers under the
     right event's name. Only the newest request is allowed to commit. */
  const requestRef = useRef(0);
  const loadedOnceRef = useRef(false);

  const load = useCallback(async (id, rangeKey) => {
    if (!id) return;
    const token = ++requestRef.current;
    // Refetches hold the previous render at reduced opacity rather than
    // dropping to a skeleton — a dashboard that blanks on every filter change
    // loses the reader's place and jumps the layout.
    if (loadedOnceRef.current) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const days = RANGES.find((r) => r.key === rangeKey)?.days;
      const qs = new URLSearchParams();
      if (days) {
        qs.set('from', new Date(Date.now() - days * 86400000).toISOString().slice(0, 10));
        qs.set('to', new Date().toISOString().slice(0, 10));
      }
      const q = qs.toString();
      const res = await apiFetch(`/events/${id}/analytics${q ? `?${q}` : ''}`);
      if (token !== requestRef.current) return;
      setData(res?.analytics || null);
      loadedOnceRef.current = true;
    } catch (err) {
      if (token !== requestRef.current) return;
      setError(err.message || 'Could not load analytics for this event.');
    } finally {
      if (token === requestRef.current) { setLoading(false); setRefreshing(false); }
    }
  }, []);

  // The whole body is inside an async IIFE so no state is set during the
  // effect's own synchronous run.
  useEffect(() => {
    if (!eventId) return;
    (async () => { await load(eventId, range); })();
  }, [eventId, range, load]);

  const onPickEvent = (id) => {
    setEventId(id);
    try { localStorage.setItem('active_event_id', id); } catch { /* private mode */ }
  };

  const activeEvent = events.find((e) => e.id === eventId);

  return (
    <div style={{ minHeight: '100dvh', background: C.softBg, fontFamily: SANS }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 22px 72px' }}>

        <nav style={{ marginBottom: 18 }}>
          <Link href="/dashboard" style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, textDecoration: 'none',
            color: C.stone, fontSize: 12.5, fontWeight: 600,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
            Dashboard
          </Link>
        </nav>

        <header style={{ marginBottom: 22 }}>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: C.charcoal, letterSpacing: '-.01em' }}>Analytics</h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: C.stone }}>
            How guests are responding to {activeEvent ? <strong style={{ color: C.charcoal, fontWeight: 600 }}>{activeEvent.title}</strong> : 'your event'}.
          </p>
        </header>

        {/* ─── One filter row, scoping everything below it ─── */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center',
          padding: '12px 14px', background: C.white, border: `1px solid ${C.border}`,
          borderRadius: 12, marginBottom: 20,
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: VIZ.inkMuted }}>Event</span>
            <select
              value={eventId || ''}
              onChange={(e) => onPickEvent(e.target.value)}
              style={{
                border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 10px', minHeight: 36,
                fontFamily: SANS, fontSize: 12.5, color: C.charcoal, background: C.white, maxWidth: 320,
              }}
            >
              {events.length === 0 && <option value="">No events yet</option>}
              {events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
          </label>

          <div role="group" aria-label="Date range" style={{ display: 'flex', gap: 4, marginInlineStart: 'auto', flexWrap: 'wrap' }}>
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setRange(r.key)}
                aria-pressed={range === r.key}
                style={{
                  border: `1px solid ${range === r.key ? C.gold : C.border}`,
                  background: range === r.key ? 'rgba(184,148,79,.10)' : 'transparent',
                  color: range === r.key ? '#7D560F' : VIZ.inkSecondary,
                  borderRadius: 999, padding: '6px 13px', minHeight: 34,
                  fontFamily: SANS, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >{r.label}</button>
            ))}
          </div>
        </div>

        {error && (
          <div style={{
            padding: '14px 16px', background: 'rgba(196,94,94,.07)', border: '1px solid rgba(196,94,94,.3)',
            borderRadius: 12, color: '#8E3A3A', fontSize: 13, marginBottom: 20,
          }}>
            {error}
            <button type="button" onClick={() => load(eventId, range)} style={{
              marginInlineStart: 12, border: 'none', background: 'transparent', color: '#8E3A3A',
              fontWeight: 700, fontSize: 12.5, cursor: 'pointer', textDecoration: 'underline',
            }}>Try again</button>
          </div>
        )}

        {loading && !data ? (
          <LoadingState />
        ) : !data ? (
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, padding: '48px 24px', textAlign: 'center' }}>
            <Empty text={events.length ? 'No analytics for this event yet.' : 'Create an event to start collecting analytics.'} />
          </div>
        ) : (
          <div style={{ opacity: refreshing ? 0.55 : 1, transition: 'opacity .2s ease' }}>
            <Dashboard data={data} />
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {[140, 220, 220].map((h, i) => (
        <div key={i} style={{ height: h, background: C.white, border: `1px solid ${C.border}`, borderRadius: 14 }} />
      ))}
    </div>
  );
}

/* ═══ The composed view ═══ */
function Dashboard({ data }) {
  const { overview = {}, funnel = [], reveal = {}, engagementActions = {}, declineReasons = {}, sources = {}, timeline = [], rangeApplied = false } = data;

  /* Who is coming is a CURRENT fact, not a windowed one — the backend
     deliberately does not filter RSVP state by the date range (see the
     comment on queries 2-4 there). Saying so on the tiles is the difference
     between a number the organizer trusts and one they quietly distrust
     because it did not move when they changed the range. */
  const stateNote = rangeApplied ? 'all time' : null;

  const responseMix = [
    { label: VIZ.status.yes.label, value: overview.attendingCount || 0, color: VIZ.status.yes.color },
    { label: VIZ.status.maybe.label, value: overview.maybeCount || 0, color: VIZ.status.maybe.color },
    { label: VIZ.status.no.label, value: overview.declinedCount || 0, color: VIZ.status.no.color },
    { label: VIZ.status.pending.label, value: overview.pendingCount || 0, color: VIZ.status.pending.color },
  ];

  const engagementItems = Object.entries(engagementActions)
    .map(([k, v]) => ({ label: ENGAGEMENT_LABELS[k] || k, value: v }))
    .filter((i) => i.value > 0)
    .sort((a, b) => b.value - a.value);

  // The API returns these two as { key: count } maps, not arrays.
  const declineItems = Object.entries(declineReasons || {})
    .map(([reason, count]) => ({ label: prettyLabel(reason), value: count }))
    .filter((i) => i.value > 0)
    .sort((a, b) => b.value - a.value);

  const sourceItems = Object.entries(sources || {})
    .map(([source, count]) => ({ label: prettyLabel(source), value: count }))
    .filter((i) => i.value > 0)
    .sort((a, b) => b.value - a.value);

  const days = timeline.map((t) => ({ ...t, label: formatDay(t.date) }));

  return (
    <div style={{ display: 'grid', gap: 16 }}>

      {/* ─── 1 + 2: the headline ─── */}
      <section style={{
        background: VIZ.surface, border: `1px solid ${C.border}`, borderRadius: 14,
        padding: '22px 24px', display: 'grid', gap: 22,
        gridTemplateColumns: 'minmax(180px, 260px) 1fr', alignItems: 'center',
      }}>
        <Hero
          label="Confirmed guests"
          value={compact(overview.totalHeadcount || 0)}
          sub={`${compact(overview.attendingCount || 0)} parties attending${stateNote ? ` · ${stateNote}` : ''}`}
        />
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
          <Stat label="Invitation views" value={compact(overview.totalPageViews || 0)} />
          <Stat label="Unique visitors" value={compact(overview.uniqueVisitors || 0)} />
          <Stat label="Responses" value={compact(overview.totalRsvps || 0)} sub={`${overview.pendingCount || 0} still to reply${stateNote ? ` · ${stateNote}` : ''}`} />
          {/* Hidden while a range is applied — its two halves would come from
              different windows. The backend sends null rather than a figure. */}
          {overview.conversionRate != null && (
            <Stat label="Reply rate" value={`${overview.conversionRate}%`} sub="of everyone who looked" />
          )}
        </div>
      </section>

      {/* ─── 3: the envelope ─── */}
      <Card
        title="The envelope"
        hint="Every guest meets the sealed invitation before the page itself. This is how many got past it — and how long they hesitated before tapping the wax."
        table={{
          columns: ['Stage', 'Guests'],
          rows: [
            ['Envelope shown', compact(reveal.shown || 0)],
            ['Seal tapped', compact(reveal.opened || 0)],
            ['Skipped', compact(reveal.skipped || 0)],
            ['Artwork failed to load', compact(reveal.failed || 0)],
            ['Median time to tap', duration(reveal.medianMsToOpen)],
          ],
        }}
      >
        {reveal.shown ? (
          <>
            <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', alignItems: 'start' }}>
              <Meter
                label="Opened the seal"
                value={reveal.openRate || 0}
                caption={`${compact(reveal.opened || 0)} of ${compact(reveal.shown)} guests who saw it`}
              />
              <Stat label="Median time to tap" value={duration(reveal.medianMsToOpen)} sub="from the moment it appeared" />
              <Stat label="Skipped it" value={compact(reveal.skipped || 0)} sub={reveal.shown ? `${Math.round(((reveal.skipped || 0) / reveal.shown) * 100)}% of viewers` : null} />
            </div>
            {reveal.failed > 0 && (
              <StatusNote tone="critical">
                <strong>{compact(reveal.failed)}</strong> {reveal.failed === 1 ? 'guest' : 'guests'} never saw the envelope — its artwork
                failed to load and they were shown the plain invitation card instead. This is a fault, not a preference: any number here
                above zero is worth investigating.
              </StatusNote>
            )}
          </>
        ) : (
          <Empty text="No guest has reached the envelope in this range yet." />
        )}
      </Card>

      {/* ─── 4: where they fall out ─── */}
      <Card
        title="RSVP funnel"
        hint="Each step is the number of guests who reached it. The drop beside a step is how many were lost getting there from the one above."
        table={{
          columns: ['Step', 'Guests', 'Drop-off'],
          rows: funnel.map((s) => [s.step, compact(s.count), s.dropOff != null ? `${s.dropOff}%` : '—']),
        }}
      >
        {funnel.some((s) => s.count > 0) ? (
          <BarList
            ramp={VIZ.ordinal}
            items={funnel.map((s) => ({
              label: s.step,
              value: s.count,
              note: s.dropOff ? `−${s.dropOff}%` : null,
            }))}
          />
        ) : <Empty text="No form activity in this range yet." />}
      </Card>

      {/* ─── 5: what they answered ─── */}
      <Card
        title="Response mix"
        hint={stateNote ? 'Where every guest stands right now — this one is not affected by the date range above.' : null}
        table={{
          columns: ['Response', 'Parties'],
          rows: responseMix.map((s) => [s.label, compact(s.value)]),
        }}
      >
        <StackedBar segments={responseMix} />
      </Card>

      {/* ─── 6: when ─── */}
      <Card
        title="Activity over time"
        hint="Three separate panels, each on its own scale — views outnumber responses by an order of magnitude, and stacking them on one axis would flatten the line that matters most."
        table={{
          columns: ['Day', 'Views', 'Responses', 'Interactions'],
          rows: days.map((d) => [d.label, compact(d.views), compact(d.rsvps), compact(d.engagements)]),
        }}
      >
        {days.length ? (
          <div style={{ display: 'grid', gap: 18 }}>
            <LinePanel title="Invitation views" points={days.map((d) => ({ label: d.label, value: d.views }))} />
            <LinePanel title="Responses" points={days.map((d) => ({ label: d.label, value: d.rsvps }))} />
            <LinePanel title="Other interactions" points={days.map((d) => ({ label: d.label, value: d.engagements }))} />
            <div style={{
              display: 'flex', justifyContent: 'space-between', paddingTop: 2,
              fontSize: 10.5, color: VIZ.inkMuted, fontVariantNumeric: 'tabular-nums',
            }}>
              <span>{days[0].label}</span>
              {days.length > 2 && <span>{days[Math.floor(days.length / 2)].label}</span>}
              <span>{days[days.length - 1].label}</span>
            </div>
          </div>
        ) : <Empty text="No activity in this range yet." />}
      </Card>

      {/* ─── 7: the rest ─── */}
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <Card
          title="What guests did"
          table={{ columns: ['Action', 'Times'], rows: engagementItems.map((i) => [i.label, compact(i.value)]) }}
        >
          <BarList items={engagementItems} emptyText="No extra interactions recorded yet." />
        </Card>

        <Card
          title="Why guests declined"
          table={{ columns: ['Reason', 'Parties'], rows: declineItems.map((i) => [i.label, compact(i.value)]) }}
        >
          <BarList items={declineItems} emptyText="No declines with a reason given." />
        </Card>

        <Card
          title="How they replied"
          table={{ columns: ['Channel', 'Responses'], rows: sourceItems.map((i) => [i.label, compact(i.value)]) }}
        >
          <BarList items={sourceItems} emptyText="No responses yet." />
        </Card>
      </div>
    </div>
  );
}

function prettyLabel(s) {
  if (!s) return 'Unknown';
  return String(s).replace(/_/g, ' ').replace(/^\w/, (m) => m.toUpperCase());
}

function formatDay(iso) {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
