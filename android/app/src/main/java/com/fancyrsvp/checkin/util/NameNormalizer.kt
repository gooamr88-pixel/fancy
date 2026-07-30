package com.fancyrsvp.checkin.util

import java.text.Normalizer

/**
 * Name normalisation for SEARCH MATCHING (spec §8.5).
 *
 * Never use this for display. Guest names are rendered exactly as stored, never
 * transliterated or folded (§9.9) — this produces a match key, not a name.
 *
 * ── This must match the server exactly ──
 *
 * Ported from backend/utils/normalize.js (`normalizeNameForSearch`). The device
 * search is the primary path, but the web kiosk hits the server implementation;
 * if the two diverge, staff at one door get different results from staff at
 * another for the same query. Locked together by golden vectors in
 * NameNormalizerTest and backend/test/checkinNameNormalizeContract.test.js.
 *
 * ── Why every character set is built from NUMBERS ──
 *
 * The code points below were extracted from the running server implementation,
 * not transcribed by eye, and they are assembled into regex patterns
 * programmatically. Writing them as literal Arabic would put invisible combining
 * marks into this source file: they cannot be reviewed, they vanish in a diff,
 * and an editor's encoding normalisation can silently alter them. A single
 * altered code point here makes some guests unfindable on the device while they
 * remain findable on the web kiosk — a bug that would only ever surface at a
 * door, mid-event.
 *
 * ── Why the Arabic handling is not optional ──
 *
 *   1. Alef/hamza variants: U+0622/23/25/0671 and bare alef are one person to
 *      everyone except a byte comparison. Staff type whatever their keyboard
 *      emits.
 *   2. Tashkeel and tatweel appear in formal spellings, not typed ones.
 *   3. Ta marbuta vs ha, and the ya variants, are freely interchanged.
 *
 * Without this the search is unusable on an Arabic guest list, which is most of
 * this product's market.
 */
object NameNormalizer {

    // ── Code points, mirroring backend/utils/normalize.js ──

    private const val CP_TATWEEL = 0x0640
    private const val CP_ALEF = 0x0627
    private const val CP_WAW = 0x0648
    private const val CP_YA = 0x064A
    private const val CP_HA = 0x0647
    private const val CP_KAF = 0x0643

    private const val CP_HAMZA_ON_WAW = 0x0624
    private const val CP_HAMZA_ON_YA = 0x0626
    private const val CP_ALEF_MAKSURA = 0x0649
    private const val CP_TA_MARBUTA = 0x0629
    private const val CP_PERSIAN_KAF = 0x06A9

    private const val CP_ARABIC_ZERO = 0x0660
    private const val CP_EXT_ARABIC_ZERO = 0x06F0

    /** Builds a regex character class from code-point ranges. */
    private fun charClass(vararg ranges: IntRange): Regex {
        val sb = StringBuilder("[")
        for (r in ranges) {
            sb.append(uEscape(r.first))
            if (r.last != r.first) {
                sb.append('-').append(uEscape(r.last))
            }
        }
        sb.append(']')
        return Regex(sb.toString())
    }

    /**
     * The regex escape TEXT for a code point: 0x0610 becomes the six characters
     * backslash-u-0-6-1-0, which java.util.regex resolves. Deliberately builds
     * the escape rather than the character, so no Arabic ever appears literally
     * in this file.
     */
    private fun uEscape(cp: Int): String = "\\u" + String.format("%04x", cp)

    private fun cp(value: Int): String = value.toChar().toString()

    // Harakat, shadda, sukun, superscript alef, and the Quranic annotation marks.
    private val ARABIC_DIACRITICS = charClass(
        0x0610..0x061A,
        0x064B..0x065F,
        0x0670..0x0670,
        0x06D6..0x06ED,
    )

    // Alef with madda / hamza above / hamza below / wasla.
    private val ALEF_FORMS = charClass(
        0x0622..0x0623,
        0x0625..0x0625,
        0x0671..0x0671,
    )

    // Persian/Urdu ya forms: U+06CC and U+06D2.
    private val PERSIAN_YA_FORMS = charClass(0x06CC..0x06CC, 0x06D2..0x06D2)

