package com.fancyrsvp.checkin.ui.theme

import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Screen-size-aware dimensions.
 *
 * ── The floors ──
 *
 * Two numbers are absolute and are not design choices:
 *
 *   • No touch target below 64dp. The operator is holding a tablet in one hand,
 *     in dim light, with a queue in front of them. Android's own 48dp minimum
 *     assumes a phone held in two hands under good light.
 *   • No text below 16sp, at EITHER scale. The previous compact ramp went to
 *     12sp, which is unreadable at arm's length on any device.
 *
 * Everything else may be tuned. These may not.
 *
 * ── Compact is a fallback, not a second design ──
 *
 * The target device is an 8-inch-or-larger tablet, and the tablet values ARE
 * the product. Compact exists so the app degrades honestly on hardware it was
 * not built for, rather than clipping controls off the edge of the screen.
 *
 * The widest row is the PIN keypad. Measured against a 360dp phone:
 *
 *     padding    24 x 2               =  48dp   -> 312dp usable
 *     keypad     3 x 72 + 2 x 10      = 236dp   -> fits
 *     code field min                  = 240dp   -> fits
 *     primary action, full width      = 312dp   -> fits
 *
 * A clipped keypad is not cosmetic: a PIN cannot be typed with a column of keys
 * off the edge, and there is no scroll to reach them.
 *
 * 600dp is Android's own compact/medium boundary and matches the 8-inch floor
 * in §4 — every 8-inch tablet reports 600dp or more in its shortest dimension.
 */
data class Dimens(
    /** Outer padding on a full-screen column. */
    val screenPadding: Dp,
    /** Gap between major blocks. */
    val sectionGap: Dp,
    /** Inner padding of a card. */
    val cardPadding: Dp,
    /**
     * The absolute minimum for anything tappable. Never below 64dp.
     *
     * Read this instead of writing a height literal on a control, so a later
     * edit cannot quietly reintroduce a 44dp button.
     */
    val minTouch: Dp,
    /** Standard height of a primary or secondary action. */
    val buttonHeight: Dp,
    /** The one action on the result screen. Larger than everything else. */
    val heroButtonHeight: Dp,
    /** The persistent way home. Large enough to hit without looking. */
    val backBarHeight: Dp,
    /** One key on the PIN pad. Also its own touch target. */
    val keypadKey: Dp,
    val keypadGap: Dp,
    /** Minimum width of the pairing-code field. */
    val codeFieldMin: Dp,
    val codeFieldMax: Dp,
    /** Corner radius on cards and wells. */
    val cardRadius: Dp,
    /**
     * The scanner's persistent status bar. Thin by requirement.
     *
     * Also the height of the MENU control that sits in it, so it may never drop
     * below [minTouch] — a 60dp bar makes the only visible way into the menu a
     * sub-minimum target.
     */
    val statusBarHeight: Dp,
    /** The oversized digits on the PIN and pairing screens. */
    val codeFontSize: TextUnit,
    val keypadFontSize: TextUnit,
) {
    companion object {
        /**
         * The product. An arm's-length scale for a tablet held at a door.
         */
        val Tablet = Dimens(
            screenPadding = 56.dp,
            sectionGap = 32.dp,
            cardPadding = 28.dp,
            minTouch = 64.dp,
            buttonHeight = 72.dp,
            heroButtonHeight = 88.dp,
            backBarHeight = 88.dp,
            keypadKey = 96.dp,
            keypadGap = 14.dp,
            codeFieldMin = 320.dp,
            codeFieldMax = 480.dp,
            cardRadius = 20.dp,
            statusBarHeight = 68.dp,
            codeFontSize = 44.sp,
            keypadFontSize = 34.sp,
        )

        /**
         * Fallback for anything under 600dp. Every value is derived so the
         * widest row fits a 360dp screen — see the arithmetic in the class doc.
         *
         * Note that [minTouch] does NOT shrink. It is a floor, not a scale.
         */
        val Compact = Dimens(
            screenPadding = 24.dp,
            sectionGap = 20.dp,
            cardPadding = 18.dp,
            minTouch = 64.dp,
            buttonHeight = 64.dp,
            heroButtonHeight = 72.dp,
            backBarHeight = 72.dp,
            keypadKey = 72.dp,
            keypadGap = 10.dp,
            codeFieldMin = 240.dp,
            codeFieldMax = 320.dp,
            cardRadius = 16.dp,
            // Not 60dp: the MENU control fills this height and must clear the
            // 64dp floor.
            statusBarHeight = 64.dp,
            codeFontSize = 32.sp,
            keypadFontSize = 27.sp,
        )
    }
}

/**
 * Defaults to Tablet so a composable rendered outside the theme — a preview, a
 * test — gets the real design rather than the fallback.
 */
val LocalDimens = staticCompositionLocalOf { Dimens.Tablet }

/** Picks the set for the current screen. Read this, never a raw dp literal. */
@Composable
@ReadOnlyComposable
fun currentDimens(): Dimens =
    if (LocalConfiguration.current.screenWidthDp >= COMPACT_WIDTH_BREAKPOINT) {
        Dimens.Tablet
    } else {
        Dimens.Compact
    }

const val COMPACT_WIDTH_BREAKPOINT = 600
