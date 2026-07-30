package com.fancyrsvp.checkin.data.remote

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.HTTP
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * The check-in API surface (`/api/v1/checkin/...`).
 *
 * Versioned independently of the organizer API (spec §21.4) so a breaking change
 * can ship as v2 while tablets already at venues keep talking to v1.
 *
 * Everything returns `Response<Envelope<T>>` rather than a bare body. The
 * repository needs the status code to distinguish outcomes that all "fail" but
 * demand opposite responses:
 *
 *   401 TOKEN_EXPIRED    → refresh and retry. Keep scanning throughout.
 *   403 DEVICE_REVOKED   → purge local event data (§20.5).
 *   403 FEATURE_*        → cannot arm this event; never re-gate a live device.
 *   413 BATCH_TOO_LARGE  → split the batch and retry. Not a data loss.
 *   429                  → a normal backoff signal, NEVER a reason to discard
 *                          queued check-ins (§21.9).
 *
 * Collapsing those into one exception type is how a device ends up wiping when it
 * should have refreshed.
 */
interface CheckinApi {

    // ── Pairing: no device credential exists yet ──

    @POST("checkin/devices/pair")
    suspend fun pairDevice(@Body body: PairRequest): Response<Envelope<PairResponse>>

    @POST("checkin/devices/refresh")
    suspend fun refreshToken(@Body body: RefreshRequest): Response<Envelope<RefreshResponse>>

    /** Confirms local event data has been destroyed after a remote wipe (§20.5). */
    @POST("checkin/devices/wipe-confirm")
    suspend fun confirmWipe(): Response<Envelope<Unit>>

    // ── Preparation (requires internet, done before travelling) ──

    @GET("checkin/events")
    suspend fun listEvents(): Response<Envelope<EventListResponse>>

    @GET("checkin/events/{eventId}/bundle/manifest")
    suspend fun bundleManifest(
        @Path("eventId") eventId: String,
    ): Response<Envelope<BundleManifestDto>>

    /**
     * One page of guests.
     *
     * Resumable because pages are ordered by a stable key (guest id) server-side,
     * so re-requesting page N after an interruption returns the same rows.
     */
    @GET("checkin/events/{eventId}/bundle")
    suspend fun bundlePage(
        @Path("eventId") eventId: String,
        @Query("page") page: Int,
        @Query("limit") limit: Int,
    ): Response<Envelope<BundlePageDto>>

    // ── Live operation and reconciliation ──

    @POST("checkin/events/{eventId}/check-ins")
    suspend fun submitBatch(
        @Path("eventId") eventId: String,
        @Body body: CheckInBatchRequest,
    ): Response<Envelope<CheckInBatchResponse>>

    @GET("checkin/events/{eventId}/delta")
    suspend fun checkInDelta(
        @Path("eventId") eventId: String,
        @Query("since_seq") sinceSeq: Long,
    ): Response<Envelope<CheckInDeltaResponse>>

    @GET("checkin/events/{eventId}/guest-delta")
    suspend fun guestDelta(
        @Path("eventId") eventId: String,
        @Query("since_version") sinceVersion: Long,
        @Query("limit") limit: Int = 500,
    ): Response<Envelope<GuestDeltaResponse>>

    /**
     * Supervisor undo — soft delete with a mandatory reason (§9.6).
     *
     * @HTTP(hasBody = true) rather than @DELETE: Retrofit's @DELETE declares
     * hasBody = false and throws "Non-body HTTP method cannot contain @Body" at
     * interface-creation time. The reason is required by the server, so the body
     * is not optional.
     */
    @HTTP(method = "DELETE", path = "checkin/events/{eventId}/check-ins/{clientCheckinId}", hasBody = true)
    suspend fun undoCheckIn(
        @Path("eventId") eventId: String,
        @Path("clientCheckinId") clientCheckinId: String,
        @Body body: UndoRequest,
    ): Response<Envelope<UndoResponse>>

    @GET("checkin/events/{eventId}/controls")
    suspend fun controls(
        @Path("eventId") eventId: String,
    ): Response<Envelope<SyncControlsDto>>

    @PATCH("checkin/events/{eventId}/controls")
    suspend fun setControls(
        @Path("eventId") eventId: String,
        @Body body: SyncControlsDto,
    ): Response<Envelope<SyncControlsDto>>
}
