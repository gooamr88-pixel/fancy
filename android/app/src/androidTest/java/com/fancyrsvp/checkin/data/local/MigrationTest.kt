package com.fancyrsvp.checkin.data.local

import androidx.room.testing.MigrationTestHelper
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Migration tests — a release blocker, not a nicety.
 *
 * `CheckinDatabase` forbids `fallbackToDestructiveMigration` because a failed
 * migration there would silently delete check-ins that exist on that tablet and
 * NOWHERE ELSE (§21.2). The other half of that decision is this file: without a
 * test, a broken migration is discovered by a fleet of tablets failing to open
 * their database on the morning of an event.
 *
 * Each test runs against the COMMITTED schema JSON for the previous version, so
 * it exercises the real shipped shape rather than whatever the entities happen to
 * look like today.
 *
 * ── What it asserts, and why that is the interesting part ──
 *
 * Not just "the migration runs". It writes a row at the old version, migrates,
 * and reads it back — because the failure mode that matters is not a thrown
 * exception, it is a migration that succeeds while quietly dropping data.
 *
 * NOTE: these are instrumented tests and need a device or emulator
 * (`./gradlew :app:connectedAndroidTest`). They do not run in the unit-test JVM
 * suite, because Room's helper needs a real SQLite.
 */
@RunWith(AndroidJUnit4::class)
class MigrationTest {

    @get:Rule
    val helper = MigrationTestHelper(
        InstrumentationRegistry.getInstrumentation(),
        CheckinDatabase::class.java,
    )

    /**
     * v1 → v2 adds the event photograph columns (§9.8).
     *
     * The event row is the one this migration touches, so the assertion is that
     * an event armed under v1 survives with every field intact and simply gains
     * two nulls. An event losing `isReadyOffline` or `lastAppliedSeq` here would
     * present at the venue as a tablet that had never been prepared.
     */
    @Test
    fun migrate1To2_addsCoverColumnsAndKeepsTheEvent() {
        val eventId = "evt-1"

        helper.createDatabase(TEST_DB, 1).use { db ->
            db.execSQL(
                """
                INSERT INTO events
                    (id, name, venue, venueAddress, startsAt, brandingPrimaryColor,
                     noKidsAllowed, totalInvited, bundleVersion, lastAppliedSeq,
                     lastFullSyncAt, isReadyOffline, syncDisabled, realtimeDisabled,
                     pollingOnly)
                VALUES ('$eventId', 'Nadia & Omar', 'Grand Hall', '1 Main St',
                        1780000000000, '#8A6D34', 1, 240, 7, 19,
                        1780000001000, 1, 0, 0, 0)
                """.trimIndent(),
            )
        }

        val db = helper.runMigrationsAndValidate(
            TEST_DB,
            2,
            // validateDroppedTables — nothing is dropped here, and a future
            // migration that does drop something must set this true deliberately.
            true,
            *CheckinDatabase.MIGRATIONS,
        )

        db.query("SELECT * FROM events WHERE id = '$eventId'").use { cursor ->
            assertTrue("the event row must survive the migration", cursor.moveToFirst())

            assertEquals("Nadia & Omar", cursor.getString(cursor.getColumnIndexOrThrow("name")))
            assertEquals(240, cursor.getInt(cursor.getColumnIndexOrThrow("totalInvited")))
            assertEquals(7, cursor.getLong(cursor.getColumnIndexOrThrow("bundleVersion")))
            // The two that would strand a prepared tablet if they were lost.
            assertEquals(19, cursor.getLong(cursor.getColumnIndexOrThrow("lastAppliedSeq")))
            assertEquals(1, cursor.getInt(cursor.getColumnIndexOrThrow("isReadyOffline")))

            // The new columns exist and default to null — "this event has no
            // photograph", which is what every reader already handles.
            assertTrue(cursor.isNull(cursor.getColumnIndexOrThrow("coverImageUrl")))
            assertTrue(cursor.isNull(cursor.getColumnIndexOrThrow("coverImagePath")))
        }
    }

