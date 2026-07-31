package com.fancyrsvp.checkin.ui.scanner

import android.Manifest
import android.content.pm.PackageManager
import android.view.HapticFeedbackConstants
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
// androidx.lifecycle.compose, not androidx.compose.ui.platform: the latter is
// deprecated as of Compose 1.7 and resolves to a different instance in a
// navigation graph, which would bind the camera to the wrong lifecycle.
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.fancyrsvp.checkin.R
import com.fancyrsvp.checkin.scan.QrAnalyzer
import com.fancyrsvp.checkin.ui.components.Chevron
import com.fancyrsvp.checkin.ui.components.PrimaryAction
import com.fancyrsvp.checkin.ui.components.SecondaryAction
import com.fancyrsvp.checkin.ui.components.StatusDot
import com.fancyrsvp.checkin.ui.theme.CameraScrim
import com.fancyrsvp.checkin.ui.theme.Gold
import com.fancyrsvp.checkin.ui.theme.LocalDimens
import com.fancyrsvp.checkin.ui.theme.OnCamera
import com.fancyrsvp.checkin.ui.theme.StateAlready
import com.fancyrsvp.checkin.ui.theme.StateAttention
import com.fancyrsvp.checkin.ui.theme.StateNeutral
import com.fancyrsvp.checkin.ui.theme.StateWelcome
import com.fancyrsvp.checkin.ui.theme.overlayEnter
import com.fancyrsvp.checkin.ui.theme.overlayExit
import com.fancyrsvp.checkin.ui.theme.resultEnter
import com.fancyrsvp.checkin.ui.theme.resultExit
import kotlinx.coroutines.delay
import java.util.concurrent.Executors

/**
 * The scanner. This is home.
 *
 * Staff spend the entire night here, and every other screen returns to it. That
 * makes its job narrow: show the camera, show the three numbers that matter,
 * and offer exactly three ways out — torch, search, menu — all of them visible,
 * labelled, and in the same place every time.
 *
 * ── What changed and why ──
 *
 * The menu used to be reachable ONLY by tapping the status strip, with nothing
 * indicating that the strip was tappable. That is a hidden affordance, and
 * temporary staff never found it. There is now a labelled MENU control on the
 * bar. The strip stays tappable as a bonus for anyone who discovers it, but
 * discovery is no longer required.
 */
