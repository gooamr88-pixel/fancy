package com.fancyrsvp.checkin.scan

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * Turns a scanned string into a party id (spec §8.3, amendment A-1).
 *
 * ── What the QR actually contains ──
 *
 * The image encodes a URL, not a bare identifier:
 *
 *     https://<origin>/ticket/<urlencoded-JWT>
 *
 * and the JWT is HS256 with payload
 * `{partyId, eventId, tableName, partySize, purpose:"qr_ticket", iat, exp}`.
 * Older emailed tickets encode the bare token instead, so both must resolve.
 *
 * This is why spec §6.1's `qr_index(code_value PK -> guest_id)` table was
 * replaced (amendment A-1): a JWT's bytes depend on when it was signed, tokens
 * are minted on demand in five server call sites and never persisted, so there is
 * no stable string to index. Resolution is instead: parse -> read partyId ->
 * indexed lookup on the local `parties` table.
 *
 * ── No signature verification, deliberately (decision D-20) ──
 *
 * Verifying HS256 on-device would require the platform-wide symmetric secret on a
 * hired tablet. The owner chose not to ship it. That is safer than it sounds,
 * because the DOWNLOADED BUNDLE IS AN ALLOWLIST: a forged token carrying an
 * invented partyId resolves to "not found" like any unknown code, and forging an
 * admission means guessing a real party's v4 UUID.
 *
 * The realistic abuse is photographing a genuine ticket, which §9.5 already
 * handles — the code is consumed on first check-in, so the second presentation
 * reads "already checked in" and needs a supervisor override that lands in the
 * audit trail.
 *
 * `purpose`, `eventId` and `exp` are still read and acted on, because they give
 * the correct result for honest codes at zero cost. They are simply not
 * trustworthy against a deliberate tamper — and a tamperer still needs a real
 * partyId, so tampering buys nothing.
 *
 * The raw token is preserved on a successful parse so the sync layer can send it
 * for SERVER-side verification (amendment A-11). That is the only place a forged
 * scan can ever be detected.
 */
object TicketResolver {

    /** The only `purpose` claim this app will accept. */
    private const val EXPECTED_PURPOSE = "qr_ticket"

    private val TICKET_PATH = Regex("""/ticket/([^/?#]+)""")

    private val json = Json { ignoreUnknownKeys = true }

    @Serializable
    private data class TicketPayload(
        @SerialName("partyId") val partyId: String? = null,
        @SerialName("eventId") val eventId: String? = null,
        @SerialName("tableName") val tableName: String? = null,
        @SerialName("partySize") val partySize: Int? = null,
        @SerialName("purpose") val purpose: String? = null,
        @SerialName("exp") val exp: Long? = null,
        @SerialName("iat") val iat: Long? = null,
    )

    /**
     * The outcome of resolving a scanned string.
     *
     * These map onto §8.4's result states. They are distinguished rather than
     * collapsed into "valid / invalid" because each needs different words and a
     * different next action in front of an usher with a queue forming:
     * "not a ticket" means try manual search, "wrong event" means they are at the
     * wrong door, and "reissued" means the invitation was regenerated.
     */
    sealed interface Resolution {
        /** Parsed and addressed to this event. Look partyId up locally. */
        data class Ticket(
            val partyId: String,
            val eventId: String,
            /** From the token. The LIVE table is re-read locally — see below. */
            val tokenTableName: String?,
            val partySize: Int?,
            val rawToken: String,
            val expiresAtSeconds: Long?,
        ) : Resolution

        /** Not a Fancy ticket at all: a random QR, a URL, a barcode. */
        data object NotATicket : Resolution

        /** A genuine ticket for a different event (§8.4 "wrong event"). */
        data class WrongEvent(val belongsToEventId: String, val rawToken: String) : Resolution

        /**
         * Past its `exp`. Reported separately from NotATicket so staff are told
         * something useful rather than "unknown code" — and because an expired
         * ticket for the CURRENT event is usually a clock problem, not fraud.
         */
        data class Expired(val partyId: String, val eventId: String, val rawToken: String) : Resolution
    }

