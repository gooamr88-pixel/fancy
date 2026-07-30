package com.fancyrsvp.checkin.ui.guests

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.fancyrsvp.checkin.R
import com.fancyrsvp.checkin.ui.theme.StateAlready
import com.fancyrsvp.checkin.ui.theme.StateNeutral
import com.fancyrsvp.checkin.ui.theme.StateVip
import com.fancyrsvp.checkin.ui.theme.StateWelcome
import kotlinx.coroutines.launch
import java.text.DateFormat
import java.util.Date

/**
 * Browsable guest list (spec §8.7) and the supervisor undo (§9.6).
 *
 * Filters are exactly those the spec names — all, arrived, not arrived, VIP, by
 * table — because they are the shapes the real question takes at a door: "has the
 * bride's aunt arrived", "who is still outstanding on table 12", "are all the VIPs
 * in".
 */
@Composable
fun GuestListScreen(
    eventId: String,
    isSupervisor: Boolean,
    onBack: () -> Unit,
    viewModel: GuestListViewModel = hiltViewModel(),
) {
    val rows by viewModel.rows.collectAsState()
    val filter by viewModel.filter.collectAsState()
    val tableFilter by viewModel.tableFilter.collectAsState()
    val tables by viewModel.tables.collectAsState()
    val loading by viewModel.loading.collectAsState()

    var undoTarget by remember { mutableStateOf<GuestListViewModel.Row?>(null) }

    LaunchedEffect(eventId) { viewModel.start(eventId) }

    Surface(modifier = Modifier.fillMaxSize()) {
        Column(modifier = Modifier.fillMaxSize().padding(32.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    stringResource(R.string.guests_title),
                    style = MaterialTheme.typography.headlineLarge,
                )
                Spacer(Modifier.weight(1f))
                Text(
                    stringResource(R.string.guests_showing, rows.size),
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.width(16.dp))
                OutlinedButton(onClick = onBack, modifier = Modifier.height(56.dp)) {
                    Text(stringResource(R.string.action_dismiss))
                }
            }

            Spacer(Modifier.height(16.dp))

            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(GuestListViewModel.Filter.entries.toList()) { option ->
                    FilterChip(
                        selected = filter == option,
                        onClick = { viewModel.setFilter(option) },
                        label = { Text(option.label()) },
                    )
                }
            }

            if (tables.isNotEmpty()) {
                Spacer(Modifier.height(8.dp))
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    item {
                        FilterChip(
                            selected = tableFilter == null,
                            onClick = { viewModel.setTableFilter(null) },
                            label = { Text(stringResource(R.string.guests_all_tables)) },
                        )
                    }
                    items(tables) { table ->
                        FilterChip(
                            selected = tableFilter == table,
                            onClick = { viewModel.setTableFilter(table) },
                            label = { Text(table) },
                        )
                    }
                }
            }

            Spacer(Modifier.height(16.dp))

            when {
                loading -> Text(
                    stringResource(R.string.dashboard_loading),
                    style = MaterialTheme.typography.bodyLarge,
                )
                rows.isEmpty() -> Text(
                    stringResource(R.string.guests_none),
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                else -> LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
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

@Composable
private fun GuestRow(
    row: GuestListViewModel.Row,
    canUndo: Boolean,
    onUndo: () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(20.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(row.fullName, style = MaterialTheme.typography.titleMedium)
                    if (row.isVip) {
                        Spacer(Modifier.width(8.dp))
                        Text(
                            stringResource(R.string.result_welcome_vip).uppercase(),
                            style = MaterialTheme.typography.bodyMedium,
                            color = StateVip,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier
                                .clip(RoundedCornerShape(4.dp))
                                .background(StateVip.copy(alpha = 0.16f))
                                .padding(horizontal = 8.dp, vertical = 2.dp),
                        )
                    }
                }
                row.partyLabel?.takeIf { it != row.fullName }?.let {
                    Text(
                        it,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                if (row.arrived) {
                    val time = row.arrivedAt?.let {
                        DateFormat.getTimeInstance(DateFormat.SHORT).format(Date(it))
                    }
                    Text(
                        text = listOfNotNull(row.arrivedByStaff, time).joinToString(" · "),
                        style = MaterialTheme.typography.bodyMedium,
                        color = StateWelcome,
                    )
                }
            }

            Column(horizontalAlignment = Alignment.End) {
                Text(
                    row.tableName ?: stringResource(R.string.result_no_table),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    text = stringResource(
                        if (row.arrived) R.string.search_arrived_badge else R.string.guests_not_arrived,
                    ).uppercase(),
                    style = MaterialTheme.typography.bodyMedium,
                    color = if (row.arrived) StateWelcome else StateNeutral,
                    fontWeight = FontWeight.Bold,
                )
            }

            if (canUndo) {
                Spacer(Modifier.width(16.dp))
                OutlinedButton(onClick = onUndo, modifier = Modifier.height(52.dp)) {
                    Text(stringResource(R.string.guests_undo))
                }
            }
        }
    }
}

/**
 * Undo confirmation with a mandatory reason (§9.6).
 *
 * The reason is required, not optional, because the point of a soft delete is that
 * someone can explain the number months later. The confirm button stays disabled
 * until something is typed, and a failed submit keeps the dialog open with the text
 * intact rather than discarding what the supervisor wrote.
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
        title = { Text(stringResource(R.string.guests_undo_title, row.fullName)) },
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
                onClick = {
                    submitting = true
                    scope.launch {
                        val ok = onConfirm(reason)
                        submitting = false
                        if (ok) onDone() else failed = true
                    }
                },
            ) {
                Text(stringResource(R.string.guests_undo))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss, enabled = !submitting) {
                Text(stringResource(R.string.action_cancel))
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
