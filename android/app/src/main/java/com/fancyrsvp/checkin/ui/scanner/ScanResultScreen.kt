package com.fancyrsvp.checkin.ui.scanner

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.fancyrsvp.checkin.R
import com.fancyrsvp.checkin.data.repo.CheckInRepository
import com.fancyrsvp.checkin.ui.components.PrimaryAction
import com.fancyrsvp.checkin.ui.components.QuietAction
import com.fancyrsvp.checkin.ui.components.SecondaryAction
import com.fancyrsvp.checkin.ui.components.SectionLabel
import com.fancyrsvp.checkin.ui.theme.BandAlready
import com.fancyrsvp.checkin.ui.theme.Dimens
import com.fancyrsvp.checkin.ui.theme.LocalDimens
import com.fancyrsvp.checkin.ui.theme.Motion
import com.fancyrsvp.checkin.ui.theme.StateAlready
import com.fancyrsvp.checkin.ui.theme.StateAttention
import com.fancyrsvp.checkin.ui.theme.displayFamilyFor
import java.text.DateFormat
import java.util.Date

/**
 * The scan result. This screen is the product.
 *
 * ── What it is designed against ──
 *
 * An usher hired that night, holding the tablet one-handed, in dim decorative
 * light, with a queue forming, looking at it for under two seconds. Everything
 * below follows from that and nothing else.
 *
 * ── The three rules ──
 *
 * 1. **The state is a full-screen colour.** Not a badge, not a tint, not a
 *    stripe down one edge. It must be recognisable from across a room by
 *    someone not looking directly at it, which means the whole screen changes
 *    or the signal does not carry. See ResultVisual for how the four states are
 *    separated by value rather than by hue.
 *
 * 2. **The table number is the largest thing on screen.** Larger than the
 *    guest's name, because the table is what staff say out loud. Sized from the
 *    string, since "12" and "The Rose Garden" cannot share a font size.
 *
 * 3. **One decision, or none.** A single full-width button admits the whole
 *    party. Choosing WHICH members arrived is a real requirement (§9.1) but it
 *    is not a door decision, so it lives behind a quiet link and an overlay.
 *
 * The screen leaves by itself, and on a tap anywhere. Staff must never hunt for
 * a way out while people wait.
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
    val visual = outcome.visual()
    val party = outcome.partyOrNull()
    val dimens = LocalDimens.current
    var picking by remember(outcome) { mutableStateOf(false) }

    LaunchedEffect(outcome) {
        visual.autoDismissMillis?.let {
            kotlinx.coroutines.delay(it)
            onDismiss()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(visual.ground)
            // Tap anywhere returns to the camera. No hit target to find, no back
            // button to hunt for. The primary action sits above this and
            // consumes its own taps.
            .clickable(onClick = onDismiss),
    ) {
        // VIP is the one state that MOVES. A slow sweep of light across the gold
        // — so it is recognised before a single word has been read, which is the
        // whole requirement for the state.
        if (visual == ResultVisual.Vip) {
            VipShimmer()
        }

        // Already-arrived is flooded from the top with its band colour. This is
        // the second signal that separates it from not-found, since both states
        // are light: one is drenched in amber, one has no colour at all.
        if (visual == ResultVisual.Already) {
            Box(
                Modifier
                    .fillMaxWidth()
                    .height(14.dp)
                    .background(BandAlready),
            )
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(
                    start = dimens.screenPadding,
                    end = dimens.screenPadding,
                    top = dimens.screenPadding * 0.55f,
                    bottom = dimens.screenPadding * 0.45f,
                ),
        ) {
            // The content region is weighted and the action is NOT. If a very
            // long name and a very long table name ever exceed the height, this
            // region clips — the button never moves off the bottom of the
            // screen. Losing a descender is survivable; losing the button is not.
            Column(
                modifier = Modifier.weight(1f).fillMaxWidth(),
                verticalArrangement = Arrangement.Center,
            ) {
                when (visual) {
                    ResultVisual.Welcome, ResultVisual.Vip ->
                        WelcomeContent(
                            party = party,
                            visual = visual,
                            noKidsAllowed = noKidsAllowed,
                            wasExpired = outcome is CheckInRepository.ScanOutcome.Expired,
                        )

                    ResultVisual.Already -> AlreadyContent(party = party, visual = visual)

                    ResultVisual.NotFound -> NotFoundContent(visual = visual)
                }
            }

            Spacer(Modifier.height(20.dp))

            ResultActions(
                visual = visual,
                party = party,
                isSupervisor = isSupervisor,
                onAdmit = onAdmit,
                onOverride = onOverride,
                onSearch = onSearch,
                onPickMembers = { picking = true },
            )
        }

        if (picking && party != null) {
            MemberPickerOverlay(
                party = party,
                onConfirm = { ids ->
                    picking = false
                    onAdmit(party, ids)
                },
                onCancel = { picking = false },
            )
        }
    }
}

// ── The four states ──────────────────────────────────────────────────────────

@Composable
private fun WelcomeContent(
    party: CheckInRepository.PartyView?,
    visual: ResultVisual,
    noKidsAllowed: Boolean,
    wasExpired: Boolean,
) {
    if (party == null) return
    val on = visual.onGround

    SectionLabel(
        text = stringResource(
            if (visual == ResultVisual.Vip) R.string.result_welcome_vip else R.string.result_welcome,
        ),
        color = on.copy(alpha = 0.75f),
    )
    Spacer(Modifier.height(10.dp))

    GuestName(party.label, on)
    Spacer(Modifier.height(18.dp))
    TableBlock(party.tableName, on)

    // Everything below is present but quiet: an usher reads it only if the
    // guest asks. It never competes with the name or the table.
    val details = buildList {
        add(stringResource(R.string.result_party_of, party.members.size))
        party.members.mapNotNull { it.mealSelection }.distinct().takeIf { it.isNotEmpty() }
            ?.let { add(it.joinToString(", ")) }
        if (wasExpired) add(stringResource(R.string.result_expired_note))
        if (noKidsAllowed) add(stringResource(R.string.result_no_kids))
    }

    Spacer(Modifier.height(16.dp))
    QuietLine(details.joinToString("  ·  "), on)

    party.notes?.takeIf { it.isNotBlank() }?.let {
        Spacer(Modifier.height(6.dp))
        QuietLine(stringResource(R.string.result_note, it), on)
    }
}

@Composable
private fun AlreadyContent(party: CheckInRepository.PartyView?, visual: ResultVisual) {
    if (party == null) return
    val on = visual.onGround

    SectionLabel(stringResource(R.string.result_already_title), color = on)
    Spacer(Modifier.height(10.dp))

    GuestName(party.label, on)
    Spacer(Modifier.height(18.dp))
    // The same size rule as a welcome. The old screen shrank the table here to
    // below the name, which made the two states read as different LAYOUTS as
    // well as different colours — one more thing to learn at a door.
    TableBlock(party.tableName, on)

    Spacer(Modifier.height(16.dp))

    // WHO admitted them and WHEN: the two facts that settle a dispute at the
    // door without anyone having to look something up.
    party.arrived.take(MAX_ARRIVAL_LINES).forEach { member ->
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
        QuietLine("${member.fullName} — $detail", on)
    }
}

@Composable
private fun NotFoundContent(visual: ResultVisual) {
    val on = visual.onGround

    SectionLabel(stringResource(R.string.result_not_found_title), color = on.copy(alpha = 0.7f))
    Spacer(Modifier.height(14.dp))
    // Calm, and never an error. A guest standing here has done nothing wrong,
    // and neither has the usher — the screen offers the next step instead of a
    // diagnosis. There is deliberately no red anywhere on it.
    Text(
        stringResource(R.string.result_not_found_body),
        style = MaterialTheme.typography.displayMedium,
        color = on,
        maxLines = 3,
        overflow = TextOverflow.Ellipsis,
    )
}

// ── Shared pieces ────────────────────────────────────────────────────────────

@Composable
private fun GuestName(name: String, color: Color) {
    Text(
        text = name,
        // The face is chosen from the STRING, not the app locale: the display
        // face has no Arabic glyphs, and most guests here have Arabic names.
        // Without this the name silently falls back to the system font while
        // everything around it stays in the brand face.
        style = MaterialTheme.typography.displayLarge.copy(
            fontFamily = displayFamilyFor(name),
        ),
        color = color,
        maxLines = 2,
        overflow = TextOverflow.Ellipsis,
    )
}

/**
 * The table. The largest element on the screen, by requirement.
 *
 * A small tracked label above a very large value, rather than the words "Table
 * 12" set together — so the part that gets read across a room is the number
 * alone, at full size, with nothing beside it.
 */
