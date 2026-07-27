const { supabase } = require('../config/supabase');
const logger = require('../utils/logger');
const crypto = require('crypto');

/* ═══════════════════════════════════════════════════════════════
   GUEST ANALYTICS CONTROLLER
   Tracks guest engagement events and provides organizer insights
   ═══════════════════════════════════════════════════════════════ */

/**
 * Anonymize IP for GDPR compliance — stores only a SHA-256 hash.
 * The salt MUST come from the environment, not source control: IPv4 space is
 * small enough (~4B addresses) that a salt checked into git lets anyone with
 * repo access precompute a rainbow table and reverse every stored hash back
 * to the original IP, defeating the anonymization entirely.
 */
const IP_HASH_SALT = process.env.IP_HASH_SALT || (() => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('IP_HASH_SALT environment variable must be set in production.');
  }
  return 'dev-only-insecure-salt';
})();

function hashIP(ip) {
  if (!ip) return null;
  return crypto.createHash('sha256').update(ip + IP_HASH_SALT).digest('hex').substring(0, 16);
}

/* The envelope reveal funnel. Declared once and shared by the ingest
   whitelist and the organizer aggregate below, so a type can never be
   accepted at one end and invisible at the other. */
const REVEAL_EVENT_TYPES = ['reveal_shown', 'reveal_opened', 'reveal_skipped', 'reveal_failed'];

/* Things a guest chose to DO on the invitation, as opposed to steps they
   passed through or impressions counted at them. Shared by the engagement
   breakdown and the daily timeline so both mean the same thing by
   "interaction". */
const ACTION_TYPES = [
  'calendar_added', 'share_clicked', 'directions_clicked',
  'guest_pass_downloaded', 'gallery_viewed', 'music_played', 'seating_searched',
];

/**
 * Record a guest engagement event (public endpoint — no auth required).
 * POST /api/v1/public/events/:slug/analytics
 *
 * Body: { eventType, sessionId?, partyId?, metadata?, referrer? }
 *
 * Supported event types:
 *   - page_view          — Guest opens event page
 *   - rsvp_started       — Guest clicks RSVP button
 *   - rsvp_step_1        — Name entry step reached
 *   - rsvp_step_2        — Attendance selection step
 *   - rsvp_step_3        — Party details step
 *   - rsvp_step_4        — Custom questions step
 *   - rsvp_completed     — RSVP form submitted successfully
 *   - rsvp_abandoned     — Guest started but did not finish (client-side beacon)
 *   - calendar_added     — Guest added event to calendar
 *   - share_clicked      — Guest shared invitation
 *   - directions_clicked — Guest clicked "Get Directions"
 *   - guest_pass_downloaded — Guest downloaded their pass
 *   - gallery_viewed     — Guest opened photo gallery
 *   - music_played       — Guest played background music
 *
 * Envelope reveal funnel (the overlay every guest meets before the page):
 *   - reveal_shown       — Reveal became visible. metadata.via says how it got
 *                          there: 'decoded' (artwork ready), 'timeout' (shown
 *                          anyway on a slow connection), 'reduced-motion' or
 *                          'artwork-failed' (the static card instead).
 *   - reveal_opened      — Guest tapped the wax seal. metadata.msToTap is the
 *                          time from reveal_shown, and is THE number for
 *                          judging whether the tap affordance reads.
 *   - reveal_skipped     — Guest used the skip control instead.
 *   - reveal_failed      — The envelope artwork did not load. Operational, not
 *                          behavioural: any volume here is a bug, not a
 *                          preference.
 *
 * reveal_shown is the denominator for the other three. page_view is NOT a
 * substitute for it — it fires on paths where the reveal never plays at all.
 */
