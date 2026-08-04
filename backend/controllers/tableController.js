const { supabase } = require('../config/supabase');
const logger = require('../utils/logger');
const { broadcast } = require('../utils/realtime');

/**
 * Seatable table shapes vs non-seating venue zones.
 *
 * FOUR places hold this catalogue and all four must agree — a shape missing
 * from any of them fails differently and none of the failures point at the
 * cause:
 *   1. this list                                        → 400 "Invalid shape"
 *   2. the DB CHECK `tables_shape_check`                → 500 on insert
 *   3. frontend dashboard/seating-map/page.js SHAPES    → the organizer palette
 *   4. frontend [slug]/rsvp/SeatingMiniMap.js +
 *      SeatingMapFullscreen.js SHAPES                   → silently drawn as a
 *                                                         round TABLE on the
 *                                                         guest's map
 * The organizer palette grew to 14 zone types while 1, 2 and 4 stayed at the
 * original 6, so two thirds of the zone picker returned "Invalid shape".
 */
const TABLE_SHAPES = ['round', 'oval', 'square', 'rectangle', 'rectangular', 'banquet', 'head'];
const ZONE_SHAPES = [
  'stage', 'dance_floor', 'bar', 'dj_booth', 'entrance', 'custom',
  'restroom', 'coat_check', 'gift_table', 'cake_table',
  'photo_booth', 'welcome_desk', 'buffet', 'lounge',
];
const ALL_SHAPES = [...TABLE_SHAPES, ...ZONE_SHAPES];

const toNum = (v) => (v === undefined || v === null || v === '' ? null : Number(v));

/**
 * True name/number uniqueness lives here, not on the client — the seating-map
 * UI only SUGGESTS the next free table number, but nothing stops an organizer
 * from typing one that collides, or renaming an element into a clash. Checked
 * across ALL elements in the event regardless of shape/category (a table and
 * a zone showing the same label is just as confusing as two tables sharing a
 * number), case-insensitively so "Bar" and "bar" don't coexist.
 */
async function hasNameCollision(eventId, name, excludeId) {
  let query = supabase.from('tables').select('id, table_name').eq('event_id', eventId);
  if (excludeId) query = query.neq('id', excludeId);
  const { data, error } = await query;
  if (error) throw error;
  const normalized = name.trim().toLowerCase();
  return (data || []).some((row) => (row.table_name || '').trim().toLowerCase() === normalized);
}

/**
 * Turns a unique-violation into the same 409 the pre-flight check produces.
 *
 * `hasNameCollision` is read-then-write, so two organizers editing one seating
 * map can both pass it and only the second insert fails. That used to be
 * invisible — nothing enforced uniqueness in the database. Amendment A-17 added
 * `uq_tables_event_entrance_name`, so the race now surfaces as a real 23505,
 * and without this it would reach the user as a generic 500 on a core seating
 * operation.
 *
 * Deliberately narrow: only the entrance-name index is translated. Any other
 * constraint failing here is a bug, and reporting it as "choose another name"
 * would send the organizer chasing the wrong thing.
 */
function duplicateNameResponse(error, name) {
  if (error?.code !== '23505') return null;
  if (!String(error.message || '').includes('uq_tables_event_entrance_name')) return null;
  return {
    success: false,
    error: 'DUPLICATE_NAME',
    message: `"${String(name || '').trim()}" is already used by another entrance on this seating map. Choose a different name.`,
  };
}

/**
 * Returns a 409 body when a seating element may not be deleted because it is
 * acting as a check-in gate (amendment A-17); null when deletion is fine.
 *
 * Two independent reasons to refuse, reported separately because the remedy
 * differs — a paired device can be revoked or moved, whereas recorded arrivals
 * are history and the element must simply be kept.
 *
 * Deliberately fails OPEN on a lookup error: the check-in tables may not exist
 * yet on a deployment that has not applied the 20260814000000 migration, and a
 * missing table must not make ordinary seating-map editing impossible.
 */
