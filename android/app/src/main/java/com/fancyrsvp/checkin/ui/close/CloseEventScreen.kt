package com.fancyrsvp.checkin.ui.close

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.fancyrsvp.checkin.R
import com.fancyrsvp.checkin.ui.components.DestructiveAction
import com.fancyrsvp.checkin.ui.components.PrimaryAction
import com.fancyrsvp.checkin.ui.components.ScreenScaffold
import com.fancyrsvp.checkin.ui.components.ScrollableCenteredColumn
import com.fancyrsvp.checkin.ui.components.SecondaryAction
import com.fancyrsvp.checkin.ui.theme.LocalDimens
import com.fancyrsvp.checkin.ui.theme.StateAttention
import com.fancyrsvp.checkin.ui.theme.StateWelcome

/**
 * Closing an event and purging local data (spec §20.5).
 *
 * The purge button does not exist in the Blocked state. It is not disabled, not
 * greyed, not behind a confirmation — it is absent. §20.5 requires the purge be
 * BLOCKED while the queue is non-empty, and a disabled button invites someone to
 * look for the way around it. Those check-ins exist on this tablet and nowhere
 * else.
 *
 * The copy was cut back so it no longer competes with the action for vertical
 * space, and the scroll was removed on the strength of that. It is back: cutting
 * the copy shortened the CONTENT, but the "blocked" state still runs a heading,
 * up to three lines and two stacked buttons, and a phone in landscape has about
 * 270dp to put them in. Short content is still centred exactly as before — see
 * [ScrollableCenteredColumn] — so nothing changes on a tablet.
 */
@Composable
fun CloseEventScreen(
    eventId: String,
    onClosed: () -> Unit,
    onBackToScanner: () -> Unit,
    viewModel: CloseEventViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()
    val dimens = LocalDimens.current

    LaunchedEffect(eventId) { viewModel.start(eventId) }

    ScreenScaffold(
        title = stringResource(R.string.close_title),
        onBackToScanner = onBackToScanner,
    ) {
        // The "blocked" state is the tallest thing on this screen — a heading, two
        // or three explanatory lines, a hero button and a secondary — and it is
        // also the state an operator is most likely to meet, because it appears
        // whenever the queue has not drained. It does not fit a landscape phone,
        // and clipping it takes away the retry button.
        ScrollableCenteredColumn {
            Column(
                modifier = Modifier.widthIn(max = 640.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                when (val current = state) {
                    CloseEventViewModel.State.Loading -> CircularProgressIndicator()

                    is CloseEventViewModel.State.Blocked -> {
                        Text(
                            stringResource(R.string.close_blocked_title),
                            style = MaterialTheme.typography.displayMedium,
                            color = StateAttention,
                            textAlign = TextAlign.Center,
                        )
                        Spacer(Modifier.height(16.dp))
                        Text(
                            stringResource(R.string.close_blocked_body, current.pending),
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onBackground,
                            textAlign = TextAlign.Center,
                        )
                        if (current.stalled > 0) {
                            Spacer(Modifier.height(12.dp))
                            // Distinguished because waiting will NOT fix a
                            // stalled entry.
                            Text(
                                stringResource(R.string.close_blocked_stalled, current.stalled),
                                style = MaterialTheme.typography.bodyLarge,
                                color = StateAttention,
                                textAlign = TextAlign.Center,
                            )
                        }
                        Spacer(Modifier.height(dimens.sectionGap))
                        PrimaryAction(
                            text = stringResource(R.string.close_retry_sync),
                            onClick = viewModel::retrySync,
                            hero = true,
                        )
                        Spacer(Modifier.height(12.dp))
                        SecondaryAction(
                            text = stringResource(R.string.action_retry),
                            onClick = viewModel::refresh,
                        )
                    }

                    is CloseEventViewModel.State.Ready -> {
                        Text(
                            stringResource(R.string.close_ready, current.arrived, current.guests),
                            style = MaterialTheme.typography.headlineLarge,
                            color = StateWelcome,
                            textAlign = TextAlign.Center,
                        )
                        Spacer(Modifier.height(16.dp))
                        Text(
                            stringResource(R.string.close_purge_explain),
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            textAlign = TextAlign.Center,
                        )
                        Spacer(Modifier.height(dimens.sectionGap))
                        // The destructive action, and it looks destructive.
                        DestructiveAction(
                            text = stringResource(R.string.close_purge),
                            onClick = viewModel::purge,
                        )
                    }

                    CloseEventViewModel.State.Purging -> {
                        CircularProgressIndicator()
                        Spacer(Modifier.height(16.dp))
                        Text(
                            stringResource(R.string.close_purging),
                            style = MaterialTheme.typography.titleMedium,
                            color = MaterialTheme.colorScheme.onBackground,
                        )
                    }

                    is CloseEventViewModel.State.Purged -> {
                        Text(
                            stringResource(R.string.close_purged),
                            style = MaterialTheme.typography.headlineLarge,
                            color = StateWelcome,
                            textAlign = TextAlign.Center,
                        )
                        Spacer(Modifier.height(dimens.sectionGap))
                        PrimaryAction(
                            text = stringResource(R.string.action_ok),
                            onClick = onClosed,
                            hero = true,
                        )
                    }

                    is CloseEventViewModel.State.Failed -> {
                        Text(
                            current.reason,
                            style = MaterialTheme.typography.headlineMedium,
                            color = StateAttention,
                            textAlign = TextAlign.Center,
                        )
                        Spacer(Modifier.height(dimens.sectionGap))
                        SecondaryAction(
                            text = stringResource(R.string.action_retry),
                            onClick = viewModel::refresh,
                        )
                    }
                }
            }
        }
    }
}
