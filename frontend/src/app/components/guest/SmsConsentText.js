// Canonical SMS opt-in consent language (Twilio Toll-Free Verification / TCPA / CTIA).
//
// This exact wording is quoted verbatim in the Twilio TFV submission, so every
// surface that shows the consent checkbox MUST render this component instead of
// its own copy of the sentence: the RSVP wizard (StepPartyDetails), the
// full-page template forms (heritageArch RsvpSection), and the public
// /sms-opt-in disclosure page. The two RSVP paths drifted apart once before —
// do not inline a variant of this text anywhere.
//
// Requirements baked into the wording (do not remove any of them):
// brand name, the four message types (event invitations, RSVP updates,
// reminders, event updates), frequency, rates, STOP, HELP, and direct links
// to the Privacy Policy and Terms of Service.

// Version stamp persisted with every consent record
// (rsvp_parties.sms_consent_text_version). MUST match
// backend/utils/smsConsent.js — bump both together whenever the sentence changes.
export const SMS_CONSENT_TEXT_VERSION = '2026-07-16';

const linkBase = { fontWeight: 600, textDecoration: 'underline', color: 'inherit' };

function PolicyLink({ href, style, children }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ ...linkBase, ...style }}>
      {children}
    </a>
  );
}

export default function SmsConsentText({ isRTL = false, linkStyle = {} }) {
  if (isRTL) {
    return (
      <>
        أوافق على تلقي رسائل نصية (SMS) من Fancy RSVP بخصوص هذه الفعالية، بما في ذلك دعوات الفعالية وتحديثات الردود (RSVP) والتذكيرات وتحديثات الفعالية. يختلف عدد الرسائل، وقد تُطبّق رسوم الرسائل والبيانات من مشغّل شبكتك. أرسل STOP لإلغاء الاشتراك في أي وقت، أو HELP للمساعدة. راجع{' '}
        <PolicyLink href="/privacy" style={linkStyle}>سياسة الخصوصية</PolicyLink>
        {' '}و{' '}
        <PolicyLink href="/terms" style={linkStyle}>شروط الخدمة</PolicyLink>.
      </>
    );
  }
  return (
    <>
      I agree to receive text messages from Fancy RSVP about this event, including event invitations, RSVP updates, reminders, and event updates. Message frequency varies. Message &amp; data rates may apply. Reply STOP to opt out at any time, or HELP for help. See our{' '}
      <PolicyLink href="/privacy" style={linkStyle}>Privacy Policy</PolicyLink>
      {' '}and{' '}
      <PolicyLink href="/terms" style={linkStyle}>Terms of Service</PolicyLink>.
    </>
  );
}
