package com.fancyrsvp.checkin.ui.theme

import androidx.compose.ui.graphics.Color
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Event branding (spec §9.8) and its contrast floor (§11).
 *
 * These are pure colour maths, so they run on the JVM. Worth testing because an
 * organizer can pick any colour at all, and the failure mode of getting this wrong
 * is a scan result screen that an usher cannot read in a dim entrance — which §8.4
 * makes the single most important screen in the product.
 */
class EventBrandingTest {

    private val darkSurface = Color(0xFF191B1E) // Charcoal
    private val lightSurface = Color(0xFFF8F4EC) // Ivory

    // ══════════════════════════════════════════════════════════════
    // Parsing
    // ══════════════════════════════════════════════════════════════

    @Test
    fun `six-digit hex parses opaque`() {
        assertEquals(Color(0xFFB8944F), EventBranding.parseHex("#B8944F"))
    }

    @Test
    fun `a leading hash is optional and whitespace is tolerated`() {
        assertEquals(Color(0xFFB8944F), EventBranding.parseHex("B8944F"))
        assertEquals(Color(0xFFB8944F), EventBranding.parseHex("  #B8944F  "))
    }

    @Test
    fun `lowercase hex parses`() {
        assertEquals(Color(0xFFB8944F), EventBranding.parseHex("#b8944f"))
    }

    @Test
    fun `eight-digit hex keeps its alpha`() {
        assertEquals(Color(0x80B8944F), EventBranding.parseHex("#80B8944F"))
    }

    @Test
    fun `malformed input returns null rather than a wrong colour`() {
        // An organizer's colour arrives from a jsonb column that nothing strongly
        // validates, so every one of these is reachable.
        for (bad in listOf(null, "", "   ", "#", "#12", "#1234", "#12345", "#GGGGGG", "red", "#1234567")) {
            assertNull("expected null for ${'"'}$bad${'"'}", EventBranding.parseHex(bad))
        }
    }

    // ══════════════════════════════════════════════════════════════
    // Fallback — never an invisible default
    // ══════════════════════════════════════════════════════════════

    @Test
    fun `a missing or unparseable colour falls back to the Fancy gold`() {
        for (bad in listOf(null, "", "not-a-colour")) {
            val accent = EventBranding.accentFor(bad, darkSurface)
            assertNotNull(accent)
            assertTrue(
                "fallback must be legible on charcoal",
                EventBranding.contrastRatio(accent, darkSurface) >= 4.5,
            )
        }
    }

    // ══════════════════════════════════════════════════════════════
    // Contrast — the §11 floor, on any organizer colour
    // ══════════════════════════════════════════════════════════════

    @Test
    fun `an already-legible colour is returned untouched`() {
        // Gold on charcoal already clears AA; adjusting it would needlessly shift the
        // brand.
        val gold = Color(0xFFB8944F)
        assertEquals(gold, EventBranding.ensureContrast(gold, darkSurface))
    }

    @Test
    fun `a near-black brand colour is lightened until legible on a dark surface`() {
        val nearBlack = Color(0xFF14171A)
        val fixed = EventBranding.ensureContrast(nearBlack, darkSurface)
        assertTrue(
            "expected >=4.5, got ${EventBranding.contrastRatio(fixed, darkSurface)}",
            EventBranding.contrastRatio(fixed, darkSurface) >= 4.5,
        )
    }

    @Test
    fun `a pale brand colour is darkened until legible on a light surface`() {
        val paleChampagne = Color(0xFFFAF3E4)
        val fixed = EventBranding.ensureContrast(paleChampagne, lightSurface)
        assertTrue(
            "expected >=4.5, got ${EventBranding.contrastRatio(fixed, lightSurface)}",
            EventBranding.contrastRatio(fixed, lightSurface) >= 4.5,
        )
    }

    @Test
    fun `every colour on the wheel ends up legible on both surfaces`() {
        // The real guarantee: whatever an organizer picks, an usher can read it.
        var checked = 0
        for (r in 0..255 step 51) {
            for (g in 0..255 step 51) {
                for (b in 0..255 step 51) {
                    val raw = Color(red = r / 255f, green = g / 255f, blue = b / 255f)
                    for (surface in listOf(darkSurface, lightSurface)) {
                        val fixed = EventBranding.ensureContrast(raw, surface)
                        val ratio = EventBranding.contrastRatio(fixed, surface)
                        assertTrue(
                            "rgb($r,$g,$b) on $surface gave ratio $ratio",
                            ratio >= 4.4, // 4.4 not 4.5: float luminance rounding
                        )
                        checked++
                    }
                }
            }
        }
        assertTrue("expected a real sweep", checked > 200)
    }

    @Test
    fun `a colour that cannot keep its hue and clear the floor falls back to white or black`() {
        // Mid-grey against a mid-grey surface: no amount of hue-preserving adjustment
        // reaches AA, so legibility must win over branding.
        val midGrey = Color(0xFF808080)
        val midSurface = Color(0xFF7A7A7A)
        val fixed = EventBranding.ensureContrast(midGrey, midSurface)
        assertTrue(
            "expected a legible extreme, got $fixed",
            fixed == Color.White || fixed == Color.Black ||
                EventBranding.contrastRatio(fixed, midSurface) >= 4.5,
        )
    }

    // ══════════════════════════════════════════════════════════════
    // Contrast ratio itself
    // ══════════════════════════════════════════════════════════════

    @Test
    fun `black on white is the maximum ratio`() {
        val ratio = EventBranding.contrastRatio(Color.Black, Color.White)
        assertTrue("expected ~21, got $ratio", ratio > 20.5 && ratio <= 21.5)
    }

    @Test
    fun `a colour against itself is the minimum ratio`() {
        assertEquals(1.0, EventBranding.contrastRatio(darkSurface, darkSurface), 0.01)
    }

    @Test
    fun `the ratio is symmetric`() {
        val a = Color(0xFFB8944F)
        val b = darkSurface
        assertEquals(
            EventBranding.contrastRatio(a, b),
            EventBranding.contrastRatio(b, a),
            0.0001,
        )
    }
}