async function gateDeletionBlocker(eventId, tableId) {
  try {
    const { data: devices, error: deviceErr } = await supabase
      .from('event_devices')
      .select('id, device_label')
      .eq('event_id', eventId)
      .eq('gate_table_id', tableId)
      .limit(1);
    if (deviceErr) throw deviceErr;

    if (devices && devices.length > 0) {
      return {
        error: 'GATE_IN_USE',
        message:
          'A check-in device is paired to this entrance. Revoke the device, or move it to another gate, before deleting this element.',
      };
    }

    // Historical arrivals recorded at this gate. check_ins stores the gate NAME
    // as a snapshot (§18.6), so deleting the element would not corrupt existing
    // records — but it would let a new element reuse the name and make the audit
    // trail ambiguous about which gate a guest actually came through.
    const { data: history, error: historyErr } = await supabase
      .from('check_ins')
      .select('id')
      .eq('event_id', eventId)
      .eq('gate_table_id', tableId)
      .limit(1);
    if (historyErr) throw historyErr;

    if (history && history.length > 0) {
      return {
        error: 'GATE_HAS_HISTORY',
        message:
          'Guests were checked in at this entrance. It is kept so the arrival record stays accurate.',
      };
    }

    return null;
  } catch (err) {
    logger.warn(
      { err: err.message, eventId, tableId },
      '[tables] gate deletion check failed — allowing delete',
    );
    return null;
  }
}

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
    if (await hasNameCollision(eventId, tableName)) {
      return res.status(409).json({
        success: false,
        error: 'DUPLICATE_NAME',
        message: `"${tableName.trim()}" is already used by another element on this seating map. Choose a different number or name.`
      });
    }

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

    if (error) {
      const dup = duplicateNameResponse(error, tableName);
      if (dup) return res.status(409).json(dup);
      throw error;
    }

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
    // Validate all positions are finite numbers before updating
    for (const pos of tablePositions) {
      const px = parseFloat(pos.x);
      const py = parseFloat(pos.y);
      if (!Number.isFinite(px) || !Number.isFinite(py)) {
        return res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: `Invalid position for table ${pos.id}: x and y must be finite numbers (got x=${pos.x}, y=${pos.y}).`,
        });
      }
    }

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

    // ── Gate guard (amendment A-17) ──
    // The check above only fires for elements with seating assignments, and
    // parties are assigned to TABLES, never to entrance zones — so it has never
    // protected a gate. Once a device binds to an entrance, that element's name
    // is the identity the audit trail and every conflict report are written
    // against, and deleting it would orphan them.
    //
    // Checked here rather than by a foreign key: `tables` and `event_devices`
    // both cascade from `events`, and Postgres does not guarantee cascade order,
    // so an ON DELETE RESTRICT would intermittently make deleting an EVENT fail.
    // The FK is SET NULL; this is where the deletion is actually refused, and
    // where a useful message can be returned.
    const gateBlock = await gateDeletionBlocker(eventId, tableId);
    if (gateBlock) {
      return res.status(409).json({ success: false, ...gateBlock });
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
    if (updates.table_name !== undefined && await hasNameCollision(eventId, updates.table_name, tableId)) {
      return res.status(409).json({
        success: false,
        error: 'DUPLICATE_NAME',
        message: `"${updates.table_name}" is already used by another element on this seating map. Choose a different number or name.`
      });
    }

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

    if (error) {
      const dup = duplicateNameResponse(error, updates.table_name);
      if (dup) return res.status(409).json(dup);
      throw error;
    }
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

    // Fetch existing tables (for the naming count AND to keep copy names
    // collision-free — "(Copy 1)" already existing shouldn't get reused).
    const { data: existingRows, count: existingCount } = await supabase
      .from('tables')
      .select('table_name', { count: 'exact' })
      .eq('event_id', eventId);
    const usedNames = new Set((existingRows || []).map((r) => (r.table_name || '').trim().toLowerCase()));
    const nextFreeCopyName = (base) => {
      let n = 1;
      let candidate;
      do {
        candidate = `${base} (Copy ${n})`;
        n += 1;
      } while (usedNames.has(candidate.trim().toLowerCase()));
      usedNames.add(candidate.trim().toLowerCase());
      return candidate;
    };

    const insertRows = [];
    for (let i = 0; i < copies; i++) {
      insertRows.push({
        event_id: eventId,
        table_name: nextFreeCopyName(source.table_name),
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

    if (insertError) {
      // Duplicating an entrance races the same index as create/update. The
      // generated "(Copy n)" names are chosen against a snapshot, so a
      // concurrent editor can take one between the read and the insert.
      const dup = duplicateNameResponse(insertError, source.table_name);
      if (dup) {
        return res.status(409).json({
          ...dup,
          message: 'Another editor took that name while the copy was being created. Try again.',
        });
      }
      throw insertError;
    }

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
  duplicateTable,
  // Exported for the cross-layer contract test that keeps this catalogue in
  // step with the DB CHECK and the two frontend SHAPES maps.
  TABLE_SHAPES,
  ZONE_SHAPES,
  ALL_SHAPES,
};
