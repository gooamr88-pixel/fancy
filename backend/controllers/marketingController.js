const { supabase } = require('../config/supabase');
const logger = require('../utils/logger');
const { sendEmailViaBrevo } = require('../utils/notificationService');
const { escapeHtml } = require('../utils/emailTemplates');
const { normalizeToE164 } = require('../utils/phone');
const { SMS_CONSENT_TEXT_VERSION } = require('../utils/smsConsent');

/**
 * Public marketing forms (footer newsletter signup, Contact page). Both were
 * previously pure client-side mockups — no backend call existed, so every
 * submission was silently discarded while the visitor saw a fake success
 * message. These persist the submission durably and best-effort notify the
 * team by email; the email failing never fails the request, since the DB
 * write is already the durable record.
 */

const NOTIFY_EMAIL = process.env.CONTACT_NOTIFY_EMAIL || 'info@viamarketing.ca';

const NEWSLETTER_SOURCES = ['footer', 'blog'];

/** POST /api/v1/public/newsletter-subscribe  body: { email, source? } */
const subscribeNewsletter = async (req, res, next) => {
  const email = (req.body.email || '').toLowerCase().trim();
  const source = NEWSLETTER_SOURCES.includes(req.body.source) ? req.body.source : 'footer';
  try {
    const { error } = await supabase
      .from('newsletter_subscribers')
      .insert({ email, source });

    // Already-subscribed is not an error from the visitor's point of view.
    if (error && error.code !== '23505') throw error;

    sendEmailViaBrevo(
      NOTIFY_EMAIL,
      'New newsletter subscriber',
      `<p>New newsletter signup: <strong>${escapeHtml(email)}</strong></p>`
    ).catch((err) => logger.warn({ err }, 'Newsletter notification email failed (non-fatal)'));

    return res.json({ success: true, message: 'Subscribed successfully.' });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/public/sms-opt-in  body: { fullName?, phone, consent }
 *
 * The live opt-in form on /sms-opt-in — the URL submitted with the Twilio
 * Toll-Free Verification. Persists a timestamped, versioned consent record
 * (phone + the exact consent-language version shown). The person receives
 * event texts only when a host invites them; this row documents the opt-in.
 */
const submitSmsOptIn = async (req, res, next) => {
  const fullName = (req.body.fullName || '').trim() || null;
  const phone = normalizeToE164(req.body.phone);

  if (!phone) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'Enter a valid phone number in international format (e.g. +1 555 123 4567).' });
  }
  // Affirmative consent is the entire point of this endpoint — never record
  // without it. String 'true' tolerated for form-encoded clients.
  const consented = req.body.consent === true || req.body.consent === 'true';
  if (!consented) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'Please check the consent box to opt in to text messages.' });
  }

  try {
    const { error } = await supabase
      .from('sms_optin_submissions')
      .insert({ full_name: fullName, phone, consent: true, consent_text_version: SMS_CONSENT_TEXT_VERSION, source: 'sms_opt_in_page', ip: req.ip || null });
    if (error) throw error;

    return res.json({ success: true, message: 'You are opted in. You will only receive texts about Fancy RSVP events you are invited to. Reply STOP to any message to opt out.' });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/public/contact  body: { name, email, subject, message,
 *   segment?, company?, phone?, expectedGuests? }
 *
 * Shared by the generic Contact page (segment omitted -> 'general') and the
 * /solutions/* B2B inquiry forms (Planners / Venues / Corporate), which pass
 * `segment` plus the optional company/phone/expectedGuests fields so a
 * qualified sales lead is durably distinguishable from a routine support
 * question — not just another row indistinguishable from the rest.
 */
const submitContactForm = async (req, res, next) => {
  const name = (req.body.name || '').trim();
  const email = (req.body.email || '').trim();
  const subject = (req.body.subject || '').trim();
  const message = (req.body.message || '').trim();
  // Defence in depth: the route validator already restricts this to the known
  // set, but never trust the body value verbatim into a CHECK-constrained column.
  const ALLOWED_SEGMENTS = ['general', 'planners', 'venues', 'corporate'];
  const segment = ALLOWED_SEGMENTS.includes(req.body.segment) ? req.body.segment : 'general';
  const company = (req.body.company || '').trim() || null;
  const phone = (req.body.phone || '').trim() || null;
  const expectedGuests = (req.body.expectedGuests || '').trim() || null;

  try {
    const { error } = await supabase
      .from('contact_submissions')
      .insert({ name, email, subject, message, segment, company, phone, expected_guests: expectedGuests, ip: req.ip || null });
    if (error) throw error;

    const segmentLabel = segment === 'general' ? null : segment.charAt(0).toUpperCase() + segment.slice(1);
    sendEmailViaBrevo(
      NOTIFY_EMAIL,
      segmentLabel ? `New ${segmentLabel} inquiry: ${subject}` : `New contact form message: ${subject}`,
      `${segmentLabel ? `<p><strong>Segment:</strong> ${escapeHtml(segmentLabel)}</p>` : ''}
       <p><strong>From:</strong> ${escapeHtml(name)} (${escapeHtml(email)})</p>
       ${company ? `<p><strong>Company:</strong> ${escapeHtml(company)}</p>` : ''}
       ${phone ? `<p><strong>Phone:</strong> ${escapeHtml(phone)}</p>` : ''}
       ${expectedGuests ? `<p><strong>Expected guests:</strong> ${escapeHtml(expectedGuests)}</p>` : ''}
       <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
       <p><strong>Message:</strong></p>
       <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>`
    ).catch((err) => logger.warn({ err }, 'Contact form notification email failed (non-fatal)'));

    return res.json({ success: true, message: 'Message sent successfully.' });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/public/testimonials — published testimonials only, in display
 * order. The counterpart to admin/testimonialsController.js's full CRUD;
 * this is the ONLY read path the public landing page uses, so an
 * unpublished (draft, or since-retracted) testimonial can never leak.
 * Never exposes created_by/updated_by or timestamps — those are internal.
 */
const getPublicTestimonials = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('testimonials')
      .select('id, name, role, quote, photo_url, initials, rating, verify_url')
      .eq('is_published', true)
      .order('sort_order', { ascending: true });
    if (error) throw error;

    res.set('Cache-Control', 'public, max-age=60, s-maxage=60');
    return res.json({ success: true, testimonials: data || [] });
  } catch (err) {
    // A landing-page decoration must never 500 the page — degrade to an
    // empty list (the section hides itself client-side) rather than error,
    // mirroring the /public/landing-stats endpoint's own fallback.
    logger.warn({ err }, 'getPublicTestimonials: query failed, returning empty list');
    return res.status(200).json({ success: false, testimonials: [] });
  }
};

/**
 * GET /api/v1/public/press-mentions — published "As Seen In" press mentions
 * / trust badges only, in display order. The counterpart to
 * admin/pressMentionsController.js's full CRUD. Never exposes
 * created_by/updated_by or timestamps — those are internal.
 */
const getPublicPressMentions = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('press_mentions')
      .select('id, publication_name, logo_url, article_url, headline')
      .eq('is_published', true)
      .order('sort_order', { ascending: true });
    if (error) throw error;

    res.set('Cache-Control', 'public, max-age=60, s-maxage=60');
    return res.json({ success: true, pressMentions: data || [] });
  } catch (err) {
    // A landing-page decoration must never 500 the page — degrade to an
    // empty list (the section hides itself client-side) rather than error,
    // mirroring getPublicTestimonials.
    logger.warn({ err }, 'getPublicPressMentions: query failed, returning empty list');
    return res.status(200).json({ success: false, pressMentions: [] });
  }
};

