package com.fancyrsvp.checkin.ui.scanner

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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.fancyrsvp.checkin.R
import com.fancyrsvp.checkin.data.repo.CheckInRepository
import com.fancyrsvp.checkin.ui.theme.StateAlready
import com.fancyrsvp.checkin.ui.theme.StateAttention
import com.fancyrsvp.checkin.ui.theme.StateNeutral
import com.fancyrsvp.checkin.ui.theme.StateVip
import com.fancyrsvp.checkin.ui.theme.StateWelcome
import java.text.DateFormat
import java.util.Date

/**
 * The scan result (spec §8.4).
 *
 * "The single most important screen for the product's perceived quality. It must
 * be readable at arm's length, in under a second, by someone who is not looking
 * directly at it."
 *
 * Three rules shape the layout, all from §8.4:
 *
 *  1. **The table number is the largest element after the name.** It is the piece
 *     of information staff relay verbally, so it is sized to be read from a
 *     glance rather than a look.
 *  2. **Every state is visually unmistakable** — full-bleed colour, not a badge on
 *     a neutral card. But colour never carries the meaning alone: each state has
 *     its own heading text, because an usher may be colour-blind and the entrance
 *     may be lit in amber.
 *  3. **Auto-returns after a short delay, and on any tap.** Staff must never have
 *     to find a back button while a queue is forming.
 */
