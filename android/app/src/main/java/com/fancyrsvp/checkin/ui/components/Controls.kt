package com.fancyrsvp.checkin.ui.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.InteractionSource
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.fancyrsvp.checkin.ui.theme.CameraScrim
import com.fancyrsvp.checkin.ui.theme.Gold
import com.fancyrsvp.checkin.ui.theme.Hairline
import com.fancyrsvp.checkin.ui.theme.LocalDimens
import com.fancyrsvp.checkin.ui.theme.Motion
import com.fancyrsvp.checkin.ui.theme.OnCamera

/**
 * The control vocabulary.
 *
 * Every interactive thing in this app is one of these. That is the point: an
 * usher hired an hour ago should be able to tell what is pressable by shape
 * alone, without reading, and there are only three shapes to learn.
 *
 * Four rules hold everywhere:
 *
 *   • Nothing is smaller than `dimens.minTouch` (64dp). Heights are read from
 *     the theme, never written as literals, so a later edit cannot quietly
 *     reintroduce a 44dp button.
 *   • Labels are WORDS, not icons. A pictogram of a torch is a guess; the word
 *     "LIGHT ON" is not, and untrained staff read faster than they decode. Where
 *     an icon appears it is BESIDE the word, never instead of it.
 *   • Every control is RAISED and RIMMED. See below.
 *   • Every control answers a finger within 90ms — see [pressLift].
 *
 * ── Why raised and rimmed ──
 *
 * These controls were flat: a filled rectangle with a word in it, no edge, no
 * shadow, no press state beyond Material's default ripple. Flat works in an
 * office, where the user knows they are looking at an app. It fails at a door:
 * the operator is glancing down at a tablet held at their side, in decorative
 * light, and a flat gold rectangle reads as a coloured panel rather than as
 * something to press. Untrained staff genuinely did not find them.
 *
 * So every control now carries three cues at once — a drop shadow that lifts it
 * off the ground, a rim that defines its edge against any surface it lands on,
 * and a press response that moves. Redundant on purpose: one of the three
 * survives whatever the venue lighting does to the other two.
 */

/**
 * The press response, as a scale factor.
 *
 * A control that changes colour on press is invisible to someone whose thumb is
 * covering it, which at a door is every press. Scale is not: the whole shape
 * moves, and the movement is visible around the finger.
 *
 * Pass the same [interactionSource] to the clickable and to this, or the button
 * animates for a press it did not receive.
 */
@Composable
fun pressLift(interactionSource: InteractionSource, pressedScale: Float = 0.965f): Float {
    val pressed by interactionSource.collectIsPressedAsState()
    val scale by animateFloatAsState(
        targetValue = if (pressed) pressedScale else 1f,
        animationSpec = Motion.press(),
        label = "pressLift",
    )
    return scale
}

/**
 * Turns any layout into one of this app's controls.
 *
 * Rows, cards and chips cannot be `Button`s — they hold columns of text, badges
 * and chevrons — but they must still be recognisable as pressable, and they must
 * be recognisable in the SAME way as the real buttons or there is no vocabulary
 * to learn. This applies the three cues in one place.
 *
 * A helper rather than a convention, for the reason `safeLaunch` is a helper: the
 * next row someone adds gets it for free, and the version of this that lived as
 * six copied modifier chains had already drifted into six slightly different
 * corner radii.
 *
 * Order matters and is not adjustable by the caller: shadow must precede clip
 * (a clipped shadow is invisible), background must precede border (or the fill
 * paints over the rim), and clickable must come last (or the ripple bounds are
 * the unclipped rectangle).
 *
 * ── Why the rim defaults to the accent ──
 *
 * The obvious default is `colorScheme.outline`, and the first version used it.
 * But outline is the DIVIDER colour — it is the same hairline that separates two
 * paragraphs, and a hairline that means "edge of a thing" cannot also mean "press
 * this". Defaulting to gold makes one rule for staff to learn and only one:
 * a gold edge with a shadow under it is something you can press. Nothing that is
 * not pressable in this app has one.
 */
