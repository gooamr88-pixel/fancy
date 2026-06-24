/**
 * SMS segmentation + safe template interpolation.
 *
 * Carriers bill per *segment*, not per message: a single SMS holds 160 GSM-7
 * characters (70 for Unicode/UCS-2); longer bodies are split into concatenated
 * segments of 153 (GSM-7) / 67 (UCS-2) chars each. Charging "1 credit per message"
 * silently under-bills multi-segment sends. These helpers compute the true segment
 * count so the wallet is debited for the exact cost.
 */

// GSM 03.38 basic set — each char is one 7-bit septet.
const GSM_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM_BASIC_SET = new Set(Array.from(GSM_BASIC));
// Extension chars cost two septets (they are escape-prefixed on the wire).
const GSM_EXT_SET = new Set(['^', '{', '}', '\\', '[', '~', ']', '|', '€']);

/**
 * Classify a message body and count its billable segments.
 * @returns {{ encoding: 'GSM-7'|'UCS-2', length: number, segments: number, perSegment: number }}
 */
function computeSmsSegments(text) {
  const body = text == null ? '' : String(text);
  if (body.length === 0) return { encoding: 'GSM-7', length: 0, segments: 1, perSegment: 160 };

  let isGsm = true;
  let gsmUnits = 0;
  for (const ch of body) {
    if (GSM_BASIC_SET.has(ch)) gsmUnits += 1;
    else if (GSM_EXT_SET.has(ch)) gsmUnits += 2;
    else { isGsm = false; break; }
  }

  if (isGsm) {
    const segments = gsmUnits <= 160 ? 1 : Math.ceil(gsmUnits / 153);
    return { encoding: 'GSM-7', length: gsmUnits, segments: Math.max(1, segments), perSegment: gsmUnits <= 160 ? 160 : 153 };
  }

  // UCS-2: count UTF-16 code units (an emoji = 2 units, matching carrier behaviour).
  const units = body.length;
  const segments = units <= 70 ? 1 : Math.ceil(units / 67);
  return { encoding: 'UCS-2', length: units, segments: Math.max(1, segments), perSegment: units <= 70 ? 70 : 67 };
}

/**
 * Render a message template against a values map.
 *
 * Supports both `{tag}` and `{{tag}}` syntaxes, is case-insensitive, and — crucially —
 * uses a *function* replacer so guest-supplied values containing `$` sequences
 * (e.g. "$5", "A$&B") can never be misread as `String.replace` special patterns.
 * Unknown tags are left intact rather than blanked, so typos are visible.
 *
 * @param {string} template
 * @param {Record<string, string|number|null|undefined>} values  keys should be lowercase
 */
function renderTemplate(template, values = {}) {
  if (template == null) return '';
  return String(template).replace(/\{\{?\s*([a-zA-Z0-9_]+)\s*\}?\}/g, (match, rawKey) => {
    const key = String(rawKey).toLowerCase();
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      const v = values[key];
      return v == null ? '' : String(v);
    }
    return match;
  });
}

/** The tags the composer advertises and the renderer understands. */
const SUPPORTED_TAGS = ['name', 'url', 'rsvp_link', 'table_number', 'table', 'event', 'event_name'];

module.exports = { computeSmsSegments, renderTemplate, SUPPORTED_TAGS };