    /**
     * Resolves a scanned string against the event currently open on this device.
     *
     * @param scanned the raw text ML Kit decoded
     * @param activeEventId the event this device is operating
     * @param nowSeconds injectable so expiry is testable without touching a clock
     */
    fun resolve(
        scanned: String?,
        activeEventId: String,
        nowSeconds: Long = System.currentTimeMillis() / 1000,
    ): Resolution {
        val token = extractToken(scanned) ?: return Resolution.NotATicket
        val payload = decodePayload(token) ?: return Resolution.NotATicket

        // A token signed for a different purpose (an RSVP invite link, say) must
        // never admit anyone. The server signs AND verifies this claim; checking
        // it here keeps an honest mismatch from resolving to a real party.
        if (payload.purpose != EXPECTED_PURPOSE) return Resolution.NotATicket

        val partyId = payload.partyId?.takeIf { it.isNotBlank() } ?: return Resolution.NotATicket
        val eventId = payload.eventId?.takeIf { it.isNotBlank() } ?: return Resolution.NotATicket

        if (eventId != activeEventId) return Resolution.WrongEvent(eventId, token)

        // Expiry is checked AFTER the event match so a guest at the wrong door is
        // told that, rather than being told their ticket expired.
        if (payload.exp != null && payload.exp < nowSeconds) {
            return Resolution.Expired(partyId, eventId, token)
        }

        return Resolution.Ticket(
            partyId = partyId,
            eventId = eventId,
            // Carried for diagnostics only. The scan flow reads the LIVE table
            // from the local bundle instead, mirroring what the server's
            // checkinController already does — a ticket minted before seating was
            // finalised has a stale or absent table, and reading it out to a guest
            // would send them to the wrong seat.
            tokenTableName = payload.tableName,
            partySize = payload.partySize,
            rawToken = token,
            expiresAtSeconds = payload.exp,
        )
    }

    /**
     * Pulls the bare JWT out of a scanned value.
     *
     * Mirrors `extractTicketToken` in backend/services/checkinSyncService.js and
     * in the web kiosk, deliberately — a divergence would mean the app and the
     * kiosk disagree about the same physical card.
     */
    fun extractToken(scanned: String?): String? {
        val text = scanned?.trim().orEmpty()
        if (text.isEmpty()) return null

        val fromUrl = TICKET_PATH.find(text)?.groupValues?.getOrNull(1)
        val candidate = if (fromUrl != null) urlDecode(fromUrl) else text

        // A JWT is exactly three dot-separated segments. Checking shape here means
        // an arbitrary URL or a shop barcode is rejected before any base64 or JSON
        // work, which keeps the common "guest scanned the wrong thing" case fast.
        val parts = candidate.split('.')
        if (parts.size != 3 || parts.any { it.isEmpty() }) return null

        return candidate
    }

    private fun decodePayload(token: String): TicketPayload? {
        val segment = token.split('.').getOrNull(1) ?: return null
        val decoded = base64UrlDecode(segment) ?: return null
        return try {
            json.decodeFromString(TicketPayload.serializer(), decoded)
        } catch (_: Exception) {
            null
        }
    }

    /**
     * Base64URL decode, tolerating the missing padding JWTs always omit.
     *
     * android.util.Base64 with URL_SAFE is deliberately avoided so this class
     * stays a pure JVM unit — it is the piece most worth testing without an
     * emulator, and the contract test that pins it against the server runs on the
     * JVM.
     */
    private fun base64UrlDecode(segment: String): String? {
        val normalised = segment.replace('-', '+').replace('_', '/')
        val padded = when (normalised.length % 4) {
            2 -> "$normalised=="
            3 -> "$normalised="
            0 -> normalised
            // Length 1 mod 4 is not producible by any base64 encoder.
            else -> return null
        }
        return try {
            String(java.util.Base64.getDecoder().decode(padded), Charsets.UTF_8)
        } catch (_: Exception) {
            null
        }
    }

    /** Minimal percent-decoding. The token itself is URL-safe; the wrapper is not. */
    private fun urlDecode(value: String): String = try {
        java.net.URLDecoder.decode(value, "UTF-8")
    } catch (_: Exception) {
        value
    }
}
