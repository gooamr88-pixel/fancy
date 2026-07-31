package com.fancyrsvp.checkin.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.fancyrsvp.checkin.ui.theme.Hairline
import com.fancyrsvp.checkin.ui.theme.LocalDimens

/**
 * The control vocabulary.
 *
 * Every interactive thing in this app is one of these. That is the point: an
 * usher hired an hour ago should be able to tell what is pressable by shape
 * alone, without reading, and there are only three shapes to learn.
 *
 * Two rules hold everywhere:
 *
 *   • Nothing is smaller than `dimens.minTouch` (64dp). Heights are read from
 *     the theme, never written as literals, so a later edit cannot quietly
 *     reintroduce a 44dp button.
 *   • Labels are WORDS, not icons. A pictogram of a torch is a guess; the word
 *     "LIGHT ON" is not, and untrained staff read faster than they decode.
 */

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
    Button(
        onClick = onClick,
        enabled = enabled,
        shape = RoundedCornerShape(dimens.cardRadius),
        colors = ButtonDefaults.buttonColors(
            containerColor = containerColor,
            contentColor = contentColor,
            // A disabled primary keeps its shape and loses its saturation. It
            // must still read as "the button, not yet" rather than vanishing.
            disabledContainerColor = containerColor.copy(alpha = 0.28f),
            disabledContentColor = contentColor.copy(alpha = 0.55f),
        ),
        contentPadding = PaddingValues(horizontal = 32.dp, vertical = 16.dp),
        modifier = modifier
            .fillMaxWidth()
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

/** An alternative that is genuinely available, not a lesser primary. */
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
    OutlinedButton(
        onClick = onClick,
        enabled = enabled,
        shape = RoundedCornerShape(dimens.cardRadius),
        border = BorderStroke(2.dp, if (enabled) borderColor else Hairline),
        colors = ButtonDefaults.outlinedButtonColors(contentColor = contentColor),
        contentPadding = PaddingValues(horizontal = 28.dp, vertical = 14.dp),
        modifier = modifier.heightIn(min = dimens.buttonHeight),
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.titleMedium,
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
 */
@Composable
fun QuietAction(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    contentColor: Color = MaterialTheme.colorScheme.onSurfaceVariant,
) {
    val dimens = LocalDimens.current
    TextButton(
        onClick = onClick,
        colors = ButtonDefaults.textButtonColors(contentColor = contentColor),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 12.dp),
        modifier = modifier.heightIn(min = dimens.minTouch),
    ) {
        Text(text, style = MaterialTheme.typography.titleMedium)
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