@Composable
private fun TableBlock(tableName: String?, color: Color) {
    val compact = LocalDimens.current === Dimens.Compact

    if (tableName.isNullOrBlank()) {
        Text(
            stringResource(R.string.result_no_table),
            style = MaterialTheme.typography.headlineLarge,
            color = color.copy(alpha = 0.8f),
            maxLines = 1,
        )
        return
    }

    SectionLabel(stringResource(R.string.result_table_label), color = color.copy(alpha = 0.7f))
    Spacer(Modifier.height(2.dp))
    Text(
        text = tableName,
        style = MaterialTheme.typography.displayLarge.copy(
            fontSize = tableDisplaySize(tableName, compact),
            // Line height must follow the computed size or a 140sp glyph is
            // clipped by the 66sp line box inherited from the style.
            lineHeight = tableDisplaySize(tableName, compact) * 1.05f,
            fontFamily = displayFamilyFor(tableName),
        ),
        color = color,
        fontWeight = FontWeight.Bold,
        maxLines = 2,
        overflow = TextOverflow.Ellipsis,
    )
}

@Composable
private fun QuietLine(text: String, color: Color) {
    Text(
        text = text,
        style = MaterialTheme.typography.bodyLarge,
        color = color.copy(alpha = 0.72f),
        maxLines = 2,
        overflow = TextOverflow.Ellipsis,
    )
}

