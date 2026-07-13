const { supabase } = require('../../config/supabase');
const { logAdminAction } = require('../../middleware/adminAudit');

/**
 * Landing-page testimonial management (Landing CMS). Replaces the previous
 * hard-coded, fabricated testimonials in TestimonialsSection.js with real,
 * admin-authored rows — full CRUD here, publicly readable (published only)
 * via marketingController.getPublicTestimonials.
 */

const MAX_RATING = 5;
const MIN_RATING = 1;

/** Basic http(s) URL sanity check — used for photo_url and verify_url. */
function isValidUrl(value) {
  if (!value) return true; // both are optional
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** GET /api/v1/admin/testimonials — every row (published + unpublished). */
const listTestimonials = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('testimonials')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return res.json({ success: true, testimonials: data || [] });
  } catch (err) {
    next(err);
  }
};

/** POST /api/v1/admin/testimonials */
const createTestimonial = async (req, res, next) => {
  const { name, role, quote, photoUrl, initials, rating, verifyUrl, isPublished, sortOrder } = req.body || {};

  if (!name || !String(name).trim()) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'name is required.' });
  }
  if (!quote || !String(quote).trim()) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'quote is required.' });
  }
  const ratingNum = rating != null ? parseInt(rating, 10) : 5;
  if (!Number.isInteger(ratingNum) || ratingNum < MIN_RATING || ratingNum > MAX_RATING) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: `rating must be a whole number between ${MIN_RATING} and ${MAX_RATING}.` });
  }
  if (!isValidUrl(photoUrl)) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'photoUrl must be a valid http(s) URL.' });
  }
  if (!isValidUrl(verifyUrl)) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'verifyUrl must be a valid http(s) URL.' });
  }

  try {
    const { data, error } = await supabase
      .from('testimonials')
      .insert({
        name: String(name).trim(),
        role: role ? String(role).trim() : null,
        quote: String(quote).trim(),
        photo_url: photoUrl ? String(photoUrl).trim() : null,
        initials: initials ? String(initials).trim().slice(0, 4).toUpperCase() : null,
        rating: ratingNum,
        verify_url: verifyUrl ? String(verifyUrl).trim() : null,
        is_published: isPublished !== false,
        sort_order: sortOrder != null ? parseInt(sortOrder, 10) || 0 : 0,
        created_by: req.user.id,
        updated_by: req.user.id,
      })
      .select()
      .single();
    if (error) throw error;

    await logAdminAction(req, { action: 'testimonial.create', entityType: 'testimonial', entityId: data.id, after: data });
    return res.status(201).json({ success: true, testimonial: data });
  } catch (err) {
    next(err);
  }
};

/** PATCH /api/v1/admin/testimonials/:testimonialId */
const updateTestimonial = async (req, res, next) => {
  const { testimonialId } = req.params;
  const b = req.body || {};
  const updates = {};

  if (b.name !== undefined) {
    if (!String(b.name).trim()) return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'name cannot be empty.' });
    updates.name = String(b.name).trim();
  }
  if (b.role !== undefined) updates.role = b.role ? String(b.role).trim() : null;
  if (b.quote !== undefined) {
    if (!String(b.quote).trim()) return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'quote cannot be empty.' });
    updates.quote = String(b.quote).trim();
  }
  if (b.photoUrl !== undefined) {
    if (!isValidUrl(b.photoUrl)) return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'photoUrl must be a valid http(s) URL.' });
    updates.photo_url = b.photoUrl ? String(b.photoUrl).trim() : null;
  }
  if (b.initials !== undefined) updates.initials = b.initials ? String(b.initials).trim().slice(0, 4).toUpperCase() : null;
  if (b.rating !== undefined) {
    const ratingNum = parseInt(b.rating, 10);
    if (!Number.isInteger(ratingNum) || ratingNum < MIN_RATING || ratingNum > MAX_RATING) {
      return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: `rating must be a whole number between ${MIN_RATING} and ${MAX_RATING}.` });
    }
    updates.rating = ratingNum;
  }
  if (b.verifyUrl !== undefined) {
    if (!isValidUrl(b.verifyUrl)) return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'verifyUrl must be a valid http(s) URL.' });
    updates.verify_url = b.verifyUrl ? String(b.verifyUrl).trim() : null;
  }
  if (b.isPublished !== undefined) updates.is_published = !!b.isPublished;
  if (b.sortOrder !== undefined) updates.sort_order = parseInt(b.sortOrder, 10) || 0;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'No updatable fields supplied.' });
  }
  updates.updated_by = req.user.id;
  updates.updated_at = new Date().toISOString();

  try {
    const { data, error } = await supabase.from('testimonials').update(updates).eq('id', testimonialId).select().single();
    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'TESTIMONIAL_NOT_FOUND', message: 'Testimonial not found.' });

    await logAdminAction(req, { action: 'testimonial.update', entityType: 'testimonial', entityId: testimonialId, after: updates });
    return res.json({ success: true, testimonial: data });
  } catch (err) {
    next(err);
  }
};

/** DELETE /api/v1/admin/testimonials/:testimonialId */
const deleteTestimonial = async (req, res, next) => {
  const { testimonialId } = req.params;
  try {
    const { error } = await supabase.from('testimonials').delete().eq('id', testimonialId);
    if (error) throw error;
    await logAdminAction(req, { action: 'testimonial.delete', entityType: 'testimonial', entityId: testimonialId });
    return res.json({ success: true, message: 'Testimonial deleted.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { listTestimonials, createTestimonial, updateTestimonial, deleteTestimonial };
