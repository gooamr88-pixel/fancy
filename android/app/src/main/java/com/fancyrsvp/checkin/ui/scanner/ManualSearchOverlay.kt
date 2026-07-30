package com.fancyrsvp.checkin.ui.scanner

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import com.fancyrsvp.checkin.R
import com.fancyrsvp.checkin.data.repo.CheckInRepository
import com.fancyrsvp.checkin.ui.theme.StateAlready
import com.fancyrsvp.checkin.ui.theme.StateVip
import kotlinx.coroutines.delay

/**
 * Offline manual search (spec §8.5, §10).
 *
 * The fallback that makes every other failure survivable: a damaged or dirty
 * printed code, a guest with no invitation at all, a phone screen too dim to
 * scan. §10 requires it to be reachable in one tap from anywhere, which is why it
 * is an overlay rather than a separate destination — dismissing it returns to a
 * live camera with no navigation transition.
 *
 * Search runs entirely against the local bundle. It matches on NORMALISED names
 * (see NameNormalizer), so أحمد is found by typing احمد and a companion is found
 * by their own name rather than only by their party label.
 */
@Composable
fun ManualSearchOverlay(
    onSearch: suspend (String) -> List<CheckInRepository.PartyView>,
    onSelect: (CheckInRepository.PartyView) -> Unit,
    onClose: () -> Unit,
) {
    var query by remember { mutableStateOf("") }
    var results by remember { mutableStateOf<List<CheckInRepository.PartyView>>(emptyList()) }
    var searching by remember { mutableStateOf(false) }
    val focusRequester = remember { FocusRequester() }

    // Focus the field immediately. An usher taps "search" because there is someone
    // in front of them; making them tap the field as well costs a second every time.
    LaunchedEffect(Unit) { focusRequester.requestFocus() }

    // Debounced so a 2000-guest LIKE scan does not run on every keystroke. 180ms is
    // below the threshold where typing feels laggy but well above a single
    // keypress, so a full name costs one query rather than twenty.
    LaunchedEffect(query) {
        if (query.isBlank()) {
            results = emptyList()
            searching = false
            return@LaunchedEffect
        }
        searching = true
        delay(180)
        results = onSearch(query)
        searching = false
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background.copy(alpha = 0.96f)),
    ) {
        Column(modifier = Modifier.fillMaxSize().padding(32.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    stringResource(R.string.search_title),
                    style = MaterialTheme.typography.headlineMedium,
                )
                Spacer(Modifier.weight(1f))
                OutlinedButton(onClick = onClose, modifier = Modifier.height(56.dp)) {
                    Text(stringResource(R.string.search_close))
                }
            }

            Spacer(Modifier.height(20.dp))

            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                label = { Text(stringResource(R.string.search_hint)) },
                singleLine = true,
                textStyle = MaterialTheme.typography.titleLarge,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                modifier = Modifier
                    .fillMaxWidth()
                    .focusRequester(focusRequester),
            )

            Spacer(Modifier.height(20.dp))

            if (query.isNotBlank() && results.isEmpty() && !searching) {
                Text(
                    stringResource(R.string.search_no_results, query),
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            LazyColumn(
                modifier = Modifier.fillMaxWidth().fillMaxHeight(),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                items(results, key = { it.partyId }) { party ->
                    SearchResultRow(party = party, onClick = { onSelect(party) })
                }
            }
        }
    }
}

@Composable
private fun SearchResultRow(
    party: CheckInRepository.PartyView,
    onClick: () -> Unit,
) {
    val fullyArrived = party.unarrived.isEmpty()

    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(20.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(party.label, style = MaterialTheme.typography.titleLarge)
                    if (party.hasVip) {
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
                Spacer(Modifier.height(4.dp))
                // Party members listed, because the match may well have been on a
                // companion's name rather than the label shown above it.
                Text(
                    text = party.members.joinToString(", ") { it.fullName },
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            Spacer(Modifier.width(16.dp))

            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = party.tableName ?: stringResource(R.string.result_no_table),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                )
                if (fullyArrived) {
                    Spacer(Modifier.height(4.dp))
                    Text(
                        stringResource(R.string.search_arrived_badge).uppercase(),
                        style = MaterialTheme.typography.bodyMedium,
                        color = StateAlready,
                        fontWeight = FontWeight.Bold,
                    )
                } else if (party.arrived.isNotEmpty()) {
                    // Partial arrival: the count is what tells an usher whether the
                    // people in front of them are the ones still expected (§9.1).
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "${party.arrived.size}/${party.members.size}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = StateAlready,
                    )
                }
            }
        }
    }
}
