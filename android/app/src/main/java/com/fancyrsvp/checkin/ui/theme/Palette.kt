package com.fancyrsvp.checkin.ui.theme

import androidx.compose.ui.graphics.Color

/**
 * The colour system.
 *
 * ── One accent ──
 *
 * Deep gold #8A6D34 is the ONLY accent in the app. Every previous gold
 * (#B8944F, #A6833F, champagne #D7BE80) is gone. A door tool with three
 * near-identical golds reads as an unfinished theme, not as a brand.
 *
 * ── How the four scan states are separated ──
 *
 * The requirement is that an usher recognises the state from across a room,
 * in dim decorative light, without looking directly at the screen. That rules
 * out hue as the primary carrier: peripheral vision is close to colour-blind,
 * and amber venue lighting shifts every warm hue toward every other warm hue.
 *
 * So the states are separated by VALUE first and hue second:
 *
 *   Welcome        DARK   deep green
 *   VIP welcome    DARK   gold        + shimmer + double haptic
 *   Already        LIGHT  warm sand, flooded with an amber band
 *   Not found      LIGHT  neutral, no accent colour at all
 *
 * Dark-vs-light survives peripheral vision. Within each pair the second signal
 * finishes the job: VIP moves and buzzes differently from Welcome, and Already
 * is flooded with colour where Not-found is deliberately colourless.
 *
 * ── Contrast ──
 *
 * Every ratio below is computed with the WCAG relative-luminance formula (the
 * same one Compose's `Color.luminance()` implements), not judged by eye. §11
 * requires 4.5:1. Values are stated so a later edit cannot quietly break one.
 */

// ── Brand ────────────────────────────────────────────────────────────────────

/** The single accent. 4.86:1 on white, 4.55:1 on [Parchment] — both pass AA. */
val Gold = Color(0xFF8A6D34)

/** Pressed and hover states only. NEVER used as text: 3.6:1 on white fails AA. */
val GoldLift = Color(0xFFA8873F)

/** Warm near-black. 16.7:1 on [Parchment]. */
val Ink = Color(0xFF1A1714)

/** Secondary text. 5.67:1 on [Parchment] — passes AA at any size. */
val InkMuted = Color(0xFF6B6154)

/** The app ground. Warm, but bright enough to hold contrast on a backlit LCD. */
val Parchment = Color(0xFFFAF7F2)

val SurfacePure = Color(0xFFFFFFFF)

/** Cards and wells. */
val SurfaceWarm = Color(0xFFF2EDE4)

/** Dividers and card edges. Decorative only — never carries meaning. */
val Hairline = Color(0xFFE3DACB)

// ── Scan-result grounds ──────────────────────────────────────────────────────
//
// These are FULL-SCREEN grounds, not tints. The previous design washed 18%
// alpha across the left third of a near-white screen, which at three metres
// is indistinguishable from a blank white screen in all four states.

/** Welcome. 6.82:1 against [OnWelcome]. */
val GroundWelcome = Color(0xFF1B5E43)
val OnWelcome = Color(0xFFF4F1EA)

/**
 * VIP welcome — the accent itself, at full bleed. 4.55:1 against [OnVip].
 *
 * Tight but passing, and every element on this screen is large text (60sp name,
 * 104sp+ table, 18sp bold labels), for which AA asks only 3:1. The state is
 * additionally carried by motion and by a distinct double haptic, so it is
 * recognised before it is read.
 */
val GroundVip = Gold
val OnVip = Color(0xFFFBF7EE)

/** Already arrived. Light, to invert the value of both welcome states. 7.77:1. */
val GroundAlready = Color(0xFFEFE3CE)
val OnAlready = Color(0xFF5C3D10)

/** The band that floods the already-arrived screen. 4.65:1 on [GroundAlready]. */
val BandAlready = Color(0xFF8A5A18)

/**
 * Not found. Deliberately colourless.
 *
 * A guest standing at this screen has done nothing wrong, and neither has the
 * usher. Calm is communicated by the ABSENCE of a state colour rather than by
 * a softer one — there is no such thing as a reassuring red. 15.3:1 with [Ink].
 */
val GroundNotFound = Color(0xFFF2EDE4)

// ── Status accents, for use on light surfaces ────────────────────────────────
//
// These name the same four states but as INK on a normal screen — status dots,
// badges, the guest list, the menu. They are not the full-screen grounds above.

/** 5.31:1 on [Parchment]. */
val StateWelcome = Color(0xFF1F6B4C)

/** 4.55:1 on [Parchment]. */
val StateVip = Gold

/** 4.65:1 on [Parchment]. */
val StateAlready = Color(0xFF8A5A18)

/** 5.67:1 on [Parchment]. */
val StateNeutral = InkMuted

/** Destructive actions and hard faults only. 6.92:1 on [Parchment]. */
val StateAttention = Color(0xFF9C2F1E)

// ── Camera overlay ───────────────────────────────────────────────────────────
//
// The scanner draws chrome over a live camera feed, where no theme surface
// colour is legible. These are the only colours allowed on top of the preview.

/** Scrim behind the scanner's status bar and controls. */
val CameraScrim = Color(0xCC0A0908)

/** Text and icons on [CameraScrim]. */
val OnCamera = Color(0xFFF6F2EA)

// ── Night scheme ─────────────────────────────────────────────────────────────
//
// Retained but not the product (see FancyCheckinTheme). A venue that mounts
// tablets against a dark wall may want it later.

val NightGround = Color(0xFF171512)
val NightSurface = Color(0xFF201D19)
val NightSurfaceHigh = Color(0xFF2A2621)
val OnNight = Color(0xFFF2EEE6)
val OnNightMuted = Color(0xFFB8B0A2)
