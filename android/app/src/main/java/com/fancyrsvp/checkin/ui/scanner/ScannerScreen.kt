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
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
// androidx.lifecycle.compose, not androidx.compose.ui.platform: the latter is
// deprecated as of Compose 1.7 and resolves to a different instance in a
// navigation graph, which would bind the camera to the wrong lifecycle.
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.fancyrsvp.checkin.R
import com.fancyrsvp.checkin.scan.QrAnalyzer
import com.fancyrsvp.checkin.ui.theme.StateAlready
import com.fancyrsvp.checkin.ui.theme.StateAttention
import com.fancyrsvp.checkin.ui.theme.StateNeutral
import com.fancyrsvp.checkin.ui.theme.StateWelcome
import java.util.concurrent.Executors

/**
 * The scanner — the screen staff spend the entire night on (spec §8.3).
 *
 * Layout rules from the spec, each with a reason at the door:
 *
 *  • Camera preview fills the screen, with a framing guide.
 *  • A persistent status strip shows connection, arrived-vs-total, and who is
 *    logged in. Staff need all three without navigating anywhere.
 *  • Manual search is ALWAYS one tap away. No hidden gestures, no nested menus.
 *  • Torch toggle is prominent — entrances are frequently dim and decoratively lit.
 *  • Continuous scanning, no shutter button.
 *  • Camera permission denial degrades to manual search, never to a dead screen.
 */
@Composable
fun ScannerScreen(
    eventId: String,
    staffId: String?,
    staffName: String?,
    role: String,
    onOpenDashboard: () -> Unit,
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

    LaunchedEffect(eventId) { viewModel.start(eventId, staffId, staffName, role) }

    // Haptic on decode. §8.3 requires immediate feedback, and at a loud venue it is
    // the only confirmation an usher reliably gets that the scan registered.
    LaunchedEffect(outcome) {
        if (outcome != null) {
            view.performHapticFeedback(HapticFeedbackConstants.CONFIRM)
        }
    }

    // One analyzer instance for the screen's life, so the 3-second debounce is
    // continuous rather than resetting on every recomposition.
    val analyzer = remember { QrAnalyzer { value -> viewModel.onDecoded(value) } }
    DisposableEffect(Unit) { onDispose { analyzer.close() } }

    // Clearing the debounce when the result is dismissed lets a guest re-present
    // the same card immediately after a mis-tap, instead of waiting it out with a
    // queue behind them.
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
                FramingGuide()
            } else {
                NoCameraFallback(
                    onRequestPermission = { permissionLauncher.launch(Manifest.permission.CAMERA) },
                    onSearch = { showSearch = true },
                )
            }

            Column(modifier = Modifier.align(Alignment.TopCenter)) {
                StatusStrip(
                    status = status,
                    // The counter is the natural affordance for "show me the numbers"
                    // — tapping what you are already reading beats hunting for a menu.
                    onClick = onOpenDashboard,
                )
                // 20% persistent banner (§21.9). Suppressed while charging and
                // superseded by the critical modal below.
                BatteryBanner(status = deviceStatus)
            }

            BottomControls(
                torchOn = torchOn,
                torchAvailable = hasCameraPermission,
                onToggleTorch = { torchOn = !torchOn },
                onSearch = { showSearch = true },
                modifier = Modifier.align(Alignment.BottomCenter),
            )

            outcome?.let { current ->
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

            if (showSearch) {
                ManualSearchOverlay(
                    onSearch = { query -> viewModel.search(query) },
                    onSelect = { party ->
                        showSearch = false
                        viewModel.showParty(party)
                    },
                    onClose = { showSearch = false },
                )
            }

            // Drawn LAST so it covers everything, including a result screen (§21.9:
            // "a blocking modal that must be dismissed deliberately"). It never stops
            // scanning once acknowledged — nothing in this app may stop a door.
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
    val context = LocalContext.current
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
                    // A backlog of stale frames is useless at a door — by the time
                    // one is analysed the guest has moved the card.
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

/** A frame indicating where to hold the code (§8.3). */
@Composable
private fun FramingGuide() {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Box(
                Modifier
                    .size(300.dp)
                    .border(
                        width = 3.dp,
                        color = MaterialTheme.colorScheme.primary,
                        shape = RoundedCornerShape(24.dp),
                    ),
            )
            Spacer(Modifier.height(20.dp))
            Text(
                stringResource(R.string.scanner_hint),
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onBackground,
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background(MaterialTheme.colorScheme.background.copy(alpha = 0.6f))
                    .padding(horizontal = 16.dp, vertical = 8.dp),
            )
        }
    }
}

/**
 * The persistent status strip (§8.3, §17.7).
 *
 * Connection is expressed in operational language only. An amber "offline" is not
 * a fault — the app is designed for that state, and a fault-shaped message makes
 * staff stop working and look for someone to fix it.
 */
