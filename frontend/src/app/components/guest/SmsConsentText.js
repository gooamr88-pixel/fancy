// Canonical SMS opt-in consent language (Twilio Toll-Free Verification / TCPA / CTIA).
//
// This exact wording is quoted verbatim in the Twilio TFV submission, so every
// surface that shows the consent checkbox MUST render these components instead
// of its own copy of the sentence: the RSVP wizard (StepPartyDetails), the
// full-page template forms (heritageArch RsvpSection), and the public
// /sms-opt-in disclosure page. The two RSVP paths drifted apart once before —
// do not inline a variant of this text anywhere.
//
// TWO components, and the split is itself a compliance requirement:
//
//   <SmsConsentText />          goes INSIDE the checkbox <label>. It is the
//                               only thing the guest agrees to by ticking the
//                               box. It contains NO links and mentions neither
//                               the Privacy Policy nor the Terms of Service.
//
//   <SmsConsentIndependence />  goes immediately BELOW the checkbox, OUTSIDE
//                               the label. It states that SMS consent is not
//                               conditioned on the Privacy Policy or Terms,
//                               and it carries the policy links.
//
// Twilio rejects consent language that bundles SMS opt-in with acceptance of
// other agreements ("independent consent"). Putting the policy links inside
// the label — as this component did until 2026-08-01 — reads as "ticking this
// box also accepts our Terms," which is exactly the construction that fails
// review. Never move the links back inside the label, and never make the
// checkbox required in order to submit a form (see RsvpWizard / RsvpSection /
// rsvpController: a phone number may be collected with the box left unticked).
//
// Requirements baked into the label wording (do not remove any of them):
// brand name, the message types (event invitations, RSVP updates, reminders,
// event updates), frequency, rates, STOP, and HELP.

// Version stamp persisted with every consent record
// (rsvp_parties.sms_consent_text_version, sms_optin_submissions.consent_text_version).
// MUST match backend/utils/smsConsent.js — bump both together whenever either
// component's wording changes.
//
// 2026-08-04: reworded to the exact sentence filed against Twilio rejection
//   30475 ("Consent for Messaging Cannot Be Part of Other Agreements"), and the
//   independence notice reduced to the three sentences filed with it. Previous
//   version: 2026-08-01 — "I agree to receive text messages from FancyRSVP
//   about this event, including event invitations, RSVP updates, reminders, and
//   event updates. Message frequency varies. Message & data rates may apply.
//   Reply STOP to opt out at any time, or HELP for help."
// 2026-08-01: links moved out of the label into SmsConsentIndependence; label
//   reworded to the TFV-submitted sentence. Previous version: 2026-07-16 —
//   "I agree to receive text messages from Fancy RSVP about this event,
//   including event invitations, RSVP updates, reminders, and event updates.
//   Message frequency varies. Message & data rates may apply. Reply STOP to opt
//   out at any time, or HELP for help. See our Privacy Policy and Terms of
//   Service."
export const SMS_CONSENT_TEXT_VERSION = '2026-08-04';

const linkBase = { fontWeight: 600, textDecoration: 'underline', color: 'inherit' };

function PolicyLink({ href, style, children }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ ...linkBase, ...style }}>
      {children}
    </a>
  );
}

/**
 * The checkbox label. Renders INSIDE <label> — no links, no reference to any
 * other agreement.
 */
export default function SmsConsentText({ isRTL = false }) {
  if (isRTL) {
    return (
      <>
        أوافق على تلقي رسائل نصية متعلقة بالفعاليات من FancyRSVP، بما في ذلك روابط الدعوات وتأكيدات الردود (RSVP) والتذكيرات وتحديثات الفعالية. يختلف عدد الرسائل. وقد تُطبّق رسوم الرسائل والبيانات. أرسل STOP لإلغاء الاشتراك في أي وقت أو HELP للمساعدة.
      </>
    );
  }
  return (
    <>
      I agree to receive event-related text messages from FancyRSVP, including invitation links, RSVP confirmations, reminders, and event updates. Message frequency varies. Message &amp; data rates may apply. Reply STOP to opt out at any time or HELP for assistance.
    </>
  );
}

/**
 * The independence notice. Renders immediately BELOW the checkbox, OUTSIDE the
 * label, on every surface that shows SmsConsentText. Carries the Privacy /
 * Terms links so they are visually and structurally separate from the thing
 * the guest is ticking.
 *
 * @param {object}  style      merged into the wrapper (colour / font-size per surface)
 * @param {object}  linkStyle  merged into the two policy links
 */
export function SmsConsentIndependence({ isRTL = false, style = {}, linkStyle = {} }) {
  const wrap = {
    fontFamily: 'var(--font-sans)',
    fontSize: '11.5px',
    lineHeight: 1.65,
    color: '#7A756C',
    margin: '8px 0 0',
    ...style,
  };
  const line = { margin: '0 0 5px' };

  if (isRTL) {
    return (
      <div style={wrap} dir="rtl">
        <p style={line}>الموافقة على الرسائل النصية اختيارية وليست مطلوبة للتسجيل أو لتأكيد الحضور (RSVP) أو لحضور أي فعالية أو لاستخدام FancyRSVP.</p>
        <p style={line}>قرارك بتلقي الرسائل النصية مستقل تمامًا عن قبول سياسة الخصوصية أو شروط الخدمة الخاصة بنا.</p>
        <p style={{ ...line, marginBottom: 0 }}>
          راجع{' '}
          <PolicyLink href="/privacy" style={linkStyle}>سياسة الخصوصية</PolicyLink>
          {' '}و{' '}
          <PolicyLink href="/terms" style={linkStyle}>شروط الخدمة</PolicyLink>
          {' '}لمزيد من المعلومات.
        </p>
      </div>
    );
  }
  return (
    <div style={wrap}>
      <p style={line}>SMS consent is voluntary and is not required to register, RSVP, attend an event, or use FancyRSVP.</p>
      <p style={line}>Your decision to receive SMS messages is completely independent from acceptance of our Privacy Policy or Terms of Service.</p>
      <p style={{ ...line, marginBottom: 0 }}>
        See our{' '}
        <PolicyLink href="/privacy" style={linkStyle}>Privacy Policy</PolicyLink>
        {' '}and{' '}
        <PolicyLink href="/terms" style={linkStyle}>Terms of Service</PolicyLink>
        {' '}for additional information.
      </p>
    </div>
  );
}
