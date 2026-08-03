package com.fancyrsvp.checkin.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.fancyrsvp.checkin.data.media.EventImageStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * The event's own photograph — the couple, on a wedding (spec §9.8).
 *
 * ── What "premium" means here, concretely ──
 *
 * The failure mode for a photograph in a working tool is that it looks like
 * decoration bolted onto a form. Four things stop that, and none of them is a
 * filter or an effect:
 *
 *  1. **It is always full-bleed and always cropped to fill.** A photograph
 *     letterboxed inside a rounded card with margins around it reads as an
 *     attachment. Filling the frame edge to edge reads as a printed piece.
 *  2. **Type never sits directly on photography.** Every use draws a scrim, and
 *     the scrim is a GRADIENT anchored where the text is, not a flat wash over
 *     the whole picture — a uniform 50% black is what makes an image look cheap,
 *     because it dulls the whole photograph to protect one corner of it.
 *  3. **It moves, barely.** A 40-second drift across a few percent of scale. At a
 *     lobby display that is the difference between a photograph and a screensaver
 *     someone forgot to turn off; it is slow enough that nobody catches it
 *     moving, which is the point.
 *  4. **It is never the only thing carrying meaning.** Every screen that uses it
 *     is fully legible with the picture absent, because most events will not have
 *     one and the tool cannot degrade when they do not.
 *
 * ── Loading ──
 *
 * Decoded off the main thread, downsampled to the width it will actually be drawn
 * at, and only from a file already on this device — see [EventImageStore]. There
 * is no network path here at all. At a venue there is no network.
 */
@Composable
fun rememberEventCover(
    path: String?,
    /** Drawn width. Decoding is downsampled to this, so pass the real size. */
    targetWidth: Dp,
): ImageBitmap? {
    val targetPx = with(LocalDensity.current) { targetWidth.roundToPx() }
    var bitmap by remember(path, targetPx) { mutableStateOf<ImageBitmap?>(null) }

    LaunchedEffect(path, targetPx) {
        // withContext(Dispatchers.IO), not a bare LaunchedEffect body: decoding a
        // multi-megapixel JPEG takes long enough to drop frames, and one of the
        // screens using this is the entrance display, where a stutter is the only
        // thing anyone in the lobby would have to look at.
        bitmap = if (path.isNullOrBlank()) {
            null
        } else {
            withContext(Dispatchers.IO) { EventImageStore.decode(path, targetPx) }
        }
    }

    return bitmap
}

/**
 * Full-bleed photographic backdrop with content drawn over it.
 *
 * Falls back to [fallback] — the themed background — whenever there is no
 * picture, which is the normal case for most events. The caller writes its
 * content once and gets both.
 *
 * @param scrim how strongly to protect the content. See [CoverScrim].
 * @param drift true to enable the slow zoom. Reserve it for the entrance display:
 *   on a working screen an operator is looking at, movement behind text is a
 *   distraction rather than a flourish.
 */
@Composable
fun EventCoverBackdrop(
    image: ImageBitmap?,
    modifier: Modifier = Modifier,
    fallback: Color = Color.Transparent,
    scrim: CoverScrim = CoverScrim.Balanced,
    drift: Boolean = false,
    content: @Composable BoxScope.() -> Unit,
) {
    Box(modifier = modifier) {
        if (image == null) {
            Box(Modifier.fillMaxSize().background(fallback))
        } else {
            // The drift scale is applied to the IMAGE only, never to the Box, so
            // the content over it stays perfectly still. A caption that breathes
            // with the background is the single most obvious way to make this
            // look like a template.
            val scale = if (drift) coverDriftScale() else 1f

            Image(
                bitmap = image,
                contentDescription = null,
                // Crop, not Fit. Fit would letterbox a portrait photograph on a
                // landscape screen with bars down both sides — see the class doc.
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize().scale(scale),
            )
            Box(Modifier.fillMaxSize().background(scrim.brush()))
        }
        content()
    }
}

/**
 * How much of the photograph to give up to keep type readable.
 *
 * Named cases rather than an alpha parameter, because "how dark should this be"
 * is not a number a caller should be guessing per screen — it is a decision about
 * where the text sits, and there are only three shapes of answer.
 */
enum class CoverScrim {
    /** Text at the bottom only. The picture stays clean above it. */
    Bottom,

    /** Text at both ends — a heading up top, a figure below. */
    Balanced,

    /** Text across the middle. The heaviest, and the last resort. */
    Full,
    ;

    @Composable
    fun brush(): Brush = when (this) {
        Bottom -> Brush.verticalGradient(
            0.0f to Color.Transparent,
            0.45f to Color.Black.copy(alpha = 0.10f),
            1.0f to Color.Black.copy(alpha = 0.78f),
        )
        // Deliberately lightest in the middle. That is where a photograph's
        // subject almost always is, and it is where no text is drawn.
        Balanced -> Brush.verticalGradient(
            0.0f to Color.Black.copy(alpha = 0.72f),
            0.35f to Color.Black.copy(alpha = 0.22f),
            0.62f to Color.Black.copy(alpha = 0.30f),
            1.0f to Color.Black.copy(alpha = 0.82f),
        )
        Full -> Brush.verticalGradient(
            0.0f to Color.Black.copy(alpha = 0.70f),
            0.5f to Color.Black.copy(alpha = 0.62f),
            1.0f to Color.Black.copy(alpha = 0.76f),
        )
    }
}

/**
 * The slow drift.
 *
 * 1.0 to 1.06 over 40 seconds and back — about 0.15% of scale per second, which
 * is below the threshold at which movement is consciously noticed. `LinearEasing`
 * with `Reverse` rather than an eased curve, because an eased drift pauses at
 * each end and the pause IS noticeable; a linear one never appears to stop.
 *
 * The one exception to this file's parent rule that nothing in the app moves
 * without being asked to (see Motion.kt) — and it is confined to a screen whose
 * entire job is to be looked at.
 */
@Composable
private fun coverDriftScale(): Float {
    val transition = rememberInfiniteTransition(label = "coverDrift")
    val scale by transition.animateFloat(
        initialValue = 1f,
        targetValue = 1.06f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 40_000, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "coverDriftScale",
    )
    return scale
}

/**
 * The photograph as a framed portrait — for a card, not a backdrop.
 *
 * Used where the picture is being shown AS a picture rather than as a ground:
 * confirming on the prepare screen that this tablet is armed for the right event.
 * A gold hairline rather than a shadow, because it sits on a card that already
 * has one, and two shadows stacked read as a mistake.
 */
@Composable
fun EventCoverFrame(
    image: ImageBitmap?,
    modifier: Modifier = Modifier,
    cornerRadius: Dp = 16.dp,
    borderColor: Color = Color.Black.copy(alpha = 0.14f),
) {
    if (image == null) return

    val shape = RoundedCornerShape(cornerRadius)

    Box(modifier.clip(shape)) {
        Image(
            bitmap = image,
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize(),
        )
        // A whisper of shade into the lower edge, so the frame has weight where it
        // meets the card's text instead of stopping dead. Not a scrim — nothing is
        // written on this one.
        Box(
            Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        0.0f to Color.Transparent,
                        0.65f to Color.Transparent,
                        1.0f to Color.Black.copy(alpha = 0.28f),
                    ),
                ),
        )
        // Inside the clip, so the rim follows the rounded corners rather than
        // being cut square by them.
        Box(Modifier.fillMaxSize().border(1.dp, borderColor, shape))
    }
}
