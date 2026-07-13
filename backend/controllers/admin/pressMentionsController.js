const { supabase } = require('../../config/supabase');
const { logAdminAction } = require('../../middleware/adminAudit');

/**
 * Landing-page "As Seen In" press mention / trust badge management (Landing
 * CMS). Real, admin-authored rows only — replaces the fabricated "Media
 * Mentions" list previously hard-coded in the /press marketing page, which
 * was never surfaced on the landing page at all. Publicly readable
 * (published only) via marketingController.getPublicPressMentions.
 */

/** Basic http(s) URL sanity check — used for logo_url and article_url. */
function isValidUrl(value) {
  if (!value) return true; // both are optional
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** GET /api/v1/admin/press-mentions — every row (published + unpublished). */
const listPressMentions = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('press_mentions')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return res.json({ success: true, pressMentions: data || [] });
  } catch (err) {
    next(err);
  }
};

/** POST /api/v1/admin/press-mentions */
const createPressMention = async (req, res, next) => {
  const { publicationName, logoUrl, articleUrl, headline, isPublished, sortOrder } = req.body || {};

  if (!publicationName || !String(publicationName).trim()) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'publicationName is required.' });
  }
  if (!isValidUrl(logoUrl)) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'logoUrl must be a valid http(s) URL.' });
  }
  if (!isValidUrl(articleUrl)) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'articleUrl must be a valid http(s) URL.' });
  }

  try {
    const { data, error } = await supabase
      .from('press_mentions')
      .insert({
        publication_name: String(publicationName).trim(),
        logo_url: logoUrl ? String(logoUrl).trim() : null,
        article_url: articleUrl ? String(articleUrl).trim() : null,
        headline: headline ? String(headline).trim() : null,
        is_published: isPublished !== false,
        sort_order: sortOrder != null ? parseInt(sortOrder, 10) || 0 : 0,
        created_by: req.user.id,
        updated_by: req.user.id,
      })
      .select()
      .single();
    if (error) throw error;

    await logAdminAction(req, { action: 'press_mention.create', entityType: 'press_mention', entityId: data.id, after: data });
    return res.status(201).json({ success: true, pressMention: data });
  } catch (err) {
    next(err);
  }
};

/** PATCH /api/v1/admin/press-mentions/:pressMentionId */
const updatePressMention = async (req, res, next) => {
  const { pressMentionId } = req.params;
  const b = req.body || {};
  const updates = {};

  if (b.publicationName !== undefined) {
    if (!String(b.publicationName).trim()) return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'publicationName cannot be empty.' });
    updates.publication_name = String(b.publicationName).trim();
  }
  if (b.logoUrl !== undefined) {
    if (!isValidUrl(b.logoUrl)) return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'logoUrl must be a valid http(s) URL.' });
    updates.logo_url = b.logoUrl ? String(b.logoUrl).trim() : null;
  }
  if (b.articleUrl !== undefined) {
    if (!isValidUrl(b.articleUrl)) return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'articleUrl must be a valid http(s) URL.' });
    updates.article_url = b.articleUrl ? String(b.articleUrl).trim() : null;
  }
  if (b.headline !== undefined) updates.headline = b.headline ? String(b.headline).trim() : null;
  if (b.isPublished !== undefined) updates.is_published = !!b.isPublished;
  if (b.sortOrder !== undefined) updates.sort_order = parseInt(b.sortOrder, 10) || 0;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'No updatable fields supplied.' });
  }
  updates.updated_by = req.user.id;
  updates.updated_at = new Date().toISOString();

  try {
    const { data, error } = await supabase.from('press_mentions').update(updates).eq('id', pressMentionId).select().single();
    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'PRESS_MENTION_NOT_FOUND', message: 'Press mention not found.' });

    await logAdminAction(req, { action: 'press_mention.update', entityType: 'press_mention', entityId: pressMentionId, after: updates });
    return res.json({ success: true, pressMention: data });
  } catch (err) {
    next(err);
  }
};

/** DELETE /api/v1/admin/press-mentions/:pressMentionId */
const deletePressMention = async (req, res, next) => {
  const { pressMentionId } = req.params;
  try {
    const { error } = await supabase.from('press_mentions').delete().eq('id', pressMentionId);
    if (error) throw error;
    await logAdminAction(req, { action: 'press_mention.delete', entityType: 'press_mention', entityId: pressMentionId });
    return res.json({ success: true, message: 'Press mention deleted.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { listPressMentions, createPressMention, updatePressMention, deletePressMention };
