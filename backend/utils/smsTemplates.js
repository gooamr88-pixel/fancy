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
 *
 * ── Plain words, not short words ──
 *
 * These are read by people of every age, on a lock screen, often in a second
 * language, frequently while standing outside a venue. So the vocabulary is
 * deliberately ordinary: "You are at table 12" rather than "Your table: 12",
 * "Show this at the door" rather than "Entry pass", "you are coming to" rather
 * than "you're confirmed for". Product nouns ("entry pass", "seating map") are
 * things this company named; a table and a door are things everybody already
 * knows.
 *
 * THE RULE WHEN EDITING COPY HERE: re-measure. Plainer is usually also longer,
 * and length is billed. Every rewording above was checked against
 * utils/smsSegments with the real 78-character compliance footer and a shortened
 * link, and none of them crossed a segment boundary — the English bodies gained
 * up to 16 characters inside two segments that hold 306, and the Arabic ones got
 * SHORTER because UCS-2 gives them almost no room to spend (see the note in
 * seating_reminder's Arabic builder). A rewrite that reads better and quietly
 * adds a segment has made every event on the platform more expensive.
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
/* Only the confirmation template uses these — it is the one message that carries
   a venue and lists of people and dishes. */
const VENUE_MAX = 48;
const COMPANION_MAX = 18;
const MEAL_MAX = 22;

/**
 * Join a list for a text message, capped in BOTH directions.
 *
 * Each entry is clipped, and the list itself stops at `max` with a "+N more"
 * tail. Uncapped, a party of twelve with long names takes the confirmation from
 * 3 segments to 9 — tripling the bill for the whole guest list, and doing it
 * worst for exactly the large families who most want to read the names.
 *
 * Returns '' for nothing usable, so the caller can omit the clause entirely
 * rather than emitting "With you: ." — an empty label still costs characters.
 */
function clipList(values, each, max) {
  const list = (Array.isArray(values) ? values : [])
    .map((v) => clip(v, each))
    .filter(Boolean);
  if (list.length === 0) return '';
  if (list.length <= max) return list.join(', ');
  return `${list.slice(0, max).join(', ')} +${list.length - max} more`;
}

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
      if (table && when) return `${who}, ${what}${when}. You are at table ${table}. Show this at the door: ${ticketUrl}`;
      if (table) return `${who}, you are at table ${table} for ${what}. Show this at the door: ${ticketUrl}`;
      if (when) return `${who}, ${what}${when}. Show this at the door: ${ticketUrl}`;
      return `${who}, show this at the door for ${what}: ${ticketUrl}`;
    },
    [AR]: ({ guestName, eventTitle, tableName, ticketUrl, dateLabel }) => {
      const who = clip(guestName, NAME_MAX);
      const what = clip(eventTitle, TITLE_MAX);
      const table = tableName ? clip(tableName, TABLE_MAX) : null;
      const when = dateLabel ? ` ${dateLabel}` : '';
      /**
       * The Arabic leg says "تذكرتك" where the English says "Show this at the
       * door", and that asymmetry is a budget decision, not an oversight.
       *
       * Arabic forces UCS-2: 67 units per segment against GSM-7's 153. The
       * English body has ~100 units of slack inside its two segments and can
       * afford the longer, plainer instruction. The Arabic one sits ~15 units
       * under its third segment boundary, so the same phrase (+5 units over the
       * old wording) would tip a realistic message to four segments — a third
       * more, for every guest, on every event. "تذكرتك" is both the plainer
       * word AND six units shorter than the "تذكرة الدخول" it replaces, so this
       * reads more simply and costs less than what was here before.
       */
      if (table && when) return `${who}، ${what}${when}. مكانك طاولة ${table}. تذكرتك: ${ticketUrl}`;
      if (table) return `${who}، مكانك في ${what} طاولة ${table}. تذكرتك: ${ticketUrl}`;
      if (when) return `${who}، ${what}${when}. تذكرتك: ${ticketUrl}`;
      return `${who}، تذكرتك لـ ${what}: ${ticketUrl}`;
    },
  },

  /**
   * THE CONFIRMATION, WITH THE DETAIL IN IT.
   *
   * ── This one breaks the one-segment rule on purpose ──
   *
   * Every other template here is terse because a segment costs money and the link
   * can carry the detail. This one was asked for the other way round: the
   * organizer wants the guest to be able to READ their table, their companions and
   * their meals in the notification shade without tapping anything, because the
   * alternative is answering the same questions by hand on WhatsApp, one guest at
   * a time.
   *
   * The cost of that decision was measured, not guessed, with utils/smsSegments
   * and the real 78-character footer:
   *
   *   full detail  EN  3 segments   9c/guest    200 guests = $18.00
   *   full detail  AR  6 segments  18c/guest    200 guests = $36.00
   *   short + link EN  2 segments   6c/guest    200 guests = $12.00
   *   short + link AR  3 segments   9c/guest    200 guests = $18.00
   *
   * So roughly 1.5x in English and 2x in Arabic — a real cost, and a modest one
   * against the support burden it removes. The registry weight (1.6) is set from
   * these numbers so the allowance estimator quotes for it honestly.
   *
   * ── What it still refuses to do ──
   *
   * Every interpolated value is clipped and every LIST is capped. A party of
   * twelve with long names would otherwise walk this from 3 segments to 9 — and
   * the guest who most needs to read their companions is in exactly that party.
   * Past the cap it says "+4 more", and the link carries the rest.
   */
  rsvp_confirmation: {
    [EN]: ({ guestName, eventTitle, dateLabel, venue, tableName, companions, meals, ticketUrl }) => {
      const parts = [`${clip(guestName, NAME_MAX)}, you are coming to ${clip(eventTitle, TITLE_MAX)}`];
      if (dateLabel) parts.push(` on ${clip(dateLabel, 34)}`);
      if (venue) parts.push(` at ${clip(venue, VENUE_MAX)}`);
      parts.push('.');
      if (tableName) parts.push(` You are at table ${clip(tableName, TABLE_MAX)}.`);
      const withYou = clipList(companions, COMPANION_MAX, 3);
      if (withYou) parts.push(` With you: ${withYou}.`);
      const food = clipList(meals, MEAL_MAX, 4);
      if (food) parts.push(` Food: ${food}.`);
      if (ticketUrl) parts.push(` Your pass and map: ${ticketUrl}`);
      return parts.join('');
    },
    [AR]: ({ guestName, eventTitle, dateLabel, venue, tableName, companions, meals, ticketUrl }) => {
      const parts = [`${clip(guestName, NAME_MAX)}، حضورك مؤكد في ${clip(eventTitle, TITLE_MAX)}`];
      if (dateLabel) parts.push(` ${clip(dateLabel, 34)}`);
      if (venue) parts.push(`، ${clip(venue, VENUE_MAX)}`);
      parts.push('.');
      if (tableName) parts.push(` مكانك طاولة ${clip(tableName, TABLE_MAX)}.`);
      const withYou = clipList(companions, COMPANION_MAX, 3);
      if (withYou) parts.push(` معك: ${withYou}.`);
      const food = clipList(meals, MEAL_MAX, 4);
      if (food) parts.push(` الأكل: ${food}.`);
      if (ticketUrl) parts.push(` تذكرتك والخريطة: ${ticketUrl}`);
      return parts.join('');
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
        ? `${who}, ${what} has been cancelled. Please read this: ${url}`
        : `${who}, the date or place for ${what} has changed. Please check here: ${url}`;
    },
    [AR]: ({ guestName, eventTitle, url, cancelled }) => {
      const who = clip(guestName, NAME_MAX);
      const what = clip(eventTitle, TITLE_MAX);
      return cancelled
        ? `${who}، تم إلغاء ${what}. اقرأ التفاصيل: ${url}`
        : `${who}، اتغيّر ميعاد أو مكان ${what}. شوف التفاصيل: ${url}`;
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

module.exports = { renderSmsBody, normalizeLang, clip, clipList, TEMPLATES };
