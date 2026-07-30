package com.fancyrsvp.checkin.ui.entrance

import androidx.compose.animation.core.EaseInOutSine
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import kotlinx.coroutines.delay
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.fancyrsvp.checkin.R
import com.fancyrsvp.checkin.ui.theme.EventBranding

/**
 * Entrance display mode (spec §8.8).
 *
 * "A separate full-screen presentation mode intended for a large screen at the venue
 * entrance: live arrival counter with elegant typography and subtle motion, in the
 * event's branding. No operational controls visible. This is a showcase feature —
 * visual quality is the entire point of it."
 *
 * Three consequences of "no operational controls":
 *
 *  • Nothing here is tappable. Guests walk past this screen and will touch it.
 *  • No guest NAMES appear. A wall-mounted display listing who has arrived at a
 *    private event is a disclosure to everyone in the lobby — the counter is the
 *    showcase, the guest list is not.
 *  • No connection state, no pending count, no staff name. Those are operator
 *    concerns, and §17.7's language rules exist because staff read them; a guest
 *    reading "Offline — 3 pending" learns only that something is wrong.
 *
 * Per decision D-10 this is intended for separate hardware or a second paired
 * tablet: one device cannot both scan and present.
 */
@Composable
fun EntranceDisplayScreen(
    eventId: String,
    viewModel: EntranceDisplayViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()

    LaunchedEffect(eventId) { viewModel.start(eventId) }

    val accent = EventBranding.accentFor(
        state?.brandingColorHex,
        MaterialTheme.colorScheme.background,
    )

    Surface(modifier = Modifier.fillMaxSize()) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    // A very soft vertical wash rather than a flat fill: on a large
                    // screen a single flat colour reads as a broken display.
                    Brush.verticalGradient(
                        listOf(
                            MaterialTheme.colorScheme.background,
                            accent.copy(alpha = 0.10f),
                        ),
                    ),
                ),
            contentAlignment = Alignment.Center,
        ) {
            val current = state
            if (current == null) {
                Text(
                    stringResource(R.string.entrance_waiting),
                    style = MaterialTheme.typography.headlineMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                return@Box
            }

            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
                modifier = Modifier.padding(64.dp),
            ) {
                Text(
                    text = current.eventName,
                    style = MaterialTheme.typography.headlineLarge,
                    color = accent,
                    textAlign = TextAlign.Center,
                )

                Spacer(Modifier.height(48.dp))

                // The counter. Animated so an arrival is VISIBLE from across a lobby
                // — a number that silently changes is indistinguishable from a static
                // sign.
                ArrivalCounter(count = current.arrived, accent = accent)

                Spacer(Modifier.height(16.dp))

                Text(
                    text = stringResource(R.string.entrance_guests_arrived),
                    style = MaterialTheme.typography.titleLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                )

                if (current.totalInvited > 0) {
                    Spacer(Modifier.height(40.dp))
                    ProgressBar(
                        fraction = current.arrived.toFloat() / current.totalInvited,
                        accent = accent,
                    )
                }
            }

            // A slow breathing accent line at the base. Subtle motion, per §8.8 —
            // enough to read as "live" without competing with the counter.
            BreathingRule(
                accent = accent,
                modifier = Modifier.align(Alignment.BottomCenter),
            )
        }
    }
}

/**
 * The arrival number, at display scale.
 *
 * The scale bump on change is deliberately small and slow: a large screen in a lobby
 * is peripheral vision for most people, and an aggressive animation reads as an
 * error state rather than a welcome.
 */
@Composable
private fun ArrivalCounter(count: Int, accent: androidx.compose.ui.graphics.Color) {
    // A brief swell on each change, then back. Driven by a target that actually
    // moves when `count` does — animating toward a constant would compile, run, and
    // do nothing, which is worse than no animation because it looks intentional.
    var target by remember { mutableStateOf(1f) }
    LaunchedEffect(count) {
        // Skipped on first composition: the display should come up settled, not
        // pulse once for a number that did not just change.
        if (count > 0) {
            target = 1.06f
            delay(180)
            target = 1f
        }
    }

    val scale by animateFloatAsState(
        targetValue = target,
        animationSpec = tween(durationMillis = 420, easing = EaseInOutSine),
        label = "counter-scale",
    )

    Text(
        text = "$count",
        fontSize = (180 * scale).sp,
        lineHeight = (190 * scale).sp,
        fontWeight = FontWeight.Bold,
        color = accent,
        textAlign = TextAlign.Center,
    )
}

@Composable
private fun ProgressBar(
    fraction: Float,
    accent: androidx.compose.ui.graphics.Color,
) {
    val animated by animateFloatAsState(
        targetValue = fraction.coerceIn(0f, 1f),
        animationSpec = tween(durationMillis = 900, easing = EaseInOutSine),
        label = "entrance-progress",
    )

    Box(
        modifier = Modifier
            .fillMaxWidth(0.6f)
            .height(10.dp)
            .clip(RoundedCornerShape(5.dp))
            .background(MaterialTheme.colorScheme.onBackground.copy(alpha = 0.12f)),
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth(animated)
                .height(10.dp)
                .clip(RoundedCornerShape(5.dp))
                .background(accent),
        )
    }
}

@Composable
private fun BreathingRule(
    accent: androidx.compose.ui.graphics.Color,
    modifier: Modifier = Modifier,
) {
    val transition = rememberInfiniteTransition(label = "breath")
    val alpha by transition.animateFloat(
        initialValue = 0.25f,
        targetValue = 0.7f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 4_000, easing = EaseInOutSine),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "breath-alpha",
    )

    Row(
        modifier = modifier.fillMaxWidth().padding(bottom = 48.dp),
        horizontalArrangement = Arrangement.Center,
    ) {
        Box(
            modifier = Modifier
                .width(160.dp)
                .height(3.dp)
                .alpha(alpha)
                .clip(RoundedCornerShape(2.dp))
                .background(accent),
        )
    }
}
