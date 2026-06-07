const { supabase } = require('../config/supabase');

/**
 * Creates a new table for an event.
 * POST /api/v1/events/:eventId/tables
 */
const createTable = async (req, res, next) => {
  const { eventId } = req.params;
  const { tableName, maxCapacity, shape, x, y } = req.body;

  if (!tableName || !maxCapacity) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'tableName and maxCapacity are required.'
    });
  }

  try {
    const { data: table, error } = await supabase
      .from('tables')
      .insert({
        event_id: eventId,
        table_name: tableName,
        max_capacity: parseInt(maxCapacity),
        shape: shape || 'round',
        position_x: x || 0,
        position_y: y || 0
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({
      success: true,
      message: 'Table created successfully.',
      table
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Fetch all tables with real-time seat occupancy calculations.
 * GET /api/v1/events/:eventId/tables
 */
const getTables = async (req, res, next) => {
  const { eventId } = req.params;

  try {
    // 1. Fetch tables
    const { data: tables, error: tableError } = await supabase
      .from('tables')
      .select('*')
      .eq('event_id', eventId)
      .order('sort_order', { ascending: true });

    if (tableError) throw tableError;

    // 2. Fetch seating assignments aggregations to calculate occupied seats
    const { data: assignments, error: assignError } = await supabase
      .from('seating_assignments')
      .select('table_id, rsvps(party_size)')
      .eq('event_id', eventId);

    if (assignError) throw assignError;

    // Calculate occupancy map
    const occupancyMap = {};
    if (assignments) {
      assignments.forEach(sa => {
        if (sa.table_id && sa.rsvps) {
          occupancyMap[sa.table_id] = (occupancyMap[sa.table_id] || 0) + sa.rsvps.party_size;
        }
      });
    }

    const results = tables.map(t => ({
      ...t,
      occupied: occupancyMap[t.id] || 0
    }));

    return res.json({
      success: true,
      tables: results
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Updates positions of multiple tables visually arranged on the canvas map.
 * PATCH /api/v1/events/:eventId/tables/positions
 */
const updateTablePositions = async (req, res, next) => {
  const { eventId } = req.params;
  const { tablePositions } = req.body; // Array: [{ id, x, y }]

  if (!tablePositions || !Array.isArray(tablePositions)) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'tablePositions array is required.'
    });
  }

  try {
    // Perform bulk updates in parallel
    const updatePromises = tablePositions.map(pos => 
      supabase
        .from('tables')
        .update({
          position_x: parseFloat(pos.x),
          position_y: parseFloat(pos.y),
          updated_at: new Date()
        })
        .eq('id', pos.id)
        .eq('event_id', eventId)
    );

    const responses = await Promise.all(updatePromises);
    const errors = responses.filter(r => r.error).map(r => r.error);

    if (errors.length > 0) {
      console.error('Bulk update positions error details:', errors);
      return res.status(500).json({
        success: false,
        error: 'BULK_UPDATE_FAILED',
        message: 'Could not update all table positions.'
      });
    }

    // Broadcast positions update via real-time channel
    await supabase.channel(`event-${eventId}`).send({
      type: 'broadcast',
      event: 'table_layout_updated',
      payload: { tablePositions }
    });

    return res.json({
      success: true,
      message: 'Table layout coordinates updated successfully.'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Soft/Hard deletes a table.
 * DELETE /api/v1/events/:eventId/tables/:tableId
 */
const deleteTable = async (req, res, next) => {
  const { eventId, tableId } = req.params;

  try {
    // Check if table contains guest assignments first
    const { data: assignments } = await supabase
      .from('seating_assignments')
      .select('id')
      .eq('table_id', tableId)
      .limit(1);

    if (assignments && assignments.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'TABLE_NOT_EMPTY',
        message: 'This table has guest assignments. Unassign guests before deleting the table.'
      });
    }

    const { error } = await supabase
      .from('tables')
      .delete()
      .eq('id', tableId)
      .eq('event_id', eventId);

    if (error) throw error;

    return res.json({
      success: true,
      message: 'Table deleted successfully.'
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createTable,
  getTables,
  updateTablePositions,
  deleteTable
};
