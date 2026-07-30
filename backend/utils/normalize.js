/**
 * Single source of truth for normalizing guest-supplied identity fields.
 * Previously `email.trim().toLowerCase()` was copy-pasted across
 * submitPublicRSVP / importGuestsCSV / updateRSVP / addGuestManually with no
 * shared helper — easy to miss in one path and let "John@x.com" and
 * "john@x.com" both slip past the dedup guard. Phone normalization already
 * had a single source (`./phone.js`); this gives email the same treatment.
 */

/** Normalize a raw email to lowercase + trimmed, or null if blank. */
function normalizeEmail(raw) {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).normalize('NFC').trim().toLowerCase();
  return s ? s : null;
}

/** Escape special characters in user input before using it in a LIKE / ILIKE pattern. */
function escapeLikePattern(str) {
  return String(str || '').replace(/[%_\\]/g, '\\$&');
}

/**
 * Normalizes a person's name for SEARCH MATCHING only (spec §8.5).
 *
 * Never use this for display. Guest names are always rendered exactly as
 * stored, never transliterated or folded (§9.9) — this produces a match key,
 * not a name.
 *
 * Real Arabic guest lists break naive search in three specific ways, and all
 * three are handled here:
 *
 *   1. Hamza / alef variants. أحمد, إحمد, آحمد and احمد are the same person to
 *      everyone except a byte comparison. Door staff type whichever form their
 *      keyboard produces.
 *   2. Tashkeel (diacritics) and tatweel (ـ, the kashida stretch character).
 *      Present in formal spellings, absent in typed ones.
 *   3. Ta marbuta vs ha (ة / ه) and ya variants (ي / ى / ئ), which are
 *      routinely interchanged in casual writing.
 *
 * Latin names get accent folding via NFD so "José" matches "Jose".
 *
 * NFKC first (not NFC): Arabic presentation forms — the ligature ﷲ, the
 * Arabic-Indic digits ٠-٩ — decompose to their canonical equivalents only
 * under the compatibility mapping.
 */
function normalizeNameForSearch(raw) {
  if (raw === null || raw === undefined) return '';

  let s = String(raw).normalize('NFKC');

  // Strip Arabic diacritics (harakat, shadda, sukun, superscript alef,
  // Quranic annotation marks) and the tatweel stretch character.
  s = s.replace(/[ؐ-ًؚ-ٰٟۖ-ۭ]/g, '');
  s = s.replace(/ـ/g, '');

  // Fold alef forms: أ إ آ ٱ → ا
  s = s.replace(/[آأإٱ]/g, 'ا');
  // Standalone hamza and hamza-on-waw/ya → dropped to their base letters.
  s = s.replace(/ؤ/g, 'و');   // ؤ → و
  s = s.replace(/ئ/g, 'ي');   // ئ → ي
  // Alef maksura → ya: ى → ي
  s = s.replace(/ى/g, 'ي');
  // Ta marbuta → ha: ة → ه
  s = s.replace(/ة/g, 'ه');
  // Persian/Urdu keyboards produce these for Arabic letters.
  s = s.replace(/ک/g, 'ك');   // ک → ك
  s = s.replace(/[یے]/g, 'ي'); // ی ۓ → ي

  // Arabic-Indic and extended Arabic-Indic digits → ASCII.
  s = s.replace(/[٠-٩]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0x0660 + 48));
  s = s.replace(/[۰-۹]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0x06F0 + 48));

  // Latin accent folding: decompose, then drop the combining marks.
  s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');

  // Punctuation splits into two classes, and conflating them was a bug:
  //   • hyphens/underscores act as WORD SEPARATORS, so they become spaces —
  //     otherwise "Al-Masri" folds to "almasri" while "Al Masri" folds to
  //     "al masri" and the two never match.
  //   • apostrophes and periods are INTRA-word noise, so they vanish —
  //     "O'Brien" and "OBrien" are the same name.
  s = s.replace(/[-_‐-―]/g, ' ');
  s = s.replace(/[‘’'`´.,]/g, '');
  s = s.replace(/\s+/g, ' ').trim().toLowerCase();

  return s;
}

module.exports = { normalizeEmail, escapeLikePattern, normalizeNameForSearch };
