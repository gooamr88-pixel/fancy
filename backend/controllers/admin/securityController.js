const { supabase } = require('../../config/supabase');
const { parsePagination, applyPagination, buildListResponse } = require('../../middleware/pagination');
const { logAdminAction } = require('../../middleware/adminAudit');

/**
 * Security Center (Master Plan §19): active sessions, device/login monitoring,
 * security events, and global session revocation.
 */

/** GET /api/v1/admin/security/sessions — active (non-revoked, unexpired) sessions. */
const listActiveSessions = async (req, res, next) => {
  const p = parsePagination(req, { sortable: ['created_at', 'last_seen_at'], defaultSort: 'last_seen_at' });
  try {
    const nowIso = new Date().toISOString();
    const query = supabase
      .from('sessions')
      .select('id, user_id, ip, user_agent, device_label, created_at, last_seen_at, expires_at', { count: 'exact' })
      .is('revoked_at', null)
      .gt('expires_at', nowIso);
    const { data, error, count } = await applyPagination(query, p);
    if (error) throw error;

    // Attach owner email for readability.
    const userIds = [...new Set((data || []).map((s) => s.user_id).filter(Boolean))];
    let map = new Map();
    if (userIds.length) {
      const { data: orgs } = await supabase.from('organizations').select('owner_user_id, name, email').in('owner_user_id', userIds);
      map = new Map((orgs || []).map((o) => [o.owner_user_id, o]));
    }
    const sessions = (data || []).map((s) => ({ ...s, ownerEmail: map.get(s.user_id)?.email || null, ownerName: map.get(s.user_id)?.name || null }));
    return res.json({ ...buildListResponse(sessions, p, count), sessions });
  } catch (err) {
    next(err);
  }
};

/** POST /api/v1/admin/security/sessions/:sessionId/revoke */
const revokeSession = async (req, res, next) => {
  const { sessionId } = req.params;
  try {
    const { data, error } = await supabase
      .from('sessions')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', sessionId)
      .is('revoked_at', null)
      .select('id, user_id')
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'SESSION_NOT_FOUND', message: 'Active session not found.' });
    await logAdminAction(req, { action: 'security.session.revoke', entityType: 'session', entityId: sessionId, metadata: { userId: data.user_id } });
    return res.json({ success: true, message: 'Session revoked.' });
  } catch (err) {
    next(err);
  }
};

/** GET /api/v1/admin/security/events (paginated) */
const listSecurityEvents = async (req, res, next) => {
  const p = parsePagination(req, { sortable: ['created_at', 'severity'], defaultSort: 'created_at' });
  try {
    let query = supabase.from('security_events').select('*', { count: 'exact' });
    if (req.query.severity) query = query.eq('severity', req.query.severity);
    if (req.query.type) query = query.eq('type', req.query.type);
    const { data, error, count } = await applyPagination(query, p);
    if (error) throw error;
    return res.json({ ...buildListResponse(data, p, count), events: data || [] });
  } catch (err) {
    next(err);
  }
};

/** GET /api/v1/admin/security/login-history (paginated, platform-wide) */
const listLoginHistory = async (req, res, next) => {
  const p = parsePagination(req, { sortable: ['created_at'], defaultSort: 'created_at' });
  try {
    let query = supabase.from('login_history').select('*', { count: 'exact' });
    if (req.query.success === 'true') query = query.eq('success', true);
    if (req.query.success === 'false') query = query.eq('success', false);
    if (p.q) query = query.ilike('email', `%${p.q}%`);
    const { data, error, count } = await applyPagination(query, p);
    if (error) throw error;
    return res.json({ ...buildListResponse(data, p, count), history: data || [] });
  } catch (err) {
    next(err);
  }
};

module.exports = { listActiveSessions, revokeSession, listSecurityEvents, listLoginHistory };
