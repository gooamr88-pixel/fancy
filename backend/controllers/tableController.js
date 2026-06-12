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

  if (!Array.isArray(tablePositions) || tablePositions.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'tablePositions array is required.'
    });
  }
  if (tablePositions.length > 200) {
    return res.status(400).json({
      success: false,
      error: 'PAYLOAD_TOO_LARGE',
      message: 'Cannot update more than 200 table positions at once.'
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
    const layoutChannel = supabase.channel(`event-${eventId}`);
    await layoutChannel.send({
      type: 'broadcast',
      event: 'table_layout_updated',
      payload: { tablePositions }
    });
    supabase.removeChannel(layoutChannel);

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

/**
 * Updates a single table's settings (name, capacity, shape).
 * PATCH /api/v1/events/:eventId/tables/:tableId
 */
const updateTable = async (req, res, next) => {
  const { eventId, tableId } = req.params;
  const { tableName, maxCapacity, shape } = req.body;

  const updates = {};
  if (tableName !== undefined) updates.table_name = tableName.trim();
  if (maxCapacity !== undefined) {
    const cap = parseInt(maxCapacity);
    if (isNaN(cap) || cap < 1 || cap > 500) {
      return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'maxCapacity must be between 1 and 500.' });
    }
    updates.max_capacity = cap;
  }
  if (shape !== undefined) {
    if (!['round', 'rectangle', 'square', 'custom'].includes(shape)) {
      return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'shape must be round, rectangle, square, or custom.' });
    }
    updates.shape = shape;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ success: false, error: 'NO_UPDATES', message: 'No fields to update.' });
  }

  updates.updated_at = new Date();

  try {
    // If reducing capacity, check current occupancy
    if (updates.max_capacity) {
      const { data: assignments } = await supabase
        .from('seating_assignments')
        .select('rsvps(party_size)')
        .eq('table_id', tableId)
        .eq('event_id', eventId);

      const occupied = (assignments || []).reduce((sum, a) => sum + (a.rsvps?.party_size || 0), 0);
      if (updates.max_capacity < occupied) {
        return res.status(409).json({
          success: false,
          error: 'CAPACITY_CONFLICT',
          message: `Cannot reduce capacity below current occupancy (${occupied} guests seated).`
        });
      }
    }

    const { data: table, error } = await supabase
      .from('tables')
      .update(updates)
      .eq('id', tableId)
      .eq('event_id', eventId)
      .select()
      .single();

    if (error) throw error;
    if (!table) return res.status(404).json({ success: false, error: 'TABLE_NOT_FOUND' });

    return res.json({ success: true, message: 'Table updated successfully.', table });
  } catch (err) {
    next(err);
  }
};

/**
 * Duplicates an existing table (up to 20 copies).
 * POST /api/v1/events/:eventId/tables/:tableId/duplicate
 */
const duplicateTable = async (req, res, next) => {
  const { eventId, tableId } = req.params;
  const { count } = req.body; // How many copies to create (default 1)

  const copies = Math.min(parseInt(count) || 1, 20); // Cap at 20 copies

  try {
    // Fetch source table
    const { data: source, error: fetchError } = await supabase
      .from('tables')
      .select('*')
      .eq('id', tableId)
      .eq('event_id', eventId)
      .single();

    if (fetchError || !source) {
      return res.status(404).json({ success: false, error: 'TABLE_NOT_FOUND', message: 'Source table not found.' });
    }

    // Fetch existing tables count for naming
    const { count: existingCount } = await supabase
      .from('tables')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId);

    const insertRows = [];
    for (let i = 0; i < copies; i++) {
      insertRows.push({
        event_id: eventId,
        table_name: `${source.table_name} (Copy ${i + 1})`,
        max_capacity: source.max_capacity,
        shape: source.shape,
        position_x: source.position_x + (60 * (i + 1)),
        position_y: source.position_y + (40 * (i + 1)),
        sort_order: (existingCount || 0) + i + 1
      });
    }

    const { data: newTables, error: insertError } = await supabase
      .from('tables')
      .insert(insertRows)
      .select();

    if (insertError) throw insertError;

    return res.status(201).json({
      success: true,
      message: `${newTables.length} table(s) duplicated successfully.`,
      tables: newTables
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createTable,
  getTables,
  updateTablePositions,
  deleteTable,
  updateTable,
  duplicateTable
};