@Composable
fun ScannerScreen(
    eventId: String,
    staffId: String?,
    staffName: String?,
    role: String,
    onOpenMenu: () -> Unit,
    viewModel: ScannerViewModel = hiltViewModel(),
) {
    val context = LocalContext.current
    val view = LocalView.current
    val lifecycleOwner = LocalLifecycleOwner.current

    val outcome by viewModel.outcome.collectAsState()
    val status by viewModel.status.collectAsState()
    val operator by viewModel.operator.collectAsState()
    val noKidsAllowed by viewModel.noKidsAllowed.collectAsState()
    val deviceStatus by viewModel.deviceStatus.collectAsState()
    val batteryAcknowledged by viewModel.batteryAcknowledged.collectAsState()

    var hasCameraPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
                PackageManager.PERMISSION_GRANTED,
        )
    }
    var torchOn by remember { mutableStateOf(false) }
    var showSearch by remember { mutableStateOf(false) }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted -> hasCameraPermission = granted }

    /*
     * Ask for the camera automatically, once, on arrival.
     *
     * The camera IS this screen. Previously the permission was only ever
     * requested by tapping "Allow camera" inside the no-camera fallback, which
     * means a fresh tablet opened to a screen explaining that scanning was
     * unavailable and left the operator to work out why. Nobody at a door is
     * going to diagnose a permission prompt that never appeared.
     *
     * Declining is still handled: the fallback takes over with manual search as
     * its primary action and keeps the grant button for later.
     */
    LaunchedEffect(Unit) {
        if (!hasCameraPermission) {
            permissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    LaunchedEffect(eventId) { viewModel.start(eventId, staffId, staffName, role) }

    /*
     * Haptics carry the state before the screen is read.
     *
     * At a loud venue this is often the only confirmation an usher reliably
     * gets, and it arrives while they are still looking at the guest. Every
     * outcome used to fire the same CONFIRM pulse, which made the feedback
     * meaningless — it said "something happened", never what.
     *
     * VIP gets a deliberate double pulse. That is the point of the state: it
     * should feel different before anyone has read a word of it.
     */
    LaunchedEffect(outcome) {
        val current = outcome ?: return@LaunchedEffect
        when (current.visual()) {
            ResultVisual.Vip -> {
                view.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)
                delay(90)
                view.performHapticFeedback(HapticFeedbackConstants.CONFIRM)
            }
            ResultVisual.Welcome -> view.performHapticFeedback(HapticFeedbackConstants.CONFIRM)
            ResultVisual.Already -> view.performHapticFeedback(HapticFeedbackConstants.REJECT)
            ResultVisual.NotFound -> view.performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK)
        }
    }

    // One analyzer instance for the screen's life, so the 3-second debounce is
    // continuous rather than resetting on every recomposition.
    val analyzer = remember { QrAnalyzer { value -> viewModel.onDecoded(value) } }
    DisposableEffect(Unit) { onDispose { analyzer.close() } }

    // Clearing the debounce when the result is dismissed lets a guest re-present
    // the same card immediately after a mis-tap, instead of waiting it out with
    // a queue behind them.
    LaunchedEffect(outcome) { if (outcome == null) analyzer.reset() }

    Surface(modifier = Modifier.fillMaxSize()) {
        Box(Modifier.fillMaxSize()) {
            if (hasCameraPermission) {
                CameraPreview(
                    analyzer = analyzer,
                    torchOn = torchOn,
                    lifecycleOwner = lifecycleOwner,
                    modifier = Modifier.fillMaxSize(),
                )
                Viewfinder()
            } else {
                NoCameraFallback(
                    onRequestPermission = { permissionLauncher.launch(Manifest.permission.CAMERA) },
                    onSearch = { showSearch = true },
                )
            }

            Column(modifier = Modifier.align(Alignment.TopCenter).fillMaxWidth()) {
                StatusBar(
                    status = status,
                    onOpenMenu = onOpenMenu,
                )
                // 20% persistent banner (§21.9). Suppressed while charging and
                // superseded by the critical modal below.
                BatteryBanner(status = deviceStatus)
            }

            // Only over a live camera. Without one, NoCameraFallback already
            // owns the screen and offers search as its primary action — showing
            // these as well put two identical SEARCH BY NAME buttons on screen
            // at the same time, one mid-screen and one at the bottom, with a
            // torch control for a camera that is not running.
            if (hasCameraPermission) {
                BottomControls(
                    torchOn = torchOn,
                    onToggleTorch = { torchOn = !torchOn },
                    onSearch = { showSearch = true },
                    modifier = Modifier.align(Alignment.BottomCenter),
                )
            }

            // Scales up toward the operator rather than sliding in. It is not a
            // place they navigated to — a guest presented a code and the answer
            // appeared in front of them.
            //
            // AnimatedContent rather than AnimatedVisibility: the outcome is
            // nullable, and AnimatedVisibility would have to read it from state
            // that is already null by the time the exit animation runs, blanking
            // the screen mid-fade. AnimatedContent keeps the outgoing value.
            AnimatedContent(
                targetState = outcome,
                transitionSpec = { resultEnter() togetherWith resultExit() },
                label = "result",
            ) { current ->
                if (current != null) {
                    ScanResultScreen(
                        outcome = current,
                        isSupervisor = operator.isSupervisor,
                        noKidsAllowed = noKidsAllowed,
                        onAdmit = { party, ids -> viewModel.admit(party, ids) },
                        onOverride = { party, ids -> viewModel.override(party, ids) },
                        onSearch = {
                            viewModel.dismiss()
                            showSearch = true
                        },
                        onDismiss = viewModel::dismiss,
                    )
                }
            }

            AnimatedVisibility(
                visible = showSearch,
                enter = overlayEnter(),
                exit = overlayExit(),
            ) {
                ManualSearchOverlay(
                    onSearch = { query -> viewModel.search(query) },
                    onSelect = { party ->
                        showSearch = false
                        viewModel.showParty(party)
                    },
                    onClose = { showSearch = false },
                )
            }

            // Drawn LAST so it covers everything, including a result screen
            // (§21.9: "a blocking modal that must be dismissed deliberately").
            // It never stops scanning once acknowledged — nothing in this app
            // may stop a door.
            if (!batteryAcknowledged) {
                BatteryCriticalDialog(
                    status = deviceStatus,
                    pendingCount = status?.pending ?: 0,
                    onDismiss = viewModel::acknowledgeBattery,
                )
            }
        }
    }
}

