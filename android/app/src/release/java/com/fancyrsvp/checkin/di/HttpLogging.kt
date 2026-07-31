package com.fancyrsvp.checkin.di

import okhttp3.Interceptor

/**
 * RELEASE variant — no HTTP logging, ever.
 *
 * Null rather than a no-op interceptor: nothing is added to the OkHttp chain, so
 * there is no code path to re-enable and nothing to misconfigure. The
 * `okhttp-logging` artifact is `debugImplementation`, so it is not in this APK
 * to begin with — see the debug counterpart for why that matters (§20.7: request
 * bodies here carry guest names and device tokens).
 */
internal fun httpLoggingInterceptor(): Interceptor? = null
