package com.fancyrsvp.checkin.ui.menu

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.fancyrsvp.checkin.R
import com.fancyrsvp.checkin.data.local.ArrivalBucket
import com.fancyrsvp.checkin.ui.components.Chevron
import com.fancyrsvp.checkin.ui.components.ScreenScaffold
import com.fancyrsvp.checkin.ui.components.SectionLabel
import com.fancyrsvp.checkin.ui.components.StatTile
import com.fancyrsvp.checkin.ui.dashboard.DashboardViewModel
import com.fancyrsvp.checkin.ui.theme.LocalDimens
import com.fancyrsvp.checkin.ui.theme.StateAlready
import com.fancyrsvp.checkin.ui.theme.StateAttention
import com.fancyrsvp.checkin.ui.theme.StateVip
import com.fancyrsvp.checkin.ui.theme.StateWelcome
import java.text.DateFormat
import java.util.Date

/**
 * The menu. Everything that is not needed at the door lives here, and nowhere
 * else.
 *
 * ── One question ──
 *
 * "How is tonight going, and what do you want to do about it?" The arrival
 * figure answers the first half at a glance; three cards answer the second.
 *
 * ── Why it does not scroll ──
 *
 * The screen this replaces was a single scrolling column of eight stacked
 * sections behind a row of four identical outlined buttons, one of which was
 * labelled "Dismiss" and was the only way back. A supervisor had to scroll to
 * discover what was on it, which means most of it was never seen.
 *
 * Two columns in landscape, everything above the fold: the numbers on one side,
 * the actions on the other. Only the two breakdown lists scroll, and only
 * within their own box — nothing that MATTERS is below a fold.
 */
