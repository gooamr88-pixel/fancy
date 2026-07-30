package com.fancyrsvp.checkin.scan

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * CROSS-LANGUAGE CONTRACT TEST — QR ticket parsing.
 *
 * The token below was minted by the REAL server (`tokenService.signQrTicket`) and
 * is pinned identically in backend/test/checkinTicketParseContract.test.js. If the
 * server ever changes the payload shape, the URL wrapping, or the `purpose`
 * claim, one of the two suites fails — rather than every scan at a door silently
 * resolving to "not found".
 *
 * Note what is NOT tested here: the signature. Decision D-20 removed on-device
 * verification, so this class parses without verifying (see TicketResolver's
 * comment for why that is defensible). The signature segment is present in the
 * fixture only because a JWT must have three segments to be shaped like one.
 */
class TicketResolverTest {

    // ── Golden vector, minted by the server ──
    private val token =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
            "eyJwYXJ0eUlkIjoiM2YxYzlhMmUtN2I0NC00ZDhhLTljMzEtMGU1ZjZhN2I4YzlkIiwiZXZlbnRJZCI6" +
            "IjExMTExMTExLTExMTEtNDExMS04MTExLTExMTExMTExMTExMSIsInRhYmxlTmFtZSI6IlRhYmxlIDEy" +
            "IiwicGFydHlTaXplIjo0LCJwdXJwb3NlIjoicXJfdGlja2V0IiwiaWF0IjoxNzg1NDA0NzY2LCJleHAi" +
            "OjE4OTM1NDI0MDB9." +
            "j1w6JTPYA20rnRVxgvGX3d_JJd1RFVORKMcqoiItzkA"

    private val partyId = "3f1c9a2e-7b44-4d8a-9c31-0e5f6a7b8c9d"
    private val eventId = "11111111-1111-4111-8111-111111111111"
    private val expSeconds = 1893542400L
    private val beforeExpiry = 1785404800L

    // ══════════════════════════════════════════════════════════════
    // The happy path
    // ══════════════════════════════════════════════════════════════

    @Test
    fun `CONTRACT a server-minted ticket resolves to its party`() {
        val result = TicketResolver.resolve(token, eventId, beforeExpiry)
        assertTrue(result is TicketResolver.Resolution.Ticket)
        result as TicketResolver.Resolution.Ticket
        assertEquals(partyId, result.partyId)
        assertEquals(eventId, result.eventId)
        assertEquals("Table 12", result.tokenTableName)
        assertEquals(4, result.partySize)
        assertEquals(expSeconds, result.expiresAtSeconds)
    }

    @Test
    fun `CONTRACT the same ticket wrapped in a ticket URL resolves identically`() {
        // This is what the QR image actually encodes.
        val url = "https://fancyrsvp.com/ticket/$token"
        val fromUrl = TicketResolver.resolve(url, eventId, beforeExpiry)
        val fromBare = TicketResolver.resolve(token, eventId, beforeExpiry)
        assertEquals(fromBare, fromUrl)
    }

    @Test
    fun `CONTRACT the raw token is preserved for server-side verification`() {
        // Amendment A-11: the server is the only place a forged scan can be
        // caught, and it needs the token to do it.
        val result = TicketResolver.resolve("https://fancyrsvp.com/ticket/$token", eventId, beforeExpiry)
        result as TicketResolver.Resolution.Ticket
        assertEquals(token, result.rawToken)
    }

    // ══════════════════════════════════════════════════════════════
    // URL shapes seen in the wild
    // ══════════════════════════════════════════════════════════════

    @Test
    fun `a query string or fragment after the token is ignored`() {
        for (suffix in listOf("?utm_source=email", "#seat", "?a=1&b=2#x")) {
            val result = TicketResolver.resolve(
                "https://fancyrsvp.com/ticket/$token$suffix", eventId, beforeExpiry,
            )
            assertTrue("suffix $suffix", result is TicketResolver.Resolution.Ticket)
        }
    }

    @Test
    fun `a percent-encoded token in the URL is decoded`() {
        // encodeURIComponent leaves a JWT untouched, but a mail client or a
        // scanner app may re-encode the dots.
        val encoded = token.replace(".", "%2E")
        val result = TicketResolver.resolve("https://fancyrsvp.com/ticket/$encoded", eventId, beforeExpiry)
        assertTrue(result is TicketResolver.Resolution.Ticket)
    }

