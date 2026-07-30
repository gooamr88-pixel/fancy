package com.fancyrsvp.checkin.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance

/**
 * White-label branding (spec §9.8).
 *
 * "The event's primary colour and logo, downloaded during preparation, are applied
 * to the app chrome, the welcome screen, and the entrance display. Assets must be
 * cached locally; the branding must render with no network access."
 *
 * Colour arrives in the bundle as a hex string from `events.custom_colors.primary`.
 * There is no per-event logo column on this platform (amendment A-5 / decision
 * D-19), so branding is colour-only for v1 and this file does not pretend otherwise.
 *
 * ── Why the accent is contrast-corrected rather than used raw ──
 *
 * An organizer can pick any colour, including a pale champagne or a near-black
 * navy. §11 requires 4.5:1 contrast on all status states, and §8.4 requires the
 * result screen to be readable at arm's length in a dim entrance. A raw brand colour
 * used as text on a dark surface can fail both — so it is adjusted toward legibility
 * while keeping its hue. A brand colour nobody can read is worse branding than a
 * slightly adjusted one.
 */
object EventBranding {

    /** Parses `#RRGGBB` or `#AARRGGBB`, returning null on anything unexpected. */
    fun parseHex(hex: String?): Color? {
        val value = hex?.trim()?.removePrefix("#") ?: return null
        if (value.length != 6 && value.length != 8) return null
        val parsed = value.toLongOrNull(16) ?: return null
        return when (value.length) {
            6 -> Color(0xFF000000L or parsed)
            else -> Color(parsed)
        }
    }

    /**
     * The event accent, adjusted so it remains legible against [background].
     *
     * Falls back to the Fancy gold when the event has no colour or an unparseable
     * one — never to an invisible default.
     */
    fun accentFor(hex: String?, background: Color): Color {
        val raw = parseHex(hex) ?: Gold
        return ensureContrast(raw, background)
    }

    /**
     * Lightens or darkens [foreground] until it clears the WCAG AA ratio against
     * [background], preserving hue.
     *
     * Bounded iteration rather than solving analytically: the loop is at most 20
     * steps, runs once per branding change, and an exact solve would still need
     * clamping at the extremes where a colour simply cannot reach the target.
     */
    fun ensureContrast(
        foreground: Color,
        background: Color,
        target: Double = MIN_CONTRAST,
    ): Color {
        if (contrastRatio(foreground, background) >= target) return foreground

        // Move away from the background: lighten on dark, darken on light.
        val towardLight = background.luminance() < 0.5f
        var candidate = foreground

        repeat(MAX_ADJUST_STEPS) {
            candidate = if (towardLight) candidate.lighten(ADJUST_STEP) else candidate.darken(ADJUST_STEP)
            if (contrastRatio(candidate, background) >= target) return candidate
        }

        // Could not reach the target while keeping the hue — fall back to plain
        // white or black, which always clears it. Legibility wins over branding.
        return if (towardLight) Color.White else Color.Black
    }

    /** WCAG relative-luminance contrast ratio, 1.0 to 21.0. */
    fun contrastRatio(a: Color, b: Color): Double {
        val la = a.luminance() + 0.05
        val lb = b.luminance() + 0.05
        return if (la > lb) la / lb.toDouble() else lb / la.toDouble()
    }

    private fun Color.lighten(fraction: Float) = Color(
        red = red + (1f - red) * fraction,
        green = green + (1f - green) * fraction,
        blue = blue + (1f - blue) * fraction,
        alpha = alpha,
    )

    private fun Color.darken(fraction: Float) = Color(
        red = red * (1f - fraction),
        green = green * (1f - fraction),
        blue = blue * (1f - fraction),
        alpha = alpha,
    )

    private const val MIN_CONTRAST = 4.5
    private const val ADJUST_STEP = 0.10f
    private const val MAX_ADJUST_STEPS = 20
}

/** Convenience for composables: the event accent against the current background. */
@Composable
fun eventAccent(brandingHex: String?): Color =
    EventBranding.accentFor(brandingHex, MaterialTheme.colorScheme.background)
