package com.fancyrsvp.checkin.ui.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import com.fancyrsvp.checkin.R

/**
 * The recorded stack trace from the last crash, on screen (§21.6).
 *
 * ── Why it lives here rather than inside PairScreen ──
 *
 * It was written as a private composable on the pairing screen, which is the one
 * screen a working tablet NEVER returns to — pairing happens once per install, in
 * an office. So a crash at a venue wrote a perfectly good report to a file that
 * nobody could reach without a cable and a laptop, and the bug report stayed "it
 * closed". The menu shows it too now; this is the shared body.
 *
 * Selectable and monospaced because the only thing anyone does with it is copy it
 * into a message to support.
 */
@Composable
fun CrashReportScreen(report: String, onDismiss: () -> Unit) {
    Surface(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp)
                .verticalScroll(rememberScrollState()),
        ) {
            Text(
                text = stringResource(R.string.pair_previous_crash),
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.error,
            )
            Spacer(Modifier.height(16.dp))

            SelectionContainer {
                Text(
                    text = report,
                    style = MaterialTheme.typography.bodySmall,
                    fontFamily = FontFamily.Monospace,
                    modifier = Modifier.fillMaxWidth(),
                )
            }

            Spacer(Modifier.height(24.dp))
            PrimaryAction(
                text = stringResource(R.string.pair_dismiss_crash),
                onClick = onDismiss,
            )
            Spacer(Modifier.height(24.dp))
        }
    }
}
