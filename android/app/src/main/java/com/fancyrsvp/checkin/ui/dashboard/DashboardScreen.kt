package com.fancyrsvp.checkin.ui.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.LinearProgressIndicator
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.fancyrsvp.checkin.R
import com.fancyrsvp.checkin.data.local.ArrivalBucket
import com.fancyrsvp.checkin.ui.theme.StateAlready
import com.fancyrsvp.checkin.ui.theme.StateAttention
import com.fancyrsvp.checkin.ui.theme.StateVip
import com.fancyrsvp.checkin.ui.theme.StateWelcome
import java.text.DateFormat
import java.util.Date

/**
 * Live attendance dashboard (spec §8.6).
 *
 * Read entirely from the local database, so it is correct and instant with no
 * connectivity — a supervisor asking "how many are in?" mid-event is standing in a
 * venue that probably has no working Wi-Fi.
 *
 * The supervisor-only block (pending sync, stalled, conflicts, per-staff) is hidden
 * from an usher because it is noise to them, not because it is secret (§18.2).
 */
@Composable
fun DashboardScreen(
    eventId: String,
    isSupervisor: Boolean,
    onOpenGuestList: () -> Unit,
    onOpenEntranceDisplay: () -> Unit,
    /** Null for an usher — closing an event destroys local data. */
    onCloseEvent: (() -> Unit)?,
    onBack: () -> Unit,
    viewModel: DashboardViewModel = hiltViewModel(),
) {
    val summary by viewModel.summary.collectAsState()

    LaunchedEffect(eventId) { viewModel.start(eventId) }

    Surface(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(32.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    stringResource(R.string.dashboard_title),
                    style = MaterialTheme.typography.headlineLarge,
                )
                Spacer(Modifier.weight(1f))
                OutlinedButton(onClick = onOpenGuestList, modifier = Modifier.height(56.dp)) {
                    Text(stringResource(R.string.dashboard_open_guests))
                }
                Spacer(Modifier.width(12.dp))
                OutlinedButton(onClick = onOpenEntranceDisplay, modifier = Modifier.height(56.dp)) {
                    Text(stringResource(R.string.dashboard_entrance_display))
                }
                onCloseEvent?.let {
                    Spacer(Modifier.width(12.dp))
                    OutlinedButton(onClick = it, modifier = Modifier.height(56.dp)) {
                        Text(stringResource(R.string.close_title))
                    }
                }
                Spacer(Modifier.width(12.dp))
                OutlinedButton(onClick = onBack, modifier = Modifier.height(56.dp)) {
                    Text(stringResource(R.string.action_dismiss))
                }
            }

            Spacer(Modifier.height(24.dp))

            val current = summary
            if (current == null) {
                Text(
                    stringResource(R.string.dashboard_loading),
                    style = MaterialTheme.typography.bodyLarge,
                )
                return@Column
            }

            // ── Headline counter ──
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
            ) {
                Column(Modifier.padding(28.dp)) {
                    Row(verticalAlignment = Alignment.Bottom) {
                        Text(
                            "${current.arrived}",
                            style = MaterialTheme.typography.displayLarge,
                            fontWeight = FontWeight.Bold,
                            color = StateWelcome,
                        )
                        Spacer(Modifier.width(12.dp))
                        Text(
                            stringResource(R.string.dashboard_of_invited, current.totalInvited),
                            style = MaterialTheme.typography.titleLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    Spacer(Modifier.height(16.dp))
                    LinearProgressIndicator(
                        progress = { current.progressPercent / 100f },
                        modifier = Modifier.fillMaxWidth().height(12.dp),
                    )
                    Spacer(Modifier.height(8.dp))
                    Text(
                        stringResource(R.string.dashboard_percent, current.progressPercent),
                        style = MaterialTheme.typography.bodyLarge,
                    )
                    current.lastSyncedAt?.let {
                        Spacer(Modifier.height(8.dp))
                        Text(
                            stringResource(
                                R.string.freshness_from,
                                DateFormat.getTimeInstance(DateFormat.SHORT).format(Date(it)),
                            ),
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }

            Spacer(Modifier.height(20.dp))

            // ── Arrivals over time ──
            SectionTitle(stringResource(R.string.dashboard_arrivals_over_time))
            if (current.arrivals.isEmpty()) {
                Text(
                    stringResource(R.string.dashboard_no_arrivals),
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else {
                ArrivalChart(buckets = current.arrivals, peak = current.peakBucket)
            }

            Spacer(Modifier.height(20.dp))

            // ── Category breakdown ──
            SectionTitle(stringResource(R.string.dashboard_by_category))
            current.categories.forEach { row ->
                Row(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        row.category,
                        style = MaterialTheme.typography.titleMedium,
                        color = if (row.category.equals("vip", true)) StateVip
                        else MaterialTheme.colorScheme.onBackground,
                        modifier = Modifier.width(160.dp),
                    )
                    Text(
                        stringResource(R.string.dashboard_arrived_of, row.arrived, row.total),
                        style = MaterialTheme.typography.bodyLarge,
                    )
                }
            }

            if (isSupervisor) {
                Spacer(Modifier.height(24.dp))
                SectionTitle(stringResource(R.string.dashboard_supervisor))

                // Queue depth is shown to supervisors at all times (§21.3).
                StatRow(
                    label = stringResource(R.string.dashboard_pending),
                    value = "${current.pendingSync}",
                    alert = current.pendingSync > 0,
                    alertColor = StateAlready,
                )
                StatRow(
                    label = stringResource(R.string.dashboard_stalled),
                    value = "${current.stalled}",
                    // Stalled means the server refused it repeatedly. Retained, never
                    // dropped — but somebody has to look at it.
                    alert = current.stalled > 0,
                    alertColor = StateAttention,
                )
                StatRow(
                    label = stringResource(R.string.dashboard_conflicts),
                    value = "${current.conflicts}",
                    alert = current.conflicts > 0,
                    alertColor = StateAttention,
                )

                Spacer(Modifier.height(16.dp))
                SectionTitle(stringResource(R.string.dashboard_per_staff))
                if (current.staff.isEmpty()) {
                    Text(
                        stringResource(R.string.dashboard_no_arrivals),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                } else {
                    current.staff.forEach { entry ->
                        StatRow(
                            label = entry.staffDisplayName
                                ?: stringResource(R.string.dashboard_unattributed),
                            value = "${entry.count}",
                            alert = false,
                            alertColor = StateWelcome,
                        )
                    }
                }
            }

            Spacer(Modifier.height(40.dp))
        }
    }
}

/**
 * Arrivals per 15 minutes, as bars.
 *
 * Drawn with Boxes rather than a charting library: the only question this answers is
 * "when was the rush", the answer is a shape not a number, and adding a chart
 * dependency to an APK that must run offline on a hired tablet is not worth it.
 */
@Composable
private fun ArrivalChart(
    buckets: List<ArrivalBucket>,
    peak: ArrivalBucket?,
) {
    val max = (buckets.maxOfOrNull { it.count } ?: 1).coerceAtLeast(1)

    LazyRow(
        modifier = Modifier.fillMaxWidth().height(180.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.Bottom,
    ) {
        items(buckets, key = { it.bucketStart }) { bucket ->
            val isPeak = peak != null && bucket.bucketStart == peak.bucketStart
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Bottom,
                modifier = Modifier.fillMaxHeight(),
            ) {
                Text(
                    "${bucket.count}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = if (isPeak) StateVip else MaterialTheme.colorScheme.onSurfaceVariant,
                    fontWeight = if (isPeak) FontWeight.Bold else FontWeight.Normal,
                )
                Spacer(Modifier.height(4.dp))
                Box(
                    modifier = Modifier
                        .width(28.dp)
                        // Proportional to the tallest bar, with a floor so a bucket
                        // of 1 is still visible next to a bucket of 60.
                        .height((140f * bucket.count / max).dp.coerceAtLeast(6.dp))
                        .clip(RoundedCornerShape(topStart = 4.dp, topEnd = 4.dp))
                        .background(if (isPeak) StateVip else StateWelcome),
                )
                Spacer(Modifier.height(6.dp))
                Text(
                    DateFormat.getTimeInstance(DateFormat.SHORT).format(Date(bucket.bucketStart)),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun SectionTitle(text: String) {
    Text(text, style = MaterialTheme.typography.titleLarge)
    Spacer(Modifier.height(8.dp))
}

@Composable
private fun StatRow(
    label: String,
    value: String,
    alert: Boolean,
    alertColor: Color,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.width(260.dp))
        Text(
            value,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = if (alert) FontWeight.Bold else FontWeight.Normal,
            color = if (alert) alertColor else MaterialTheme.colorScheme.onBackground,
        )
    }
}
