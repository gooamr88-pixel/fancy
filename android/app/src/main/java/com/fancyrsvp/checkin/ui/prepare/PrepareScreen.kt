package com.fancyrsvp.checkin.ui.prepare

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.fancyrsvp.checkin.R
import com.fancyrsvp.checkin.data.repo.BundleRepository
import com.fancyrsvp.checkin.ui.theme.StateAlready
import com.fancyrsvp.checkin.ui.theme.StateAttention
import com.fancyrsvp.checkin.ui.theme.StateNeutral
import com.fancyrsvp.checkin.ui.theme.StateWelcome
import java.text.DateFormat
import java.util.Date

/**
 * Event selection and preparation (spec §8.2).
 *
 * Two requirements from the spec drive this layout:
 *
 *  • Readiness is stated per event, prominently — green / amber / grey — because
 *    an operator's only question here is "can I leave for the venue yet".
 *  • Download progress shows REAL COUNTS, never an indeterminate spinner. On a
 *    2000-guest event over a weak connection, a spinner cannot distinguish
 *    "working" from "stalled", and the operator has to decide whether to wait.
 */
@Composable
fun PrepareScreen(
    onEventReady: (eventId: String) -> Unit,
    viewModel: PrepareViewModel = hiltViewModel(),
) {
    val events by viewModel.events.collectAsState()
    val progress by viewModel.progress.collectAsState()
    val preparingId by viewModel.preparingEventId.collectAsState()

    Surface(modifier = Modifier.fillMaxSize()) {
        Column(modifier = Modifier.fillMaxSize().padding(32.dp)) {
            Text(
                text = stringResource(R.string.prepare_title),
                style = MaterialTheme.typography.headlineLarge,
            )
            Spacer(Modifier.height(8.dp))
            // Stated explicitly, as §8.2 requires: the operator must understand
            // that connectivity is needed NOW and not at the venue.
            Text(
                text = stringResource(R.string.prepare_internet_notice),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            Spacer(Modifier.height(24.dp))

            progress?.let { current ->
                ProgressPanel(
                    progress = current,
                    onDismiss = viewModel::dismissProgress,
                )
                Spacer(Modifier.height(24.dp))
            }

            LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                items(events, key = { it.id }) { event ->
                    EventCard(
                        event = event,
                        isBusy = preparingId == event.id,
                        anyBusy = preparingId != null,
                        onPrepare = { viewModel.prepare(event.id) },
                        onOpen = { onEventReady(event.id) },
                    )
                }
            }
        }
    }
}

@Composable
private fun EventCard(
    event: PrepareViewModel.EventRow,
    isBusy: Boolean,
    anyBusy: Boolean,
    onPrepare: () -> Unit,
    onOpen: () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(20.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(event.name, style = MaterialTheme.typography.titleLarge)
                Spacer(Modifier.height(4.dp))
                Text(
                    text = listOfNotNull(
                        event.venue,
                        DateFormat.getDateTimeInstance(DateFormat.MEDIUM, DateFormat.SHORT)
                            .format(Date(event.startsAt)),
                    ).joinToString("  ·  "),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(10.dp))
                ReadinessBadge(event)
            }

            Spacer(Modifier.size(16.dp))

            when (event.readiness) {
                PrepareViewModel.Readiness.READY_OFFLINE -> Column(
                    horizontalAlignment = Alignment.End,
                ) {
                    Button(onClick = onOpen, modifier = Modifier.height(52.dp)) {
                        Text(stringResource(R.string.action_ok))
                    }
                    Spacer(Modifier.height(8.dp))
                    OutlinedButton(
                        onClick = onPrepare,
                        enabled = !anyBusy,
                        modifier = Modifier.height(44.dp),
                    ) {
                        Text(stringResource(R.string.prepare_refresh))
                    }
                }
                else -> Button(
                    onClick = onPrepare,
                    // Disabled while ANY event is preparing: two concurrent bundle
                    // downloads would compete for the same weak connection and make
                    // both slower, and the progress panel can only speak for one.
                    enabled = !anyBusy,
                    modifier = Modifier.height(52.dp),
                ) {
                    Text(
                        if (isBusy) {
                            stringResource(R.string.prepare_fetching_manifest)
                        } else {
                            stringResource(R.string.prepare_download)
                        },
                    )
                }
            }
        }
    }
}

