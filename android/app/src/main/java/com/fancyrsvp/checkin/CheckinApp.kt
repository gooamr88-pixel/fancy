package com.fancyrsvp.checkin

import android.app.Application
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject

/**
 * Application entry point.
 *
 * WorkManager is initialised manually (see the manifest provider removal note
 * below) so Hilt can inject dependencies into workers — the sync engine needs the
 * database and the API, and the default WorkManager initialiser cannot supply
 * them.
 */
@HiltAndroidApp
class CheckinApp : Application(), Configuration.Provider {

    @Inject lateinit var workerFactory: HiltWorkerFactory

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setWorkerFactory(workerFactory)
            // ERROR only. WorkManager's INFO logging includes worker input data,
            // and the sync worker's input carries event and device identifiers.
            // §20.7 restricts logs to identifiers with no personal data, and the
            // safest way to honour that is to keep the framework quiet.
            .setMinimumLoggingLevel(android.util.Log.ERROR)
            .build()
}
