const { supabase } = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * Fetches aggregated dashboard data for the authenticated organizer.
 * GET /api/v1/dashboard
 */
const getDashboardData = async (req, res, next) => {
  try {
    // 1. Get user's organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('owner_user_id', req.user.id)
      .single();

    if (orgError || !org) {
      logger.warn({ orgError, userId: req.user.id }, 'Dashboard: org not found');
      return res.status(403).json({
        success: false,
        error: 'ORG_NOT_FOUND',
        message: 'No organization found for this user.'
      });
    }

    const orgId = org.id;

    // 2. Get all events for this org
    const { data: orgEvents, error: eventsError } = await supabase
      .from('events')
      .select('id, status, event_date')
      .eq('org_id', orgId);

    if (eventsError) {
      logger.error({ eventsError }, 'Dashboard: failed to fetch events');
      throw eventsError;
    }

    const events = orgEvents || [];
    const eventIds = events.map(e => e.id);
    const totalEvents = events.length;
    const activeEvents = events.filter(e => e.status === 'active').length;

    // 3. If no events, return zeroed-out response
    if (eventIds.length === 0) {
      return res.json({
        success: true,
        dashboard: {
          totalEvents: 0,
          activeEvents: 0,
          totalGuests: 0,
          rsvpOverview: {
            acceptedCount: 0,
            acceptedPercent: 0,
            declinedCount: 0,
            declinedPercent: 0,
            pendingCount: 0,
            pendingPercent: 0
          },
          checkedIn: 0,
          notArrived: 0,
          totalGuestsAccepted: 0,
          rsvpTrend: [],
          upcomingEvents: [],
          recentActivity: []
        }
      });
    }

    // 4. Run all dashboard queries in parallel
    const [
      statsResult,
      checkInsResult,
      rsvpTrendResult,
      upcomingEventsResult,
      recentActivityResult
    ] = await Promise.all([
      // a) Stats — RSVP aggregation
      supabase
        .from('rsvps')
        .select('response, party_size')
        .in('event_id', eventIds),

      // b) Check-ins count
      supabase
        .from('check_ins')
        .select('id', { count: 'exact', head: true })
        .in('event_id', eventIds),

      // c) RSVP Trend — raw data to aggregate by date
      supabase
        .from('rsvps')
        .select('submitted_at, response, party_size')
        .in('event_id', eventIds)
        .not('submitted_at', 'is', null)
        .order('submitted_at', { ascending: true }),

      // d) Upcoming Events
      supabase
        .from('events')
        .select('id, title, event_date, location_name, status')
        .eq('org_id', orgId)
        .gte('event_date', new Date().toISOString())
        .order('event_date', { ascending: true })
        .limit(5),

      // e) Recent Activity
      supabase
        .from('activity_logs')
        .select('id, action, metadata, created_at, entity_type, entity_id')
        .in('event_id', eventIds)
        .order('created_at', { ascending: false })
        .limit(10)
    ]);

    // --- Process a) Stats ---
    if (statsResult.error) {
      logger.error({ error: statsResult.error }, 'Dashboard: stats query failed');
      throw statsResult.error;
    }
    const rsvps = statsResult.data || [];

    let totalGuests = 0;
    let acceptedCount = 0;
    let declinedCount = 0;
    let pendingCount = 0;

    rsvps.forEach(rsvp => {
      const size = rsvp.party_size || 1;
      totalGuests += size;
      if (rsvp.response === 'yes') {
        acceptedCount += size;
      } else if (rsvp.response === 'no') {
        declinedCount += size;
      } else {
        pendingCount += size;
      }
    });

    const acceptedPercent = totalGuests > 0 ? Math.round((acceptedCount / totalGuests) * 100) : 0;
    const declinedPercent = totalGuests > 0 ? Math.round((declinedCount / totalGuests) * 100) : 0;
    const pendingPercent = totalGuests > 0 ? Math.round((pendingCount / totalGuests) * 100) : 0;

    // --- Process b) Check-ins ---
    if (checkInsResult.error) {
      logger.error({ error: checkInsResult.error }, 'Dashboard: check-ins query failed');
      // Non-fatal: default to 0
    }
    const checkedIn = checkInsResult.count || 0;
    const notArrived = Math.max(acceptedCount - checkedIn, 0);

    // --- Process c) RSVP Trend ---
    let rsvpTrendLimited = [];
    if (rsvpTrendResult.error) {
      logger.error({ error: rsvpTrendResult.error }, 'Dashboard: rsvp trend query failed');
      // Non-fatal: return empty trend
    } else {
      const trendRsvps = rsvpTrendResult.data || [];

      // Group by date (day) and build cumulative running totals
      const dailyMap = {};
      trendRsvps.forEach(rsvp => {
        if (!rsvp.submitted_at) return;
        const dateObj = new Date(rsvp.submitted_at);
        const dateKey = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD for sorting
        if (!dailyMap[dateKey]) {
          dailyMap[dateKey] = { accepted: 0, declined: 0, pending: 0 };
        }
        const size = rsvp.party_size || 1;
        if (rsvp.response === 'yes') {
          dailyMap[dateKey].accepted += size;
        } else if (rsvp.response === 'no') {
          dailyMap[dateKey].declined += size;
        } else {
          dailyMap[dateKey].pending += size;
        }
      });

      const sortedDates = Object.keys(dailyMap).sort();
      let cumAccepted = 0;
      let cumDeclined = 0;
      let cumPending = 0;

      const rsvpTrend = sortedDates.map(dateKey => {
        cumAccepted += dailyMap[dateKey].accepted;
        cumDeclined += dailyMap[dateKey].declined;
        cumPending += dailyMap[dateKey].pending;

        // Format date as 'MMM DD' (e.g. 'Apr 20')
        const d = new Date(dateKey + 'T00:00:00Z');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const formattedDate = `${months[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, '0')}`;

        return {
          date: formattedDate,
          accepted: cumAccepted,
          declined: cumDeclined,
          pending: cumPending
        };
      });

      // Limit to last 30 data points
      rsvpTrendLimited = rsvpTrend.slice(-30);
    }

    // --- Process d) Upcoming Events ---
    let upcomingEvents = [];
    if (upcomingEventsResult.error) {
      logger.error({ error: upcomingEventsResult.error }, 'Dashboard: upcoming events query failed');
      // Non-fatal: return empty
    } else {
      const upcomingRaw = upcomingEventsResult.data || [];

      // For each upcoming event, get count of RSVPs with response='yes'
      upcomingEvents = await Promise.all(
        upcomingRaw.map(async (event) => {
          let guestCount = 0;
          try {
            const { data: yesRsvps } = await supabase
              .from('rsvps')
              .select('party_size')
              .eq('event_id', event.id)
              .eq('response', 'yes');

            guestCount = (yesRsvps || []).reduce((sum, r) => sum + (r.party_size || 1), 0);
          } catch (e) {
            logger.warn({ eventId: event.id, error: e }, 'Dashboard: failed to get guest count for event');
          }

          return {
            id: event.id,
            title: event.title,
            event_date: event.event_date,
            location_name: event.location_name,
            status: event.status,
            guestCount
          };
        })
      );
    }

    // --- Process e) Recent Activity ---
    let recentActivity = [];
    if (recentActivityResult.error) {
      logger.error({ error: recentActivityResult.error }, 'Dashboard: activity query failed');
      // Non-fatal: return empty
    } else {
      const activityRaw = recentActivityResult.data || [];

      // Join with rsvps table to get guest_name where entity_type = 'rsvp'
      const rsvpEntityIds = activityRaw
        .filter(a => a.entity_type === 'rsvp' && a.entity_id)
        .map(a => a.entity_id);

      let rsvpNameMap = {};
      if (rsvpEntityIds.length > 0) {
        try {
          const { data: rsvpNames } = await supabase
            .from('rsvps')
            .select('id, guest_name')
            .in('id', rsvpEntityIds);

          if (rsvpNames) {
            rsvpNames.forEach(r => {
              rsvpNameMap[r.id] = r.guest_name;
            });
          }
        } catch (e) {
          logger.warn({ error: e }, 'Dashboard: failed to resolve guest names');
        }
      }

      recentActivity = activityRaw.map(activity => ({
        id: activity.id,
        action: activity.action,
        metadata: activity.metadata,
        created_at: activity.created_at,
        guest_name: (activity.entity_type === 'rsvp' && activity.entity_id)
          ? (rsvpNameMap[activity.entity_id] || null)
          : null
      }));
    }

    // 5. Build and return response
    return res.json({
      success: true,
      dashboard: {
        totalEvents,
        activeEvents,
        totalGuests,
        rsvpOverview: {
          acceptedCount,
          acceptedPercent,
          declinedCount,
          declinedPercent,
          pendingCount,
          pendingPercent
        },
        checkedIn,
        notArrived,
        totalGuestsAccepted: acceptedCount,
        rsvpTrend: rsvpTrendLimited,
        upcomingEvents,
        recentActivity
      }
    });
  } catch (err) {
    logger.error({ err, message: err.message, code: err.code, details: err.details, hint: err.hint, userId: req.user?.id }, 'getDashboardData failed');
    next(err);
  }
};

module.exports = {
  getDashboardData
};