    private val ARABIC_INDIC_DIGITS = charClass(0x0660..0x0669)
    private val EXTENDED_ARABIC_INDIC_DIGITS = charClass(0x06F0..0x06F9)

    /** Latin combining marks, dropped after an NFD decomposition. */
    private val COMBINING_MARKS = charClass(0x0300..0x036F)

    /**
     * Hyphens and underscores act as WORD SEPARATORS, so they become spaces.
     * Otherwise "Al-Masri" folds to "almasri" while "Al Masri" folds to
     * "al masri" and the two never match. Covers the Unicode dash range so an
     * en/em dash behaves like an ASCII hyphen.
     */
    private val WORD_SEPARATORS = charClass(
        0x002D..0x002D,
        0x005F..0x005F,
        0x2010..0x2015,
    )

    /**
     * Apostrophes, backtick, acute accent, period and comma are INTRA-word noise
     * and vanish: "O'Brien" and "OBrien" are the same name.
     */
    private val INTRA_WORD_NOISE = charClass(
        0x0027..0x0027,
        0x002C..0x002C,
        0x002E..0x002E,
        0x0060..0x0060,
        0x00B4..0x00B4,
        0x2018..0x2019,
    )

    /**
     * Whitespace, matching JavaScript's `\s` rather than Java's.
     *
     * Java's `\s` is only [ \t\n\x0B\f\r]; JavaScript's also covers NBSP and the
     * Unicode space separators. NFKC folds most of those to U+0020, but ZWNBSP
     * and the line/paragraph separators survive it — and one stray NBSP in a
     * pasted guest name would otherwise normalise differently on the two
     * platforms and make that guest unfindable on one of them.
     */
    private val WHITESPACE = Regex(
        "(?:" + charClass(
            0x0009..0x000D,
            0x0020..0x0020,
            0x00A0..0x00A0,
            0x1680..0x1680,
            0x2000..0x200A,
            0x2028..0x2029,
            0x202F..0x202F,
            0x205F..0x205F,
            0x3000..0x3000,
            0xFEFF..0xFEFF,
        ).pattern + ")+",
    )

    fun normalize(raw: String?): String {
        if (raw.isNullOrEmpty()) return ""

        // NFKC (not NFC): Arabic presentation forms and the Arabic-Indic digits
        // only decompose to their canonical equivalents under the compatibility
        // mapping.
        var s = Normalizer.normalize(raw, Normalizer.Form.NFKC)

        s = ARABIC_DIACRITICS.replace(s, "")
        s = s.replace(cp(CP_TATWEEL), "")

        s = ALEF_FORMS.replace(s, cp(CP_ALEF))
        s = s.replace(cp(CP_HAMZA_ON_WAW), cp(CP_WAW))
        s = s.replace(cp(CP_HAMZA_ON_YA), cp(CP_YA))
        s = s.replace(cp(CP_ALEF_MAKSURA), cp(CP_YA))
        s = s.replace(cp(CP_TA_MARBUTA), cp(CP_HA))
        s = s.replace(cp(CP_PERSIAN_KAF), cp(CP_KAF))
        s = PERSIAN_YA_FORMS.replace(s, cp(CP_YA))

        s = ARABIC_INDIC_DIGITS.replace(s) { m ->
            (m.value[0].code - CP_ARABIC_ZERO + '0'.code).toChar().toString()
        }
        s = EXTENDED_ARABIC_INDIC_DIGITS.replace(s) { m ->
            (m.value[0].code - CP_EXT_ARABIC_ZERO + '0'.code).toChar().toString()
        }

        // Latin accent folding.
        s = Normalizer.normalize(s, Normalizer.Form.NFD)
        s = COMBINING_MARKS.replace(s, "")

        s = WORD_SEPARATORS.replace(s, " ")
        s = INTRA_WORD_NOISE.replace(s, "")
        s = WHITESPACE.replace(s, " ").trim()

        // lowercase() and NOT toLowerCase(Locale.getDefault()): a tablet's
        // default locale could be Turkish, where I maps to a dotless i, and every
        // name containing an I would then normalise differently from the server.
        // Kotlin's lowercase() is locale-invariant.
        return s.lowercase()
    }
}