    /**
     * The queue is what a migration must never touch.
     *
     * v1 → v2 has no business near `sync_queue`, and this asserts that directly
     * rather than trusting the SQL to have stayed narrow. A queued check-in is
     * the one piece of data in this system that cannot be recovered from
     * anywhere else (§21.3).
     */
    @Test
    fun migrate1To2_leavesTheSyncQueueAlone() {
        helper.createDatabase(TEST_DB, 1).use { db ->
            db.execSQL(
                """
                INSERT INTO sync_queue
                    (payloadType, payloadJson, eventId, createdAt, attemptCount, lastError, isStalled)
                VALUES ('check_in', '{"clientCheckinId":"queued-1"}', 'evt-1',
                        1780000005000, 2, NULL, 0)
                """.trimIndent(),
            )
        }

        val db = helper.runMigrationsAndValidate(TEST_DB, 2, true, *CheckinDatabase.MIGRATIONS)

        db.query("SELECT * FROM sync_queue WHERE eventId = 'evt-1'").use { cursor ->
            assertTrue("a queued check-in must survive any migration", cursor.moveToFirst())
            assertEquals(2, cursor.getInt(cursor.getColumnIndexOrThrow("attemptCount")))
            assertEquals(
                """{"clientCheckinId":"queued-1"}""",
                cursor.getString(cursor.getColumnIndexOrThrow("payloadJson")),
            )
            assertNull(cursor.getString(cursor.getColumnIndexOrThrow("lastError")))
        }
    }

    /**
     * v2 → v3 adds the event's timezone.
     *
     * Written as a v1 → v3 run rather than v2 → v3 on purpose. A tablet that has
     * been sitting in a drawer since before the photograph release upgrades
     * across BOTH migrations in one open, and chaining is where migrations
     * actually break — each one passes in isolation and the pair corrupts the
     * schema. This is the path that fleet takes.
     */
    @Test
    fun migrate1To3_addsTimezoneAndKeepsThePreparedEvent() {
        val eventId = "evt-1"

        helper.createDatabase(TEST_DB, 1).use { db ->
            db.execSQL(
                """
                INSERT INTO events
                    (id, name, venue, venueAddress, startsAt, brandingPrimaryColor,
                     noKidsAllowed, totalInvited, bundleVersion, lastAppliedSeq,
                     lastFullSyncAt, isReadyOffline, syncDisabled, realtimeDisabled,
                     pollingOnly)
                VALUES ('$eventId', 'Nadia & Omar', 'Grand Hall', '1 Main St',
                        1780000000000, '#8A6D34', 1, 240, 7, 19,
                        1780000001000, 1, 0, 0, 0)
                """.trimIndent(),
            )
        }

        val db = helper.runMigrationsAndValidate(TEST_DB, 3, true, *CheckinDatabase.MIGRATIONS)

        db.query("SELECT * FROM events WHERE id = '$eventId'").use { cursor ->
            assertTrue("the event row must survive both migrations", cursor.moveToFirst())

            // The instant itself was always stored correctly — this migration is
            // about how it is RENDERED, so losing it here would be the one
            // outcome that makes the change worse than the bug it fixes.
            assertEquals(1780000000000, cursor.getLong(cursor.getColumnIndexOrThrow("startsAt")))
            assertEquals(19, cursor.getLong(cursor.getColumnIndexOrThrow("lastAppliedSeq")))
            assertEquals(1, cursor.getInt(cursor.getColumnIndexOrThrow("isReadyOffline")))

            // Null for a row that predates the column. PrepareScreen reads that
            // as "unknown" and falls back to the device clock, which is exactly
            // the behaviour this tablet had before it upgraded.
            assertTrue(cursor.isNull(cursor.getColumnIndexOrThrow("timezone")))
        }
    }

    /**
     * And the queue is still untouchable at v3.
     *
     * Same assertion as the v1 → v2 case, re-run across the chain: a queued
     * check-in is the one piece of data in this system that exists nowhere else
     * (§21.3), so every migration that ships has to be shown not to disturb it.
     */
    @Test
    fun migrate1To3_leavesTheSyncQueueAlone() {
        helper.createDatabase(TEST_DB, 1).use { db ->
            db.execSQL(
                """
                INSERT INTO sync_queue
                    (payloadType, payloadJson, eventId, createdAt, attemptCount, lastError, isStalled)
                VALUES ('check_in', '{"clientCheckinId":"queued-1"}', 'evt-1',
                        1780000005000, 2, NULL, 0)
                """.trimIndent(),
            )
        }

        val db = helper.runMigrationsAndValidate(TEST_DB, 3, true, *CheckinDatabase.MIGRATIONS)

        db.query("SELECT * FROM sync_queue WHERE eventId = 'evt-1'").use { cursor ->
            assertTrue("a queued check-in must survive any migration", cursor.moveToFirst())
            assertEquals(2, cursor.getInt(cursor.getColumnIndexOrThrow("attemptCount")))
            assertEquals(
                """{"clientCheckinId":"queued-1"}""",
                cursor.getString(cursor.getColumnIndexOrThrow("payloadJson")),
            )
            assertNull(cursor.getString(cursor.getColumnIndexOrThrow("lastError")))
        }
    }

    private companion object {
        const val TEST_DB = "migration-test.db"
    }
}
