package com.fancyrsvp.checkin.scan

import android.annotation.SuppressLint
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import com.google.mlkit.vision.barcode.BarcodeScanner
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import java.util.concurrent.atomic.AtomicBoolean

/**
 * CameraX analyser that decodes QR codes on-device (spec §4, §8.3).
 *
 * ── Bundled ML Kit model, not the Play-Services download ──
 *
 * The dependency is `com.google.mlkit:barcode-scanning`, which embeds the model in
 * the APK. The Play-Services variant downloads it on first use, and a fresh tablet
 * with no internet AT THE VENUE may not have it — scanning would fail at exactly
 * the moment it matters. That choice lives in libs.versions.toml with the same
 * note.
 *
 * ── Debounce ──
 *
 * §8.3 requires the same code decoded repeatedly within 3 seconds not to
 * re-trigger. Continuous analysis sees the same card 20+ times a second while a
 * guest holds it up, and without this the result screen would thrash and a
 * double-admission race would be trivial to hit.
 *
 * The debounce is keyed on the DECODED VALUE, not on time alone, so two different
 * guests presenting cards back-to-back are both admitted immediately — only a
 * repeat of the same code waits.
 */
class QrAnalyzer(
    private val onDecoded: (String) -> Unit,
) : ImageAnalysis.Analyzer {

    private val scanner: BarcodeScanner = BarcodeScanning.getClient(
        BarcodeScannerOptions.Builder()
            // QR only. Restricting the format set measurably speeds up detection,
            // and no other symbology is ever presented at this door.
            .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
            .build(),
    )

    private var lastValue: String? = null
    private var lastAcceptedAt: Long = 0L

    /**
     * Guards against overlapping analyses.
     *
     * CameraX delivers frames faster than ML Kit completes on a mid-range tablet.
     * STRATEGY_KEEP_ONLY_LATEST drops frames for us, but the callback can still be
     * re-entered while a decode is in flight; this keeps exactly one outstanding.
     */
    private val inFlight = AtomicBoolean(false)

    @SuppressLint("UnsafeOptInUsageError")
    override fun analyze(imageProxy: ImageProxy) {
        val mediaImage = imageProxy.image
        if (mediaImage == null || !inFlight.compareAndSet(false, true)) {
            imageProxy.close()
            return
        }

        val input = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)

        scanner.process(input)
            .addOnSuccessListener { barcodes ->
                barcodes.firstNotNullOfOrNull { it.rawValue }?.let { value -> accept(value) }
            }
            .addOnCompleteListener {
                inFlight.set(false)
                // Closing in onComplete rather than onSuccess: a failed decode must
                // also release the frame, or the pipeline stalls after the first
                // unreadable card and the scanner silently dies mid-event.
                imageProxy.close()
            }
    }

    private fun accept(value: String) {
        val now = System.currentTimeMillis()
        if (value == lastValue && now - lastAcceptedAt < DEBOUNCE_MS) return

        lastValue = value
        lastAcceptedAt = now
        onDecoded(value)
    }

    /**
     * Clears the debounce.
     *
     * Called when the result screen is dismissed, so a guest whose first scan was
     * mis-tapped can immediately present the same card again rather than waiting
     * out the window with a queue behind them.
     */
    fun reset() {
        lastValue = null
        lastAcceptedAt = 0L
    }

    fun close() {
        runCatching { scanner.close() }
    }

    private companion object {
        const val DEBOUNCE_MS = 3_000L
    }
}