    @Test
    fun `surrounding whitespace is tolerated`() {
        val result = TicketResolver.resolve("  $token  ", eventId, beforeExpiry)
        assertTrue(result is TicketResolver.Resolution.Ticket)
    }

    @Test
    fun `a different host still resolves - the path is what matters`() {
        // Staging, a custom white-label domain, or a shortened link that expands.
        val result = TicketResolver.resolve("https://staging.example.com/ticket/$token", eventId, beforeExpiry)
        assertTrue(result is TicketResolver.Resolution.Ticket)
    }

    // ══════════════════════════════════════════════════════════════
    // Wrong event (§8.4) — never silently accepted
    // ══════════════════════════════════════════════════════════════

    @Test
    fun `CONTRACT a ticket for another event reports WrongEvent with the event it belongs to`() {
        val other = "22222222-2222-4222-8222-222222222222"
        val result = TicketResolver.resolve(token, other, beforeExpiry)
        assertTrue(result is TicketResolver.Resolution.WrongEvent)
        result as TicketResolver.Resolution.WrongEvent
        assertEquals(eventId, result.belongsToEventId)
    }

    @Test
    fun `wrong event is reported even when the ticket is also expired`() {
        // A guest at the wrong door should be told that, not told their ticket
        // expired — the wrong-event fact is the actionable one.
        val other = "22222222-2222-4222-8222-222222222222"
        val result = TicketResolver.resolve(token, other, expSeconds + 1)
        assertTrue(result is TicketResolver.Resolution.WrongEvent)
    }

    // ══════════════════════════════════════════════════════════════
    // Expiry
    // ══════════════════════════════════════════════════════════════

    @Test
    fun `an expired ticket for this event reports Expired, not NotATicket`() {
        val result = TicketResolver.resolve(token, eventId, expSeconds + 1)
        assertTrue(result is TicketResolver.Resolution.Expired)
        result as TicketResolver.Resolution.Expired
        assertEquals(partyId, result.partyId)
    }

    @Test
    fun `a ticket exactly at its expiry second is still valid`() {
        // The server signs exp as event_date + 24h. Rejecting on the boundary
        // would turn a rounding difference into a refused guest.
        val result = TicketResolver.resolve(token, eventId, expSeconds)
        assertTrue(result is TicketResolver.Resolution.Ticket)
    }

    // ══════════════════════════════════════════════════════════════
    // Rejection — everything that is not a ticket
    // ══════════════════════════════════════════════════════════════

    @Test
    fun `arbitrary text and other QR payloads are rejected`() {
        val notTickets = listOf(
            "", "   ", "hello world",
            "https://fancyrsvp.com/", "https://example.com/ticket/",
            "WIFI:T:WPA;S:VenueGuest;P:hunter2;;",
            "0123456789012",
            "not.a.jwt.at.all.really",
            "onlyonepart",
            "two.parts",
        )
        for (value in notTickets) {
            assertEquals(
                "expected NotATicket for ${'"'}$value${'"'}",
                TicketResolver.Resolution.NotATicket,
                TicketResolver.resolve(value, eventId, beforeExpiry),
            )
        }
    }

    @Test
    fun `null input is rejected without throwing`() {
        assertEquals(TicketResolver.Resolution.NotATicket, TicketResolver.resolve(null, eventId))
    }

    @Test
    fun `a JWT-shaped string with undecodable base64 is rejected`() {
        assertEquals(
            TicketResolver.Resolution.NotATicket,
            TicketResolver.resolve("aaa.!!!!.bbb", eventId, beforeExpiry),
        )
    }

    @Test
    fun `a JWT with valid base64 but non-JSON payload is rejected`() {
        // "aGVsbG8" is base64url for "hello" — decodes fine, is not an object.
        assertEquals(
            TicketResolver.Resolution.NotATicket,
            TicketResolver.resolve("aaa.aGVsbG8.bbb", eventId, beforeExpiry),
        )
    }