@Composable
private fun ReadinessBadge(event: PrepareViewModel.EventRow) {
    val (color, label) = when (event.readiness) {
        PrepareViewModel.Readiness.READY_OFFLINE -> StateWelcome to
            if (event.lastSyncedAt != null) {
                stringResource(
                    R.string.prepare_ready_synced,
                    DateFormat.getTimeInstance(DateFormat.SHORT).format(Date(event.lastSyncedAt)),
                )
            } else {
                stringResource(R.string.prepare_ready)
            }
        PrepareViewModel.Readiness.NEEDS_SYNC -> StateAlready to stringResource(R.string.prepare_needs_sync)
        PrepareViewModel.Readiness.NOT_PREPARED -> StateNeutral to stringResource(R.string.prepare_not_prepared)
    }

    Row(verticalAlignment = Alignment.CenterVertically) {
        // A colour dot AND a text label. Colour alone would be unreadable to a
        // colour-blind operator, and §11 requires legibility over decoration.
        Box(modifier = Modifier.size(12.dp).clip(CircleShape).background(color))
        Spacer(Modifier.size(8.dp))
        Text(label, style = MaterialTheme.typography.bodyMedium, color = color)
        if (event.totalInvited > 0) {
            Spacer(Modifier.size(12.dp))
            Text(
                stringResource(R.string.prepare_guest_count, event.totalInvited),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun ProgressPanel(
    progress: BundleRepository.Progress,
    onDismiss: () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = when (progress) {
                is BundleRepository.Progress.Failed -> StateAttention.copy(alpha = 0.12f)
                is BundleRepository.Progress.Done -> StateWelcome.copy(alpha = 0.12f)
                else -> MaterialTheme.colorScheme.surfaceVariant
            },
        ),
    ) {
        Column(modifier = Modifier.fillMaxWidth().padding(20.dp)) {
            Text(
                text = progressText(progress),
                style = MaterialTheme.typography.titleMedium,
            )

            if (progress is BundleRepository.Progress.Downloading && progress.total > 0) {
                Spacer(Modifier.height(12.dp))
                // Determinate, driven by real counts (§8.2).
                LinearProgressIndicator(
                    progress = { progress.downloaded.toFloat() / progress.total.toFloat() },
                    modifier = Modifier.fillMaxWidth().height(8.dp),
                )
            }

            if (progress is BundleRepository.Progress.Failed || progress is BundleRepository.Progress.Done) {
                Spacer(Modifier.height(16.dp))
                OutlinedButton(onClick = onDismiss) {
                    Text(stringResource(R.string.action_dismiss))
                }
            }
        }
    }
}

@Composable
private fun progressText(progress: BundleRepository.Progress): String = when (progress) {
    BundleRepository.Progress.FetchingManifest -> stringResource(R.string.prepare_fetching_manifest)
    is BundleRepository.Progress.Downloading -> stringResource(
        R.string.prepare_downloading,
        progress.downloaded, progress.total, progress.page, progress.totalPages,
    )
    BundleRepository.Progress.Verifying -> stringResource(R.string.prepare_verifying)
    BundleRepository.Progress.Promoting -> stringResource(R.string.prepare_promoting)
    is BundleRepository.Progress.Done -> stringResource(R.string.prepare_done, progress.recordCount)
    is BundleRepository.Progress.Failed -> failureText(progress.reason)
}

@Composable
private fun failureText(failure: BundleRepository.Failure): String = when (failure) {
    BundleRepository.Failure.Offline -> stringResource(R.string.prepare_failed_offline)
    BundleRepository.Failure.NotAuthorised -> stringResource(R.string.prepare_failed_not_authorised)
    BundleRepository.Failure.FeatureNotAvailable -> stringResource(R.string.prepare_failed_feature)
    // These two say plainly that NOTHING was saved. A partially downloaded guest
    // list is the failure §21.1 exists to prevent, and it must never be left
    // looking like a partial success the operator could work with.
    is BundleRepository.Failure.Incomplete -> stringResource(
        R.string.prepare_failed_incomplete, failure.actual, failure.expected,
    )
    is BundleRepository.Failure.Corrupted -> stringResource(R.string.prepare_failed_corrupted)
    is BundleRepository.Failure.NoStorage ->
        stringResource(R.string.prepare_no_space, failure.guestCount)
    is BundleRepository.Failure.Server -> stringResource(R.string.prepare_failed_server, failure.code)
    is BundleRepository.Failure.Unknown -> stringResource(R.string.prepare_failed_unknown)
}
