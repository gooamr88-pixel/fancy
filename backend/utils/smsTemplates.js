/**
 * SMS bodies for every lifecycle message type, in English and Arabic.
 *
 * ── Why these are terse to the point of looking unfinished ──
 *
 * Carriers bill per SEGMENT, and the organizer's allowance is denominated in
 * segments. A GSM-7 segment holds 160 characters, but the mandatory compliance
 * footer that smsDispatch appends to every body — " - Fancy RSVP. Msg&data rates
 * may apply. Reply STOP to opt out, HELP for help." — is 77 of them before the
 * message says anything at all. Roughly 80 characters remain inside one segment;
 * a single word past that DOUBLES the cost of every message to every guest.
 *
 * Arabic is far tighter still: it forces UCS-2, where a segment holds 70
 * characters total and the (English, unavoidable) footer alone overflows it. Two
 * segments is the practical floor for an Arabic message, which is exactly what
 * smsEstimator prices in.
 *
 * So: no pleasantries, no restating the event's full title, no "we look forward
 * to seeing you". Every template is a fact plus a link.
 *
 * ── The link is the payload ──
 *
 * SMS cannot carry an image, a button, or formatting. Where the email equivalent
 * embeds a QR pass or a formatted table, the text carries a short link to the
 * page that has it. That is why qr_ticket and rsvp_confirmation do NOT suppress
 * their emails (see smsMessageTypes.replacesEmail) — the email is still the thing
 * holding the actual pass.
 *
 * ── Truncation ──
 *
 * Guest names and event titles are organizer/guest-supplied and unbounded. Left
 * raw, one long title turns a one-segment message into four, for the entire guest
 * list. Every interpolated value goes through `clip`.
 */

const EN = 'en';
const AR = 'ar';

/** Hard cap on any interpolated value, so one long title cannot inflate a whole send. */
function clip(value, max) {
  const s = String(value == null ? '' : value).trim();
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

const NAME_MAX = 24;
const TITLE_MAX = 40;
const TABLE_MAX = 20;

/**
 * body builders, keyed by message type then language.
 *
 * Each receives a context object and returns the message WITHOUT the compliance
 * footer — smsDispatch appends that centrally so it can never be forgotten or
 * duplicated.
 */
const TEMPLATES = {
  rsvp_confirmation: {
    [EN]: ({ guestName, eventTitle, response, ticketUrl }) => {
      const who = clip(guestName, NAME_MAX);
      const what = clip(eventTitle, TITLE_MAX);
      if (response === 'maybe') return `${who}, we've noted your tentative reply for ${what}.`;
      return ticketUrl
        ? `${who}, your RSVP for ${what} is confirmed. Entry pass: ${ticketUrl}`
        : `${who}, your RSVP for ${what} is confirmed.`;
    },
    [AR]: ({ guestName, eventTitle, response, ticketUrl }) => {
      const who = clip(guestName, NAME_MAX);
      const what = clip(eventTitle, TITLE_MAX);
      if (response === 'maybe') return `${who}، سجّلنا ردك المبدئي لـ ${what}.`;
      return ticketUrl
        ? `${who}، تم تأكيد حضورك لـ ${what}. تذكرة الدخول: ${ticketUrl}`
        : `${who}، تم تأكيد حضورك لـ ${what}.`;
    },
  },

  rsvp_reminder: {
    [EN]: ({ guestName, eventTitle, rsvpUrl }) =>
      `${clip(guestName, NAME_MAX)}, please RSVP for ${clip(eventTitle, TITLE_MAX)}: ${rsvpUrl}`,
    [AR]: ({ guestName, eventTitle, rsvpUrl }) =>
      `${clip(guestName, NAME_MAX)}، برجاء تأكيد حضورك لـ ${clip(eventTitle, TITLE_MAX)}: ${rsvpUrl}`,
  },

  event_reminder: {
    [EN]: ({ guestName, eventTitle, dateLabel, tableName }) => {
      const base = `${clip(guestName, NAME_MAX)}, ${clip(eventTitle, TITLE_MAX)} is ${dateLabel}.`;
      return tableName ? `${base} Your table: ${clip(tableName, TABLE_MAX)}.` : base;
    },
    [AR]: ({ guestName, eventTitle, dateLabel, tableName }) => {
      const base = `${clip(guestName, NAME_MAX)}، ${clip(eventTitle, TITLE_MAX)} ${dateLabel}.`;
      return tableName ? `${base} طاولتك: ${clip(tableName, TABLE_MAX)}.` : base;
    },
  },

  qr_ticket: {
    [EN]: ({ guestName, eventTitle, ticketUrl }) =>
      `${clip(guestName, NAME_MAX)}, your entry pass for ${clip(eventTitle, TITLE_MAX)}: ${ticketUrl}`,
    [AR]: ({ guestName, eventTitle, ticketUrl }) =>
      `${clip(guestName, NAME_MAX)}، تذكرة دخولك لـ ${clip(eventTitle, TITLE_MAX)}: ${ticketUrl}`,
  },

  decline_ack: {
    [EN]: ({ guestName, eventTitle }) =>
      `${clip(guestName, NAME_MAX)}, thank you for letting us know about ${clip(eventTitle, TITLE_MAX)}.`,
    [AR]: ({ guestName, eventTitle }) =>
      `${clip(guestName, NAME_MAX)}، شكرًا لإخبارنا بخصوص ${clip(eventTitle, TITLE_MAX)}.`,
  },

  organizer_report: {
    [EN]: ({ eventTitle, attending, pending, dashboardUrl }) =>
      `${clip(eventTitle, TITLE_MAX)}: ${attending} attending, ${pending} awaiting reply. ${dashboardUrl}`,
    [AR]: ({ eventTitle, attending, pending, dashboardUrl }) =>
      `${clip(eventTitle, TITLE_MAX)}: ${attending} حضور، ${pending} بانتظار الرد. ${dashboardUrl}`,
  },
};

/**
 * Render one message body for a type + language.
 *
 * Falls back to English for any unknown language rather than returning nothing —
 * a guest receiving the message in the wrong language is a far smaller failure
 * than a scheduled send silently producing an empty body.
 *
 * Returns null only when the TYPE is unknown, which is a programming error the
 * caller should surface rather than paper over. `campaign` has no entry here at
 * all: its body is written by the organizer and rendered by smsDispatch.personalize.
 */
function renderSmsBody(type, lang, context = {}) {
  const byLang = TEMPLATES[type];
  if (!byLang) return null;
  const build = byLang[lang === AR ? AR : EN] || byLang[EN];
  const body = build(context);
  return typeof body === 'string' && body.trim() ? body.trim() : null;
}

/** 'ar' for any Arabic language tag, else 'en'. */
function normalizeLang(lang) {
  return String(lang || '').toLowerCase().startsWith('ar') ? AR : EN;
}

module.exports = { renderSmsBody, normalizeLang, clip, TEMPLATES };
