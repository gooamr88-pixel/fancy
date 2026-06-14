const { supabase } = require('../config/supabase');
const notificationService = require('../utils/notificationService');

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
    const channel = supabase.channel(`event-${eventId}`);
    await channel.send({
        type: 'broadcast',
        event: 'seating_update',
        payload: {
          rsvpId,
          tableId,
          seatsRemaining: data.seats_remaining
        }
      });
    supabase.removeChannel(channel);

    // Auto-fire QR ticket email on successful seating assignment
    try {
      await notificationService.sendQRTicketEmail(eventId, rsvpId);
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
    const channel = supabase.channel(`event-${eventId}`);
    await channel.send({
        type: 'broadcast',
        event: 'seating_update',
        payload: {
          rsvpId,
          fromTable: data.from_table,
          toTable: data.to_table,
          seatsRemainingNewTable: data.seats_remaining_new_table
        }
      });
    supabase.removeChannel(channel);

    // Auto-fire updated QR ticket email on successful reassignment
    try {
      await notificationService.sendQRTicketEmail(eventId, rsvpId);
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

/**
 * Unassigns a guest from any table atomically.
 * POST /api/v1/events/:eventId/seating/unassign
 */
const unassignSeat = async (req, res, next) => {
  const { eventId } = req.params;
  const { rsvpId } = req.body;
  const assignedBy = req.user?.id || null;

  if (!rsvpId) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'rsvpId is required.'
    });
  }

  try {
    const { data, error } = await supabase.rpc('unassign_seat', {
      p_event_id: eventId,
      p_rsvp_id: rsvpId,
      p_assigned_by: assignedBy
    });

    if (error) {
      console.error('Database RPC error:', error);
      return res.status(500).json({
        success: false,
        error: 'DATABASE_ERROR',
        message: 'A database error occurred during unseating.'
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
    const channel = supabase.channel(`event-${eventId}`);
    await channel.send({
        type: 'broadcast',
        event: 'seating_update',
        payload: {
          rsvpId,
          tableId: '',
          seatsRemaining: data.seats_remaining
        }
      });
    supabase.removeChannel(channel);

    // Auto-fire updated ticket email (no seating details / unseated notice if needed, or skip)
    // For now we don't need to auto-fire a ticket since they are unseated, but they can be notified.
    
    return res.status(200).json({
      success: true,
      message: 'Guest unassigned from table successfully.',
      data
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Saves a batch of seating assignments/unassignments for an event.
 * POST /api/v1/events/:eventId/seating/save-batch
 */
const saveSeatingBatch = async (req, res, next) => {
  const { eventId } = req.params;
  const { assignments } = req.body; // Array of { rsvpId, tableId }
  const assignedBy = req.user?.id || null;

  if (!Array.isArray(assignments)) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'assignments must be an array.'
    });
  }

  try {
    // 1. Fetch current seating assignments for this event to compare
    const { data: currentAssignments, error: fetchErr } = await supabase
      .from('seating_assignments')
      .select('rsvp_id, table_id')
      .eq('event_id', eventId);

    if (fetchErr) throw fetchErr;

    const currentMap = {};
    (currentAssignments || []).forEach(a => {
      currentMap[a.rsvp_id] = a.table_id;
    });

    const results = [];

    // 2. Process each assignment in the batch
    for (const item of assignments) {
      const { rsvpId, tableId } = item;
      if (!rsvpId) continue;

      const currentTableId = currentMap[rsvpId];

      if (!tableId) {
        // We want to unassign
        if (currentTableId) {
          const { data, error } = await supabase.rpc('unassign_seat', {
            p_event_id: eventId,
            p_rsvp_id: rsvpId,
            p_assigned_by: assignedBy
          });
          results.push({ rsvpId, action: 'unassign', success: !error && data?.success, error: error || data?.message });
        }
      } else {
        // We want to assign or reassign
        if (!currentTableId) {
          // Assign
          const { data, error } = await supabase.rpc('assign_seat', {
            p_event_id: eventId,
            p_rsvp_id: rsvpId,
            p_table_id: tableId,
            p_assigned_by: assignedBy
          });
          results.push({ rsvpId, tableId, action: 'assign', success: !error && data?.success, error: error || data?.message });
        } else if (currentTableId !== tableId) {
          // Reassign
          const { data, error } = await supabase.rpc('reassign_seat', {
            p_event_id: eventId,
            p_rsvp_id: rsvpId,
            p_new_table_id: tableId,
            p_assigned_by: assignedBy
          });
          results.push({ rsvpId, tableId, action: 'reassign', success: !error && data?.success, error: error || data?.message });
        }
      }
    }

    // 3. Broadcast seating_update event to Supabase Realtime channel
    const channel = supabase.channel(`event-${eventId}`);
    await channel.send({
      type: 'broadcast',
      event: 'seating_update',
      payload: {
        batch: true,
        results
      }
    });
    supabase.removeChannel(channel);

    // Check if there was any failure in the batch
    const failures = results.filter(r => !r.success);
    if (failures.length > 0) {
      const errorMsg = failures.map(f => f.error).join(', ');
      return res.status(400).json({
        success: false,
        error: 'BATCH_SAVE_FAILED',
        message: `Some seating assignments failed: ${errorMsg}`,
        results
      });
    }

    return res.status(200).json({
      success: true,
      message: 'All seating assignments saved successfully.',
      results
    });

  } catch (err) {
    next(err);
  }
};

module.exports = {
  assignSeat,
  reassignSeat,
  unassignSeat,
  saveSeatingBatch
};