    @Test
    fun `CONTRACT a token for a different purpose cannot admit anyone`() {
        // An RSVP invite link is signed with the SAME secret. Only the purpose
        // claim separates them, which is exactly why the server signs and verifies
        // it — and why this side checks it too.
        val payload = """{"partyId":"$partyId","eventId":"$eventId","purpose":"rsvp_invite"}"""
        val fake = "aaa." + b64url(payload) + ".bbb"
        assertEquals(
            TicketResolver.Resolution.NotATicket,
            TicketResolver.resolve(fake, eventId, beforeExpiry),
        )
    }

    @Test
    fun `a ticket payload missing partyId or eventId is rejected`() {
        val noParty = "aaa." + b64url("""{"eventId":"$eventId","purpose":"qr_ticket"}""") + ".bbb"
        val noEvent = "aaa." + b64url("""{"partyId":"$partyId","purpose":"qr_ticket"}""") + ".bbb"
        val blankParty = "aaa." + b64url("""{"partyId":"","eventId":"$eventId","purpose":"qr_ticket"}""") + ".bbb"

        for (value in listOf(noParty, noEvent, blankParty)) {
            assertEquals(
                TicketResolver.Resolution.NotATicket,
                TicketResolver.resolve(value, eventId, beforeExpiry),
            )
        }
    }

    @Test
    fun `a ticket with no exp claim is treated as non-expiring`() {
        val noExp = "aaa." + b64url("""{"partyId":"$partyId","eventId":"$eventId","purpose":"qr_ticket"}""") + ".bbb"
        val result = TicketResolver.resolve(noExp, eventId, beforeExpiry)
        assertTrue(result is TicketResolver.Resolution.Ticket)
        result as TicketResolver.Resolution.Ticket
        assertNull(result.expiresAtSeconds)
    }

    @Test
    fun `unknown payload fields are ignored, so a server addition cannot break scanning`() {
        val extra = "aaa." + b64url(
            """{"partyId":"$partyId","eventId":"$eventId","purpose":"qr_ticket","newField":"x","nested":{"a":1}}""",
        ) + ".bbb"
        assertTrue(TicketResolver.resolve(extra, eventId, beforeExpiry) is TicketResolver.Resolution.Ticket)
    }

    // ══════════════════════════════════════════════════════════════
    // Base64URL handling
    // ══════════════════════════════════════════════════════════════

    @Test
    fun `payloads needing one or two padding characters decode correctly`() {
        // JWTs never carry padding, so every unpadded length must work. These
        // payloads are sized to land on each length-mod-4 case.
        val cases = listOf(
            """{"partyId":"p","eventId":"e","purpose":"qr_ticket"}""",
            """{"partyId":"pp","eventId":"e","purpose":"qr_ticket"}""",
            """{"partyId":"ppp","eventId":"e","purpose":"qr_ticket"}""",
            """{"partyId":"pppp","eventId":"e","purpose":"qr_ticket"}""",
        )
        for (payload in cases) {
            val encoded = b64url(payload)
            val result = TicketResolver.resolve("aaa.$encoded.bbb", "e", beforeExpiry)
            assertTrue("payload $payload (len%4=${encoded.length % 4})", result is TicketResolver.Resolution.Ticket)
        }
    }

    @Test
    fun `a payload containing base64url-specific characters decodes`() {
        // '-' and '_' replace '+' and '/'. A table name with the right bytes
        // produces them, and a decoder that only handles standard base64 would
        // fail on exactly those guests.
        val payload = """{"partyId":"$partyId","eventId":"$eventId","purpose":"qr_ticket","tableName":"Tab~le?>"}"""
        val encoded = b64url(payload)
        val result = TicketResolver.resolve("aaa.$encoded.bbb", eventId, beforeExpiry)
        assertTrue(result is TicketResolver.Resolution.Ticket)
    }

    @Test
    fun `extractToken returns null for anything not shaped like a JWT`() {
        assertNull(TicketResolver.extractToken(null))
        assertNull(TicketResolver.extractToken(""))
        assertNull(TicketResolver.extractToken("https://fancyrsvp.com/ticket/"))
        assertNull(TicketResolver.extractToken("a..b"))
        assertEquals(token, TicketResolver.extractToken(token))
    }

    /** Unpadded base64url, as a JWT encoder produces. */
    private fun b64url(value: String): String =
        java.util.Base64.getUrlEncoder().withoutPadding()
            .encodeToString(value.toByteArray(Charsets.UTF_8))
}