@Composable
private fun StatusStrip(
    status: ScannerViewModel.StatusStrip?,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    if (status == null) return

    val (label, color) = when (status.connection) {
        ScannerViewModel.ConnectionLabel.SYNCED ->
            stringResource(R.string.conn_synced) to StateWelcome
        ScannerViewModel.ConnectionLabel.OFFLINE_CLEAN ->
            stringResource(R.string.conn_offline_normal) to StateNeutral
        ScannerViewModel.ConnectionLabel.OFFLINE_PENDING ->
            stringResource(R.string.conn_offline_pending, status.pending) to StateAlready
        ScannerViewModel.ConnectionLabel.NEEDS_ATTENTION ->
            stringResource(R.string.conn_needs_attention) to StateAttention
    }

    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background.copy(alpha = 0.85f))
            .clickable(onClick = onClick)
            .padding(horizontal = 24.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(10.dp).clip(CircleShape).background(color))
        Spacer(Modifier.width(8.dp))
        Text(label, style = MaterialTheme.typography.bodyLarge, color = color)

        Spacer(Modifier.weight(1f))

        Text(
            stringResource(R.string.scanner_counter, status.arrived, status.totalInvited),
            style = MaterialTheme.typography.titleMedium,
        )

        Spacer(Modifier.width(24.dp))
        FreshnessLabel(status.freshnessMillis)

        status.operatorName?.let {
            Spacer(Modifier.width(24.dp))
            Text(
                it,
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

/**
 * Data freshness, always visible (spec §19.7).
 *
 * "Staff need to know when the list they are working from may not match what the
 * organizer sees. Silent staleness is how a guest gets sent to the wrong table."
 *
 * The thresholds are the spec's: current under 30 minutes, the sync time between 30
 * minutes and 2 hours, and an amber prompt beyond that. Amber only past two hours —
 * an event that started an hour ago is working from a perfectly good list, and
 * colouring that as a problem would teach staff to ignore the colour.
 */
@Composable
private fun FreshnessLabel(lastSyncedAt: Long?) {
    if (lastSyncedAt == null) return

    val ageMs = System.currentTimeMillis() - lastSyncedAt
    val clock = java.text.DateFormat.getTimeInstance(java.text.DateFormat.SHORT)
        .format(java.util.Date(lastSyncedAt))

    val (text, color) = when {
        ageMs < 30 * 60 * 1000L ->
            stringResource(R.string.freshness_current) to MaterialTheme.colorScheme.onSurfaceVariant
        ageMs < 2 * 60 * 60 * 1000L ->
            stringResource(R.string.freshness_from, clock) to MaterialTheme.colorScheme.onSurfaceVariant
        else ->
            stringResource(R.string.freshness_stale, clock) to StateAlready
    }

    Text(text, style = MaterialTheme.typography.bodyMedium, color = color)
}

@Composable
private fun BottomControls(
    torchOn: Boolean,
    torchAvailable: Boolean,
    onToggleTorch: () -> Unit,
    onSearch: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(24.dp),
        horizontalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterHorizontally),
    ) {
        if (torchAvailable) {
            OutlinedButton(
                onClick = onToggleTorch,
                modifier = Modifier.height(64.dp).width(200.dp),
            ) {
                Text(
                    stringResource(if (torchOn) R.string.scanner_torch_off else R.string.scanner_torch_on),
                    style = MaterialTheme.typography.titleMedium,
                )
            }
        }
        // Always present, always the same size and place. §8.3: reachable with one
        // tap, no hidden gestures.
        Button(
            onClick = onSearch,
            modifier = Modifier.height(64.dp).width(240.dp),
        ) {
            Text(stringResource(R.string.scanner_search), style = MaterialTheme.typography.titleMedium)
        }
    }
}

/**
 * Camera unavailable or permission denied.
 *
 * §8.3: this must degrade to manual search, NOT to a dead screen. The wording says
 * what still works rather than what failed, because an usher reading this has a
 * queue in front of them.
 */
@Composable
private fun NoCameraFallback(
    onRequestPermission: () -> Unit,
    onSearch: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxSize().padding(48.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            stringResource(R.string.scanner_no_camera_title),
            style = MaterialTheme.typography.headlineMedium,
        )
        Spacer(Modifier.height(12.dp))
        Text(
            stringResource(R.string.scanner_no_camera_body),
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(32.dp))
        Button(onClick = onSearch, modifier = Modifier.height(64.dp).width(280.dp)) {
            Text(stringResource(R.string.scanner_search), style = MaterialTheme.typography.titleMedium)
        }
        Spacer(Modifier.height(12.dp))
        OutlinedButton(onClick = onRequestPermission, modifier = Modifier.height(56.dp).width(280.dp)) {
            Text(stringResource(R.string.scanner_grant_camera))
        }
    }
}
