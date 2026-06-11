const { supabase } = require('../config/supabase');
const { verifyTicketToken } = require('../utils/qrHelper');

/** Escape special characters in user input before using it in a LIKE / ILIKE pattern. */
function escapeLikePattern(str) {
  return str.replace(/[%_\\]/g, '\\$&');
}

/**
 * Scan QR ticket and check-in guest.
 * POST /api/v1/events/:eventId/checkin/scan
 */
const scanCheckIn = async (req, res, next) => {
  const { eventId } = req.params;
  const { token, checkedInBy } = req.body;

  if (!token) {
    return res.status(400).json({ success: false, error: 'token is required.' });
  }

  try {
    // 1. Verify and decode JWT token
    let decoded;
    try {
      decoded = verifyTicketToken(token);
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_TICKET',
        message: 'The QR Code is invalid or has been tampered with.'
      });
    }

    const { guest_id, event_id: tokenEventId, table_name, party_size } = decoded;

    // 2. Validate event match
    if (tokenEventId !== eventId) {
      return res.status(400).json({
        success: false,
        error: 'EVENT_MISMATCH',
        message: 'This ticket belongs to a different event.'
      });
    }

    // 3. Perform check-in (insert directly, handle duplicate via DB UNIQUE constraint)
    const { data: checkInData, error: checkInError } = await supabase
      .from('check_ins')
      .insert({
        event_id: eventId,
        rsvp_id: guest_id,
        checked_in_by: checkedInBy || 'QR Scanner',
        method: 'qr_scan',
        party_count_arrived: party_size
      })
      .select()
      .single();

    if (checkInError) {
      // Handle duplicate check-in (UNIQUE constraint violation)
      if (checkInError.code === '23505') {
        const { data: existingCheckIn } = await supabase
          .from('check_ins')
          .select('id, checked_in_at')
          .eq('event_id', eventId)
          .eq('rsvp_id', guest_id)
          .single();

        return res.status(409).json({
          success: false,
          error: 'ALREADY_CHECKED_IN',
          message: `Guest already checked in at ${existingCheckIn ? new Date(existingCheckIn.checked_in_at).toLocaleTimeString() : 'an earlier time'}`,
          checkedInAt: existingCheckIn?.checked_in_at
        });
      }
      return res.status(500).json({
        success: false,
        error: 'CHECKIN_FAILED',
        message: 'Could not record check-in in database.'
      });
    }

    // 5. Fetch guest name for response
    const { data: rsvp } = await supabase
      .from('rsvps')
      .select('guest_name')
      .eq('id', guest_id)
      .single();

    // Broadcast checkin event via Realtime
    const scanChannel = supabase.channel(`event-${eventId}`);
    await scanChannel.send({
      type: 'broadcast',
      event: 'checkin_update',
      payload: {
        rsvpId: guest_id,
        guestName: rsvp?.guest_name,
        partySize: party_size,
        tableName: table_name,
        method: 'qr_scan'
      }
    });
    supabase.removeChannel(scanChannel);

    return res.status(200).json({
      success: true,
      message: `${rsvp?.guest_name || 'Guest'} checked in successfully.`,
      guestName: rsvp?.guest_name,
      tableName: table_name,
      partySize: party_size,
      checkInData
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Performs a manual check-in by RSVP ID.
 * POST /api/v1/events/:eventId/checkin/manual
 */
const manualCheckIn = async (req, res, next) => {
  const { eventId } = req.params;
  const { rsvpId, checkedInBy } = req.body;

  if (!rsvpId) {
    return res.status(400).json({ success: false, error: 'rsvpId is required.' });
  }

  try {
    // 1. Fetch guest party details and table assignment
    const { data: guestData, error: guestError } = await supabase
      .from('rsvps')
      .select('*, seating_assignments(tables(table_name))')
      .eq('id', rsvpId)
      .eq('event_id', eventId)
      .single();

    if (guestError || !guestData) {
      return res.status(404).json({ success: false, error: 'GUEST_NOT_FOUND', message: 'Guest not found.' });
    }

    // 2. Record check-in (insert directly, handle duplicate via DB UNIQUE constraint)
    const tableName = guestData.seating_assignments?.[0]?.tables?.table_name || 'Unassigned';
    
    const { data: checkInData, error: checkInError } = await supabase
      .from('check_ins')
      .insert({
        event_id: eventId,
        rsvp_id: rsvpId,
        checked_in_by: checkedInBy || 'Manual Staff Search',
        method: 'manual_search',
        party_count_arrived: guestData.party_size
      })
      .select()
      .single();

    if (checkInError) {
      // Handle duplicate check-in (UNIQUE constraint violation)
      if (checkInError.code === '23505') {
        return res.status(409).json({
          success: false,
          error: 'ALREADY_CHECKED_IN',
          message: 'Guest already checked in.'
        });
      }
      return res.status(500).json({ success: false, error: 'CHECKIN_FAILED' });
    }

    // Broadcast checkin event via Realtime
    const manualChannel = supabase.channel(`event-${eventId}`);
    await manualChannel.send({
      type: 'broadcast',
      event: 'checkin_update',
      payload: {
        rsvpId,
        guestName: guestData.guest_name,
        partySize: guestData.party_size,
        tableName,
        method: 'manual_search'
      }
    });
    supabase.removeChannel(manualChannel);

    return res.status(200).json({
      success: true,
      message: `${guestData.guest_name} checked in successfully.`,
      guestName: guestData.guest_name,
      tableName,
      partySize: guestData.party_size,
      checkInData
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Searches guests for autocomplete dropdown at check-in desk.
 * GET /api/v1/events/:eventId/checkin/search
 */
const searchGuests = async (req, res, next) => {
  const { eventId } = req.params;
  const { query } = req.query;

  if (!query) {
    return res.json({ success: true, results: [] });
  }

  try {
    // Search by guest name matching query prefix/substring
    const { data, error } = await supabase
      .from('rsvps')
      .select(`
        id,
        guest_name,
        party_size,
        response,
        seating_assignments(
          tables(table_name)
        ),
        check_ins(
          id,
          checked_in_at
        )
      `)
      .eq('event_id', eventId)
      .ilike('guest_name', `%${escapeLikePattern(query)}%`)
      .limit(10);

    if (error) throw error;

    const results = data.map(item => {
      const isCheckedIn = item.check_ins && item.check_ins.length > 0;
      const tableName = item.seating_assignments && item.seating_assignments.length > 0 
        ? item.seating_assignments[0].tables.table_name 
        : 'Unassigned';
      
      return {
        id: item.id,
        guestName: item.guest_name,
        partySize: item.party_size,
        response: item.response,
        tableName,
        isCheckedIn,
        checkedInAt: isCheckedIn ? item.check_ins[0].checked_in_at : null
      };
    });

    return res.json({
      success: true,
      results
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Reverses a guest check-in by deleting the check-in record.
 * POST /api/v1/events/:eventId/checkin/undo
 */
const undoCheckIn = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const { rsvpId } = req.body;

    if (!rsvpId) {
      return res.status(400).json({ success: false, error: 'MISSING_RSVP_ID', message: 'rsvpId is required' });
    }

    const { data, error } = await supabase
      .from('check_ins')
      .delete()
      .eq('event_id', eventId)
      .eq('rsvp_id', rsvpId)
      .select();

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'No check-in record found for this guest' });
    }

    res.json({ success: true, message: 'Check-in reversed successfully' });
  } catch (err) {
    next(err);
  }
};

/**
 * Self-service check-in: guest checks themselves in by providing their RSVP id.
 * POST /api/v1/public/events/:slug/self-checkin
 */
const selfCheckIn = async (req, res, next) => {
  const { slug } = req.params;
  const { rsvpId, guestName } = req.body;

  if (!rsvpId) {
    return res.status(400).json({ success: false, error: 'rsvpId is required.' });
  }

  try {
    // 1. Resolve event
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, is_paid, status')
      .eq('slug', slug)
      .single();

    if (eventError || !event) {
      return res.status(404).json({ success: false, error: 'EVENT_NOT_FOUND' });
    }

    if (!event.is_paid || event.status !== 'active') {
      return res.status(403).json({ success: false, error: 'EVENT_INACTIVE', message: 'Event is not active.' });
    }

    // 2. Verify RSVP exists and belongs to this event
    const { data: rsvp, error: rsvpError } = await supabase
      .from('rsvps')
      .select('id, guest_name, party_size, seating_assignments(tables(table_name))')
      .eq('id', rsvpId)
      .eq('event_id', event.id)
      .single();

    if (rsvpError || !rsvp) {
      return res.status(404).json({ success: false, error: 'RSVP_NOT_FOUND', message: 'Guest not found for this event.' });
    }

    // Optional: verify guest name matches for extra security
    if (guestName && rsvp.guest_name.toLowerCase() !== guestName.toLowerCase()) {
      return res.status(400).json({ success: false, error: 'NAME_MISMATCH', message: 'Guest name does not match the RSVP record.' });
    }

    // 3. Check if already checked in
    const { data: existingCheckIn } = await supabase
      .from('check_ins')
      .select('id, checked_in_at')
      .eq('event_id', event.id)
      .eq('rsvp_id', rsvpId)
      .single();

    if (existingCheckIn) {
      const tableName = rsvp.seating_assignments?.[0]?.tables?.table_name || 'Unassigned';
      return res.status(409).json({
        success: false,
        error: 'ALREADY_CHECKED_IN',
        message: `You are already checked in.`,
        checkedInAt: existingCheckIn.checked_in_at,
        tableName
      });
    }

    // 4. Perform check-in
    const { data: checkInData, error: checkInError } = await supabase
      .from('check_ins')
      .insert({
        event_id: event.id,
        rsvp_id: rsvpId,
        checked_in_by: 'Self-Service Kiosk',
        method: 'self_service',
        party_count_arrived: rsvp.party_size
      })
      .select()
      .single();

    if (checkInError) {
      return res.status(500).json({ success: false, error: 'CHECKIN_FAILED' });
    }

    const tableName = rsvp.seating_assignments?.[0]?.tables?.table_name || 'Unassigned';

    // Broadcast checkin event via Realtime
    const selfChannel = supabase.channel(`event-${event.id}`);
    await selfChannel.send({
      type: 'broadcast',
      event: 'checkin_update',
      payload: {
        rsvpId,
        guestName: rsvp.guest_name,
        partySize: rsvp.party_size,
        tableName,
        method: 'self_service'
      }
    });
    supabase.removeChannel(selfChannel);

    return res.status(200).json({
      success: true,
      message: `Welcome, ${rsvp.guest_name}! You are checked in.`,
      guestName: rsvp.guest_name,
      tableName,
      partySize: rsvp.party_size
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  scanCheckIn,
  manualCheckIn,
  searchGuests,
  undoCheckIn,
  selfCheckIn
};