const trackGuestEvent = async (req, res) => {
  const { slug } = req.params;
  const { eventType, sessionId, partyId, metadata, referrer } = req.body;

  if (!eventType) {
    return res.status(400).json({ success: false, error: 'eventType is required' });
  }

  // Validate event type whitelist
  const ALLOWED_TYPES = [
    'page_view', 'rsvp_started', 'rsvp_step_1', 'rsvp_step_2', 'rsvp_step_3',
    'rsvp_step_4', 'rsvp_completed', 'rsvp_abandoned', 'calendar_added',
    'share_clicked', 'directions_clicked', 'guest_pass_downloaded',
    'gallery_viewed', 'music_played', 'seating_searched',
    ...REVEAL_EVENT_TYPES,
  ];

  if (!ALLOWED_TYPES.includes(eventType)) {
    return res.status(400).json({ success: false, error: `Invalid eventType. Allowed: ${ALLOWED_TYPES.join(', ')}` });
  }

  try {
    // Resolve event from slug (lightweight query)
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id')
      .eq('slug', slug)
      .single();

    if (eventError || !event) {
      return res.status(404).json({ success: false, error: 'EVENT_NOT_FOUND' });
    }

    // Insert analytics event — fire-and-forget is fine, but we await for error detection
    const { error: insertError } = await supabase
      .from('guest_analytics')
      .insert({
        event_id: event.id,
        party_id: partyId || null,
        session_id: sessionId || null,
        event_type: eventType,
        metadata: metadata || {},
        user_agent: (req.headers['user-agent'] || '').substring(0, 500),
        ip_hash: hashIP(req.ip),
        referrer: referrer || req.headers.referer || null,
      });

    if (insertError) {
      logger.warn({ insertError, slug, eventType }, 'Analytics insert failed');
      // Don't return error to client — analytics should never block UX
    }

    return res.status(202).json({ success: true });
  } catch (err) {
    // Never let analytics errors affect guest experience
    logger.error({ err, slug, eventType }, 'Analytics tracking error');
    return res.status(202).json({ success: true });
  }
};

/**
 * Get engagement analytics for an event (organizer-only, auth required).
 * GET /api/v1/events/:eventId/analytics
 *
 * Returns:
 *   - overview: total views, unique visitors, engagement rate
 *   - funnel: RSVP conversion funnel steps
 *   - timeline: daily engagement chart data
 *   - sources: response source breakdown (web_form vs email)
 *   - declineReasons: decline reason breakdown
 */
