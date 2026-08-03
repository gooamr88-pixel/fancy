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
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
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
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
// androidx.lifecycle.compose, not androidx.compose.ui.platform: the latter is
// deprecated as of Compose 1.7 and resolves to a different instance in a
// navigation graph, which would bind the camera to the wrong lifecycle.
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.fancyrsvp.checkin.R
import com.fancyrsvp.checkin.scan.QrAnalyzer
import com.fancyrsvp.checkin.ui.components.CameraAction
import com.fancyrsvp.checkin.ui.components.Chevron
import com.fancyrsvp.checkin.ui.components.MagnifierIcon
import com.fancyrsvp.checkin.ui.components.PrimaryAction
import com.fancyrsvp.checkin.ui.components.SecondaryAction
import com.fancyrsvp.checkin.ui.components.StatusDot
import com.fancyrsvp.checkin.ui.components.TorchIcon
import com.fancyrsvp.checkin.ui.components.pressLift
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
    val dimens = LocalDimens.current

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

    /*
     * The chrome's real heights, measured rather than assumed.
     *
     * The viewfinder has to know what is drawn over the camera so its frame lands
     * somewhere an usher can actually aim. The first version computed that from
     * the theme — status-bar height, hero-button height, a shared padding
     * constant — which is right until something CONDITIONAL appears. The 20%
     * battery banner (§21.9) is exactly that: it is not in the theme, its height
     * depends on how its text wraps, and when it shows the frame slid underneath
     * it.
     *
     * Measuring removes the whole class of problem. Anything added to either bar
     * later is accounted for automatically, and the two numbers cannot drift out
     * of sync with the layout the way a duplicated constant can.
     *
     * Seeded with the theme estimate rather than zero: the chrome is composed
     * AFTER the viewfinder, so a zero seed would size the frame to the whole
     * screen for one frame and visibly snap. The estimate is already close, and
     * the measurement corrects it before anyone could notice.
     */
    val density = LocalDensity.current
    var topChrome by remember(dimens) { mutableStateOf(dimens.statusBarHeight) }
    var bottomChrome by remember(dimens) {
        mutableStateOf(dimens.heroButtonHeight + BOTTOM_BAR_PADDING * 2)
    }

    Surface(modifier = Modifier.fillMaxSize()) {
        Box(Modifier.fillMaxSize()) {
            if (hasCameraPermission) {
                CameraPreview(
                    analyzer = analyzer,
                    torchOn = torchOn,
                    lifecycleOwner = lifecycleOwner,
                    modifier = Modifier.fillMaxSize(),
                )
                Viewfinder(topInset = topChrome, bottomInset = bottomChrome)
            } else {
                NoCameraFallback(
                    onRequestPermission = { permissionLauncher.launch(Manifest.permission.CAMERA) },
                    onSearch = { showSearch = true },
                )
            }

            Column(
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .fillMaxWidth()
                    // Covers the status bar AND the battery banner, whether or not
                    // the banner is showing and however many lines it wraps to.
                    .onSizeChanged { size ->
                        topChrome = with(density) { size.height.toDp() }
                    },
            ) {
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
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .onSizeChanged { size ->
                            bottomChrome = with(density) { size.height.toDp() }
                        },
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
 *
 * ── Why every camera call here is guarded ──
 *
 * This block runs on the main executor, NOT inside a coroutine, so `safeLaunch`
 * does nothing for it: an uncaught throw goes straight to the default handler and
 * the process dies with no dialog. And camera bring-up throws for reasons that
 * have nothing to do with this app being correct — another process holding the
 * camera, a vendor HAL that fails to initialise, the operator leaving the screen
 * before the provider future resolves. At a venue every one of those was the app
 * disappearing mid-shift.
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

    // Retained so the use cases can be DETACHED before the analysis executor is
    // shut down. Without the unbind, CameraX goes on delivering frames to an
    // executor that no longer accepts work — a RejectedExecutionException raised
    // on a camera thread, which is another silent process kill. It fired on the
    // way back from the menu, when the previous binding is re-attached to a
    // lifecycle that has just come round again.
    var provider by remember { mutableStateOf<ProcessCameraProvider?>(null) }

    DisposableEffect(Unit) {
        onDispose {
            runCatching { provider?.unbindAll() }
            executor.shutdown()
        }
    }

    LaunchedEffect(torchOn, camera) {
        // enableTorch on a camera that has just been unbound throws rather than
        // returning a failed future on some devices, and the torch is the control
        // staff hit most often in a dark venue.
        runCatching {
            val control = camera?.cameraControl
            if (control != null && camera?.cameraInfo?.hasFlashUnit() == true) {
                control.enableTorch(torchOn)
            }
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
                runCatching {
                    // The future resolves asynchronously. If the operator has moved
                    // on in the meantime, binding to a destroyed lifecycle throws —
                    // so check first and simply do nothing.
                    if (lifecycleOwner.lifecycle.currentState == Lifecycle.State.DESTROYED) {
                        return@runCatching
                    }

                    // .get() on a failed future throws ExecutionException, wrapping
                    // whatever the camera stack objected to.
                    val cameraProvider = providerFuture.get()
                    provider = cameraProvider

                    val preview = Preview.Builder().build().also {
                        it.setSurfaceProvider(previewView.surfaceProvider)
                    }
                    val analysis = ImageAnalysis.Builder()
                        .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                        .build()
                        .also { it.setAnalyzer(executor, analyzer) }

                    cameraProvider.unbindAll()
                    camera = cameraProvider.bindToLifecycle(
                        lifecycleOwner,
                        CameraSelector.DEFAULT_BACK_CAMERA,
                        preview,
                        analysis,
                    )
                }
                // Failure leaves `camera` null and the preview black. The status bar,
                // the counter, MENU and SEARCH BY NAME are all drawn over this and
                // stay live, so the door keeps working by name — which is exactly the
                // degradation §8.3 asks for when the camera is unavailable.
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
 *
 * ── Why it takes the chrome's insets ──
 *
 * It used to size itself from the WHOLE screen height and centre in it, as if
 * nothing else were drawn. On a tablet the slack absorbed that. On a landscape
 * phone — 390dp tall, of which the status bar and the control row already own
 * about 200 — the frame ran under both, and "Hold the guest's code inside the
 * frame" was printed underneath the search button where it could not be read.
 *
 * The brackets mark where an usher is being asked to hold a guest's card. A
 * frame that overlaps the chrome is not a cosmetic problem: it points at a place
 * the camera cannot usefully see.
 *
 * @param topInset height of the status bar drawn above this.
 * @param bottomInset height of the control row drawn below it.
 */
@Composable
private fun Viewfinder(topInset: Dp, bottomInset: Dp) {
    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .padding(top = topInset, bottom = bottomInset),
        contentAlignment = Alignment.Center,
    ) {
        // Room for the gap and one line of the hint inside its scrim.
        val hintSpace = 76.dp
        // Below this there is no honest way to show both, and the frame is what
        // matters — an usher who can see where to hold the card does not need to
        // be told to.
        val showHint = maxHeight > 240.dp

        val side = minOf(
            // Bounded by BOTH axes. Height alone was fine on a tablet, where
            // there is always more width than height; on a narrow window it
            // produced a frame wider than the screen.
            if (showHint) maxHeight - hintSpace else maxHeight * 0.92f,
            maxWidth * 0.6f,
            360.dp,
        ).coerceAtLeast(120.dp)

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

            if (showHint) {
                Spacer(Modifier.height(24.dp))
                Text(
                    stringResource(R.string.scanner_hint),
                    style = MaterialTheme.typography.titleMedium,
                    color = OnCamera,
                    textAlign = TextAlign.Center,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier
                        .clip(RoundedCornerShape(12.dp))
                        .background(CameraScrim)
                        .padding(horizontal = 20.dp, vertical = 10.dp),
                )
            }
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
        //
        // It fills the bar's height rather than floating inside it, so it cannot
        // be mistaken for a badge — but it now separates from the bar with its own
        // rim and a press response, which a flat gold block against a dark scrim
        // did not have.
        val menuInteraction = remember { MutableInteractionSource() }
        val menuScale = pressLift(menuInteraction, pressedScale = 0.94f)
        Row(
            modifier = Modifier
                .fillMaxHeight()
                .widthIn(min = 170.dp)
                .scale(menuScale)
                .background(Gold)
                .border(BorderStroke(2.dp, Color.White.copy(alpha = 0.45f)))
                .clickable(
                    interactionSource = menuInteraction,
                    indication = null,
                    onClick = onOpenMenu,
                )
                .padding(horizontal = 24.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center,
        ) {
            Text(
                stringResource(R.string.nav_menu),
                // Was labelMedium — the same caption size as the freshness note it
                // sits beside, on the only way into every other screen in the app.
                style = MaterialTheme.typography.titleMedium,
                color = Color.White,
                maxLines = 1,
            )
            Spacer(Modifier.width(10.dp))
            Chevron(color = Color.White, pointsBack = false, iconSize = 24.dp)
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
 * screen — everything else is behind MENU. Both carry their WORD as the label; the
 * drawn icon beside it is a second cue for finding the control, never the label
 * itself.
 *
 * ── Why SEARCH BY NAME is the biggest thing on this bar ──
 *
 * It is the fallback that makes every other failure at the door survivable
 * (§8.5, §10): a printed code that is creased, a phone screen too dim to read, a
 * guest who never opened their invitation at all. Every one of those ends with an
 * usher needing this control, usually with a queue already forming and a guest
 * watching them hunt for it.
 *
 * Both controls used to be the same 72dp slab with a 16sp caption in it, one
 * slightly wider than the other, and neither carried a shadow or an edge. Over a
 * bright entrance they read as two coloured smudges. The search control is now
 * unambiguously the largest, brightest, most raised thing on the screen after the
 * viewfinder itself: hero height, gold, 2dp rim, a real shadow, titleLarge type,
 * and a magnifier beside the words. It is meant to be findable without looking
 * for it.
 */
@Composable
private fun BottomControls(
    torchOn: Boolean,
    onToggleTorch: () -> Unit,
    onSearch: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp, vertical = BOTTOM_BAR_PADDING),
        horizontalArrangement = Arrangement.spacedBy(20.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.Bottom,
    ) {
        // The torch is the one control whose STATE matters at a glance: an usher
        // must be able to see whether the light is already on without toggling it
        // to find out. On is solid gold; off is a dark panel.
        CameraAction(
            text = stringResource(
                if (torchOn) R.string.scanner_torch_off else R.string.scanner_torch_on,
            ),
            onClick = onToggleTorch,
            containerColor = if (torchOn) Gold else CameraScrim,
            contentColor = if (torchOn) Color.White else OnCamera,
            icon = { tint -> TorchIcon(color = tint) },
            modifier = Modifier.weight(1f),
        )

        CameraAction(
            text = stringResource(R.string.scanner_search),
            onClick = onSearch,
            prominent = true,
            icon = { tint -> MagnifierIcon(color = tint, iconSize = 34.dp) },
            // 2:1 against the torch. The weights were 1.4:1, which is not a
            // difference anyone perceives as a hierarchy — it just looked like two
            // buttons that failed to line up.
            modifier = Modifier.weight(2f),
        )
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

/**
 * Vertical inset around the bottom control row.
 *
 * Still named rather than a literal, but it is no longer load-bearing: the
 * viewfinder MEASURES the control row now instead of reconstructing its height
 * from this. It survives only as the first-frame estimate, so getting it slightly
 * wrong costs a barely perceptible settle rather than an overlapping frame.
 */
private val BOTTOM_BAR_PADDING = 20.dp
