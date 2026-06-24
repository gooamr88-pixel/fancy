'use client';

// Client mirror of backend/utils/smsSegments.js — keeps the composer's live cost
// estimate in lock-step with how the server actually bills (per segment, encoding-aware).

const GSM_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM_BASIC_SET = new Set(Array.from(GSM_BASIC));
const GSM_EXT_SET = new Set(['^', '{', '}', '\\', '[', '~', ']', '|', '€']);

export function computeSmsSegments(text) {
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
  const units = body.length;
  const segments = units <= 70 ? 1 : Math.ceil(units / 67);
  return { encoding: 'UCS-2', length: units, segments: Math.max(1, segments), perSegment: units <= 70 ? 70 : 67 };
}

// Same lenient {tag} / {{tag}} renderer the backend uses, for the live preview.
export function renderTemplate(template, values = {}) {
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
