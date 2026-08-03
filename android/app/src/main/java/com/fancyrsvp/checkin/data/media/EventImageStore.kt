package com.fancyrsvp.checkin.data.media

import android.content.Context
import android.graphics.BitmapFactory
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import com.fancyrsvp.checkin.di.MediaClient
import dagger.hilt.android.qualifiers.ApplicationContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

/**
 * The event's photograph, on this device (spec §9.8).
 *
 * ── Why a file, downloaded once, and not an image-loading library ──
 *
 * §9.8 is unambiguous: "Assets must be cached locally; the branding must render
 * with no network access." A venue has no internet — that is the premise of the
 * entire app — so an image that is fetched when a screen opens is an image that
 * is blank at the door.
 *
 * A caching loader (Coil, Glide) is built for the opposite situation: many
 * images, unknown ahead of time, fetched as they scroll into view, with the cache
 * as an optimisation. Here there is exactly ONE image per event, its URL is known
 * during preparation, and the cache is not an optimisation — it is the only copy
 * that will ever exist at the venue. Adding a loader would bring a fetch path
 * that must never be used, and its disk cache is evictable, which is precisely
 * the wrong policy for a file that cannot be re-fetched.
 *
 * So: OkHttp writes it to internal storage during preparation, and every screen
 * afterwards decodes from that path. If the file is not there, there is no
 * picture, and the screens say so by simply not drawing one.
 *
 * ── Where it lives ──
 *
 * `filesDir/event-media/`, which is INTERNAL storage — not `getExternalFilesDir`
 * like the crash log. The crash log is put somewhere a file manager can reach
 * precisely so an operator can send it; an event's photograph is private content
 * belonging to a client, and the app already refuses cloud and adb backup for the
 * same reason (§20). It is removed by [delete] when the event is closed, on the
 * same trigger that purges the guest list.
 */
