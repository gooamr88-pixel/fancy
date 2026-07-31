package com.fancyrsvp.checkin.di

import okhttp3.Interceptor
import okhttp3.logging.HttpLoggingInterceptor

/**
 * DEBUG variant — full body logging.
 *
 * This file has a counterpart in src/release that returns null, and the two
 * exist as separate source sets rather than as one `if (BuildConfig.DEBUG)`
 * branch for a reason that only shows up in a release build:
 *
 * `okhttp-logging` is declared `debugImplementation`, so the class is not on the
 * release compile classpath at all. Kotlin resolves types regardless of which
 * branch can execute, so a guarded reference in shared code fails to COMPILE in
 * release — which is exactly what happened the first time assembleRelease ran.
 *
 * Keeping the dependency debug-only is deliberate and worth the split: it means
 * the logging library is physically absent from the release APK rather than
 * merely switched off. §20.7 forbids personal data in logs, and the bodies here
 * carry guest names and device tokens — a level that is one edit away from being
 * re-enabled in production is not a control.
 */
internal fun httpLoggingInterceptor(): Interceptor? =
    HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BODY }
