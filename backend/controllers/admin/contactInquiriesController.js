const { supabase } = require('../../config/supabase');
const { logAdminAction } = require('../../middleware/adminAudit');
const { sendEmailViaBrevo } = require('../../utils/notificationService');
const { getContactInquiryReplyTemplate } = require('../../utils/emailTemplates');

/**
 * Admin visibility + reply workflow for contact_submissions (public Contact
 * page + /solutions/* B2B lead forms — see controllers/marketingController.js
 * for the public-facing submit endpoint). Previously write-only: every
 * inquiry was saved and emailed to a static inbox with no way to see the
 * history or reply from within the platform.
 */

const ALLOWED_STATUSES = ['new', 'responded', 'closed'];

/** GET /api/v1/admin/inquiries?status=&segment= */
const listContactInquiries = async (req, res, next) => {
  try {
    let query = supabase
      .from('contact_submissions')
      .select('*')
      .order('created_at', { ascending: false });

    const status = (req.query.status || '').toString().trim();
    if (status && ALLOWED_STATUSES.includes(status)) query = query.eq('status', status);

    const segment = (req.query.segment || '').toString().trim();
    if (segment && ['general', 'planners', 'venues', 'corporate'].includes(segment)) query = query.eq('segment', segment);

    const { data, error } = await query.limit(500);
    if (error) throw error;

    return res.json({ success: true, inquiries: data || [] });
  } catch (err) {
    next(err);
  }
};

/** POST /api/v1/admin/inquiries/:inquiryId/respond  body: { message } */
const respondToInquiry = async (req, res, next) => {
  const { inquiryId } = req.params;
  const message = (req.body?.message || '').toString().trim();

  if (!message) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'A response message is required.' });
  }
  if (message.length > 5000) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'Response is too long (max 5000 characters).' });
  }

  try {
    const { data: inquiry, error: fetchError } = await supabase
      .from('contact_submissions')
      .select('id, name, email, subject, message')
      .eq('id', inquiryId)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!inquiry) {
      return res.status(404).json({ success: false, error: 'INQUIRY_NOT_FOUND', message: 'Inquiry not found.' });
    }

    const html = getContactInquiryReplyTemplate({
      name: inquiry.name,
      subject: inquiry.subject,
      originalMessage: inquiry.message,
      replyMessage: message,
    });
    const sent = await sendEmailViaBrevo(inquiry.email, `Re: ${inquiry.subject}`, html);
    if (!sent) {
      return res.status(502).json({ success: false, error: 'EMAIL_SEND_FAILED', message: 'Could not send the reply email. Please try again.' });
    }

    const { data, error } = await supabase
      .from('contact_submissions')
      .update({
        admin_response: message,
        responded_at: new Date().toISOString(),
        responded_by: req.user.id,
        status: 'responded',
      })
      .eq('id', inquiryId)
      .select()
      .single();
    if (error) throw error;

    await logAdminAction(req, { action: 'contact_inquiry.respond', entityType: 'contact_submission', entityId: inquiryId, after: { status: 'responded' } });
    return res.json({ success: true, inquiry: data });
  } catch (err) {
    next(err);
  }
};

/** PATCH /api/v1/admin/inquiries/:inquiryId/status  body: { status } */
const updateInquiryStatus = async (req, res, next) => {
  const { inquiryId } = req.params;
  const status = (req.body?.status || '').toString().trim();

  if (!ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: `status must be one of: ${ALLOWED_STATUSES.join(', ')}.` });
  }

  try {
    const { data, error } = await supabase
      .from('contact_submissions')
      .update({ status })
      .eq('id', inquiryId)
      .select()
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'INQUIRY_NOT_FOUND', message: 'Inquiry not found.' });

    await logAdminAction(req, { action: 'contact_inquiry.status_update', entityType: 'contact_submission', entityId: inquiryId, after: { status } });
    return res.json({ success: true, inquiry: data });
  } catch (err) {
    next(err);
  }
};

module.exports = { listContactInquiries, respondToInquiry, updateInquiryStatus };
