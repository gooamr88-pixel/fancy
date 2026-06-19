const { supabase } = require('../../config/supabase');
const { parsePagination, applyPagination, buildListResponse } = require('../../middleware/pagination');

/**
 * Admin Audit Log viewer (Master Plan §17). Reads admin_audit_logs with the
 * IP / browser / OS context captured by middleware/adminAudit.
 */

/** GET /api/v1/admin/audit?action=&actorId=&entityType=&q= (paginated) */
const listAuditLogs = async (req, res, next) => {
  const p = parsePagination(req, { sortable: ['created_at'], defaultSort: 'created_at' });
  try {
    let query = supabase.from('admin_audit_logs').select('*', { count: 'exact' });

    if (req.query.action) query = query.eq('action', req.query.action);
    if (req.query.actorId) query = query.eq('actor_user_id', req.query.actorId);
    if (req.query.entityType) query = query.eq('entity_type', req.query.entityType);
    if (p.q) query = query.ilike('action', `%${p.q}%`);

    const { data, error, count } = await applyPagination(query, p);
    if (error) throw error;

    // Resolve actor names for readable rows.
    const actorIds = [...new Set((data || []).map((a) => a.actor_user_id).filter(Boolean))];
    let actorMap = new Map();
    if (actorIds.length) {
      const { data: orgs } = await supabase.from('organizations').select('owner_user_id, name, email').in('owner_user_id', actorIds);
      actorMap = new Map((orgs || []).map((o) => [o.owner_user_id, o]));
    }
    const logs = (data || []).map((a) => ({
      ...a,
      actorName: a.actor_user_id ? (actorMap.get(a.actor_user_id)?.name || actorMap.get(a.actor_user_id)?.email || a.actor_user_id) : 'System',
    }));

    return res.json({ ...buildListResponse(logs, p, count), logs });
  } catch (err) {
    next(err);
  }
};

module.exports = { listAuditLogs };
