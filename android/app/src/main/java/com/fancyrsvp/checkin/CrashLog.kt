package com.fancyrsvp.checkin

import android.content.Context
import java.io.File
import java.io.PrintWriter
import java.io.StringWriter
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Last-resort crash recorder for a tablet with no adb attached (§21.6).
 *
 * Door staff operate these devices at a venue. When something kills the process
 * there, the app simply disappears — no dialog, no logcat, and nobody present
 * who can attach a debugger. Without a record, a crash at a venue is
 * unreportable: "it closed" is the entire bug report.
 *
 * So the handler writes the stack trace to a file and then delegates to the
 * platform's default handler, which still terminates the process. It does NOT
 * try to keep the app alive — swallowing a fatal error would leave the operator
 * with a half-dead app in front of a queue of guests, which is worse than a
 * clean restart.
 *
 * Contains a stack trace only. No guest data, no names, no tokens (§20.7).
 */
object CrashLog {

    private const val FILE = "last-crash.txt"

    /**
     * Installs the handler. Chains to the previous one rather than replacing it,
     * so the platform still does its normal job after we have our copy.
     */
    fun install(context: Context) {
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            // Guarded: a failure while recording a crash must not replace the
            // original crash with a less useful one.
            runCatching { write(context, thread, throwable) }
            previous?.uncaughtException(thread, throwable)
        }
    }

    private fun write(context: Context, thread: Thread, throwable: Throwable) {
        val stack = StringWriter().also { throwable.printStackTrace(PrintWriter(it)) }
        val stamp = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(Date())

        target(context).writeText(
            buildString {
                appendLine("Fancy RSVP check-in — crash report")
                appendLine("when    : $stamp")
                appendLine("version : ${BuildConfig.VERSION_NAME} (${BuildConfig.BUILD_TYPE})")
                appendLine("device  : ${android.os.Build.MANUFACTURER} ${android.os.Build.MODEL}")
                appendLine("android : ${android.os.Build.VERSION.RELEASE} (API ${android.os.Build.VERSION.SDK_INT})")
                appendLine("thread  : ${thread.name}")
                appendLine()
                append(stack.toString())
            },
        )
    }

    /**
     * getExternalFilesDir, not filesDir: this has to be readable by a file
     * manager on an unrooted tablet, which internal storage is not. It is still
     * app-scoped and removed on uninstall.
     */
    private fun target(context: Context): File =
        File(context.getExternalFilesDir(null) ?: context.filesDir, FILE)

    /** The recorded crash, if there is one — surfaced in the UI so it can be read. */
    fun read(context: Context): String? =
        runCatching { target(context).takeIf { it.exists() }?.readText() }.getOrNull()

    fun clear(context: Context) {
        runCatching { target(context).delete() }
    }
}
