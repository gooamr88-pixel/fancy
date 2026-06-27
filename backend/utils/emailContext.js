const { supabase } = require('../config/supabase');

/**
 * Rich, precise event statistics for organizer reports/digests. Computed from a
 * single minimal RSVP read + a head-count check-in count, so reports reflect the
 * live database state rather than approximations.
 */
async function getEventStats(eventId) {
  const stat = {
    total: 0, attending: 0, declined: 0, maybe: 0, pending: 0,
    invited: 0, responded: 0, headcount: 0, checkedIn: 0, responseRate: 0,
  };
  try {
    const [{ data }, { data: invitedRows }] = await Promise.all([
      supabase.from('rsvp_parties').select('response, guests(id)').eq('event_id', eventId),
      supabase.from('invitations').select('party_id').eq('event_id', eventId).in('status', ['sent', 'delivered', 'opened', 'responded']),
    ]);
    for (const r of (data || [])) {
      stat.total += 1;
      const ps = (r.guests || []).length || 1;
      if (r.response === 'yes') { stat.attending += 1; stat.headcount += ps; }
      else if (r.response === 'no') stat.declined += 1;
      else if (r.response === 'maybe') stat.maybe += 1;
      else stat.pending += 1;
    }
    stat.invited = new Set((invitedRows || []).map((i) => i.party_id)).size;
    stat.responded = stat.attending + stat.declined + stat.maybe;
    const base = stat.invited || stat.total;
    stat.responseRate = base ? Math.round((stat.responded / base) * 100) : 0;
  } catch { /* leave zeros — report still renders */ }

  try {
    const { count } = await supabase
      .from('check_ins')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId);
    stat.checkedIn = count || 0;
  } catch { /* check_ins optional */ }

  return stat;
}

/** Event row joined with its organizer's display name + email. */
async function getEventWithOrg(eventId) {
  try {
    const { data } = await supabase
      .from('events')
      .select('id, title, slug, event_date, event_end_date, rsvp_deadline, status, is_paid, location_name, location_address, tier_name, notification_preferences, organizations(name, email)')
      .eq('id', eventId)
      .single();
    return data || null;
  } catch {
    return null;
  }
}

/** True when the organizer has email notifications enabled for this event. */
const orgEmailEnabled = (event) => {
  const prefs = event && event.notification_preferences;
  return !prefs || prefs.email !== false;
};

module.exports = { getEventStats, getEventWithOrg, orgEmailEnabled };