@Composable
fun MenuScreen(
    eventId: String,
    isSupervisor: Boolean,
    onOpenGuestList: () -> Unit,
    onOpenEntranceDisplay: () -> Unit,
    /** Null for an usher — closing an event destroys local data. */
    onCloseEvent: (() -> Unit)?,
    onBackToScanner: () -> Unit,
    viewModel: DashboardViewModel = hiltViewModel(),
) {
    val summary by viewModel.summary.collectAsState()
    val dimens = LocalDimens.current

    LaunchedEffect(eventId) { viewModel.start(eventId) }

    ScreenScaffold(
        title = stringResource(R.string.menu_title),
        onBackToScanner = onBackToScanner,
    ) {
        val current = summary
        if (current == null) {
            Text(
                stringResource(R.string.dashboard_loading),
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            return@ScreenScaffold
        }

        Row(
            modifier = Modifier.fillMaxSize(),
            horizontalArrangement = Arrangement.spacedBy(dimens.sectionGap),
        ) {
            // ── Left: how tonight is going ──
            Column(
                modifier = Modifier.weight(1.1f).fillMaxHeight(),
                verticalArrangement = Arrangement.spacedBy(dimens.sectionGap),
            ) {
                ArrivalHero(current)

                if (current.arrivals.isNotEmpty()) {
                    Column {
                        SectionLabel(stringResource(R.string.menu_when_they_came))
                        Spacer(Modifier.height(8.dp))
                        Sparkline(current.arrivals)
                    }
                }

                Column(Modifier.weight(1f)) {
                    SectionLabel(stringResource(R.string.dashboard_by_category))
                    Spacer(Modifier.height(8.dp))
                    // Deliberately unkeyed. Categories and staff share one list,
                    // and a key must be unique across the WHOLE list — a table
                    // category named after a staff member, or two unattributed
                    // rows, would crash it. These lists are short and never
                    // reorder, so keys buy nothing here.
                    LazyColumn(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        items(current.categories) { row ->
                            BreakdownRow(
                                label = row.category,
                                value = stringResource(
                                    R.string.dashboard_arrived_of, row.arrived, row.total,
                                ),
                                accent = if (row.category.equals("vip", true)) StateVip else null,
                            )
                        }
                        if (isSupervisor && current.staff.isNotEmpty()) {
                            item {
                                Spacer(Modifier.height(16.dp))
                                SectionLabel(stringResource(R.string.dashboard_per_staff))
                                Spacer(Modifier.height(8.dp))
                            }
                            items(current.staff) { entry ->
                                BreakdownRow(
                                    label = entry.staffDisplayName
                                        ?: stringResource(R.string.dashboard_unattributed),
                                    value = "${entry.count}",
                                    accent = null,
                                )
                            }
                        }
                    }
                }
            }

            // ── Right: what you can do ──
            Column(
                modifier = Modifier.weight(1f).fillMaxHeight(),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                ActionCard(
                    title = stringResource(R.string.dashboard_open_guests),
                    detail = stringResource(R.string.menu_guests_detail),
                    onClick = onOpenGuestList,
                )
                ActionCard(
                    title = stringResource(R.string.dashboard_entrance_display),
                    detail = stringResource(R.string.menu_entrance_detail),
                    onClick = onOpenEntranceDisplay,
                )
                onCloseEvent?.let {
                    ActionCard(
                        title = stringResource(R.string.close_title),
                        detail = stringResource(R.string.menu_close_detail),
                        onClick = it,
                        accent = StateAttention,
                    )
                }

                if (isSupervisor) {
                    Spacer(Modifier.weight(1f))
                    // Queue depth is shown to supervisors at all times (§21.3).
                    // Three tiles rather than three label/value rows, because
                    // the only thing anyone reads here is whether a figure is
                    // above zero.
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        StatTile(
                            label = stringResource(R.string.dashboard_pending),
                            value = "${current.pendingSync}",
                            accent = if (current.pendingSync > 0) StateAlready else MaterialTheme.colorScheme.onBackground,
                            modifier = Modifier.weight(1f),
                        )
                        StatTile(
                            label = stringResource(R.string.dashboard_stalled),
                            value = "${current.stalled}",
                            // Stalled means the server refused it repeatedly.
                            // Retained, never dropped — but somebody has to look.
                            accent = if (current.stalled > 0) StateAttention else MaterialTheme.colorScheme.onBackground,
                            modifier = Modifier.weight(1f),
                        )
                        StatTile(
                            label = stringResource(R.string.dashboard_conflicts),
                            value = "${current.conflicts}",
                            accent = if (current.conflicts > 0) StateAttention else MaterialTheme.colorScheme.onBackground,
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }
        }
    }
}

/** The one number a supervisor is ever asked for. */
@Composable
private fun ArrivalHero(summary: DashboardViewModel.Summary) {
    val dimens = LocalDimens.current

    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(dimens.cardRadius))
            .background(MaterialTheme.colorScheme.surfaceVariant)
            .padding(dimens.cardPadding),
    ) {
        Row(verticalAlignment = Alignment.Bottom) {
            Text(
                "${summary.arrived}",
                style = MaterialTheme.typography.displayLarge,
                color = StateWelcome,
                maxLines = 1,
            )
            Spacer(Modifier.width(12.dp))
            Text(
                stringResource(R.string.dashboard_of_invited, summary.totalInvited),
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(bottom = 10.dp),
                maxLines = 1,
            )
        }
        Spacer(Modifier.height(14.dp))
        LinearProgressIndicator(
            progress = { summary.progressPercent / 100f },
            color = StateWelcome,
            trackColor = MaterialTheme.colorScheme.outline,
            modifier = Modifier.fillMaxWidth().height(10.dp).clip(RoundedCornerShape(5.dp)),
        )
        summary.lastSyncedAt?.let {
            Spacer(Modifier.height(10.dp))
            Text(
                stringResource(
                    R.string.freshness_from,
                    DateFormat.getTimeInstance(DateFormat.SHORT).format(Date(it)),
                ),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
            )
        }
    }
}

/**
 * When the rush was, as a shape.
 *
 * Replaces a 180dp bar chart that carried a clock label under every bar. The
 * only question it ever answered was "when was the rush", and the answer is a
 * silhouette — nobody at a door reads a time axis. One quarter the height, and
 * it says the same thing.
 *
 * Drawn with a Canvas rather than a charting library: adding a dependency to an
 * APK that must run offline on a hired tablet is not worth a shape.
 */
@Composable
private fun Sparkline(buckets: List<ArrivalBucket>) {
    val peak = (buckets.maxOfOrNull { it.count } ?: 1).coerceAtLeast(1)
    val accent = StateWelcome

    Canvas(
        Modifier
            .fillMaxWidth()
            .height(64.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant),
    ) {
        if (buckets.isEmpty()) return@Canvas

        val gap = 3f
        val barWidth = ((size.width - gap * (buckets.size - 1)) / buckets.size).coerceAtLeast(2f)

        buckets.forEachIndexed { index, bucket ->
            // A floor of 3px so a bucket of one is still visible beside a
            // bucket of sixty — an empty-looking gap reads as "nobody came",
            // which is a different fact.
            val barHeight = (size.height * bucket.count / peak).coerceAtLeast(3f)
            drawRect(
                color = if (bucket.count == peak) accent else accent.copy(alpha = 0.45f),
                topLeft = Offset(index * (barWidth + gap), size.height - barHeight),
                size = Size(barWidth, barHeight),
            )
        }
    }
}

/**
 * A destination, as a card rather than a button in a row of four.
 *
 * Each says what it is and what is in it. The old screen had four identically
 * sized outlined buttons side by side, one of which was the way back — nothing
 * distinguished a destination from an exit.
 */
@Composable
private fun ActionCard(
    title: String,
    detail: String,
    onClick: () -> Unit,
    accent: Color? = null,
) {
    val dimens = LocalDimens.current
    val tint = accent ?: MaterialTheme.colorScheme.primary

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 96.dp)
            .clip(RoundedCornerShape(dimens.cardRadius))
            .background(MaterialTheme.colorScheme.surfaceVariant)
            .clickable(onClick = onClick)
            .padding(horizontal = 24.dp, vertical = 18.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(
                title,
                style = MaterialTheme.typography.titleLarge,
                color = tint,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Spacer(Modifier.height(2.dp))
            Text(
                detail,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Spacer(Modifier.width(12.dp))
        // Points forward: this goes deeper, and the transition will confirm it.
        Chevron(color = tint, pointsBack = false)
    }
}

@Composable
private fun BreakdownRow(
    label: String,
    value: String,
    accent: Color?,
) {
    Row(
        modifier = Modifier.fillMaxWidth().heightIn(min = 40.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            label,
            style = MaterialTheme.typography.bodyLarge,
            color = accent ?: MaterialTheme.colorScheme.onBackground,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
        Spacer(Modifier.width(12.dp))
        Text(
            value,
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 1,
        )
    }
}
