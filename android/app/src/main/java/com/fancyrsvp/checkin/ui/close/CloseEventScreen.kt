package com.fancyrsvp.checkin.ui.close

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.fancyrsvp.checkin.R
import com.fancyrsvp.checkin.ui.theme.StateAttention
import com.fancyrsvp.checkin.ui.theme.StateWelcome

/**
 * Closing an event and purging local data (spec §20.5).
 *
 * The purge button does not exist in the Blocked state. It is not disabled, not
 * greyed, not behind a confirmation — it is absent. §20.5 requires the purge be
 * BLOCKED while the queue is non-empty, and a disabled button invites someone to look
 * for the way around it. Those check-ins exist on this tablet and nowhere else.
 */
@Composable
fun CloseEventScreen(
    eventId: String,
    onClosed: () -> Unit,
    onBack: () -> Unit,
    viewModel: CloseEventViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()

    LaunchedEffect(eventId) { viewModel.start(eventId) }

    Surface(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier.fillMaxSize().padding(48.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Text(
                stringResource(R.string.close_title),
                style = MaterialTheme.typography.headlineLarge,
            )
            Spacer(Modifier.height(32.dp))

            when (val current = state) {
                CloseEventViewModel.State.Loading -> CircularProgressIndicator()

                is CloseEventViewModel.State.Blocked -> {
                    Text(
                        stringResource(R.string.close_blocked_title),
                        style = MaterialTheme.typography.headlineMedium,
                        color = StateAttention,
                        fontWeight = FontWeight.Bold,
                    )
                    Spacer(Modifier.height(16.dp))
                    Text(
                        stringResource(R.string.close_blocked_body, current.pending),
                        style = MaterialTheme.typography.titleMedium,
                        textAlign = TextAlign.Center,
                    )
                    if (current.stalled > 0) {
                        Spacer(Modifier.height(12.dp))
                        // Distinguished because waiting will NOT fix a stalled entry.
                        Text(
                            stringResource(R.string.close_blocked_stalled, current.stalled),
                            style = MaterialTheme.typography.bodyLarge,
                            color = StateAttention,
                            textAlign = TextAlign.Center,
                        )
                    }
                    Spacer(Modifier.height(32.dp))
                    Button(
                        onClick = viewModel::retrySync,
                        modifier = Modifier.height(64.dp).widthIn(min = 300.dp),
                    ) {
                        Text(stringResource(R.string.close_retry_sync))
                    }
                    Spacer(Modifier.height(12.dp))
                    OutlinedButton(onClick = viewModel::refresh, modifier = Modifier.height(56.dp)) {
                        Text(stringResource(R.string.action_retry))
                    }
                }

                is CloseEventViewModel.State.Ready -> {
                    Text(
                        stringResource(R.string.close_ready, current.arrived, current.guests),
                        style = MaterialTheme.typography.titleLarge,
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
                    Spacer(Modifier.height(40.dp))
                    Button(
                        onClick = viewModel::purge,
                        colors = ButtonDefaults.buttonColors(containerColor = StateAttention),
                        modifier = Modifier.height(72.dp).widthIn(min = 360.dp),
                    ) {
                        Text(
                            stringResource(R.string.close_purge),
                            style = MaterialTheme.typography.titleMedium,
                        )
                    }
                }

                CloseEventViewModel.State.Purging -> {
                    CircularProgressIndicator()
                    Spacer(Modifier.height(16.dp))
                    Text(stringResource(R.string.close_purging), style = MaterialTheme.typography.titleMedium)
                }

                is CloseEventViewModel.State.Purged -> {
                    Text(
                        stringResource(R.string.close_purged),
                        style = MaterialTheme.typography.headlineMedium,
                        color = StateWelcome,
                        textAlign = TextAlign.Center,
                    )
                    Spacer(Modifier.height(32.dp))
                    Button(onClick = onClosed, modifier = Modifier.height(64.dp).widthIn(min = 280.dp)) {
                        Text(stringResource(R.string.action_ok))
                    }
                }

                is CloseEventViewModel.State.Failed -> {
                    Text(
                        current.reason,
                        style = MaterialTheme.typography.titleMedium,
                        color = StateAttention,
                        textAlign = TextAlign.Center,
                    )
                    Spacer(Modifier.height(24.dp))
                    OutlinedButton(onClick = viewModel::refresh, modifier = Modifier.height(56.dp)) {
                        Text(stringResource(R.string.action_retry))
                    }
                }
            }

            Spacer(Modifier.height(32.dp))
            OutlinedButton(onClick = onBack, modifier = Modifier.height(56.dp)) {
                Text(stringResource(R.string.action_cancel))
            }
        }
    }
}
