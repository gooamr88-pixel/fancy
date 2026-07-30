package com.fancyrsvp.checkin.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

/** Fancy RSVP's palette, shared with the web platform. */
val Gold = Color(0xFFB8944F)
val GoldHover = Color(0xFFA6833F)
val Champagne = Color(0xFFD7BE80)
val Charcoal = Color(0xFF191B1E)
val Ivory = Color(0xFFF8F4EC)
val Stone = Color(0xFF77736A)
val BorderTint = Color(0xFFE8E2D6)

/**
 * Scan-result state colours (§8.4).
 *
 * Each state must be unmistakable at arm's length, in a dim and decoratively-lit
 * entrance, to someone who is not looking directly at the screen. Colour alone
 * never carries the meaning — every state also has distinct text and layout, both
 * because §11 requires 4.5:1 contrast and because a colour-blind usher must be
 * able to work the door.
 */
val StateWelcome = Color(0xFF2E7D5B)
val StateVip = Gold
val StateAlready = Color(0xFFC8871B)
val StateNeutral = Stone
val StateAttention = Color(0xFFB03A2E)

private val DarkScheme = darkColorScheme(
    primary = Gold,
    onPrimary = Charcoal,
    primaryContainer = GoldHover,
    onPrimaryContainer = Ivory,
    secondary = Champagne,
    onSecondary = Charcoal,
    background = Charcoal,
    onBackground = Ivory,
    surface = Color(0xFF22252A),
    onSurface = Ivory,
    surfaceVariant = Color(0xFF2C3036),
    onSurfaceVariant = Color(0xFFCFC9BC),
    error = StateAttention,
    onError = Ivory,
    outline = Stone,
)

private val LightScheme = lightColorScheme(
    primary = GoldHover,
    onPrimary = Ivory,
    primaryContainer = Champagne,
    onPrimaryContainer = Charcoal,
    secondary = Stone,
    onSecondary = Ivory,
    background = Ivory,
    onBackground = Charcoal,
    surface = Color.White,
    onSurface = Charcoal,
    surfaceVariant = Color(0xFFF1ECE1),
    onSurfaceVariant = Color(0xFF4A4741),
    error = StateAttention,
    onError = Ivory,
    outline = BorderTint,
)

/**
 * Type scale sized for a tablet held at arm's length.
 *
 * Deliberately larger than Material's defaults throughout. §8.4 requires the scan
 * result to be readable in under a second by someone glancing at it, and §11
 * requires all text legible at arm's length — Material's 16sp body is sized for a
 * phone at reading distance, not a tablet on a stand at a door.
 */
private val CheckinTypography = Typography(
    displayLarge = TextStyle(fontSize = 72.sp, lineHeight = 80.sp, fontWeight = FontWeight.Bold),
    displayMedium = TextStyle(fontSize = 56.sp, lineHeight = 64.sp, fontWeight = FontWeight.Bold),
    headlineLarge = TextStyle(fontSize = 40.sp, lineHeight = 48.sp, fontWeight = FontWeight.SemiBold),
    headlineMedium = TextStyle(fontSize = 32.sp, lineHeight = 40.sp, fontWeight = FontWeight.SemiBold),
    titleLarge = TextStyle(fontSize = 26.sp, lineHeight = 32.sp, fontWeight = FontWeight.SemiBold),
    titleMedium = TextStyle(fontSize = 22.sp, lineHeight = 28.sp, fontWeight = FontWeight.Medium),
    bodyLarge = TextStyle(fontSize = 20.sp, lineHeight = 28.sp),
    bodyMedium = TextStyle(fontSize = 18.sp, lineHeight = 24.sp),
    labelLarge = TextStyle(fontSize = 18.sp, lineHeight = 24.sp, fontWeight = FontWeight.Medium),
)

@Composable
fun FancyCheckinTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        // Dynamic colour is deliberately NOT used. The event's own brand colour
        // arrives in the bundle (§9.8), and letting the tablet's wallpaper recolour
        // a white-labelled app would undermine the whole point of it.
        colorScheme = if (darkTheme) DarkScheme else LightScheme,
        typography = CheckinTypography,
        content = content,
    )
}
