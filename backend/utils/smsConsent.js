/**
 * Canonical SMS consent-language version stamp.
 *
 * The guest-facing consent sentence lives in ONE frontend component —
 * frontend/src/app/components/guest/SmsConsentText.js — and is rendered by
 * every opt-in surface (RSVP wizard, full-page templates, /sms-opt-in). This
 * version identifier is persisted with each consent record
 * (rsvp_parties.sms_consent_text_version) so the exact wording a guest agreed
 * to can always be reconstructed (Privacy Policy §3 record-keeping).
 *
 * Bump BOTH this constant and SMS_CONSENT_TEXT_VERSION in SmsConsentText.js
 * whenever the consent sentence changes, and archive the old wording in the
 * commit message.
 */
const SMS_CONSENT_TEXT_VERSION = '2026-07-16';

// Whitelist of opt-in surfaces the frontend may report (anything else is
// coerced to the generic 'guest_form' rather than trusting client input).
const SMS_CONSENT_SOURCES = ['guest_form_wizard', 'guest_form_template'];

function normalizeConsentSource(source) {
  return SMS_CONSENT_SOURCES.includes(source) ? source : 'guest_form';
}

module.exports = { SMS_CONSENT_TEXT_VERSION, SMS_CONSENT_SOURCES, normalizeConsentSource };