/**
 * The bottom of the screen. Exactly one primary action in every state.
 *
 * No state is a dead end: a welcome admits, an already-arrived either overrides
 * or explains, and a not-found goes straight to manual search.
 */
@Composable
private fun ResultActions(
    visual: ResultVisual,
    party: CheckInRepository.PartyView?,
    isSupervisor: Boolean,
    onAdmit: (CheckInRepository.PartyView, List<String>) -> Unit,
    onOverride: (CheckInRepository.PartyView, List<String>) -> Unit,
    onSearch: () -> Unit,
    onPickMembers: () -> Unit,
) {
    val on = visual.onGround

    when (visual) {
        ResultVisual.Welcome, ResultVisual.Vip -> {
            if (party == null) return
            val unarrived = party.unarrived
            Column {
                PrimaryAction(
                    text = if (unarrived.size > 1) {
                        stringResource(R.string.result_admit_all, unarrived.size)
                    } else {
                        stringResource(R.string.result_admit)
                    },
                    onClick = { onAdmit(party, unarrived.map { it.guestId }) },
                    enabled = unarrived.isNotEmpty(),
                    // On a coloured ground the button inverts: the ground's own
                    // text colour becomes the button, and the ground becomes the
                    // label. Gold on gold would disappear.
                    containerColor = on,
                    contentColor = visual.ground,
                    hero = true,
                )
                // The partial-arrival path (§9.1), kept off the door. Most
                // parties walk in together; the ones that do not are rare
                // enough to afford one extra tap.
                if (party.members.size > 1) {
                    Spacer(Modifier.height(4.dp))
                    QuietAction(
                        text = stringResource(R.string.result_not_everyone),
                        onClick = onPickMembers,
                        contentColor = on.copy(alpha = 0.8f),
                    )
                }
            }
        }

        ResultVisual.Already -> {
            if (party == null) return
            if (isSupervisor) {
                // §9.5: a photographed ticket resolves here, and admitting again
                // requires an override that is recorded in the audit trail.
                PrimaryAction(
                    text = stringResource(R.string.result_override),
                    onClick = { onOverride(party, party.arrived.map { it.guestId }) },
                    containerColor = StateAttention,
                    contentColor = Color.White,
                )
            } else {
                QuietLine(stringResource(R.string.result_override_unavailable), on)
            }
        }

        ResultVisual.NotFound -> PrimaryAction(
            text = stringResource(R.string.scanner_search),
            onClick = onSearch,
            hero = true,
        )
    }
}

/**
 * One slow pass of light across the VIP ground.
 *
 * Drawn on a Canvas rather than as an animated Brush modifier so the sweep is
 * expressed in the canvas's own pixels — there is no correct dp constant for
 * "one screen width", and a gradient anchored to a guessed size behaves
 * differently on every tablet.
 *
 * Deliberately slow (2.6s) and deliberately faint (16% white). A fast or bright
 * shimmer reads as a loading skeleton; this has to read as expensive.
 */