@Composable
fun Modifier.pressableSurface(
    onClick: () -> Unit,
    shape: Shape,
    container: Color = MaterialTheme.colorScheme.surface,
    borderColor: Color = MaterialTheme.colorScheme.primary.copy(alpha = 0.4f),
    elevation: Dp = 3.dp,
    borderWidth: Dp = 1.dp,
    pressedScale: Float = 0.965f,
    enabled: Boolean = true,
): Modifier {
    val interactionSource = remember { MutableInteractionSource() }
    val scale = pressLift(interactionSource, pressedScale)

    return this
        .scale(if (enabled) scale else 1f)
        .shadow(if (enabled) elevation else 0.dp, shape, clip = false)
        .clip(shape)
        .background(container)
        .border(BorderStroke(borderWidth, borderColor), shape)
        .clickable(
            interactionSource = interactionSource,
            indication = null,
            enabled = enabled,
            onClick = onClick,
        )
}

/** The one thing to do on a screen. Full width by default, gold, unmissable. */
@Composable
fun PrimaryAction(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    containerColor: Color = MaterialTheme.colorScheme.primary,
    contentColor: Color = MaterialTheme.colorScheme.onPrimary,
    hero: Boolean = false,
) {
    val dimens = LocalDimens.current
    val interactionSource = remember { MutableInteractionSource() }
    val scale = pressLift(interactionSource)

    Button(
        onClick = onClick,
        enabled = enabled,
        interactionSource = interactionSource,
        shape = RoundedCornerShape(dimens.cardRadius),
        colors = ButtonDefaults.buttonColors(
            containerColor = containerColor,
            contentColor = contentColor,
            // A disabled primary keeps its shape and loses its saturation. It
            // must still read as "the button, not yet" rather than vanishing.
            disabledContainerColor = containerColor.copy(alpha = 0.28f),
            disabledContentColor = contentColor.copy(alpha = 0.55f),
        ),
        // M3's filled Button ships with ZERO elevation by default, which is the
        // single reason these read as painted panels rather than as keys. A hero
        // sits higher than a standard action so the difference between "the one
        // thing to do" and "a thing you may do" survives a glance.
        elevation = ButtonDefaults.buttonElevation(
            defaultElevation = if (hero) 10.dp else 6.dp,
            pressedElevation = 2.dp,
            disabledElevation = 0.dp,
        ),
        // The rim is the content colour at low alpha, so it works on gold, on the
        // error red, and on anything a caller passes — rather than a fixed line
        // that disappears against half of them.
        border = if (enabled) BorderStroke(1.dp, contentColor.copy(alpha = 0.22f)) else null,
        contentPadding = PaddingValues(horizontal = 32.dp, vertical = 16.dp),
        modifier = modifier
            .fillMaxWidth()
            .scale(scale)
            .heightIn(min = if (hero) dimens.heroButtonHeight else dimens.buttonHeight),
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.titleLarge,
            textAlign = TextAlign.Center,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

/**
 * An alternative that is genuinely available, not a lesser primary.
 *
 * FILLED, not transparent. It was an outline on the page ground, which on this
 * app's warm parchment is a thin gold rectangle around some text — closer to a
 * bordered paragraph than to a key. It now has its own surface and a shadow, so
 * it is unmistakably an object sitting on the page. The 2dp gold border is what
 * keeps it subordinate to the solid-gold primary beside it.
 */
@Composable
fun SecondaryAction(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    contentColor: Color = MaterialTheme.colorScheme.onBackground,
    borderColor: Color = MaterialTheme.colorScheme.primary,
) {
    val dimens = LocalDimens.current
    val interactionSource = remember { MutableInteractionSource() }
    val scale = pressLift(interactionSource)

    OutlinedButton(
        onClick = onClick,
        enabled = enabled,
        interactionSource = interactionSource,
        shape = RoundedCornerShape(dimens.cardRadius),
        border = BorderStroke(2.dp, if (enabled) borderColor else Hairline),
        colors = ButtonDefaults.outlinedButtonColors(
            containerColor = MaterialTheme.colorScheme.surface,
            contentColor = contentColor,
            disabledContainerColor = MaterialTheme.colorScheme.surface,
        ),
        elevation = ButtonDefaults.buttonElevation(
            defaultElevation = if (enabled) 3.dp else 0.dp,
            pressedElevation = 1.dp,
            disabledElevation = 0.dp,
        ),
        contentPadding = PaddingValues(horizontal = 28.dp, vertical = 14.dp),
        modifier = modifier
            .scale(scale)
            .heightIn(min = dimens.buttonHeight),
    ) {
        Text(
            text = text,
            // Was titleMedium. A secondary is a lesser CHOICE, not lesser text —
            // it is read at the same arm's length as everything else.
            style = MaterialTheme.typography.titleLarge,
            textAlign = TextAlign.Center,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

/**
 * Destructive, and it looks it.
 *
 * Used for closing an event and for a supervisor override — the two actions in
 * the app that cannot be taken back by the person taking them.
 */
@Composable
fun DestructiveAction(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) = PrimaryAction(
    text = text,
    onClick = onClick,
    modifier = modifier,
    enabled = enabled,
    containerColor = MaterialTheme.colorScheme.error,
    contentColor = MaterialTheme.colorScheme.onError,
)

/**
 * A quiet route out of a screen — "Not everyone?", "Cancel".
 *
 * Still 64dp tall even though it looks small. The visual weight is low on
 * purpose; the target is not.
 *
 * It keeps a hairline rim, which a text button normally does not. Low weight is
 * a statement about PRIORITY, not an excuse to make something undiscoverable —
 * bare words on a background are the one thing in this app that staff never
 * identified as pressable. The rim is the least that still says "control".
 */
@Composable
fun QuietAction(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    contentColor: Color = MaterialTheme.colorScheme.onSurfaceVariant,
) {
    val dimens = LocalDimens.current
    val interactionSource = remember { MutableInteractionSource() }
    val scale = pressLift(interactionSource)

    TextButton(
        onClick = onClick,
        interactionSource = interactionSource,
        shape = RoundedCornerShape(dimens.cardRadius),
        border = BorderStroke(1.dp, contentColor.copy(alpha = 0.4f)),
        colors = ButtonDefaults.textButtonColors(contentColor = contentColor),
        contentPadding = PaddingValues(horizontal = 24.dp, vertical = 12.dp),
        modifier = modifier
            .scale(scale)
            .heightIn(min = dimens.minTouch),
    ) {
        Text(text, style = MaterialTheme.typography.titleMedium)
    }
}

/**
 * A control drawn ON TOP OF the live camera.
 *
 * The scanner's chrome cannot use the theme's surfaces — there is no page ground
 * under it, only whatever the lens happens to be pointed at. A control here has
 * to hold its shape against a black doorway, a white marquee, and a chandelier,
 * sometimes within the same second as the operator turns.
 *
 * Four cues, all of them working at once, because any one of them can be lost to
 * what is behind it:
 *
 *   • a solid ground — the accent for the important control, a near-opaque
 *     scrim for the rest. Never a translucent tint over the preview.
 *   • a bright rim, so the edge survives even where ground and background
 *     happen to match in value.
 *   • a real drop shadow, which is what makes it read as sitting ON the camera
 *     rather than being part of the image.
 *   • an icon beside the word. Not instead of it — see the file header — but a
 *     shape is recognised from further away than a word is read, and it is what
 *     lets an operator find the control without stopping to read the row.
 *
 * @param prominent the one control on the bar that must be found first. Taller,
 *   gold, larger type. Exactly one control per bar should set this.
 */
@Composable
fun CameraAction(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    prominent: Boolean = false,
    /** Solid ground. Defaults to the accent when prominent, the scrim otherwise. */
    containerColor: Color = if (prominent) Gold else CameraScrim,
    contentColor: Color = if (prominent) Color.White else OnCamera,
    icon: (@Composable (Color) -> Unit)? = null,
) {
    val dimens = LocalDimens.current
    val interactionSource = remember { MutableInteractionSource() }
    val scale = pressLift(interactionSource)
    val shape = RoundedCornerShape(dimens.cardRadius)

    Row(
        modifier = modifier
            .scale(scale)
            .heightIn(min = if (prominent) dimens.heroButtonHeight else dimens.buttonHeight)
            // shadow BEFORE clip and background, or it is drawn inside the
            // control's own bounds and there is nothing to see.
            .shadow(if (prominent) 12.dp else 8.dp, shape, clip = false)
            .clip(shape)
            .background(containerColor)
            .border(
                width = if (prominent) 2.dp else 1.dp,
                // The rim is the CONTENT colour, not a fixed line: against a dark
                // scrim that is a pale edge, against gold it is white. Both read.
                color = contentColor.copy(alpha = if (prominent) 0.55f else 0.35f),
                shape = shape,
            )
            .clickable(interactionSource = interactionSource, indication = null, onClick = onClick)
            .padding(horizontal = 20.dp, vertical = 14.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // `?.let { it(...) }` rather than `?.invoke(...)`, matching how
        // ScreenScaffold calls its optional `trailing` slot.
        icon?.let { it(contentColor) }
        Text(
            text = text,
            // titleLarge for the prominent one. These were labelMedium — a 16sp
            // caption on the most-used control on the most-used screen.
            style = if (prominent) {
                MaterialTheme.typography.titleLarge
            } else {
                MaterialTheme.typography.titleMedium
            },
            color = contentColor,
            textAlign = TextAlign.Center,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

/**
 * A magnifying glass, drawn rather than imported.
 *
 * Same reasoning as [Chevron]: no icon dependency, no font glyph that might be
 * missing on a vendor ROM, and it scales to whatever the layout gives it. It
 * always appears beside the words "Search by name" and never replaces them.
 */
@Composable
fun MagnifierIcon(
    color: Color,
    modifier: Modifier = Modifier,
    iconSize: Dp = 30.dp,
    strokeWidth: Float = 6f,
) {
    Canvas(modifier = modifier.size(iconSize)) {
        val w = size.width
        val h = size.height
        val radius = w * 0.29f
        val centre = Offset(w * 0.42f, h * 0.42f)

        drawCircle(
            color = color,
            radius = radius,
            center = centre,
            style = Stroke(width = strokeWidth, cap = StrokeCap.Round),
        )
        // The handle leaves the circle at 45 degrees, so it starts ON the rim
        // rather than inside it — a handle that overlaps the glass reads as a
        // scribble at 30dp.
        val offset = radius * 0.707f
        drawLine(
            color = color,
            start = Offset(centre.x + offset, centre.y + offset),
            end = Offset(w * 0.9f, h * 0.9f),
            strokeWidth = strokeWidth,
            cap = StrokeCap.Round,
        )
    }
}

/** A torch beam. Beside the words "Light on" / "Light off", never instead. */
@Composable
fun TorchIcon(
    color: Color,
    modifier: Modifier = Modifier,
    iconSize: Dp = 30.dp,
    strokeWidth: Float = 6f,
) {
    Canvas(modifier = modifier.size(iconSize)) {
        val w = size.width
        val h = size.height
        // A filled bulb with three rays. Recognisable at a glance and, unlike a
        // torch body, it does not depend on the viewer knowing which end is which.
        drawCircle(color = color, radius = w * 0.2f, center = Offset(w * 0.5f, h * 0.5f))
        listOf(
            Offset(w * 0.5f, h * 0.06f) to Offset(w * 0.5f, h * 0.22f),
            Offset(w * 0.06f, h * 0.5f) to Offset(w * 0.22f, h * 0.5f),
            Offset(w * 0.94f, h * 0.5f) to Offset(w * 0.78f, h * 0.5f),
        ).forEach { (start, end) ->
            drawLine(
                color = color,
                start = start,
                end = end,
                strokeWidth = strokeWidth,
                cap = StrokeCap.Round,
            )
        }
    }
}

/** A tracked-caps label. The only place uppercase is used in the app. */
@Composable
fun SectionLabel(
    text: String,
    modifier: Modifier = Modifier,
    color: Color = MaterialTheme.colorScheme.onSurfaceVariant,
) {
    Text(
        text = text.uppercase(),
        style = MaterialTheme.typography.labelMedium,
        color = color,
        modifier = modifier,
    )
}

/** A dot plus its word. Colour never carries meaning alone (§11). */
@Composable
fun StatusDot(
    label: String,
    color: Color,
    modifier: Modifier = Modifier,
    textColor: Color = color,
) {
    Row(modifier = modifier, verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(14.dp).clip(CircleShape).background(color))
        Spacer(Modifier.width(10.dp))
        Text(
            label,
            style = MaterialTheme.typography.bodyMedium,
            color = textColor,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

/**
 * One number and what it means.
 *
 * The figure is set in the display face and the label in the UI face — the
 * weight contrast is what lets a supervisor read the number without reading
 * the label.
 */
@Composable
fun StatTile(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    accent: Color = MaterialTheme.colorScheme.onBackground,
) {
    val dimens = LocalDimens.current
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(dimens.cardRadius))
            .background(MaterialTheme.colorScheme.surfaceVariant)
            .padding(horizontal = 20.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(
            value,
            style = MaterialTheme.typography.headlineMedium,
            color = accent,
            maxLines = 1,
        )
        Text(
            label,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

/**
 * A chevron, drawn rather than imported.
 *
 * Two straight strokes on a Canvas — no icon dependency, no glyph that might
 * be missing, and it scales to whatever size the layout gives it. It always
 * appears BESIDE a word; it is never the only thing marking an action.
 *
 * @param pointsBack true draws it pointing toward the start edge.
 * @param iconSize taken as a parameter rather than a `.size()` in the caller's
 *   modifier, because chaining two `size` modifiers silently keeps the outer
 *   one and quietly ignores what the caller asked for.
 *
 *   It is NOT called `size`: inside the Canvas lambda the receiver is a
 *   DrawScope, which already has a `size` property holding the canvas bounds in
 *   pixels. A parameter of that name shadows it, so `size.width` resolves to
 *   `Dp.width` — which does not exist — and the whole block stops compiling.
 */
@Composable
fun Chevron(
    color: Color,
    modifier: Modifier = Modifier,
    pointsBack: Boolean = true,
    iconSize: Dp = 28.dp,
    strokeWidth: Float = 7f,
) {
    Canvas(modifier = modifier.size(iconSize)) {
        val w = size.width
        val h = size.height
        // Inset so the stroke's round cap is not clipped by the bounds.
        val tipX = if (pointsBack) w * 0.28f else w * 0.72f
        val baseX = if (pointsBack) w * 0.72f else w * 0.28f
        drawLine(
            color = color,
            start = Offset(baseX, h * 0.16f),
            end = Offset(tipX, h * 0.5f),
            strokeWidth = strokeWidth,
            cap = StrokeCap.Round,
        )
        drawLine(
            color = color,
            start = Offset(tipX, h * 0.5f),
            end = Offset(baseX, h * 0.84f),
            strokeWidth = strokeWidth,
            cap = StrokeCap.Round,
        )
    }
}

/**
 * PIN progress, as filled and empty discs.
 *
 * Drawn rather than typed. The previous version built a string of "●" and "○"
 * characters, which depends on the system font having those glyphs, cannot be
 * sized independently of the text baseline, and puts raw non-ASCII literals in
 * Kotlin source — a convention this codebase avoids because one altered byte in
 * a character literal has broken a cross-language contract here before.
 *
 * Large and widely spaced: a PIN is typed while people are watching, and the
 * only feedback is how many discs have filled.
 */
@Composable
fun PinDots(
    entered: Int,
    length: Int,
    modifier: Modifier = Modifier,
    color: Color = MaterialTheme.colorScheme.primary,
) {
    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(20.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        repeat(length) { index ->
            val filled = index < entered
            Box(
                Modifier
                    .size(26.dp)
                    .clip(CircleShape)
                    .background(if (filled) color else color.copy(alpha = 0.18f)),
            )
        }
    }
}

