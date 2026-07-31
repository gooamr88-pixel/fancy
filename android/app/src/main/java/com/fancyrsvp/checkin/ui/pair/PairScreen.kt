package com.fancyrsvp.checkin.ui.pair

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.fancyrsvp.checkin.CrashLog
import com.fancyrsvp.checkin.R
import com.fancyrsvp.checkin.ui.components.PrimaryAction
import com.fancyrsvp.checkin.ui.theme.LocalDimens

/**
 * Device pairing (spec §18.3).
 *
 * The first screen an unpaired tablet shows. Deliberately sparse: an operator does
 * this once, in an office, with the code on another screen in front of them.
 */
@Composable
fun PairScreen(
    onPaired: (eventId: String) -> Unit,
    viewModel: PairViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()
    val code by viewModel.code.collectAsState()

    val context = LocalContext.current
    var crashReport by remember { mutableStateOf(CrashLog.read(context)) }

    // Takes over the WHOLE screen rather than being appended below the form.
    // The pairing Column is centred and does not scroll, so anything added under
    // the button is pushed off the bottom of the display and cannot be read —
    // which is exactly what happened the first time this was built.
    crashReport?.let { report ->
        CrashReportScreen(
            report = report,
            onDismiss = {
                CrashLog.clear(context)
                crashReport = null
            },
        )
        return
    }

    LaunchedEffect(state) {
        val current = state
        if (current is PairViewModel.State.Paired) onPaired(current.eventId)
    }

    val dimens = LocalDimens.current

    Surface(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(dimens.screenPadding)
                // Scrollable because the keyboard covers roughly half a small
                // screen: without it the Pair button sits under the keyboard with
                // no way to reach it, which reads as the app ignoring the tap.
                .verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Text(
                text = stringResource(R.string.pair_title),
                style = MaterialTheme.typography.headlineLarge,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(16.dp))
            Text(
                text = stringResource(R.string.pair_instructions),
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )

            Spacer(Modifier.height(40.dp))

            OutlinedTextField(
                value = code,
                onValueChange = viewModel::onCodeChanged,
                enabled = state !is PairViewModel.State.Pairing,
                singleLine = true,
                label = { Text(stringResource(R.string.pair_code_hint)) },
                // Monospace, wide letter spacing, centred. An 8-character code is
                // read off one screen and typed into another; a proportional font
                // makes that error-prone. The server's alphabet already excludes
                // O/0 and I/1/L, and this makes what remains easy to check by eye.
                textStyle = TextStyle(
                    fontSize = dimens.codeFontSize,
                    // Letter spacing scales with the glyphs. Fixed 8sp against a
                    // smaller face pushes an 8-character code past the field.
                    letterSpacing = dimens.codeFontSize * 0.2f,
                    textAlign = TextAlign.Center,
                    fontFamily = FontFamily.Monospace,
                ),
                keyboardOptions = KeyboardOptions(
                    capitalization = KeyboardCapitalization.Characters,
                    imeAction = ImeAction.Done,
                ),
                keyboardActions = KeyboardActions(onDone = { viewModel.submit() }),
                modifier = Modifier
                    .fillMaxWidth()
                    .widthIn(min = dimens.codeFieldMin, max = dimens.codeFieldMax),
            )

            Spacer(Modifier.height(24.dp))

            when (val current = state) {
                is PairViewModel.State.Pairing -> CircularProgressIndicator()
                is PairViewModel.State.Error -> Text(
                    text = pairErrorText(current),
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.error,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
                else -> Unit
            }


            Spacer(Modifier.height(24.dp))

            Box(Modifier.widthIn(max = dimens.codeFieldMax)) {
                PrimaryAction(
                    text = stringResource(R.string.pair_submit),
                    onClick = viewModel::submit,
                    enabled = viewModel.canSubmit,
                    hero = true,
                )
            }
        }
    }
}

/**
 * The whole screen, given over to a crash from the previous run.
 *
 * A tablet at a venue has no adb, and the process simply vanishes — so this text
 * is the only account of what happened that anyone will ever get. It is
 * therefore full-screen and scrollable rather than tucked under the form, and
 * wrapped in a SelectionContainer so the operator can long-press, copy, and
 * paste it into a message instead of having to photograph and transcribe it.
 */
@Composable
private fun CrashReportScreen(report: String, onDismiss: () -> Unit) {
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

@Composable
private fun pairErrorText(error: PairViewModel.State.Error): String = when (error.kind) {
    PairViewModel.Kind.INVALID_CODE -> stringResource(R.string.pair_failed_invalid)
    PairViewModel.Kind.EXPIRED -> stringResource(R.string.pair_failed_expired)
    PairViewModel.Kind.DEVICE_LIMIT -> stringResource(R.string.pair_failed_limit)
    PairViewModel.Kind.OFFLINE -> stringResource(R.string.prepare_failed_offline)
    PairViewModel.Kind.SERVER -> error.detail ?: stringResource(R.string.prepare_failed_unknown)
}
