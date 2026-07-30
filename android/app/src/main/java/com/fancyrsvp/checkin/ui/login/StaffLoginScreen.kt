package com.fancyrsvp.checkin.ui.login

import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.fancyrsvp.checkin.R
import com.fancyrsvp.checkin.ui.theme.StateAttention
import java.text.DateFormat
import java.util.Date

/**
 * Staff login (spec §8.1, §18.5).
 *
 * Pick a name, type four digits. No email, no password — door staff may be
 * temporary hires who cannot be expected to hold platform credentials, and the
 * venue may have no connectivity at all.
 *
 * Staff switching is one tap back to the picker, because handover happens
 * mid-rush (§18.5).
 */
@Composable
fun StaffLoginScreen(
    eventId: String,
    onLoggedIn: (staffId: String, displayName: String, role: String) -> Unit,
    viewModel: StaffLoginViewModel = hiltViewModel(),
) {
    val roster by viewModel.roster.collectAsState()
    val state by viewModel.state.collectAsState()
    var selected by remember { mutableStateOf<StaffLoginViewModel.StaffOption?>(null) }
    var pin by remember { mutableStateOf("") }

    LaunchedEffect(eventId) { viewModel.loadRoster(eventId) }

    LaunchedEffect(state) {
        val current = state
        if (current is StaffLoginViewModel.State.Success) {
            onLoggedIn(current.staffId, current.displayName, current.role)
        }
        // Clear the entry on any failure so the next attempt starts from empty
        // rather than appending to a wrong PIN.
        if (current is StaffLoginViewModel.State.WrongPin ||
            current is StaffLoginViewModel.State.LockedOut
        ) {
            pin = ""
        }
    }

    Surface(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier.fillMaxSize().padding(40.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            val current = selected
            if (current == null) {
                Text(
                    stringResource(R.string.login_title),
                    style = MaterialTheme.typography.headlineLarge,
                )
                Spacer(Modifier.height(24.dp))

                if (state is StaffLoginViewModel.State.RosterEmpty && roster.isEmpty()) {
                    Text(
                        stringResource(R.string.login_roster_empty),
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                    )
                }

                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.fillMaxWidth(0.7f),
                ) {
                    items(roster, key = { it.staffId }) { option ->
                        StaffRow(
                            option = option,
                            onClick = {
                                selected = option
                                pin = ""
                                viewModel.clearError()
                            },
                        )
                    }
                }
            } else {
                PinEntry(
                    staff = current,
                    pin = pin,
                    state = state,
                    onDigit = { digit ->
                        if (pin.length < PIN_LENGTH) {
                            pin += digit
                            if (pin.length == PIN_LENGTH) {
                                viewModel.submitPin(current.staffId, pin)
                            }
                        }
                    },
                    onBackspace = { if (pin.isNotEmpty()) pin = pin.dropLast(1) },
                    onBack = {
                        selected = null
                        pin = ""
                        viewModel.clearError()
                    },
                )
            }
        }
    }
}

@Composable
private fun StaffRow(
    option: StaffLoginViewModel.StaffOption,
    onClick: () -> Unit,
) {
    val locked = option.isLocked()
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant,
        ),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(20.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(option.displayName, style = MaterialTheme.typography.titleLarge)
                Text(
                    text = stringResource(
                        if (option.role == "supervisor") {
                            R.string.login_role_supervisor
                        } else {
                            R.string.login_role_usher
                        },
                    ),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                if (locked && option.lockedUntil != null) {
                    Text(
                        text = DateFormat.getTimeInstance(DateFormat.SHORT)
                            .format(Date(option.lockedUntil)),
                        style = MaterialTheme.typography.bodyMedium,
                        color = StateAttention,
                    )
                }
            }
            // A locked entry is still tappable: the PIN screen is where a
            // supervisor performs the offline reset (§21.8), so blocking entry
            // here would remove the only recovery path at a venue.
            Button(onClick = onClick, modifier = Modifier.height(52.dp)) {
                Text(stringResource(R.string.action_ok))
            }
        }
    }
}

@Composable
private fun PinEntry(
    staff: StaffLoginViewModel.StaffOption,
    pin: String,
    state: StaffLoginViewModel.State,
    onDigit: (Char) -> Unit,
    onBackspace: () -> Unit,
    onBack: () -> Unit,
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            stringResource(R.string.login_enter_pin, staff.displayName),
            style = MaterialTheme.typography.headlineMedium,
            textAlign = TextAlign.Center,
        )

        Spacer(Modifier.height(20.dp))

        // Masked, but showing how many digits have been entered — a door PIN is
        // typed while people are watching, and a blank field gives no feedback at
        // all on a tablet with no haptics.
        Text(
            text = buildString {
                repeat(pin.length) { append("●  ") }
                repeat(PIN_LENGTH - pin.length) { append("○  ") }
            }.trim(),
            fontSize = 40.sp,
            color = MaterialTheme.colorScheme.primary,
        )

        Spacer(Modifier.height(16.dp))

        when (state) {
            is StaffLoginViewModel.State.Verifying -> {
                // The 600k-iteration derivation is deliberately slow (§18.5) and
                // can exceed a second on a low-end tablet. Without this, staff
                // would assume the tap did not register and try again.
                CircularProgressIndicator()
                Spacer(Modifier.height(8.dp))
                Text(
                    stringResource(R.string.login_verifying),
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
            is StaffLoginViewModel.State.WrongPin -> Text(
                stringResource(R.string.login_wrong_pin, state.attemptsRemaining),
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.error,
            )
            is StaffLoginViewModel.State.LockedOut -> Text(
                stringResource(R.string.login_locked_out),
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.error,
                textAlign = TextAlign.Center,
            )
            else -> Spacer(Modifier.height(28.dp))
        }

        Spacer(Modifier.height(24.dp))

        Keypad(
            enabled = state !is StaffLoginViewModel.State.Verifying,
            onDigit = onDigit,
            onBackspace = onBackspace,
        )

        Spacer(Modifier.height(24.dp))

        OutlinedButton(onClick = onBack, modifier = Modifier.height(52.dp)) {
            Text(stringResource(R.string.action_cancel))
        }
    }
}

/**
 * An on-screen keypad rather than the system keyboard.
 *
 * The IME on a tablet covers half the screen, varies by device, and can be
 * swapped for one that logs input. Large fixed keys are also simply faster for a
 * four-digit entry made repeatedly through a shift.
 */
@Composable
private fun Keypad(
    enabled: Boolean,
    onDigit: (Char) -> Unit,
    onBackspace: () -> Unit,
) {
    val rows = listOf("123", "456", "789")
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        rows.forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                row.forEach { digit ->
                    KeypadKey(digit.toString(), enabled) { onDigit(digit) }
                }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Spacer(Modifier.size(88.dp))
            KeypadKey("0", enabled) { onDigit('0') }
            KeypadKey("⌫", enabled) { onBackspace() }
        }
    }
}

@Composable
private fun KeypadKey(
    label: String,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = Modifier.size(88.dp),
    ) {
        Text(label, fontSize = 32.sp)
    }
}

private const val PIN_LENGTH = 4
