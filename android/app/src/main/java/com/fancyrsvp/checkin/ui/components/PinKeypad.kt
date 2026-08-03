package com.fancyrsvp.checkin.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.fancyrsvp.checkin.R
import com.fancyrsvp.checkin.ui.theme.LocalDimens

/**
 * The PIN pad, once.
 *
 * ── Why this is shared ──
 *
 * There were two of these: one on the staff login screen and one on the
 * session-lock overlay, written separately and drifted apart — the login keys had
 * been restyled and the lock keys were still bare Material buttons. They are the
 * same control performing the same job for the same person, and a supervisor who
 * learns one and then meets the other is meeting an inconsistency the app has no
 * reason to have.
 *
 * Worse, the divergence was invisible: nothing fails when two copies of a keypad
 * disagree, it just looks unfinished at a door.
 *
 * ── An on-screen pad rather than the system keyboard ──
 *
 * The IME covers half a screen, varies by device, and can be swapped for one that
 * logs input. Large fixed keys are also simply faster for a four-digit entry made
 * repeatedly through a shift.
 *
 * The pad is a FIXED grid of fixed keys and must never be stretched or squeezed by
 * its container — a key that changes size between screens is a key that gets
 * mistyped in the dark. It takes exactly `4 x keypadKey + 3 x keypadGap` in
 * height and `3 x keypadKey + 2 x keypadGap` in width, and callers lay out around
 * that rather than the other way round.
 */
@Composable
fun PinKeypad(
    enabled: Boolean,
    onDigit: (Char) -> Unit,
    onBackspace: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val dimens = LocalDimens.current

    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(dimens.keypadGap),
    ) {
        listOf("123", "456", "789").forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(dimens.keypadGap)) {
                row.forEach { digit ->
                    KeypadKey(digit.toString(), enabled) { onDigit(digit) }
                }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(dimens.keypadGap)) {
            // Holds the zero in the centre column, under the 8, where it is on
            // every phone and every cash machine.
            Spacer(Modifier.size(dimens.keypadKey))
            KeypadKey("0", enabled) { onDigit('0') }
            // The glyph lives in strings.xml, not in Kotlin source.
            KeypadKey(stringResource(R.string.keypad_backspace), enabled) { onBackspace() }
        }
    }
}

/**
 * One key.
 *
 * A bare M3 `Button` is a flat gold pill with no edge and no elevation — twelve
 * of them in a grid read as a printed keypad graphic rather than as twelve keys.
 * A PIN is typed while a queue watches, usually without looking down, so each key
 * has to confirm its own press: it is rimmed, raised, and it moves further under
 * a finger than anything else in the app (0.92 against the usual 0.965), because
 * that movement is the only feedback an operator gets that a digit registered.
 */
@Composable
private fun KeypadKey(
    label: String,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    val dimens = LocalDimens.current
    val interactionSource = remember { MutableInteractionSource() }
    val scale = pressLift(interactionSource, pressedScale = 0.92f)

    Button(
        onClick = onClick,
        enabled = enabled,
        interactionSource = interactionSource,
        shape = RoundedCornerShape(dimens.cardRadius),
        border = if (enabled) {
            BorderStroke(1.dp, MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.28f))
        } else {
            null
        },
        elevation = ButtonDefaults.buttonElevation(
            defaultElevation = 6.dp,
            pressedElevation = 1.dp,
            disabledElevation = 0.dp,
        ),
        // Zero, so the digit centres in a square key rather than being pushed off
        // centre by Material's asymmetric default content padding.
        contentPadding = PaddingValues(0.dp),
        modifier = Modifier
            .size(dimens.keypadKey)
            .scale(scale),
    ) {
        Text(label, fontSize = dimens.keypadFontSize)
    }
}
