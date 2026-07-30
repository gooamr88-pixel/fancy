package com.fancyrsvp.checkin.ui.scanner

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
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.fancyrsvp.checkin.R
import com.fancyrsvp.checkin.device.DeviceStatusMonitor
import com.fancyrsvp.checkin.ui.theme.StateAlready
import com.fancyrsvp.checkin.ui.theme.StateAttention

/**
 * Battery warnings (spec §21.9).
 *
 * "At 20%, a persistent visible warning. At 10%, a blocking modal that must be
 * dismissed deliberately, stating the pending queue count."
 *
 * ── Why the copy changes with the queue ──
 *
 * §21.9: "the warning must communicate stakes, not just battery level." A tablet
 * dying with unsynced check-ins is permanent data loss (§21.7) — those arrivals exist
 * on this device and nowhere else. So the critical modal states how many are at risk,
 * and says something different when the queue is empty.
 *
 * That difference matters: warning a supervisor about losing check-ins when there are
 * none to lose is how staff learn to dismiss the warning that counts.
 */
@Composable
fun BatteryBanner(
    status: DeviceStatusMonitor.Status,
    modifier: Modifier = Modifier,
) {
    // Charging cancels the warning entirely — the problem is being solved, and a
    // banner that persists while someone holds a charger is noise.
    if (status.isCharging || !status.isBatteryLow || status.isBatteryCritical) return

    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(StateAlready.copy(alpha = 0.22f))
            .padding(horizontal = 24.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        Text(
            text = stringResource(R.string.battery_low),
            style = MaterialTheme.typography.titleMedium,
            color = StateAlready,
            fontWeight = FontWeight.Bold,
        )
    }
}

/**
 * The 10% blocking modal.
 *
 * Deliberately covers the screen and requires an explicit tap. §21.9 calls for
 * "a blocking modal that must be dismissed deliberately" — a toast or a banner at
 * this level would be glanced past, and the consequence is unrecoverable.
 *
 * It does NOT stop scanning once dismissed. Nothing in this app may stop a door
 * (§5.1); the modal exists to make sure a human has seen the stakes, not to gate
 * admissions.
 */
@Composable
fun BatteryCriticalDialog(
    status: DeviceStatusMonitor.Status,
    pendingCount: Int,
    onDismiss: () -> Unit,
) {
    if (status.isCharging || !status.isBatteryCritical) return

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background.copy(alpha = 0.94f)),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(48.dp).widthIn(max = 720.dp),
        ) {
            Text(
                text = "${status.batteryPercent ?: 0}%",
                style = MaterialTheme.typography.displayLarge,
                fontWeight = FontWeight.Bold,
                color = StateAttention,
            )

            Spacer(Modifier.height(24.dp))

            Text(
                text = if (pendingCount > 0) {
                    stringResource(R.string.battery_critical, pendingCount)
                } else {
                    stringResource(R.string.battery_critical_clean)
                },
                style = MaterialTheme.typography.headlineMedium,
                color = MaterialTheme.colorScheme.onBackground,
                textAlign = TextAlign.Center,
            )

            Spacer(Modifier.height(40.dp))

            Button(
                onClick = onDismiss,
                colors = ButtonDefaults.buttonColors(containerColor = StateAttention),
                modifier = Modifier.height(72.dp).widthIn(min = 320.dp),
            ) {
                Text(
                    stringResource(R.string.action_ok),
                    style = MaterialTheme.typography.titleLarge,
                )
            }
        }
    }
}