@Composable
private fun VipShimmer() {
    val transition = rememberInfiniteTransition(label = "vip")
    val progress by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(Motion.shimmer(), RepeatMode.Restart),
        label = "sweep",
    )

    Canvas(Modifier.fillMaxSize()) {
        val w = size.width
        // Travels from fully off the start edge to fully off the end edge.
        val head = -w * 0.5f + progress * (w * 2f)
        val halfBand = w * 0.22f
        drawRect(
            brush = Brush.linearGradient(
                colors = listOf(
                    Color.Transparent,
                    Color.White.copy(alpha = 0.16f),
                    Color.Transparent,
                ),
                start = Offset(head - halfBand, 0f),
                end = Offset(head + halfBand, size.height),
            ),
        )
    }
}

/**
 * Choosing which members of a party arrived (§9.1).
 *
 * This used to sit on the result screen itself, where it made every single
 * admission — including the overwhelming majority that are a whole party
 * walking in together — into a reading task with a scrollable list in it.
 *
 * Here it is one tap away and nowhere near the two-second path.
 */
@Composable
private fun MemberPickerOverlay(
    party: CheckInRepository.PartyView,
    onConfirm: (List<String>) -> Unit,
    onCancel: () -> Unit,
) {
    val dimens = LocalDimens.current
    val selected = remember(party.partyId) {
        mutableStateListOf<String>().apply { addAll(party.unarrived.map { it.guestId }) }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            // Swallows taps so the result screen's dismiss-anywhere does not
            // fire through the overlay and throw away the selection.
            //
            // It must be an ENABLED clickable with the indication suppressed. A
            // `clickable(enabled = false)` does not consume the event — it opts
            // out of input entirely, so every tap would pass straight through to
            // the dismiss handler underneath.
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                onClick = {},
            )
            .padding(dimens.screenPadding),
    ) {
        Column(Modifier.fillMaxSize()) {
            Text(
                stringResource(R.string.result_choose_who),
                style = MaterialTheme.typography.headlineLarge,
                color = MaterialTheme.colorScheme.onBackground,
            )
            Spacer(Modifier.height(16.dp))

            LazyColumn(
                modifier = Modifier.weight(1f).fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(8.dp),
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
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                PrimaryAction(
                    text = stringResource(R.string.result_admit_all, selected.size),
                    onClick = { onConfirm(selected.toList()) },
                    enabled = selected.isNotEmpty(),
                    modifier = Modifier.weight(2f),
                )
                SecondaryAction(
                    text = stringResource(R.string.action_cancel),
                    onClick = onCancel,
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}

@Composable
private fun MemberRow(
    member: CheckInRepository.GuestView,
    checked: Boolean,
    onToggle: () -> Unit,
) {
    val dimens = LocalDimens.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(dimens.cardRadius))
            .background(MaterialTheme.colorScheme.surfaceVariant)
            // The whole row is the target, not just the checkbox. A 24dp
            // checkbox is not a touch target on a tablet held in one hand.
            .clickable(enabled = !member.alreadyArrived, onClick = onToggle)
            .heightIn(min = dimens.minTouch)
            .padding(horizontal = 20.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Checkbox(
            checked = checked,
            // An already-arrived member cannot be re-selected here; that path is
            // the supervisor override, which is deliberately harder to reach.
            enabled = !member.alreadyArrived,
            onCheckedChange = { onToggle() },
            colors = CheckboxDefaults.colors(checkedColor = MaterialTheme.colorScheme.primary),
        )
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(
                member.fullName,
                style = MaterialTheme.typography.titleMedium.copy(
                    fontFamily = displayFamilyFor(member.fullName),
                ),
                color = if (member.alreadyArrived) {
                    MaterialTheme.colorScheme.onSurfaceVariant
                } else {
                    MaterialTheme.colorScheme.onBackground
                },
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            listOfNotNull(
                member.mealSelection?.let { stringResource(R.string.result_meal, it) },
                member.dietaryNotes?.takeIf { it.isNotBlank() }
                    ?.let { stringResource(R.string.result_dietary, it) },
            ).takeIf { it.isNotEmpty() }?.let {
                Text(
                    it.joinToString("  ·  "),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
        if (member.alreadyArrived) {
            Spacer(Modifier.width(12.dp))
            Text(
                stringResource(R.string.search_arrived_badge),
                style = MaterialTheme.typography.labelMedium,
                color = StateAlready,
            )
        }
    }
}

/**
 * How many arrival lines the already-state prints.
 *
 * A party of twelve would otherwise push the override button off the screen.
 * Four is enough to settle an argument; the full list is in the guest list.
 */
private const val MAX_ARRIVAL_LINES = 4