const getEventAnalytics = async (req, res, next) => {
  const { eventId } = req.params;
  const { from, to } = req.query;

  // Validate optional date range parameters
  if (from && isNaN(Date.parse(from))) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: "Invalid 'from' date parameter. Use ISO 8601 format (e.g. 2026-01-01)." });
  }
  if (to && isNaN(Date.parse(to))) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: "Invalid 'to' date parameter. Use ISO 8601 format (e.g. 2026-12-31)." });
  }
  if (from && to && new Date(from) > new Date(to)) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: "'from' date must be before 'to' date." });
  }

  /* Applies the ?from / ?to window to a query.
     These two parameters were validated in careful detail above and then
     applied to NOTHING: every query ran unscoped, so the endpoint answered
     every date range with the same all-time numbers. A range control in the
     UI on top of that would not be a missing feature, it would be a lie, so
     the filter is wired here before anything is built against it.
     `to` is taken as inclusive of its whole day — an organizer asking for
     "up to the 24th" means the end of the 24th, not midnight at its start. */
  const rangeApplied = !!(from || to);
  const toEndOfDay = to ? new Date(new Date(to).setUTCHours(23, 59, 59, 999)).toISOString() : null;
  const inRange = (query) => {
    let q = query;
    if (from) q = q.gte('created_at', new Date(from).toISOString());
    if (toEndOfDay) q = q.lte('created_at', toEndOfDay);
    return q;
  };

  try {
    // Run all analytics queries in parallel
    const [
      analyticsResult,
      rsvpStatsResult,
      declineReasonsResult,
      sourceBreakdownResult,
      timelineResult,
      revealResult,
    ] = await Promise.all([
      // 1. All analytics events for this event
      inRange(supabase
        .from('guest_analytics')
        .select('event_type, session_id, created_at')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true })),

      // 2-4. RSVP state. Deliberately NOT windowed by ?from/?to, unlike the
      // analytics queries around them. guest_analytics rows are EVENTS — a
      // view happened on a day — so a date window is meaningful. rsvp_parties
      // rows are current STATE, and their created_at is when the party was
      // added to the guest list (usually a bulk import), not when anyone
      // replied. Windowing on it would answer "guests added in the last 7
      // days", so an organizer picking a range would watch their headcount
      // collapse toward zero on a perfectly healthy event.
      supabase
        .from('rsvp_parties')
        .select('id, response, response_source, decline_reason, maybe_confirm_by, created_at, responded_at, guests(id)')
        .eq('event_id', eventId),

      supabase
        .from('rsvp_parties')
        .select('decline_reason')
        .eq('event_id', eventId)
        .eq('response', 'no')
        .not('decline_reason', 'is', null),

      supabase
        .from('rsvp_parties')
        .select('response_source')
        .eq('event_id', eventId)
        .not('response', 'eq', 'pending'),

      // 5. Daily timeline (analytics events grouped by day)
      inRange(supabase
        .from('guest_analytics')
        .select('event_type, created_at')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true })),

      // 6. Envelope reveal funnel. Queried separately, and narrowly, because
      // it is the only aggregate that needs `metadata` — pulling that column
      // for every analytics row on a large event would multiply the payload
      // of the four queries above for the sake of one small block.
      inRange(supabase
        .from('guest_analytics')
        .select('event_type, metadata')
        .eq('event_id', eventId)
        .in('event_type', REVEAL_EVENT_TYPES)),
    ]);

    const analytics = analyticsResult.data || [];
    const rsvps = rsvpStatsResult.data || [];
    const declineData = declineReasonsResult.data || [];
    const sourceData = sourceBreakdownResult.data || [];
    const timelineData = timelineResult.data || [];

    // ─── OVERVIEW ───
    const totalPageViews = analytics.filter(a => a.event_type === 'page_view').length;
    const uniqueSessions = new Set(analytics.filter(a => a.session_id).map(a => a.session_id)).size;
    const totalRsvps = rsvps.filter(r => r.response !== 'pending').length;
    const attendingCount = rsvps.filter(r => r.response === 'yes').length;
    const declinedCount = rsvps.filter(r => r.response === 'no').length;
    const maybeCount = rsvps.filter(r => r.response === 'maybe').length;
    const pendingCount = rsvps.filter(r => r.response === 'pending').length;
    const totalHeadcount = rsvps.filter(r => r.response === 'yes').reduce((sum, r) => sum + ((r.guests || []).length || 1), 0);

    // ─── CONVERSION FUNNEL ───
    const funnelSteps = [
      { step: 'Page Views', count: totalPageViews },
      { step: 'RSVP Started', count: analytics.filter(a => a.event_type === 'rsvp_started').length },
      { step: 'Name Entered', count: analytics.filter(a => a.event_type === 'rsvp_step_1').length },
      { step: 'Attendance Selected', count: analytics.filter(a => a.event_type === 'rsvp_step_2').length },
      { step: 'Details Filled', count: analytics.filter(a => a.event_type === 'rsvp_step_3').length },
      { step: 'RSVP Completed', count: analytics.filter(a => a.event_type === 'rsvp_completed').length },
    ];

    // Compute drop-off rates
    const funnel = funnelSteps.map((step, i) => ({
      ...step,
      dropOff: i > 0 && funnelSteps[i - 1].count > 0
        ? Math.round(((funnelSteps[i - 1].count - step.count) / funnelSteps[i - 1].count) * 100)
        : 0,
      conversionRate: funnelSteps[0].count > 0
        ? Math.round((step.count / funnelSteps[0].count) * 100)
        : 0,
    }));

    // ─── DECLINE REASONS ───
    const declineReasons = {};
    declineData.forEach(d => {
      const reason = d.decline_reason || 'unspecified';
      declineReasons[reason] = (declineReasons[reason] || 0) + 1;
    });

    // ─── RESPONSE SOURCES ───
    const sources = {};
    sourceData.forEach(s => {
      const src = s.response_source || 'web_form';
      sources[src] = (sources[src] || 0) + 1;
    });

    // ─── ENGAGEMENT ACTIONS ───
    const engagementActions = {};
    ACTION_TYPES.forEach(type => {
      engagementActions[type] = analytics.filter(a => a.event_type === type).length;
    });

    // ─── DAILY TIMELINE ───
    const dailyMap = {};
    timelineData.forEach(a => {
      const day = new Date(a.created_at).toISOString().split('T')[0];
      if (!dailyMap[day]) dailyMap[day] = { date: day, views: 0, rsvps: 0, engagements: 0 };
      if (a.event_type === 'page_view') dailyMap[day].views++;
      else if (a.event_type === 'rsvp_completed') dailyMap[day].rsvps++;
      // Previously "everything else", which quietly swept up funnel steps and
      // abandonments — and would now also swallow the reveal impressions,
      // which fire once per guest and would have dwarfed the real
      // interactions on this line. Only deliberate guest actions count.
      else if (ACTION_TYPES.includes(a.event_type)) dailyMap[day].engagements++;
    });
    // ─── ENVELOPE REVEAL ───
    // How the overlay that stands in front of the whole invitation actually
    // performs. `shown` is the denominator, not page views: the reveal does
    // not play on every page view (password gates, the ?noreveal=1 bypass, a
    // repeat visit inside one RSVP session), so dividing by page views would
    // understate the open rate by counting guests who were never offered it.
    const revealRows = revealResult.data || [];
    const countReveal = (type) => revealRows.filter(r => r.event_type === type).length;
    const revealShown = countReveal('reveal_shown');
    const revealOpened = countReveal('reveal_opened');

    // Median, not mean: a handful of guests who leave the tab open for minutes
    // would drag an average far away from what a typical guest experiences,
    // and this number exists to answer "does the tap affordance read quickly".
    const tapTimes = revealRows
      .filter(r => r.event_type === 'reveal_opened')
      .map(r => Number(r.metadata?.msToTap))
      .filter(ms => Number.isFinite(ms) && ms >= 0)
      .sort((a, b) => a - b);
    const medianMsToOpen = tapTimes.length
      ? (tapTimes.length % 2
        ? tapTimes[(tapTimes.length - 1) / 2]
        : Math.round((tapTimes[tapTimes.length / 2 - 1] + tapTimes[tapTimes.length / 2]) / 2))
      : null;

    const reveal = {
      shown: revealShown,
      opened: revealOpened,
      skipped: countReveal('reveal_skipped'),
      // Any value above zero is a bug report, not a guest preference.
      failed: countReveal('reveal_failed'),
      openRate: revealShown > 0 ? Math.round((revealOpened / revealShown) * 100) : 0,
      medianMsToOpen,
    };

    const timeline = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

    // ─── RESPONSE ───
    return res.json({
      success: true,
      analytics: {
        // Lets the UI say which blocks the date range actually applies to.
        rangeApplied,
        overview: {
          totalPageViews,
          uniqueVisitors: uniqueSessions,
          totalRsvps,
          attendingCount,
          declinedCount,
          maybeCount,
          pendingCount,
          totalHeadcount,
          // Null, not a number, whenever a window is applied: the numerator
          // is every response ever and the denominator is only the views in
          // the window, so the ratio is meaningless — and on a narrow window
          // it cheerfully exceeds 100%. The UI hides the tile when this is
          // null rather than printing a figure nobody can act on.
          conversionRate: rangeApplied
            ? null
            : (totalPageViews > 0 ? Math.round((totalRsvps / totalPageViews) * 100) : 0),
          // Nulled under a window for the same reason as conversionRate
          // directly above: unique VISITORS is windowed and total responses is
          // not, so the ratio compares two different spans of time.
          engagementRate: rangeApplied
            ? null
            : (uniqueSessions > 0 ? Math.round((totalRsvps / uniqueSessions) * 100) : 0),
        },
        funnel,
        declineReasons,
        sources,
        engagementActions,
        reveal,
        timeline,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get maybe-response guests who haven't confirmed yet.
 * GET /api/v1/events/:eventId/analytics/maybe-guests
 */
const getMaybeGuests = async (req, res, next) => {
  const { eventId } = req.params;

  try {
    const { data: maybeParties, error } = await supabase
      .from('rsvp_parties')
      .select('id, label, maybe_confirm_by, created_at, updated_at, guests(is_primary_contact, email, phone)')
      .eq('event_id', eventId)
      .eq('response', 'maybe')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.json({
      success: true,
      guests: (maybeParties || []).map(p => {
        const primary = (p.guests || []).find(g => g.is_primary_contact) || {};
        return {
          id: p.id, guest_name: p.label, email: primary.email || null, phone: primary.phone || null,
          maybe_confirm_by: p.maybe_confirm_by, created_at: p.created_at, updated_at: p.updated_at,
          daysSinceRsvp: Math.floor((Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24)),
          isOverdue: p.maybe_confirm_by && Date.now() > new Date(p.updated_at || p.created_at).getTime() + parseDuration(p.maybe_confirm_by),
        };
      }),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Parse a human-readable duration like "24h", "3d", "1w" into milliseconds.
 */
function parseDuration(str) {
  if (!str) return Infinity;
  const match = str.match(/^(\d+)\s*(h|d|w)$/i);
  if (!match) return Infinity;
  const val = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === 'h') return val * 60 * 60 * 1000;
  if (unit === 'd') return val * 24 * 60 * 60 * 1000;
  if (unit === 'w') return val * 7 * 24 * 60 * 60 * 1000;
  return Infinity;
}


module.exports = {
  trackGuestEvent,
  getEventAnalytics,
  getMaybeGuests,
};
