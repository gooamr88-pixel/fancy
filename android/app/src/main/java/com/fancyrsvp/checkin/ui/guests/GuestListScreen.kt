package com.fancyrsvp.checkin.ui.guests

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.fancyrsvp.checkin.R
import com.fancyrsvp.checkin.ui.components.EmptyState
import com.fancyrsvp.checkin.ui.components.ScreenScaffold
import com.fancyrsvp.checkin.ui.components.SecondaryAction
import com.fancyrsvp.checkin.ui.theme.LocalDimens
import com.fancyrsvp.checkin.ui.theme.StateNeutral
import com.fancyrsvp.checkin.ui.theme.StateVip
import com.fancyrsvp.checkin.ui.theme.StateWelcome
import com.fancyrsvp.checkin.ui.theme.displayFamilyFor
import kotlinx.coroutines.launch
import java.text.DateFormat
import java.util.Date

/**
 * Browsable guest list (spec §8.7) and the supervisor undo (§9.6).
 *
 * Filters are exactly those the spec names — all, arrived, not arrived, VIP, by
 * table — because they are the shapes the real question takes at a door: "has
 * the bride's aunt arrived", "who is still outstanding on table 12", "are all
 * the VIPs in".
 *
 * Two changes from the previous version, both about the door rather than the
 * list: the way out is now the persistent bar rather than a button labelled
 * "Dismiss", and rows are a full touch target tall, because this is scrolled
 * with a thumb while the tablet is held in one hand.
 */
@Composable
fun GuestListScreen(
    eventId: String,
    isSupervisor: Boolean,
    onBackToScanner: () -> Unit,
    viewModel: GuestListViewModel = hiltViewModel(),
) {
    val rows by viewModel.rows.collectAsState()
    val filter by viewModel.filter.collectAsState()
    val tableFilter by viewModel.tableFilter.collectAsState()
    val tables by viewModel.tables.collectAsState()
    val loading by viewModel.loading.collectAsState()
    val dimens = LocalDimens.current

    var undoTarget by remember { mutableStateOf<GuestListViewModel.Row?>(null) }

    LaunchedEffect(eventId) { viewModel.start(eventId) }

    ScreenScaffold(
        title = stringResource(R.string.guests_title),
        subtitle = stringResource(R.string.guests_showing, rows.size),
        onBackToScanner = onBackToScanner,
    ) {
        LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            items(GuestListViewModel.Filter.entries.toList()) { option ->
                Chip(
                    label = option.label(),
                    selected = filter == option,
                    onClick = { viewModel.setFilter(option) },
                )
            }
        }

        if (tables.isNotEmpty()) {
            Spacer(Modifier.height(10.dp))
            LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                item {
                    Chip(
                        label = stringResource(R.string.guests_all_tables),
                        selected = tableFilter == null,
                        onClick = { viewModel.setTableFilter(null) },
                    )
                }
                items(tables) { table ->
                    Chip(
                        label = table,
                        selected = tableFilter == table,
                        onClick = { viewModel.setTableFilter(table) },
                    )
                }
            }
        }

        Spacer(Modifier.height(dimens.sectionGap))

        when {
            loading -> Text(
                stringResource(R.string.dashboard_loading),
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            // Never a bare "no results". An empty list here is almost always a
            // filter left on from the last question somebody asked, so the way
            // out of it is offered rather than described.
            rows.isEmpty() -> EmptyState(
                message = stringResource(R.string.guests_none),
                actionLabel = stringResource(R.string.guests_clear_filters),
                onAction = {
                    viewModel.setFilter(GuestListViewModel.Filter.ALL)
                    viewModel.setTableFilter(null)
                },
            )

            else -> LazyColumn(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items(rows, key = { it.guestId }) { row ->
                    GuestRow(
                        row = row,
                        // The undo affordance appears only for a supervisor AND
                        // only on a guest who has actually arrived. Showing it
                        // otherwise would invite taps that can do nothing.
                        canUndo = isSupervisor && row.arrived && row.clientCheckinId != null,
                        onUndo = { undoTarget = row },
                    )
                }
            }
        }
    }

    undoTarget?.let { target ->
        UndoDialog(
            row = target,
            onDismiss = { undoTarget = null },
            onConfirm = { reason -> viewModel.undo(target.clientCheckinId!!, reason) },
            onDone = { undoTarget = null },
        )
    }
}

/**
 * A filter chip, hand-rolled rather than Material's `FilterChip`.
 *
 * M3's chip is 32dp tall with a 14sp label. Both are below this app's floors,
 * and neither is overridable without fighting the component's internal padding.
 */
