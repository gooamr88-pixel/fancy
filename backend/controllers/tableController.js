const { supabase } = require('../config/supabase');
const logger = require('../utils/logger');
const { broadcast } = require('../utils/realtime');

// Seatable table shapes vs non-seating venue zones (must match the DB shape CHECK).
const TABLE_SHAPES = ['round', 'oval', 'square', 'rectangle', 'rectangular', 'banquet', 'head'];
const ZONE_SHAPES = ['stage', 'dance_floor', 'bar', 'dj_booth', 'entrance', 'custom'];
const ALL_SHAPES = [...TABLE_SHAPES, ...ZONE_SHAPES];

const toNum = (v) => (v === undefined || v === null || v === '' ? null : Number(v));

/**
 * Creates a new seating element (table or venue zone) for an event.
 * POST /api/v1/events/:eventId/tables
 */
const createTable = async (req, res, next) => {
  const { eventId } = req.params;
  const { tableName, maxCapacity, shape, x, y, width, height, rotation, color } = req.body;
  const elementType = req.body.elementType === 'zone' ? 'zone' : 'table';

  if (!tableName || !tableName.trim()) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'tableName is required.'
    });
  }

  const resolvedShape = shape || (elementType === 'zone' ? 'custom' : 'round');
  if (!ALL_SHAPES.includes(resolvedShape)) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: `Invalid shape "${resolvedShape}".` });
  }

  // Tables must have a capacity; zones never do.
  let capacity = null;
  if (elementType === 'table') {
    capacity = parseInt(maxCapacity);
    if (isNaN(capacity) || capacity < 1 || capacity > 500) {
      return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'maxCapacity must be between 1 and 500 for a table.' });
    }
  }

  try {
    const { data: table, error } = await supabase
      .from('tables')
      .insert({
        event_id: eventId,
        table_name: tableName.trim(),
        element_type: elementType,
        max_capacity: capacity,
        shape: resolvedShape,
        position_x: toNum(x) ?? 0,
        position_y: toNum(y) ?? 0,
        width: toNum(width),
        height: toNum(height),
        rotation: toNum(rotation) ?? 0,
        color: color || null
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({
      success: true,
      message: 'Element created successfully.',
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
    // 1. Fetch tables — try sort_order first, fall back to created_at if column missing
    let tables, tableError;
    ({ data: tables, error: tableError } = await supabase
      .from('tables')
      .select('*')
      .eq('event_id', eventId)
      .order('sort_order', { ascending: true }));

    // Fall back if sort_order column doesn't exist (code 42703 = undefined_column)
    if (tableError && (tableError.code === '42703' || (tableError.message && tableError.message.includes('sort_order')))) {
      ({ data: tables, error: tableError } = await supabase
        .from('tables')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true }));
    }

    if (tableError) throw tableError;

    // 2. Occupancy via a single DB-side aggregate (scales to 100k+ guests; never
    //    streams every assignment into Node). Falls back to a manual sum if the
    //    RPC isn't present yet (pre-migration environments).
    const occupancyMap = {};
    const { data: occRows, error: occError } = await supabase
      .rpc('get_table_occupancy', { p_event_id: eventId });

    if (!occError && Array.isArray(occRows)) {
      occRows.forEach(row => { occupancyMap[row.table_id] = Number(row.occupied) || 0; });
    } else {
      try {
        const { data: assignments } = await supabase
          .from('seating_assignments')
          .select('table_id, rsvps(party_size)')
          .eq('event_id', eventId);
        (assignments || []).forEach(sa => {
          if (sa.table_id && sa.rsvps) {
            occupancyMap[sa.table_id] = (occupancyMap[sa.table_id] || 0) + sa.rsvps.party_size;
          }
        });
      } catch (e) {
        // seating_assignments table may not exist yet — leave occupancy at 0
      }
    }

    // By default only return seatable tables so legacy consumers (dashboard
    // seating tab, guest table-picker) never see venue zones. The seating map
    // opts into zones with ?include=all.
    let rows = tables || [];
    if (req.query.include !== 'all') {
      rows = rows.filter(t => (t.element_type || 'table') === 'table');
    }

    const results = rows.map(t => ({
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
  if (tablePositions.length > 500) {
    return res.status(400).json({
      success: false,
      error: 'PAYLOAD_TOO_LARGE',
      message: 'Cannot update more than 500 table positions at once.'
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
      logger.error({ errors }, 'Bulk update positions error details');
      return res.status(500).json({
        success: false,
        error: 'BULK_UPDATE_FAILED',
        message: 'Could not update all table positions.'
      });
    }

    // Broadcast positions update (fire-and-forget REST broadcast — no per-request socket).
    broadcast(eventId, 'table_layout_updated', { tablePositions });

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
  const { tableName, maxCapacity, shape, width, height, rotation, color } = req.body;

  const updates = {};
  if (tableName !== undefined) updates.table_name = tableName.trim();
  if (maxCapacity !== undefined) {
    // null/'' clears capacity (zones); otherwise validate range.
    if (maxCapacity === null || maxCapacity === '') {
      updates.max_capacity = null;
    } else {
      const cap = parseInt(maxCapacity);
      if (isNaN(cap) || cap < 1 || cap > 500) {
        return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'maxCapacity must be between 1 and 500.' });
      }
      updates.max_capacity = cap;
    }
  }
  if (shape !== undefined) {
    if (!ALL_SHAPES.includes(shape)) {
      return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: `Invalid shape "${shape}".` });
    }
    updates.shape = shape;
  }
  if (width !== undefined) updates.width = toNum(width);
  if (height !== undefined) updates.height = toNum(height);
  if (rotation !== undefined) updates.rotation = toNum(rotation) ?? 0;
  if (color !== undefined) updates.color = color || null;

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
        element_type: source.element_type || 'table',
        max_capacity: source.max_capacity,
        shape: source.shape,
        position_x: Math.min(88, parseFloat(source.position_x || 0) + (6 * (i + 1))),
        position_y: Math.min(88, parseFloat(source.position_y || 0) + (6 * (i + 1))),
        width: source.width,
        height: source.height,
        rotation: source.rotation || 0,
        color: source.color || null,
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
