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

  try {
    // Run all analytics queries in parallel
    const [
      analyticsResult,
      rsvpStatsResult,
      declineReasonsResult,
      sourceBreakdownResult,
      timelineResult,
    ] = await Promise.all([
      // 1. All analytics events for this event
      supabase
        .from('guest_analytics')
        .select('event_type, session_id, created_at')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true }),

      // 2. RSVP stats (party_size is derived from the embedded guest count)
      supabase
        .from('rsvp_parties')
        .select('id, response, response_source, decline_reason, maybe_confirm_by, created_at, responded_at, guests(id)')
        .eq('event_id', eventId),

      // 3. Decline reasons
      supabase
        .from('rsvp_parties')
        .select('decline_reason')
        .eq('event_id', eventId)
        .eq('response', 'no')
        .not('decline_reason', 'is', null),

      // 4. Response source breakdown
      supabase
        .from('rsvp_parties')
        .select('response_source')
        .eq('event_id', eventId)
        .not('response', 'eq', 'pending'),

      // 5. Daily timeline (analytics events grouped by day)
      supabase
        .from('guest_analytics')
        .select('event_type, created_at')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true }),
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
    const ACTION_TYPES = ['calendar_added', 'share_clicked', 'directions_clicked', 'guest_pass_downloaded', 'gallery_viewed', 'music_played', 'seating_searched'];
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
      else dailyMap[day].engagements++;
    });
    const timeline = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

    // ─── RESPONSE ───
    return res.json({
      success: true,
      analytics: {
        overview: {
          totalPageViews,
          uniqueVisitors: uniqueSessions,
          totalRsvps,
          attendingCount,
          declinedCount,
          maybeCount,
          pendingCount,
          totalHeadcount,
          conversionRate: totalPageViews > 0 ? Math.round((totalRsvps / totalPageViews) * 100) : 0,
          engagementRate: uniqueSessions > 0 ? Math.round((totalRsvps / uniqueSessions) * 100) : 0,
        },
        funnel,
        declineReasons,
        sources,
        engagementActions,
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
          isOverdue: p.maybe_confirm_by && new Date() > new Date(p.updated_at || p.created_at).getTime() + parseDuration(p.maybe_confirm_by),
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
