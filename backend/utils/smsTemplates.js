/**
 * SMS bodies for every message type, in English and Arabic.
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
 * ── "Make them beautiful" and "keep them one segment" are the same instruction ──
 *
 * The obvious way to make a text feel premium is to put more in it: the venue,
 * the dress code, the timings, a warm sentence. Every one of those is three to
 * four segments in English and six to eight in Arabic — which triples an
 * organizer's bill to produce a wall of grey text in a notification shade, which
 * is the opposite of premium.
 *
 * So the craft goes somewhere better. The SMS carries the guest's name, the one
 * fact that moment is about, and a link — and the LINK opens the full invitation
 * reveal, which is already the most polished thing this product makes. A phone
 * that opens a wax seal and an animated card is a far stronger impression than
 * any amount of text could be, and it costs one segment to deliver.
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
  /**
   * THE INVITATION. Sent when the organizer presses send, never automatically.
   *
   * Deliberately says almost nothing beyond who it is from and where to look.
   * The date, the venue, the dress code, the RSVP form and the reveal animation
   * are all on the other side of the link, laid out properly, in the event's own
   * design. Repeating any of them here costs a segment per guest to say something
   * worse than the page already says.
   */
  invitation: {
    [EN]: ({ guestName, eventTitle, rsvpUrl }) => {
      const who = clip(guestName, NAME_MAX);
      const what = clip(eventTitle, TITLE_MAX);
      return `${who}, you're invited to ${what}. Open your invitation: ${rsvpUrl}`;
    },
    [AR]: ({ guestName, eventTitle, rsvpUrl }) => {
      const who = clip(guestName, NAME_MAX);
      const what = clip(eventTitle, TITLE_MAX);
      return `${who}، أنت مدعو إلى ${what}. دعوتك هنا: ${rsvpUrl}`;
    },
  },

  /**
   * TABLE & ENTRY PASS. Fires twice in an event's life, from the same template:
   * once when the organizer seats the guest, and again a day or two before.
   *
   * Three shapes, because three genuinely different things can be true:
   *   • seated, and the event is imminent  → date + table + pass
   *   • seated, weeks out                  → table + pass
   *   • no seating chart at all            → pass only
   *
   * The third is why this type replaced the old entry-pass type rather than
   * sitting beside it. A standing reception has no tables, and a guest there
   * still needs the thing that gets them through the door.
   */
  seating_reminder: {
    [EN]: ({ guestName, eventTitle, tableName, ticketUrl, dateLabel }) => {
      const who = clip(guestName, NAME_MAX);
      const what = clip(eventTitle, TITLE_MAX);
      const table = tableName ? clip(tableName, TABLE_MAX) : null;
      const when = dateLabel ? ` is ${dateLabel}` : '';
      if (table && when) return `${who}, ${what}${when}. Your table: ${table}. Entry pass: ${ticketUrl}`;
      if (table) return `${who}, your table for ${what} is ${table}. Entry pass: ${ticketUrl}`;
      if (when) return `${who}, ${what}${when}. Your entry pass: ${ticketUrl}`;
      return `${who}, your entry pass for ${what}: ${ticketUrl}`;
    },
    [AR]: ({ guestName, eventTitle, tableName, ticketUrl, dateLabel }) => {
      const who = clip(guestName, NAME_MAX);
      const what = clip(eventTitle, TITLE_MAX);
      const table = tableName ? clip(tableName, TABLE_MAX) : null;
      const when = dateLabel ? ` ${dateLabel}` : '';
      if (table && when) return `${who}، ${what}${when}. طاولتك: ${table}. تذكرة الدخول: ${ticketUrl}`;
      if (table) return `${who}، طاولتك في ${what}: ${table}. تذكرة الدخول: ${ticketUrl}`;
      if (when) return `${who}، ${what}${when}. تذكرة دخولك: ${ticketUrl}`;
      return `${who}، تذكرة دخولك لـ ${what}: ${ticketUrl}`;
    },
  },

  /**
   * CHANGE OR CANCELLATION. The only type where being slightly over budget would
   * be the right call — and it still is not, because the link carries the detail
   * and the reason.
   *
   * `cancelled` is a separate sentence rather than a variation on "changed". A
   * guest skim-reading "there's been an update to the wedding" and arriving at an
   * empty venue is the precise failure this type exists to prevent, so the word
   * has to be in the first six.
   */
  event_update: {
    [EN]: ({ guestName, eventTitle, url, cancelled }) => {
      const who = clip(guestName, NAME_MAX);
      const what = clip(eventTitle, TITLE_MAX);
      return cancelled
        ? `${who}, ${what} has been cancelled. Details: ${url}`
        : `${who}, the details for ${what} have changed. See what's new: ${url}`;
    },
    [AR]: ({ guestName, eventTitle, url, cancelled }) => {
      const who = clip(guestName, NAME_MAX);
      const what = clip(eventTitle, TITLE_MAX);
      return cancelled
        ? `${who}، تم إلغاء ${what}. التفاصيل: ${url}`
        : `${who}، تغيّرت تفاصيل ${what}. التفاصيل الجديدة: ${url}`;
    },
  },

  /**
   * THE ORGANIZER'S OWN ALERT. The only type addressed to the customer rather
   * than to a guest, and the only one where the numbers themselves are the
   * message — so it carries them, and links to the dashboard for the rest.
   */
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
 * Returns null when the TYPE is unknown, which now includes every RETIRED type.
 * That is the correct behaviour and the caller must surface it: a resend of a
 * retired kind has to fail visibly rather than send an empty message. See
 * smsUsage.isResendable, which stops it reaching here at all.
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
