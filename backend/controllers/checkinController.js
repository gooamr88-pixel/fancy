const { supabase } = require('../config/supabase');
const { verifyTicketToken } = require('../utils/qrHelper');

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

    // 3. Check if already checked in
    const { data: existingCheckIn } = await supabase
      .from('check_ins')
      .select('id, checked_in_at')
      .eq('event_id', eventId)
      .eq('rsvp_id', guest_id)
      .single();

    if (existingCheckIn) {
      return res.status(409).json({
        success: false,
        error: 'ALREADY_CHECKED_IN',
        message: `Guest already checked in at ${new Date(existingCheckIn.checked_in_at).toLocaleTimeString()}`,
        checkedInAt: existingCheckIn.checked_in_at
      });
    }

    // 4. Perform check-in (atomic)
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
    await supabase.channel(`event-${eventId}`).send({
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

    // 2. Check if already checked in
    const { data: existingCheckIn } = await supabase
      .from('check_ins')
      .select('id, checked_in_at')
      .eq('event_id', eventId)
      .eq('rsvp_id', rsvpId)
      .single();

    if (existingCheckIn) {
      return res.status(409).json({
        success: false,
        error: 'ALREADY_CHECKED_IN',
        message: 'Guest already checked in.'
      });
    }

    // 3. Record check-in
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
      return res.status(500).json({ success: false, error: 'CHECKIN_FAILED' });
    }

    // Broadcast checkin event via Realtime
    await supabase.channel(`event-${eventId}`).send({
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
      .ilike('guest_name', `%${query}%`)
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

module.exports = {
  scanCheckIn,
  manualCheckIn,
  searchGuests
};
