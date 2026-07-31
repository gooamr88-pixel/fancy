package com.fancyrsvp.checkin.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.fancyrsvp.checkin.R
import com.fancyrsvp.checkin.ui.theme.LocalDimens

/**
 * Every screen that is not the scanner.
 *
 * ── Why this exists as a component rather than a convention ──
 *
 * The rule is that no screen may be a dead end, and that the way home is always
 * large, always in the same place, and always says where it goes. A convention
 * gets forgotten the next time a screen is added; a scaffold that will not
 * compile without `onBackToScanner` does not.
 *
 * The bar sits at the BOTTOM, not the top. The tablet is held in one hand with
 * a queue in front of the operator — the bottom edge is where the thumb already
 * is, and a top-left system arrow is the single hardest control to hit
 * one-handed on a 10-inch device.
 */
@Composable
fun ScreenScaffold(
    title: String,
    onBackToScanner: () -> Unit,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    /** Actions that belong beside the title. Kept rare — usually none. */
    trailing: (@Composable RowScope.() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val dimens = LocalDimens.current

    Surface(modifier = modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(Modifier.fillMaxSize()) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(
                        start = dimens.screenPadding,
                        end = dimens.screenPadding,
                        top = dimens.screenPadding * 0.6f,
                        bottom = 8.dp,
                    ),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f)) {
                    // The title answers "where am I" in one word or two. It is
                    // never a sentence, and never repeats what the content says.
                    Text(
                        title,
                        style = MaterialTheme.typography.headlineLarge,
                        color = MaterialTheme.colorScheme.onBackground,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    subtitle?.let {
                        Spacer(Modifier.height(4.dp))
                        Text(
                            it,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
                trailing?.let {
                    Spacer(Modifier.width(16.dp))
                    it()
                }
            }

            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .padding(horizontal = dimens.screenPadding),
                content = content,
            )

            BackToScannerBar(onClick = onBackToScanner)
        }
    }
}

/**
 * The persistent way home.
 *
 * Deliberately not subtle: full width, 88dp tall, its own ground colour, a
 * drawn chevron AND the literal words "Back to scanner". The brief's rule is
 * that a small system arrow alone is never enough, and this is the answer to
 * it — an operator who has forgotten how they got somewhere can still leave.
 *
 * It returns to the SCANNER, not to the previous screen, even from two levels
 * down. That is why it can promise where it goes: one tap from anywhere lands
 * on the camera. The system back gesture still pops one level for anyone who
 * knows it.
 */
@Composable
fun BackToScannerBar(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val dimens = LocalDimens.current

    Column(modifier.fillMaxWidth()) {
        Box(
            Modifier
                .fillMaxWidth()
                .height(1.dp)
                .background(MaterialTheme.colorScheme.outline),
        )
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(min = dimens.backBarHeight)
                .background(MaterialTheme.colorScheme.surfaceVariant)
                .clickable(onClick = onClick)
                .padding(horizontal = dimens.screenPadding),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Start,
        ) {
            Chevron(color = MaterialTheme.colorScheme.primary, pointsBack = true)
            Spacer(Modifier.width(16.dp))
            Text(
                stringResource(R.string.nav_back_to_scanner),
                style = MaterialTheme.typography.titleLarge,
                color = MaterialTheme.colorScheme.primary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

/**
 * What a screen shows when it has nothing to show.
 *
 * An empty state is a dead end unless it says what to do next, so [actionLabel]
 * and [onAction] are not optional. One short sentence, then a way out.
 */
@Composable
fun EmptyState(
    message: String,
    actionLabel: String,
    onAction: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val dimens = LocalDimens.current
    Column(
        modifier = modifier.fillMaxWidth().padding(vertical = dimens.sectionGap),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(dimens.sectionGap),
    ) {
        Text(
            message,
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        SecondaryAction(text = actionLabel, onClick = onAction)
    }
}
