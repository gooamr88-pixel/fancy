const { supabase } = require('../config/supabase');
const { sendQRTicketEmailHelper } = require('./notificationController');

/**
 * Assigns a guest party to a table atomically.
 * POST /api/v1/events/:eventId/seating/assign
 */
const assignSeat = async (req, res, next) => {
  const { eventId } = req.params;
  const { rsvpId, tableId } = req.body;
  const assignedBy = req.user?.id || null; // Assume auth middleware sets req.user

  if (!rsvpId || !tableId) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'rsvpId and tableId are required fields.'
    });
  }

  try {
    // Call the postgres atomic seating function
    const { data, error } = await supabase.rpc('assign_seat', {
      p_event_id: eventId,
      p_rsvp_id: rsvpId,
      p_table_id: tableId,
      p_assigned_by: assignedBy
    });

    if (error) {
      console.error('Database RPC error:', error);
      return res.status(500).json({
        success: false,
        error: 'DATABASE_ERROR',
        message: 'A database error occurred during seat assignment.'
      });
    }

    if (!data.success) {
      return res.status(409).json({
        success: false,
        error: data.error,
        message: data.message
      });
    }

    // Broadcast the update using Supabase Realtime channel
    await supabase
      .channel(`event-${eventId}`)
      .send({
        type: 'broadcast',
        event: 'seating_update',
        payload: {
          rsvpId,
          tableId,
          seatsRemaining: data.seats_remaining
        }
      });

    // Auto-fire QR ticket email on successful seating assignment
    try {
      await sendQRTicketEmailHelper(eventId, rsvpId);
    } catch (emailErr) {
      console.error(`Failed to auto-send QR ticket email for RSVP ${rsvpId}:`, emailErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Guest assigned to table successfully. QR ticket email triggered.',
      data
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Reassigns a guest party to a different table atomically.
 * POST /api/v1/events/:eventId/seating/reassign
 */
const reassignSeat = async (req, res, next) => {
  const { eventId } = req.params;
  const { rsvpId, newTableId } = req.body;
  const assignedBy = req.user?.id || null;

  if (!rsvpId || !newTableId) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'rsvpId and newTableId are required fields.'
    });
  }

  try {
    // Call the postgres atomic reassignment function
    const { data, error } = await supabase.rpc('reassign_seat', {
      p_event_id: eventId,
      p_rsvp_id: rsvpId,
      p_new_table_id: newTableId,
      p_assigned_by: assignedBy
    });

    if (error) {
      console.error('Database RPC error:', error);
      return res.status(500).json({
        success: false,
        error: 'DATABASE_ERROR',
        message: 'A database error occurred during seat reassignment.'
      });
    }

    if (!data.success) {
      return res.status(409).json({
        success: false,
        error: data.error,
        message: data.message
      });
    }

    // Broadcast the update using Supabase Realtime channel
    await supabase
      .channel(`event-${eventId}`)
      .send({
        type: 'broadcast',
        event: 'seating_update',
        payload: {
          rsvpId,
          fromTable: data.from_table,
          toTable: data.to_table,
          seatsRemainingNewTable: data.seats_remaining_new_table
        }
      });

    // Auto-fire updated QR ticket email on successful reassignment
    try {
      await sendQRTicketEmailHelper(eventId, rsvpId);
    } catch (emailErr) {
      console.error(`Failed to auto-send updated QR ticket email for RSVP ${rsvpId}:`, emailErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Guest reassigned to table successfully. Updated QR ticket email triggered.',
      data
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  assignSeat,
  reassignSeat
};
