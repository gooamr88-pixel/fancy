package com.fancyrsvp.checkin.util

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

/**
 * CROSS-LANGUAGE CONTRACT TEST — name normalisation for search.
 *
 * Two implementations must agree:
 *   • backend/utils/normalize.js         → normalizeNameForSearch()
 *   • android/.../util/NameNormalizer.kt → normalize()
 *
 * The device search is the primary path (§8.5) but the web kiosk hits the server
 * one. A divergence means staff at one door get different results from staff at
 * another for the same query — noticed only at a venue, mid-event, with a queue
 * forming.
 *
 * The vectors below are pinned identically in
 * backend/test/checkinNameNormalizeContract.test.js and were produced by running
 * the real server implementation.
 *
 * Every Arabic string is built from CODE POINTS, never written literally. A
 * combining mark in a source file is invisible in review and in a diff, and an
 * editor's encoding normalisation can silently alter it — while what is being
 * asserted is an exact sequence of code points.
 */
class NameNormalizerTest {

    /** Builds a string from code points, so nothing depends on file encoding. */
    private fun s(vararg cps: Int): String = buildString { cps.forEach { append(it.toChar()) } }

    // ── Arabic letters, by code point ──
    private val ALEF = 0x0627
    private val ALEF_MADDA = 0x0622
    private val ALEF_HAMZA_ABOVE = 0x0623
    private val ALEF_HAMZA_BELOW = 0x0625
    private val ALEF_WASLA = 0x0671
    private val BEH = 0x0628
    private val TEH = 0x062A
    private val HAH = 0x062D
    private val DAL = 0x062F
    private val REH = 0x0631
    private val SEEN = 0x0633
    private val TAH = 0x0637
    private val AIN = 0x0639
    private val FEH = 0x0641
    private val KAF = 0x0643
    private val LAM = 0x0644
    private val MEEM = 0x0645
    private val NOON = 0x0646
    private val HA = 0x0647
    private val WAW = 0x0648
    private val ALEF_MAKSURA = 0x0649
    private val YA = 0x064A
    private val TA_MARBUTA = 0x0629
    private val HAMZA_ON_WAW = 0x0624
    private val HAMZA_ON_YA = 0x0626
    private val PERSIAN_KAF = 0x06A9
    private val SAD = 0x0635
    private val QAF = 0x0642

    // Diacritics
    private val DAMMA = 0x064F
    private val FATHA = 0x064E
    private val SHADDA = 0x0651
    private val TATWEEL = 0x0640

    // Digits
    private val ARABIC_FIVE = 0x0665

    private fun assertNormalizes(input: String, expected: String) {
        assertEquals(
            "input=${input.map { it.code.toString(16) }}",
            expected,
            NameNormalizer.normalize(input),
        )
    }

    // ══════════════════════════════════════════════════════════
    // Alef variants — the most common Arabic search failure
    // ══════════════════════════════════════════════════════════

    @Test
    fun `CONTRACT alef variants all fold to bare alef`() {
        val bare = s(ALEF, HAH, MEEM, DAL) // احمد
        for (first in listOf(ALEF_HAMZA_ABOVE, ALEF_HAMZA_BELOW, ALEF_MADDA, ALEF_WASLA, ALEF)) {
            assertNormalizes(s(first, HAH, MEEM, DAL), bare)
        }
    }

    // ══════════════════════════════════════════════════════════
    // Diacritics and tatweel
    // ══════════════════════════════════════════════════════════

    @Test
    fun `CONTRACT tashkeel is ignored`() {
        // مُحَمَّد -> محمد
        assertNormalizes(
            s(MEEM, DAMMA, HAH, FATHA, MEEM, FATHA, SHADDA, DAL),
            s(MEEM, HAH, MEEM, DAL),
        )
    }

    @Test
    fun `CONTRACT tatweel is ignored`() {
        assertNormalizes(
            s(MEEM, HAH, TATWEEL, TATWEEL, MEEM, DAL),
            s(MEEM, HAH, MEEM, DAL),
        )
    }

    // ══════════════════════════════════════════════════════════
    // Letter interchange
    // ══════════════════════════════════════════════════════════

    @Test
    fun `CONTRACT ta marbuta folds to ha`() {
        val expected = s(FEH, ALEF, TAH, MEEM, HA) // فاطمه
        assertNormalizes(s(FEH, ALEF, TAH, MEEM, TA_MARBUTA), expected)
        assertNormalizes(s(FEH, ALEF, TAH, MEEM, HA), expected)
    }

    @Test
    fun `CONTRACT alef maksura folds to ya`() {
        val expected = s(AIN, LAM, YA) // علي
        assertNormalizes(s(AIN, LAM, YA), expected)
        assertNormalizes(s(AIN, LAM, ALEF_MAKSURA), expected)
    }

    @Test
    fun `CONTRACT hamza on waw and hamza on ya drop to base letters`() {
        // رؤوف -> رووف
        assertNormalizes(s(REH, HAMZA_ON_WAW, WAW, FEH), s(REH, WAW, WAW, FEH))
        // مسائل -> مسايل
        assertNormalizes(
            s(MEEM, SEEN, ALEF, HAMZA_ON_YA, LAM),
            s(MEEM, SEEN, ALEF, YA, LAM),
        )
    }

    @Test
    fun `CONTRACT the Persian kaf folds to Arabic kaf`() {
        assertNormalizes(s(PERSIAN_KAF, REH, YA, MEEM), s(KAF, REH, YA, MEEM))
    }

    // ══════════════════════════════════════════════════════════
    // Digits
    // ══════════════════════════════════════════════════════════