@Singleton
class EventImageStore @Inject constructor(
    @ApplicationContext private val context: Context,
    /**
     * The CREDENTIAL-FREE client, and that qualifier is load-bearing.
     *
     * `cover_image_url` points at whatever host the organizer's upload landed on.
     * The app's main client attaches the device token to everything that is not
     * the pairing or refresh path — by path, not by host — so fetching an image
     * with it would hand a third party the credential that reads the whole guest
     * list. See [MediaClient].
     */
    @MediaClient private val client: OkHttpClient,
) {

    /**
     * Downloads [url] for [eventId] and returns the local path, or null.
     *
     * Never throws. A missing photograph must not be able to fail a preparation
     * that has already downloaded a complete, verified guest list — the guest
     * list is what the night depends on, and a picture is not worth refusing to
     * arm a tablet over. Callers treat null as "this event has no picture".
     *
     * Downloads to a `.part` file and renames only on success, so a connection
     * dropped mid-transfer leaves no half-image that would later decode to grey
     * bands across an entrance display.
     */
    fun download(eventId: String, url: String?): String? {
        if (url.isNullOrBlank()) return null

        val target = fileFor(eventId)
        val partial = File(target.parentFile, "${target.name}.part")

        return runCatching {
            target.parentFile?.mkdirs()
            partial.delete()

            val request = Request.Builder().url(url).build()
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return null
                val body = response.body ?: return null

                // Declared size first, so an oversized file is refused before a
                // byte of it is transferred. An organizer can upload anything, and
                // a 40MB original straight off a camera is a slow download on
                // venue-office wifi and an OutOfMemoryError to decode.
                if (body.contentLength() > MAX_BYTES) return null

                // ...but contentLength() is -1 on a chunked response, so the
                // declared size cannot be the only guard: a server that omits the
                // header could otherwise stream unbounded data straight onto a
                // tablet that has to have room for a 2000-guest bundle (§21.9).
                // Checking the file AFTER the copy is too late — the disk is
                // already full. So the copy itself is bounded.
                val written = body.byteStream().use { input ->
                    partial.outputStream().use { output -> input.copyAtMost(output, MAX_BYTES) }
                }
                if (written == null) {
                    partial.delete()
                    return null
                }
            }

            if (partial.length() !in 1..MAX_BYTES) {
                partial.delete()
                return null
            }

            // Decode the BOUNDS only — no pixels are allocated. This proves the
            // bytes are a real image before the file is promoted, so "the file
            // exists" and "the file can be shown" mean the same thing everywhere
            // else in the app.
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeFile(partial.absolutePath, bounds)
            if (bounds.outWidth <= 0 || bounds.outHeight <= 0) {
                partial.delete()
                return null
            }

            target.delete()
            if (!partial.renameTo(target)) {
                partial.delete()
                return null
            }
            target.absolutePath
        }.getOrElse {
            runCatching { partial.delete() }
            null
        }
    }

    /**
     * Removes the cached photograph.
     *
     * Called from the close-event purge (§20.5). The picture is client content and
     * leaves the device with the guest list, not after it.
     */
    fun delete(eventId: String) {
        runCatching { fileFor(eventId).delete() }
        runCatching { File(fileFor(eventId).parentFile, "${fileFor(eventId).name}.part").delete() }
    }

    /**
     * One fixed name per event, so re-preparing overwrites rather than accumulates.
     *
     * The id is sanitised because it reaches the filesystem: ids are server UUIDs
     * today, but a path separator arriving in one must not be able to write
     * outside this directory.
     */
    private fun fileFor(eventId: String): File {
        val safe = eventId.filter { it.isLetterOrDigit() || it == '-' || it == '_' }.take(64)
        return File(File(context.filesDir, DIRECTORY), "$safe.img")
    }

    /**
     * Copies at most [limit] bytes, returning the count — or null if the source
     * had more than that.
     *
     * `copyTo` would happily write until the disk filled. Stopping AT the limit
     * rather than after it means the tablet never loses space it needs for the
     * guest list to a photograph that was never going to be accepted anyway.
     */
    private fun java.io.InputStream.copyAtMost(
        output: java.io.OutputStream,
        limit: Long,
    ): Long? {
        val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
        var total = 0L
        while (true) {
            val read = read(buffer)
            if (read < 0) return total
            total += read
            if (total > limit) return null
            output.write(buffer, 0, read)
        }
    }

    companion object {
        private const val DIRECTORY = "event-media"

        /** 12MB. Comfortably above any sane cover, far below what will not decode. */
        private const val MAX_BYTES = 12L * 1024 * 1024

        /**
         * Widest bitmap this app will ever hold in memory.
         *
         * 1600px behind a scrim, at arm's length or across a lobby, is
         * indistinguishable from the original — and it bounds the worst case at
         * roughly 12MB rather than 48MB. See [decode].
         */
        private const val MAX_DECODE_WIDTH_PX = 1600

        /**
         * Decodes a cached photograph, downsampled to roughly [targetWidthPx].
         *
         * On the companion, not the instance, and deliberately: reading a file
         * that is already on disk needs no context, no HTTP client and no
         * injection. Four screens draw this picture, and requiring each of their
         * view models to hold a dependency purely so a composable can call
         * `decodeFile` would be ceremony protecting nothing. Downloading — which
         * genuinely does need a client and a place to put things — stays on the
         * instance.
         *
         * ── Why downsampling is not optional ──
         *
         * A 4000x3000 wedding photograph is 48MB decoded at ARGB_8888. The app
         * runs on cheap 2GB tablets that are also holding an encrypted database,
         * a camera pipeline and ML Kit, and it is drawn on a screen about 1200px
         * wide — so all but a twelfth of those pixels would be decoded and then
         * thrown away.
         *
         * `inSampleSize` halves in powers of two DURING decode, so the full
         * bitmap is never allocated at all. That is the difference between a
         * background image and an OutOfMemoryError at a door.
         *
         * Returns null rather than throwing on anything unreadable: every screen
         * that calls this has a themed appearance to fall back to.
         */
        fun decode(path: String?, targetWidthPx: Int): ImageBitmap? {
            if (path.isNullOrBlank() || targetWidthPx <= 0) return null
            if (!File(path).exists()) return null

            /*
             * The caller's request is a CEILING, not an instruction.
             *
             * The entrance display asks for the full width of whatever it is
             * running on, which is the point — but that screen is also the one
             * most likely to be a large panel. A 1920dp-wide 4K display at
             * density 2 asks for 3840px, `inSampleSize` then rounds down to 1,
             * and a 4000x3000 photograph decodes at full size: 48MB of ARGB_8888
             * on a device that is also holding an encrypted database and a camera
             * pipeline, on a screen that stays up all night.
             *
             * Capping here rather than at each call site, because the cap is a
             * property of what the device can afford, not of what any one screen
             * wants — and a future caller passing something enormous should not
             * be able to reintroduce this.
             */
            val target = minOf(targetWidthPx, MAX_DECODE_WIDTH_PX)

            return runCatching {
                val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                BitmapFactory.decodeFile(path, bounds)
                if (bounds.outWidth <= 0) return null

                var sample = 1
                while (bounds.outWidth / (sample * 2) >= target) sample *= 2

                val options = BitmapFactory.Options().apply { inSampleSize = sample }
                BitmapFactory.decodeFile(path, options)?.asImageBitmap()
            }.getOrNull()
        }
    }
}