/**
 * GET /api/v1/public/blog — published posts only, newest first. Optional
 * ?category= filter. The counterpart to admin/blogController.js's full CRUD.
 * Never exposes content/meta fields not needed for a list card — the full
 * body is only returned by getPublicBlogPostBySlug for the detail page.
 */
const getPublicBlogPosts = async (req, res) => {
  try {
    let query = supabase
      .from('blog_posts')
      .select('id, title, slug, excerpt, cover_image_url, category, author_name, published_at, read_time_minutes')
      .eq('is_published', true)
      .order('published_at', { ascending: false });

    const category = (req.query.category || '').toString().trim();
    if (category && category.toLowerCase() !== 'all') query = query.eq('category', category);

    const { data, error } = await query;
    if (error) throw error;

    res.set('Cache-Control', 'public, max-age=60, s-maxage=60');
    return res.json({ success: true, posts: data || [] });
  } catch (err) {
    // A landing-page listing must never 500 the page — degrade to an empty
    // list, mirroring getPublicTestimonials / getPublicPressMentions.
    logger.warn({ err }, 'getPublicBlogPosts: query failed, returning empty list');
    return res.status(200).json({ success: false, posts: [] });
  }
};

/**
 * GET /api/v1/public/blog/:slug — a single published post's full content.
 * Unlike the decorative list/testimonials endpoints, a missing or unpublished
 * slug is a genuine 404 (the page itself doesn't exist), not a soft-degrade.
 */
const getPublicBlogPostBySlug = async (req, res, next) => {
  const slug = (req.params.slug || '').toString().trim();
  try {
    const { data, error } = await supabase
      .from('blog_posts')
      .select('id, title, slug, excerpt, content, cover_image_url, category, author_name, published_at, read_time_minutes, meta_title, meta_description')
      .eq('slug', slug)
      .eq('is_published', true)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'POST_NOT_FOUND', message: 'This article could not be found.' });

    res.set('Cache-Control', 'public, max-age=60, s-maxage=60');
    return res.json({ success: true, post: data });
  } catch (err) {
    next(err);
  }
};

module.exports = { subscribeNewsletter, submitContactForm, submitSmsOptIn, getPublicTestimonials, getPublicPressMentions, getPublicBlogPosts, getPublicBlogPostBySlug };