/**
 * CameraX preview bound to the lifecycle.
 *
 * KEEP_ONLY_LATEST because a backlog of stale frames is useless at a door — the
 * guest has already moved the card. Binding to the lifecycle owner means the
 * preview pauses when the app is backgrounded, which §11 requires for battery.
 */
@Composable
private fun CameraPreview(
    analyzer: QrAnalyzer,
    torchOn: Boolean,
    lifecycleOwner: androidx.lifecycle.LifecycleOwner,
    modifier: Modifier = Modifier,
) {
    val executor = remember { Executors.newSingleThreadExecutor() }
    var camera by remember { mutableStateOf<androidx.camera.core.Camera?>(null) }

    DisposableEffect(Unit) { onDispose { executor.shutdown() } }

    LaunchedEffect(torchOn, camera) {
        val control = camera?.cameraControl
        if (control != null && camera?.cameraInfo?.hasFlashUnit() == true) {
            control.enableTorch(torchOn)
        }
    }

    AndroidView(
        modifier = modifier,
        factory = { ctx ->
            val previewView = PreviewView(ctx).apply {
                scaleType = PreviewView.ScaleType.FILL_CENTER
            }

            val providerFuture = ProcessCameraProvider.getInstance(ctx)
            providerFuture.addListener({
                val provider = providerFuture.get()

                val preview = Preview.Builder().build().also {
                    it.setSurfaceProvider(previewView.surfaceProvider)
                }
                val analysis = ImageAnalysis.Builder()
                    .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                    .build()
                    .also { it.setAnalyzer(executor, analyzer) }

                provider.unbindAll()
                camera = provider.bindToLifecycle(
                    lifecycleOwner,
                    CameraSelector.DEFAULT_BACK_CAMERA,
                    preview,
                    analysis,
                )
            }, ContextCompat.getMainExecutor(ctx))

            previewView
        },
    )
}

/**
 * Where to hold the code.
 *
 * Four corner brackets rather than a closed rectangle. A complete box reads as
 * a form field — an enterprise input waiting to be filled — where brackets read
 * as a viewfinder, which is what this is. It also leaves the middle of the frame
 * completely clear, so nothing overlaps the code being scanned.
 *
 * Sized from the screen rather than fixed at 300dp, so it stays proportionate on
 * both a 7-inch spare and a 13-inch tablet.
 */
@Composable
private fun Viewfinder() {
    BoxWithConstraints(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        val side = minOf(maxHeight * 0.62f, 360.dp)

        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Canvas(Modifier.size(side)) {
                val stroke = 6.dp.toPx()
                val arm = size.minDimension * 0.2f
                val inset = stroke / 2f
                val right = size.width - inset
                val bottom = size.height - inset

                fun corner(x: Float, y: Float, dx: Float, dy: Float) {
                    drawLine(
                        color = Gold,
                        start = Offset(x, y),
                        end = Offset(x + dx, y),
                        strokeWidth = stroke,
                        cap = StrokeCap.Round,
                    )
                    drawLine(
                        color = Gold,
                        start = Offset(x, y),
                        end = Offset(x, y + dy),
                        strokeWidth = stroke,
                        cap = StrokeCap.Round,
                    )
                }

                corner(inset, inset, arm, arm)
                corner(right, inset, -arm, arm)
                corner(inset, bottom, arm, -arm)
                corner(right, bottom, -arm, -arm)
            }

            Spacer(Modifier.height(24.dp))
            Text(
                stringResource(R.string.scanner_hint),
                style = MaterialTheme.typography.titleMedium,
                color = OnCamera,
                modifier = Modifier
                    .clip(RoundedCornerShape(12.dp))
                    .background(CameraScrim)
                    .padding(horizontal = 20.dp, vertical = 10.dp),
            )
        }
    }
}