@Composable
fun ScanResultScreen(
    outcome: CheckInRepository.ScanOutcome,
    isSupervisor: Boolean,
    noKidsAllowed: Boolean,
    onAdmit: (party: CheckInRepository.PartyView, guestIds: List<String>) -> Unit,
    onOverride: (party: CheckInRepository.PartyView, guestIds: List<String>) -> Unit,
    onSearch: () -> Unit,
    onDismiss: () -> Unit,
) {
    val accent = outcome.accent()

    // Auto-dismiss only for states with nothing to decide. A Welcome needs someone
    // to confirm who is arriving, and timing that out would admit the wrong people
    // or nobody — so it stays until acted on.
    val autoDismissMs = when (outcome) {
        is CheckInRepository.ScanOutcome.AlreadyCheckedIn -> 6_000L
        is CheckInRepository.ScanOutcome.WrongEvent -> 6_000L
        CheckInRepository.ScanOutcome.NotFound -> 8_000L
        CheckInRepository.ScanOutcome.Unrecognised -> 8_000L
        else -> null
    }
    LaunchedEffect(outcome) {
        autoDismissMs?.let {
            kotlinx.coroutines.delay(it)
            onDismiss()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(accent.copy(alpha = 0.14f))
            // Tap anywhere dismisses. No hit target to find, no back button to
            // hunt for.
            .clickable(onClick = onDismiss),
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 40.dp, vertical = 32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            when (outcome) {
                is CheckInRepository.ScanOutcome.Welcome -> WelcomeBody(
                    party = outcome.party,
                    noKidsAllowed = noKidsAllowed,
                    onAdmit = onAdmit,
                )

                is CheckInRepository.ScanOutcome.AlreadyCheckedIn -> AlreadyBody(
                    party = outcome.party,
                    isSupervisor = isSupervisor,
                    onOverride = onOverride,
                )

                is CheckInRepository.ScanOutcome.Expired -> {
                    // Past its date, but §5.3 is explicit: the door is never
                    // blocked by uncertainty. If the party resolves, admission
                    // proceeds normally and the anomaly is recorded server-side.
                    Heading(stringResource(R.string.result_expired_title), StateAlready)
                    Text(
                        stringResource(R.string.result_expired_body),
                        style = MaterialTheme.typography.bodyLarge,
                        textAlign = TextAlign.Center,
                    )
                    Spacer(Modifier.height(24.dp))
                    if (outcome.party != null) {
                        WelcomeBody(outcome.party, noKidsAllowed, onAdmit)
                    } else {
                        DeadEndActions(onSearch)
                    }
                }

                is CheckInRepository.ScanOutcome.WrongEvent -> {
                    Heading(stringResource(R.string.result_wrong_event_title), StateAlready)
                    Text(
                        stringResource(R.string.result_wrong_event_body),
                        style = MaterialTheme.typography.headlineMedium,
                        textAlign = TextAlign.Center,
                    )
                    Spacer(Modifier.height(32.dp))
                    DeadEndActions(onSearch)
                }

                CheckInRepository.ScanOutcome.NotFound -> {
                    // Neutral, never alarming (§8.4). A guest standing here has
                    // done nothing wrong, and the usher needs a next step rather
                    // than an error.
                    Heading(stringResource(R.string.result_not_found_title), StateNeutral)
                    Text(
                        stringResource(R.string.result_not_found_body),
                        style = MaterialTheme.typography.bodyLarge,
                        textAlign = TextAlign.Center,
                    )
                    Spacer(Modifier.height(32.dp))
                    DeadEndActions(onSearch)
                }

                CheckInRepository.ScanOutcome.Unrecognised -> {
                    Heading(stringResource(R.string.result_unrecognised_title), StateNeutral)
                    Text(
                        stringResource(R.string.result_unrecognised_body),
                        style = MaterialTheme.typography.bodyLarge,
                        textAlign = TextAlign.Center,
                    )
                    Spacer(Modifier.height(32.dp))
                    DeadEndActions(onSearch)
                }
            }

            Spacer(Modifier.weight(1f))
            Text(
                stringResource(R.string.result_tap_to_continue),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun WelcomeBody(
    party: CheckInRepository.PartyView,
    noKidsAllowed: Boolean,
    onAdmit: (CheckInRepository.PartyView, List<String>) -> Unit,
) {
    val unarrived = party.unarrived
    val isVip = party.hasVip

    // Selection defaults to EVERYONE not yet arrived: the common case is a whole
    // party walking in together, and making that one tap keeps the door moving.
    // Deselecting is how a partial arrival is expressed (§9.1).
    val selected = remember(party.partyId) {
        mutableStateListOf<String>().apply { addAll(unarrived.map { it.guestId }) }
    }

    Heading(
        text = stringResource(if (isVip) R.string.result_welcome_vip else R.string.result_welcome),
        color = if (isVip) StateVip else StateWelcome,
    )

    // Name — large.
    Text(
        text = party.label,
        style = MaterialTheme.typography.displayMedium,
        textAlign = TextAlign.Center,
        color = MaterialTheme.colorScheme.onBackground,
    )

    Spacer(Modifier.height(12.dp))

    // Table — the largest element after the name (§8.4), because this is what
    // staff say out loud.
    Text(
        text = party.tableName?.let { stringResource(R.string.result_table, it) }
            ?: stringResource(R.string.result_no_table),
        style = MaterialTheme.typography.displayLarge,
        fontWeight = FontWeight.Bold,
        color = if (isVip) StateVip else StateWelcome,
        textAlign = TextAlign.Center,
    )

    Spacer(Modifier.height(8.dp))
    Text(
        stringResource(R.string.result_party_of, party.members.size),
        style = MaterialTheme.typography.titleMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )

    party.notes?.takeIf { it.isNotBlank() }?.let {
        Spacer(Modifier.height(12.dp))
        // Shown to the usher: accessibility needs, seating requests (§6.1).
        Text(
            stringResource(R.string.result_note, it),
            style = MaterialTheme.typography.bodyLarge,
            textAlign = TextAlign.Center,
        )
    }

    if (noKidsAllowed) {
        Spacer(Modifier.height(8.dp))
        Text(
            stringResource(R.string.result_no_kids),
            style = MaterialTheme.typography.bodyMedium,
            color = StateAlready,
        )
    }

    Spacer(Modifier.height(24.dp))

    // Party members, with a checkbox each when there is a choice to make. A party
    // of one gets no list — there is nothing to select.
    if (unarrived.size > 1 || party.arrived.isNotEmpty()) {
        Text(
            stringResource(R.string.result_arriving_now),
            style = MaterialTheme.typography.titleMedium,
        )
        Spacer(Modifier.height(8.dp))
        LazyColumn(
            modifier = Modifier.widthIn(max = 560.dp).height(200.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            items(party.members, key = { it.guestId }) { member ->
                MemberRow(
                    member = member,
                    checked = member.guestId in selected,
                    onToggle = {
                        if (member.guestId in selected) selected.remove(member.guestId)
                        else selected.add(member.guestId)
                    },
                )
            }
        }
        Spacer(Modifier.height(16.dp))
    }

    Button(
        onClick = { onAdmit(party, selected.toList()) },
        enabled = selected.isNotEmpty(),
        colors = ButtonDefaults.buttonColors(
            containerColor = if (isVip) StateVip else StateWelcome,
        ),
        modifier = Modifier.widthIn(min = 320.dp).height(72.dp),
    ) {
        Text(
            text = if (selected.size > 1) {
                stringResource(R.string.result_admit_all, selected.size)
            } else {
                stringResource(R.string.result_admit)
            },
            style = MaterialTheme.typography.titleLarge,
        )
    }
}

@Composable
private fun MemberRow(
    member: CheckInRepository.GuestView,
    checked: Boolean,
    onToggle: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Checkbox(
            checked = checked,
            // An already-arrived member cannot be re-selected here; that path is
            // the supervisor override, which is deliberately harder to reach.
            enabled = !member.alreadyArrived,
            onCheckedChange = { onToggle() },
        )
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    member.fullName,
                    style = MaterialTheme.typography.titleMedium,
                    color = if (member.alreadyArrived) {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    } else {
                        MaterialTheme.colorScheme.onBackground
                    },
                )
                if (member.isVip) {
                    Spacer(Modifier.width(8.dp))
                    Badge(stringResource(R.string.result_welcome_vip), StateVip)
                }
                if (member.alreadyArrived) {
                    Spacer(Modifier.width(8.dp))
                    Badge(stringResource(R.string.search_arrived_badge), StateAlready)
                }
            }
            listOfNotNull(
                member.mealSelection?.let { stringResource(R.string.result_meal, it) },
                member.dietaryNotes?.takeIf { it.isNotBlank() }
                    ?.let { stringResource(R.string.result_dietary, it) },
            ).forEach {
                Text(
                    it,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun AlreadyBody(
    party: CheckInRepository.PartyView,
    isSupervisor: Boolean,
    onOverride: (CheckInRepository.PartyView, List<String>) -> Unit,
) {
    // Amber: clearly not an error, clearly not a fresh welcome (§8.4).
    Heading(stringResource(R.string.result_already_title), StateAlready)

    Text(
        party.label,
        style = MaterialTheme.typography.displayMedium,
        textAlign = TextAlign.Center,
    )
    Spacer(Modifier.height(8.dp))
    Text(
        text = party.tableName?.let { stringResource(R.string.result_table, it) }
            ?: stringResource(R.string.result_no_table),
        style = MaterialTheme.typography.headlineLarge,
        color = StateAlready,
    )

    Spacer(Modifier.height(20.dp))

    // WHO checked them in and WHEN — the two facts that settle a dispute at the
    // door without a supervisor having to look anything up (§8.4).
    party.arrived.forEach { member ->
        val time = member.arrivedAt?.let {
            DateFormat.getTimeInstance(DateFormat.SHORT).format(Date(it))
        }
        val detail = when {
            member.arrivedByStaff != null && member.arrivedAtDevice != null && time != null ->
                stringResource(
                    R.string.result_already_detail_device,
                    member.arrivedByStaff, time, member.arrivedAtDevice,
                )
            member.arrivedByStaff != null && time != null ->
                stringResource(R.string.result_already_detail, member.arrivedByStaff, time)
            else -> time.orEmpty()
        }
        Text(
            "${member.fullName} — $detail",
            style = MaterialTheme.typography.bodyLarge,
            textAlign = TextAlign.Center,
        )
    }

    Spacer(Modifier.height(28.dp))

    if (isSupervisor) {
        // §9.5: a photographed ticket resolves here, and admission then requires an
        // override that is recorded in the audit trail.
        Button(
            onClick = { onOverride(party, party.arrived.map { it.guestId }) },
            colors = ButtonDefaults.buttonColors(containerColor = StateAttention),
            modifier = Modifier.widthIn(min = 300.dp).height(64.dp),
        ) {
            Text(stringResource(R.string.result_override), style = MaterialTheme.typography.titleMedium)
        }
    } else {
        Text(
            stringResource(R.string.result_override_unavailable),
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
    }
}

/** Every neutral state ends with a route to manual search — never a dead end. */
@Composable
private fun DeadEndActions(onSearch: () -> Unit) {
    OutlinedButton(
        onClick = onSearch,
        modifier = Modifier.widthIn(min = 300.dp).height(64.dp),
    ) {
        Text(stringResource(R.string.scanner_search), style = MaterialTheme.typography.titleMedium)
    }
}

@Composable
private fun Heading(text: String, color: Color) {
    Text(
        text = text.uppercase(),
        style = MaterialTheme.typography.titleLarge,
        color = color,
        fontWeight = FontWeight.Bold,
    )
    Spacer(Modifier.height(16.dp))
}

@Composable
private fun Badge(text: String, color: Color) {
    Text(
        text = text.uppercase(),
        style = MaterialTheme.typography.bodyMedium,
        color = color,
        fontWeight = FontWeight.Bold,
        modifier = Modifier
            .clip(RoundedCornerShape(4.dp))
            .background(color.copy(alpha = 0.16f))
            .padding(horizontal = 8.dp, vertical = 2.dp),
    )
}

private fun CheckInRepository.ScanOutcome.accent(): Color = when (this) {
    is CheckInRepository.ScanOutcome.Welcome -> if (party.hasVip) StateVip else StateWelcome
    is CheckInRepository.ScanOutcome.AlreadyCheckedIn -> StateAlready
    is CheckInRepository.ScanOutcome.Expired -> StateAlready
    is CheckInRepository.ScanOutcome.WrongEvent -> StateAlready
    CheckInRepository.ScanOutcome.NotFound -> StateNeutral
    CheckInRepository.ScanOutcome.Unrecognised -> StateNeutral
}
