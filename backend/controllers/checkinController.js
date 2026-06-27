const { supabase } = require('../config/supabase');
const tokenService = require('../services/tokenService');
const guestService = require('../services/guestService');
const { isEventLiveForGuests } = require('../utils/eventAccess');
const { sendOk, sendFail } = require('../utils/responseEnvelope');
const { broadcast } = require('../utils/realtime');

/**
 * Scan QR ticket and check in the whole party it represents.
 * POST /api/v1/events/:eventId/checkin/scan
 */
const scanCheckIn = async (req, res, next) => {
  const { eventId } = req.params;
  const { token, checkedInBy } = req.body;

  if (!token) return sendFail(res, { status: 400, error: 'VALIDATION_ERROR', message: 'token is required.' });

  let decoded;
  try {
    decoded = tokenService.verifyQrTicket(token);
  } catch {
    return sendFail(res, { status: 400, error: 'INVALID_TICKET', message: 'The QR Code is invalid or has been tampered with.' });
  }

  if (decoded.eventId !== eventId) {
    return sendFail(res, { status: 400, error: 'EVENT_MISMATCH', message: 'This ticket belongs to a different event.' });
  }

  try {
    const { data: party } = await supabase.from('rsvp_parties').select('label').eq('id', decoded.partyId).single();
    
    // Query current live table assignment rather than relying solely on the static token payload
    const { data: assignment } = await supabase
      .from('seating_assignments')
      .select('tables(table_name)')
      .eq('party_id', decoded.partyId)
      .eq('event_id', eventId)
      .maybeSingle();

    const tableName = assignment?.tables?.table_name || decoded.tableName || 'Unassigned';

    const result = await guestService.checkInParty(eventId, decoded.partyId, { method: 'qr_scan', checkedInBy: checkedInBy || null });

    if (!result.success) {
      if (result.error === 'ALREADY_CHECKED_IN') {
        return sendFail(res, {
          status: 409, error: 'ALREADY_CHECKED_IN',
          message: `${party?.label || 'Guest'} already checked in at ${result.checkedInAt ? new Date(result.checkedInAt).toLocaleTimeString() : 'an earlier time'}`,
        });
      }
      return sendFail(res, { status: 404, error: 'GUEST_NOT_FOUND' });
    }

    await supabase.from('activity_logs').insert({
      event_id: eventId, action: 'guest_checked_in', entity_type: 'check_in', entity_id: decoded.partyId,
      metadata: { guest_name: party?.label, party_size: decoded.partySize, method: 'qr_scan' },
    });

    broadcast(eventId, 'checkin_update', {
      partyId: decoded.partyId, guestName: party?.label, partySize: result.totalGuests, tableName, method: 'qr_scan',
    });

    return sendOk(res, {
      message: `${party?.label || 'Guest'} checked in successfully.`,
      partyId: decoded.partyId, guestName: party?.label, tableName, partySize: result.totalGuests, checkedInCount: result.checkedInCount,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Manual check-in by party id (staff search).
 * POST /api/v1/events/:eventId/checkin/manual
 */
const manualCheckIn = async (req, res, next) => {
  const { eventId } = req.params;
  const { partyId, checkedInBy } = req.body;

  if (!partyId) return sendFail(res, { status: 400, error: 'VALIDATION_ERROR', message: 'partyId is required.' });

  try {
    const { data: party, error: partyError } = await supabase
      .from('rsvp_parties').select('label, seating_assignments(tables(table_name))').eq('id', partyId).eq('event_id', eventId).single();
    if (partyError || !party) return sendFail(res, { status: 404, error: 'GUEST_NOT_FOUND', message: 'Guest not found.' });

    const tableName = party.seating_assignments?.[0]?.tables?.table_name || 'Unassigned';
    const result = await guestService.checkInParty(eventId, partyId, { method: 'manual_search', checkedInBy: checkedInBy || null });

    if (!result.success) {
      if (result.error === 'ALREADY_CHECKED_IN') return sendFail(res, { status: 409, error: 'ALREADY_CHECKED_IN', message: 'Guest already checked in.' });
      return sendFail(res, { status: 404, error: 'GUEST_NOT_FOUND' });
    }

    await supabase.from('activity_logs').insert({
      event_id: eventId, action: 'guest_checked_in', entity_type: 'check_in', entity_id: partyId,
      metadata: { guest_name: party.label, party_size: result.totalGuests, method: 'manual_search' },
    });

    broadcast(eventId, 'checkin_update', { partyId, guestName: party.label, partySize: result.totalGuests, tableName, method: 'manual_search' });

    return sendOk(res, { message: `${party.label} checked in successfully.`, partyId, guestName: party.label, tableName, partySize: result.totalGuests, checkedInCount: result.checkedInCount });
  } catch (err) {
    next(err);
  }
};

/**
 * Searches guests for the autocomplete dropdown at the check-in desk.
 * GET /api/v1/events/:eventId/checkin/search
 */
const searchGuests = async (req, res, next) => {
  const { eventId } = req.params;
  const { query } = req.query;
  if (!query) return sendOk(res, { results: [] });

  try {
    const results = await guestService.searchGuestsForCheckin(eventId, query, 10);
    return sendOk(res, { results });
  } catch (err) {
    next(err);
  }
};

/**
 * Reverses every check-in for a party.
 * POST /api/v1/events/:eventId/checkin/undo
 */
const undoCheckIn = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const { partyId } = req.body;
    if (!partyId) return sendFail(res, { status: 400, error: 'VALIDATION_ERROR', message: 'partyId is required.' });

    const removed = await guestService.undoPartyCheckIn(eventId, partyId);
    if (removed === 0) return sendFail(res, { status: 404, error: 'NOT_FOUND', message: 'No check-in record found for this guest.' });

    return sendOk(res, { message: 'Check-in reversed successfully.' });
  } catch (err) {
    next(err);
  }
};

/**
 * Self-service check-in: a guest checks themselves in with their party id +
 * matching name (the second factor — a party id alone is an enumerable
 * capability that travels in shared links, so it must not be sufficient on
 * its own to mark a no-show as arrived).
 * POST /api/v1/public/events/:slug/self-checkin
 */
const selfCheckIn = async (req, res, next) => {
  const { slug } = req.params;
  const { partyId, guestName } = req.body;

  if (!partyId || !guestName || !guestName.trim()) {
    return sendFail(res, { status: 400, error: 'VALIDATION_ERROR', message: 'partyId and guestName are required.' });
  }

  try {
    const { data: event, error: eventError } = await supabase.from('events').select('id, is_paid, status').eq('slug', slug).single();
    if (eventError || !event) return sendFail(res, { status: 404, error: 'EVENT_NOT_FOUND' });
    if (!isEventLiveForGuests({ ...event, slug })) return sendFail(res, { status: 403, error: 'EVENT_INACTIVE', message: 'Event is not active.' });

    const party = await guestService.getPartyForSelfCheckIn(event.id, partyId, guestName);
    if (!party) return sendFail(res, { status: 404, error: 'RSVP_NOT_FOUND', message: 'Guest not found for this event.' });
    if (party.nameMismatch) return sendFail(res, { status: 400, error: 'NAME_MISMATCH', message: 'Guest name does not match the RSVP record.' });

    const result = await guestService.checkInParty(event.id, partyId, { method: 'self_service' });
    if (!result.success) {
      if (result.error === 'ALREADY_CHECKED_IN') {
        return sendFail(res, { status: 409, error: 'ALREADY_CHECKED_IN', message: 'You are already checked in.', meta: { checkedInAt: result.checkedInAt, tableName: party.tableName } });
      }
      return sendFail(res, { status: 404, error: 'GUEST_NOT_FOUND' });
    }

    broadcast(event.id, 'checkin_update', { partyId, guestName: party.label, partySize: result.totalGuests, tableName: party.tableName, method: 'self_service' });

    return sendOk(res, { message: `Welcome, ${party.label}! You are checked in.`, guestName: party.label, tableName: party.tableName, partySize: result.totalGuests });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  scanCheckIn,
  manualCheckIn,
  searchGuests,
  undoCheckIn,
  selfCheckIn,
};
