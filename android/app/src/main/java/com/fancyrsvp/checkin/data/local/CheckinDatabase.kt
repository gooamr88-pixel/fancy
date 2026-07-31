package com.fancyrsvp.checkin.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import net.zetetic.database.sqlcipher.SupportOpenHelperFactory

/**
 * The local database — the backbone of this product (spec §5.1).
 *
 * ── Two rules that are release blockers, not preferences ──
 *
 * 1. `fallbackToDestructiveMigration` is FORBIDDEN (§21.2). It silently deletes
 *    the user's data, and here "the user's data" means check-ins that exist
 *    NOWHERE ELSE. A tablet auto-updating overnight before an event would lose
 *    them permanently, with no error and no record. Its absence below is
 *    deliberate; do not add it to "fix" a migration failure.
 *
 * 2. The database is ENCRYPTED at rest via SQLCipher (§20.3). It holds the
 *    complete guest list of a private event — names, tables, VIP designations,
 *    free-text notes — on a tablet that is routinely hired, left unattended at
 *    an entrance, and physically accessible to strangers for hours.
 *
 * ── Schema versioning ──
 *
 * Schema JSON is exported to app/schemas (see build.gradle.kts) and committed.
 * Every future schema change ships an explicit Migration plus a migration test
 * against the previous released version. If a migration ever fails, the app must
 * NOT wipe — it must fail into a recovery mode that preserves the file for
 * extraction (§21.2).
 */
@Database(
    entities = [
        EventEntity::class,
        PartyEntity::class,
        GuestEntity::class,
        GuestStagingEntity::class,
        CheckInEntity::class,
        SyncQueueEntity::class,
        StaffEntity::class,
        VenueTableEntity::class,
        ConflictEntity::class,
    ],
    version = 1,
    exportSchema = true,
)
abstract class CheckinDatabase : RoomDatabase() {

    abstract fun eventDao(): EventDao
    abstract fun partyDao(): PartyDao
    abstract fun guestDao(): GuestDao
    abstract fun guestStagingDao(): GuestStagingDao
    abstract fun checkInDao(): CheckInDao
    abstract fun syncQueueDao(): SyncQueueDao
    abstract fun staffDao(): StaffDao
    abstract fun venueTableDao(): VenueTableDao
    abstract fun conflictDao(): ConflictDao
    abstract fun bundleDao(): BundleDao

    companion object {
        const val NAME = "fancy_checkin.db"

        /**
         * All migrations, in order. Empty at v1.
         *
         * When this grows: every entry must have a matching test in
         * androidTest/MigrationTest.kt that runs against the committed schema
         * JSON for the PREVIOUS version. A migration with no test is how a
         * fleet of tablets loses a night's check-ins.
         */
        val MIGRATIONS = emptyArray<androidx.room.migration.Migration>()

        /**
         * Loads SQLCipher's native library. Idempotent — the JVM ignores repeat
         * calls for an already-loaded library.
         *
         * REQUIRED. `net.zetetic:sqlcipher-android` does NOT self-initialise: the
         * older `android-database-sqlcipher` artifact loaded itself via
         * `SQLiteDatabase.loadLibs(context)`, and the rewrite dropped that in
         * favour of an explicit call. Omitting it does not fail at build time or
         * when the database is constructed — Room is lazy, so it fails at the
         * FIRST QUERY, with an UnsatisfiedLinkError.
         *
         * That error is a `java.lang.Error`, not an `Exception`, so it passes
         * straight through every `catch (e: Exception)` in the app and terminates
         * the process. In this app the first query happens inside an OkHttp
         * interceptor during device pairing, which made it look like a pairing or
         * networking fault rather than a missing initialisation.
         */
        private fun loadNativeLibrary() {
            System.loadLibrary("sqlcipher")
        }

        fun build(context: Context, passphrase: ByteArray): CheckinDatabase {
            loadNativeLibrary()

            // SupportOpenHelperFactory zeroes the passphrase array it is given,
            // so the caller must not reuse or retain it afterwards.
            val factory = SupportOpenHelperFactory(passphrase)

            return Room.databaseBuilder(context, CheckinDatabase::class.java, NAME)
                .openHelperFactory(factory)
                .addMigrations(*MIGRATIONS)
                // No fallbackToDestructiveMigration. See the class comment.
                // A missing migration must crash loudly in development rather
                // than delete a venue's arrival record in production.
                .build()
        }
    }
}
