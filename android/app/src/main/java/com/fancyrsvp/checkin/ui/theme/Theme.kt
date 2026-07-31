package com.fancyrsvp.checkin.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

/*
 * Colours live in Palette.kt. This file is the scheme and the type ramp only.
 */

private val DayScheme = lightColorScheme(
    primary = Gold,
    // White on Gold is 4.86:1 — the button label clears AA at any size.
    onPrimary = Color.White,
    primaryContainer = SurfaceWarm,
    onPrimaryContainer = Ink,
    secondary = InkMuted,
    onSecondary = Color.White,
    background = Parchment,
    onBackground = Ink,
    surface = SurfacePure,
    onSurface = Ink,
    surfaceVariant = SurfaceWarm,
    onSurfaceVariant = InkMuted,
    error = StateAttention,
    onError = Color.White,
    outline = Hairline,
    outlineVariant = Color(0xFFF0EAE0),
)

private val NightScheme = darkColorScheme(
    primary = GoldLift,
    onPrimary = NightGround,
    primaryContainer = NightSurfaceHigh,
    onPrimaryContainer = OnNight,
    secondary = OnNightMuted,
    onSecondary = NightGround,
    background = NightGround,
    onBackground = OnNight,
    surface = NightSurface,
    onSurface = OnNight,
    surfaceVariant = NightSurfaceHigh,
    onSurfaceVariant = OnNightMuted,
    error = Color(0xFFE0745F),
    onError = NightGround,
    outline = Color(0xFF3A352E),
)

/**
 * The type ramp, sized for a tablet held at arm's length in dim light.
 *
 * ── Two rules ──
 *
 * 1. NOTHING below 16sp, at either scale. This is the floor that killed the old
 *    12sp compact label.
 * 2. Real weight contrast between a NAME and a LABEL. Guest names, tables and
 *    counts take the display face at Normal weight and negative tracking;
 *    every control and label takes the UI face at Bold with positive tracking.
 *    Setting both in one face at one weight is most of why the old screens read
 *    flat — the eye had nothing to rank.
 *
 * Negative tracking on the large display sizes is not decorative: a display
 * face set above 40sp falls apart into individual letters without it.
 */
private val TabletTypography = Typography(
    // The guest name on the result screen. The largest thing in the ramp — the
    // table number is larger still, but it is computed per-string, not a role.
    displayLarge = TextStyle(fontFamily = DisplayFont, fontSize = 60.sp, lineHeight = 66.sp, letterSpacing = (-1.2).sp),
    displayMedium = TextStyle(fontFamily = DisplayFont, fontSize = 44.sp, lineHeight = 50.sp, letterSpacing = (-0.8).sp),
    headlineLarge = TextStyle(fontFamily = DisplayFont, fontSize = 36.sp, lineHeight = 42.sp, letterSpacing = (-0.4).sp),
    headlineMedium = TextStyle(fontFamily = DisplayFont, fontSize = 28.sp, lineHeight = 34.sp),
    // Primary actions. Bold, because a button that shares a weight with body
    // text does not read as pressable.
    titleLarge = TextStyle(fontFamily = UiFont, fontSize = 24.sp, lineHeight = 30.sp, fontWeight = FontWeight.Bold),
    titleMedium = TextStyle(fontFamily = UiFont, fontSize = 20.sp, lineHeight = 26.sp, fontWeight = FontWeight.Medium),
    bodyLarge = TextStyle(fontFamily = UiFont, fontSize = 20.sp, lineHeight = 28.sp),
    bodyMedium = TextStyle(fontFamily = UiFont, fontSize = 18.sp, lineHeight = 25.sp),
    // Defined rather than inherited. Material's default bodySmall is 12sp, and
    // the one place this is used — a crash report an operator has to read off a
    // tablet and retype into a message — is the worst possible place for it.
    bodySmall = TextStyle(fontFamily = UiFont, fontSize = 16.sp, lineHeight = 22.sp),
    labelLarge = TextStyle(fontFamily = UiFont, fontSize = 20.sp, lineHeight = 26.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.3.sp),
    // Tracked caps. The wide tracking is what makes a short caps label look set
    // rather than shouted.
    labelMedium = TextStyle(fontFamily = UiFont, fontSize = 18.sp, lineHeight = 24.sp, fontWeight = FontWeight.Bold, letterSpacing = 2.0.sp),
    labelSmall = TextStyle(fontFamily = UiFont, fontSize = 16.sp, lineHeight = 22.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.6.sp),
)

/**
 * The same ramp for screens under 600dp. NOT a second design — see Dimens.
 *
 * Body sizes stop at 16sp rather than scaling proportionally, because that is
 * the floor for reading at any distance.
 */
private val CompactTypography = Typography(
    displayLarge = TextStyle(fontFamily = DisplayFont, fontSize = 40.sp, lineHeight = 46.sp, letterSpacing = (-0.8).sp),
    displayMedium = TextStyle(fontFamily = DisplayFont, fontSize = 32.sp, lineHeight = 38.sp, letterSpacing = (-0.5).sp),
    headlineLarge = TextStyle(fontFamily = DisplayFont, fontSize = 26.sp, lineHeight = 32.sp),
    headlineMedium = TextStyle(fontFamily = DisplayFont, fontSize = 22.sp, lineHeight = 28.sp),
    titleLarge = TextStyle(fontFamily = UiFont, fontSize = 20.sp, lineHeight = 26.sp, fontWeight = FontWeight.Bold),
    titleMedium = TextStyle(fontFamily = UiFont, fontSize = 18.sp, lineHeight = 24.sp, fontWeight = FontWeight.Medium),
    bodyLarge = TextStyle(fontFamily = UiFont, fontSize = 17.sp, lineHeight = 24.sp),
    bodyMedium = TextStyle(fontFamily = UiFont, fontSize = 16.sp, lineHeight = 22.sp),
    bodySmall = TextStyle(fontFamily = UiFont, fontSize = 16.sp, lineHeight = 22.sp),
    labelLarge = TextStyle(fontFamily = UiFont, fontSize = 17.sp, lineHeight = 23.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.3.sp),
    labelMedium = TextStyle(fontFamily = UiFont, fontSize = 16.sp, lineHeight = 21.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.6.sp),
    labelSmall = TextStyle(fontFamily = UiFont, fontSize = 16.sp, lineHeight = 21.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.4.sp),
)

/**
 * @param darkTheme defaults to FALSE, deliberately — not to the system setting.
 *
 * This is kiosk hardware. Every tablet at an event must look identical: a
 * supervisor comparing two gates should not find one parchment and one charcoal
 * because somebody enabled dark mode on one of them, and a device swapped in
 * mid-event must not visibly differ from the one it replaced.
 */
@Composable
fun FancyCheckinTheme(
    darkTheme: Boolean = false,
    content: @Composable () -> Unit,
) {
    val dimens = currentDimens()
    val compact = dimens === Dimens.Compact

    MaterialTheme(
        // Dynamic colour is deliberately NOT used. The event's own brand colour
        // arrives in the bundle (§9.8), and letting the tablet's wallpaper
        // recolour a white-labelled app would undermine the point of it.
        colorScheme = if (darkTheme) NightScheme else DayScheme,
        typography = if (compact) CompactTypography else TabletTypography,
    ) {
        // Provided here rather than read per-screen so every composable below
        // sees one consistent set — a screen mixing tablet padding with compact
        // type would be worse than either.
        CompositionLocalProvider(LocalDimens provides dimens, content = content)
    }
}
