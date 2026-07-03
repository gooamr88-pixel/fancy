const { supabase } = require('../config/supabase');
const logger = require('../utils/logger');
const { sendEmailViaBrevo } = require('../utils/notificationService');
const { escapeHtml } = require('../utils/emailTemplates');

/**
 * Public marketing forms (footer newsletter signup, Contact page). Both were
 * previously pure client-side mockups — no backend call existed, so every
 * submission was silently discarded while the visitor saw a fake success
 * message. These persist the submission durably and best-effort notify the
 * team by email; the email failing never fails the request, since the DB
 * write is already the durable record.
 */

const NOTIFY_EMAIL = process.env.CONTACT_NOTIFY_EMAIL || 'support@fancyrsvp.com';

/** POST /api/v1/public/newsletter-subscribe  body: { email } */
const subscribeNewsletter = async (req, res, next) => {
  const email = (req.body.email || '').toLowerCase().trim();
  try {
    const { error } = await supabase
      .from('newsletter_subscribers')
      .insert({ email, source: 'footer' });

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

/** POST /api/v1/public/contact  body: { name, email, subject, message } */
const submitContactForm = async (req, res, next) => {
  const name = (req.body.name || '').trim();
  const email = (req.body.email || '').trim();
  const subject = (req.body.subject || '').trim();
  const message = (req.body.message || '').trim();

  try {
    const { error } = await supabase
      .from('contact_submissions')
      .insert({ name, email, subject, message, ip: req.ip || null });
    if (error) throw error;

    sendEmailViaBrevo(
      NOTIFY_EMAIL,
      `New contact form message: ${subject}`,
      `<p><strong>From:</strong> ${escapeHtml(name)} (${escapeHtml(email)})</p>
       <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
       <p><strong>Message:</strong></p>
       <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>`
    ).catch((err) => logger.warn({ err }, 'Contact form notification email failed (non-fatal)'));

    return res.json({ success: true, message: 'Message sent successfully.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { subscribeNewsletter, submitContactForm };