    @Test
    fun `CONTRACT Arabic-Indic digits fold to ASCII`() {
        // طاولة ٥ -> طاوله 5
        assertNormalizes(
            s(TAH, ALEF, WAW, LAM, TA_MARBUTA, 0x0020, ARABIC_FIVE),
            s(TAH, ALEF, WAW, LAM, HA, 0x0020) + "5",
        )
    }

    // ══════════════════════════════════════════════════════════
    // Latin
    // ══════════════════════════════════════════════════════════

    @Test
    fun `CONTRACT Latin accents fold`() {
        assertNormalizes("Jos" + 0x00E9.toChar(), "jose")
        assertNormalizes("Zo" + 0x00EB.toChar(), "zoe")
        assertNormalizes("Fran" + 0x00E7.toChar() + "ois", "francois")
    }

    @Test
    fun `CONTRACT apostrophes vanish and hyphens become spaces`() {
        assertNormalizes("O'Brien", "obrien")
        assertNormalizes("D" + 0x2019.toChar() + "Angelo", "dangelo")
        assertNormalizes("Al-Masri", "al masri")
        assertNormalizes("Anne-Marie", "anne marie")
    }

    @Test
    fun `CONTRACT whitespace collapses and case folds`() {
        assertNormalizes("  Alice   Smith  ", "alice smith")
        assertNormalizes("ALICE SMITH", "alice smith")
    }

    @Test
    fun `CONTRACT a non-breaking space is treated as whitespace`() {
        // Java's \s does not cover NBSP, hence the explicit class in
        // NameNormalizer. Without it a pasted name would be unfindable on the
        // device while remaining findable on the web kiosk.
        assertNormalizes("Alice" + 0x00A0.toChar() + "Smith", "alice smith")
    }

    // ══════════════════════════════════════════════════════════
    // Realistic and mixed
    // ══════════════════════════════════════════════════════════

    @Test
    fun `CONTRACT a realistic full name matches its casually-typed form`() {
        // أحمد عبد الله الأنصاري -> احمد عبد الله الانصاري
        val input = s(
            ALEF_HAMZA_ABOVE, HAH, MEEM, DAL, 0x0020,
            AIN, BEH, DAL, 0x0020,
            ALEF, LAM, LAM, HA, 0x0020,
            ALEF, LAM, ALEF_HAMZA_ABOVE, NOON, SAD, ALEF, REH, YA,
        )
        val expected = s(
            ALEF, HAH, MEEM, DAL, 0x0020,
            AIN, BEH, DAL, 0x0020,
            ALEF, LAM, LAM, HA, 0x0020,
            ALEF, LAM, ALEF, NOON, SAD, ALEF, REH, YA,
        )
        assertNormalizes(input, expected)
    }

    @Test
    fun `CONTRACT a mixed-script name keeps both scripts`() {
        assertNormalizes(s(ALEF, HAH, MEEM, DAL) + " Smith", s(ALEF, HAH, MEEM, DAL) + " smith")
    }

    // ══════════════════════════════════════════════════════════
    // Guarantees the caller depends on
    // ══════════════════════════════════════════════════════════

    @Test
    fun `null and blank input return empty string, never a crash`() {
        assertEquals("", NameNormalizer.normalize(null))
        assertEquals("", NameNormalizer.normalize(""))
        assertEquals("", NameNormalizer.normalize("   "))
    }

    @Test
    fun `normalisation is idempotent`() {
        val inputs = listOf(
            s(ALEF_HAMZA_ABOVE, HAH, MEEM, DAL),
            "Jos" + 0x00E9.toChar() + "-Mar" + 0x00ED.toChar() + "a",
            "O'Brien",
            s(MEEM, DAMMA, HAH, FATHA, MEEM, FATHA, SHADDA, DAL),
        )
        for (input in inputs) {
            val once = NameNormalizer.normalize(input)
            assertEquals("not idempotent", once, NameNormalizer.normalize(once))
        }
    }

    @Test
    fun `distinct people still do not collide`() {
        // Folding must not be so aggressive that different names merge — that is
        // worse than failing to match, because staff would admit the wrong guest.
        assertNotEquals(
            NameNormalizer.normalize(s(ALEF, HAH, MEEM, DAL)),
            NameNormalizer.normalize(s(MEEM, HAH, MEEM, DAL)),
        )
        assertNotEquals(
            NameNormalizer.normalize(s(SEEN, ALEF, REH, TA_MARBUTA)),
            NameNormalizer.normalize(s(SEEN, MEEM, YA, REH, TA_MARBUTA)),
        )
        assertNotEquals(
            NameNormalizer.normalize("Alice"),
            NameNormalizer.normalize("Alicia"),
        )
    }

    @Test
    fun `substring matching works on the normalised form - this is how search uses it`() {
        val full = NameNormalizer.normalize(
            s(ALEF_HAMZA_ABOVE, HAH, MEEM, DAL, 0x0020, AIN, BEH, DAL),
        )
        val needle = NameNormalizer.normalize(s(AIN, BEH, DAL))
        org.junit.Assert.assertTrue(full.contains(needle))
    }

    @Test
    fun `lowercasing is locale-invariant so a Turkish tablet cannot diverge`() {
        // toLowerCase(Locale("tr")) maps I to a dotless i. If NameNormalizer used
        // the default locale, every name with an I would normalise differently
        // from the server on a Turkish-locale device.
        val previous = java.util.Locale.getDefault()
        try {
            java.util.Locale.setDefault(java.util.Locale("tr", "TR"))
            assertEquals("ismail", NameNormalizer.normalize("ISMAIL"))
        } finally {
            java.util.Locale.setDefault(previous)
        }
    }
}