@Composable
private fun Chip(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
) {
    val dimens = LocalDimens.current
    Box(
        modifier = Modifier
            .heightIn(min = dimens.minTouch)
            .clip(RoundedCornerShape(dimens.cardRadius))
            .background(
                if (selected) MaterialTheme.colorScheme.primary
                else MaterialTheme.colorScheme.surfaceVariant,
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 24.dp, vertical = 16.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            label,
            style = MaterialTheme.typography.titleMedium,
            color = if (selected) Color.White else MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
private fun GuestRow(
    row: GuestListViewModel.Row,
    canUndo: Boolean,
    onUndo: () -> Unit,
) {
    val dimens = LocalDimens.current

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 76.dp)
            .clip(RoundedCornerShape(dimens.cardRadius))
            .background(MaterialTheme.colorScheme.surfaceVariant)
            .padding(horizontal = 24.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    row.fullName,
                    // Per-name face: an Arabic name set in the Latin display
                    // face falls back to the system font, so a mixed guest list
                    // would render in two unrelated typefaces.
                    style = MaterialTheme.typography.titleLarge.copy(
                        fontFamily = displayFamilyFor(row.fullName),
                    ),
                    color = MaterialTheme.colorScheme.onBackground,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                if (row.isVip) {
                    Spacer(Modifier.width(10.dp))
                    Text(
                        stringResource(R.string.result_welcome_vip),
                        style = MaterialTheme.typography.labelMedium,
                        color = StateVip,
                        maxLines = 1,
                    )
                }
            }
            val secondary = listOfNotNull(
                row.partyLabel?.takeIf { it != row.fullName },
                if (row.arrived) {
                    listOfNotNull(
                        row.arrivedByStaff,
                        row.arrivedAt?.let {
                            DateFormat.getTimeInstance(DateFormat.SHORT).format(Date(it))
                        },
                    ).joinToString(" · ").takeIf { it.isNotBlank() }
                } else {
                    null
                },
            )
            if (secondary.isNotEmpty()) {
                Text(
                    secondary.joinToString("  ·  "),
                    style = MaterialTheme.typography.bodyMedium,
                    color = if (row.arrived) StateWelcome else MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }

        Spacer(Modifier.width(16.dp))

        Column(horizontalAlignment = Alignment.End) {
            Text(
                row.tableName ?: stringResource(R.string.result_no_table),
                style = MaterialTheme.typography.titleLarge,
                color = MaterialTheme.colorScheme.onBackground,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = stringResource(
                    if (row.arrived) R.string.search_arrived_badge else R.string.guests_not_arrived,
                ),
                style = MaterialTheme.typography.labelMedium,
                color = if (row.arrived) StateWelcome else StateNeutral,
                maxLines = 1,
            )
        }

        if (canUndo) {
            Spacer(Modifier.width(20.dp))
            SecondaryAction(
                text = stringResource(R.string.guests_undo),
                onClick = onUndo,
            )
        }
    }
}

/**
 * Undo confirmation with a mandatory reason (§9.6).
 *
 * The reason is required, not optional, because the point of a soft delete is
 * that someone can explain the number months later. The confirm button stays
 * disabled until something is typed, and a failed submit keeps the dialog open
 * with the text intact rather than discarding what the supervisor wrote.
 */
@Composable
private fun UndoDialog(
    row: GuestListViewModel.Row,
    onDismiss: () -> Unit,
    onConfirm: suspend (String) -> Boolean,
    onDone: () -> Unit,
) {
    var reason by remember { mutableStateOf("") }
    var submitting by remember { mutableStateOf(false) }
    var failed by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    AlertDialog(
        onDismissRequest = { if (!submitting) onDismiss() },
        title = {
            Text(
                stringResource(R.string.guests_undo_title, row.fullName),
                style = MaterialTheme.typography.headlineMedium,
            )
        },
        text = {
            Column {
                Text(
                    stringResource(R.string.guests_undo_body),
                    style = MaterialTheme.typography.bodyLarge,
                )
                Spacer(Modifier.height(16.dp))
                OutlinedTextField(
                    value = reason,
                    onValueChange = { reason = it; failed = false },
                    label = { Text(stringResource(R.string.guests_undo_reason)) },
                    enabled = !submitting,
                    textStyle = MaterialTheme.typography.bodyLarge,
                    modifier = Modifier.fillMaxWidth(),
                )
                if (failed) {
                    Spacer(Modifier.height(8.dp))
                    Text(
                        stringResource(R.string.guests_undo_failed),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.error,
                    )
                }
            }
        },
        confirmButton = {
            TextButton(
                enabled = reason.isNotBlank() && !submitting,
                modifier = Modifier.heightIn(min = LocalDimens.current.minTouch),
                onClick = {
                    submitting = true
                    scope.launch {
                        // rememberCoroutineScope is tied to the composition, and
                        // an exception here reaches the default handler and kills
                        // the process — with the dialog still on screen and the
                        // supervisor's typed reason lost.
                        val ok = try {
                            onConfirm(reason)
                        } catch (t: Throwable) {
                            false
                        }
                        submitting = false
                        if (ok) onDone() else failed = true
                    }
                },
            ) {
                Text(
                    stringResource(R.string.guests_undo),
                    style = MaterialTheme.typography.titleMedium,
                )
            }
        },
        dismissButton = {
            TextButton(
                onClick = onDismiss,
                enabled = !submitting,
                modifier = Modifier.heightIn(min = LocalDimens.current.minTouch),
            ) {
                Text(
                    stringResource(R.string.action_cancel),
                    style = MaterialTheme.typography.titleMedium,
                )
            }
        },
    )
}

@Composable
private fun GuestListViewModel.Filter.label(): String = when (this) {
    GuestListViewModel.Filter.ALL -> stringResource(R.string.guests_filter_all)
    GuestListViewModel.Filter.ARRIVED -> stringResource(R.string.guests_filter_arrived)
    GuestListViewModel.Filter.NOT_ARRIVED -> stringResource(R.string.guests_filter_not_arrived)
    GuestListViewModel.Filter.VIP -> stringResource(R.string.guests_filter_vip)
}