/**
 * The persistent status bar (§8.3, §17.7).
 *
 * Thin, dark, and over the camera — so it never competes with the frame and
 * stays legible against whatever the lens happens to be pointed at. The old bar
 * used the app's near-white surface at 85% alpha, which over a bright entrance
 * turned into a pale smear with pale text on it.
 *
 * Connection is expressed in operational language only. An amber "offline" is
 * not a fault — the app is designed for that state, and a fault-shaped message
 * makes staff stop working and go looking for someone to fix it.
 */
@Composable
private fun StatusBar(
    status: ScannerViewModel.StatusStrip?,
    onOpenMenu: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val dimens = LocalDimens.current

    // `status` is nullable and a `when` on `status?.connection` does NOT smart-cast
    // it, so the pending count is read defensively rather than through `status.`.
    val pending = status?.pending ?: 0
    val (label, dotColor) = when (status?.connection) {
        ScannerViewModel.ConnectionLabel.SYNCED ->
            stringResource(R.string.conn_synced) to StateWelcome
        ScannerViewModel.ConnectionLabel.OFFLINE_CLEAN ->
            stringResource(R.string.conn_offline_normal) to StateNeutral
        ScannerViewModel.ConnectionLabel.OFFLINE_PENDING ->
            stringResource(R.string.conn_offline_pending, pending) to StateAlready
        ScannerViewModel.ConnectionLabel.NEEDS_ATTENTION ->
            stringResource(R.string.conn_needs_attention) to StateAttention
        null -> null to StateNeutral
    }

    Row(
        modifier = modifier
            .fillMaxWidth()
            // EXACT height, not `heightIn(min = ...)`.
            //
            // `heightIn` only sets a floor — the maximum stays whatever the
            // parent offered, which here is the entire screen. The children
            // below use `fillMaxHeight()` to make the MENU control span the
            // bar, and `fillMaxHeight` expands to the incoming MAXIMUM. With a
            // min-only constraint that is the full screen, so this bar grew to
            // cover the camera entirely and its tap target swallowed every
            // touch on the screen.
            .height(dimens.statusBarHeight)
            .background(CameraScrim),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(
            modifier = Modifier
                .weight(1f)
                .fillMaxHeight()
                // Still tappable, for anyone who finds it. It is no longer the
                // only way in — see the MENU control at the end of the bar.
                .clickable(onClick = onOpenMenu)
                .padding(horizontal = 24.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (status == null) {
                // The strip is hidden rather than wrong when the database is
                // unreadable. The camera keeps working, which is what matters.
                Spacer(Modifier.weight(1f))
            } else {
                // The arrival count is the one number staff are asked for all
                // night, so it leads and it is the largest thing on the bar.
                Text(
                    stringResource(R.string.scanner_counter, status.arrived, status.totalInvited),
                    style = MaterialTheme.typography.titleLarge,
                    color = OnCamera,
                    maxLines = 1,
                )

                Spacer(Modifier.width(28.dp))
                StatusDot(
                    label = label.orEmpty(),
                    color = dotColor,
                    textColor = OnCamera,
                )

                Spacer(Modifier.weight(1f))

                FreshnessLabel(status.freshnessMillis)

                status.operatorName?.let {
                    Spacer(Modifier.width(24.dp))
                    Text(
                        it,
                        style = MaterialTheme.typography.bodyMedium,
                        color = OnCamera.copy(alpha = 0.75f),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.widthIn(max = 220.dp),
                    )
                }
            }
        }

        // The fix that matters most in this file. Everything that is not needed
        // at the door lives behind this control, and it is a labelled word, not
        // a hamburger, not a gesture, not a tap on something that looks inert.
        Row(
            modifier = Modifier
                .fillMaxHeight()
                .widthIn(min = 150.dp)
                .background(Gold)
                .clickable(onClick = onOpenMenu)
                .padding(horizontal = 24.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center,
        ) {
            Text(
                stringResource(R.string.nav_menu),
                style = MaterialTheme.typography.labelMedium,
                color = Color.White,
                maxLines = 1,
            )
            Spacer(Modifier.width(8.dp))
            Chevron(color = Color.White, pointsBack = false, iconSize = 22.dp)
        }
    }
}

/**
 * Data freshness, always visible (spec §19.7).
 *
 * Staff need to know when the list they are working from may not match what the
 * organizer sees. Silent staleness is how a guest gets sent to the wrong table.
 *
 * Amber only past two hours — an event that started an hour ago is working from
 * a perfectly good list, and colouring that as a problem would teach staff to
 * ignore the colour.
 */
@Composable
private fun FreshnessLabel(lastSyncedAt: Long?) {
    if (lastSyncedAt == null) return

    val ageMs = System.currentTimeMillis() - lastSyncedAt
    val clock = java.text.DateFormat.getTimeInstance(java.text.DateFormat.SHORT)
        .format(java.util.Date(lastSyncedAt))

    val (text, color) = when {
        ageMs < 30 * 60 * 1000L ->
            stringResource(R.string.freshness_current) to OnCamera.copy(alpha = 0.75f)
        ageMs < 2 * 60 * 60 * 1000L ->
            stringResource(R.string.freshness_from, clock) to OnCamera.copy(alpha = 0.75f)
        else ->
            stringResource(R.string.freshness_stale, clock) to StateAlready
    }

    Text(
        text,
        style = MaterialTheme.typography.bodyMedium,
        color = color,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
    )
}

/**
 * Exactly two controls, always visible, always in the same place.
 *
 * Torch and search. Nothing else earns a permanent place at the bottom of the
 * screen — everything else is behind MENU. Both are words rather than icons: a
 * pictogram of a torch is a guess, and staff hired an hour ago read faster than
 * they decode.
 */
@Composable
private fun BottomControls(
    torchOn: Boolean,
    onToggleTorch: () -> Unit,
    onSearch: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val dimens = LocalDimens.current

    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp, vertical = 20.dp),
        horizontalArrangement = Arrangement.spacedBy(20.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier
                .weight(1f)
                .heightIn(min = dimens.buttonHeight)
                .clip(RoundedCornerShape(dimens.cardRadius))
                // The torch is the one control whose STATE matters at a glance:
                // an usher must be able to see whether the light is already on
                // without toggling it to find out. On is solid gold; off is a
                // dark panel.
                .background(if (torchOn) Gold else CameraScrim)
                .clickable(onClick = onToggleTorch)
                .padding(horizontal = 20.dp, vertical = 18.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                stringResource(
                    if (torchOn) R.string.scanner_torch_off else R.string.scanner_torch_on,
                ),
                style = MaterialTheme.typography.labelMedium,
                color = if (torchOn) Color.White else OnCamera,
                textAlign = TextAlign.Center,
                maxLines = 1,
            )
        }

        Box(
            Modifier
                .weight(1.4f)
                .heightIn(min = dimens.buttonHeight)
                .clip(RoundedCornerShape(dimens.cardRadius))
                .background(Gold)
                .clickable(onClick = onSearch)
                .padding(horizontal = 20.dp, vertical = 18.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                stringResource(R.string.scanner_search),
                style = MaterialTheme.typography.labelMedium,
                color = Color.White,
                textAlign = TextAlign.Center,
                maxLines = 1,
            )
        }
    }
}

/**
 * Camera unavailable or permission denied.
 *
 * §8.3: this must degrade to manual search, NOT to a dead screen. The wording
 * says what still works rather than what failed, because an usher reading it has
 * a queue in front of them.
 */
@Composable
private fun NoCameraFallback(
    onRequestPermission: () -> Unit,
    onSearch: () -> Unit,
) {
    val dimens = LocalDimens.current
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(dimens.screenPadding),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            stringResource(R.string.scanner_no_camera_title),
            style = MaterialTheme.typography.headlineLarge,
            color = MaterialTheme.colorScheme.onBackground,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(12.dp))
        Text(
            stringResource(R.string.scanner_no_camera_body),
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(dimens.sectionGap))
        Box(Modifier.widthIn(max = 480.dp)) {
            PrimaryAction(
                text = stringResource(R.string.scanner_search),
                onClick = onSearch,
                hero = true,
            )
        }
        Spacer(Modifier.height(12.dp))
        SecondaryAction(
            text = stringResource(R.string.scanner_grant_camera),
            onClick = onRequestPermission,
        )
    }
}
