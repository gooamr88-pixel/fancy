package com.fancyrsvp.checkin.util

import java.security.MessageDigest

/**
 * Bundle integrity verification (spec §21.1).
 *
 * The single most dangerous silent failure in this product: a bundle download
 * interrupted at 60% leaves the app BELIEVING it holds a complete guest list.
 * Nobody discovers otherwise until guests are being told "not found" at a venue
 * with no internet to fix it. It presents as a working app, which is why it
 * needs a positive proof of completeness rather than an absence of errors.
 *
 * ── This must byte-match the server ──
 *
 * The canonical form is defined in backend/services/checkinSyncService.js
 * (`canonicalizeGuests`). Any divergence here makes EVERY bundle fail
 * verification, so the two implementations are deliberately trivial and
 * identical in shape:
 *
 *   1. sort by guest id, ascending, plain lexicographic
 *   2. map each guest to a 5-element array:
 *        [id, partyId, fullName, tableName ?: "", category ?: "standard"]
 *   3. JSON-encode the array-of-arrays with NO whitespace
 *   4. SHA-256, lowercase hex
 *
 * Step 3 is hand-rolled rather than delegated to kotlinx.serialization on
 * purpose: a serializer's escaping and key-ordering choices are an
 * implementation detail that could change under us on a library upgrade, and a
 * silent change would break verification for every device in the field at once.
 * The escaping below matches JSON.stringify exactly.
 */
object BundleIntegrity {

    /** One guest, reduced to the fields the hash covers. */
    data class HashableGuest(
        val id: String,
        val partyId: String,
        val fullName: String,
        val tableName: String?,
        val category: String?,
    )

    private const val CODE_BACKSPACE = 0x08
    private const val CODE_TAB = 0x09
    private const val CODE_NEWLINE = 0x0A
    private const val CODE_FORM_FEED = 0x0C
    private const val CODE_RETURN = 0x0D
    private const val CODE_FIRST_PRINTABLE = 0x20

    /**
     * Escapes a string the way JavaScript's JSON.stringify does.
     *
     * JSON.stringify escapes exactly: the quote, the backslash, and control
     * characters below 0x20 — using the SHORT forms \b \t \n \f \r where they
     * exist and \uXXXX otherwise. It does NOT escape forward slashes or
     * non-ASCII, so Arabic names pass through as literal UTF-8 and the hash
     * covers their bytes directly.
     *
     * Everything is matched by CODE POINT rather than by character literal.
     * Raw control characters in a .kt file are invisible in review and are
     * silently destroyed by a reformat or a stray editor normalisation — and
     * since a single wrong byte here fails verification on every device in the
     * field simultaneously, this is not a place to rely on invisible bytes
     * surviving a decade of edits.
     */
    private fun escapeJson(value: String): String {
        val sb = StringBuilder(value.length + 8)
        for (ch in value) {
            when (val code = ch.code) {
                '"'.code -> sb.append("\\\"")
                '\\'.code -> sb.append("\\\\")
                CODE_BACKSPACE -> sb.append("\\b")
                CODE_TAB -> sb.append("\\t")
                CODE_NEWLINE -> sb.append("\\n")
                CODE_FORM_FEED -> sb.append("\\f")
                CODE_RETURN -> sb.append("\\r")
                else ->
                    if (code < CODE_FIRST_PRINTABLE) {
                        sb.append("\\u").append(String.format("%04x", code))
                    } else {
                        sb.append(ch)
                    }
            }
        }
        return sb.toString()
    }

    /**
     * The canonical serialisation. Must equal the server's
     * `canonicalizeGuests()` output character for character.
     */
    fun canonicalize(guests: List<HashableGuest>): String {
        val sorted = guests.sortedWith { a, b ->
            // Plain UTF-16 code-unit comparison, matching JS's `<`/`>` on
            // strings. Guest ids are UUIDs (ASCII), so this is unambiguous —
            // but it must NOT be a locale-aware collation, which would order
            // differently from the server.
            when {
                a.id < b.id -> -1
                a.id > b.id -> 1
                else -> 0
            }
        }

        val sb = StringBuilder(sorted.size * 96)
        sb.append('[')
        sorted.forEachIndexed { index, g ->
            if (index > 0) sb.append(',')
            sb.append('[')
            sb.append('"').append(escapeJson(g.id)).append("\",")
            sb.append('"').append(escapeJson(g.partyId)).append("\",")
            sb.append('"').append(escapeJson(g.fullName)).append("\",")
            sb.append('"').append(escapeJson(g.tableName ?: "")).append("\",")
            sb.append('"').append(escapeJson(g.category ?: "standard")).append('"')
            sb.append(']')
        }
        sb.append(']')
        return sb.toString()
    }

    private val HEX = "0123456789abcdef".toCharArray()

    /** Lowercase hex SHA-256 of the canonical form. */
    fun contentHash(guests: List<HashableGuest>): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val bytes = digest.digest(canonicalize(guests).toByteArray(Charsets.UTF_8))
        val sb = StringBuilder(bytes.size * 2)
        for (b in bytes) {
            val v = b.toInt() and 0xFF
            sb.append(HEX[v ushr 4]).append(HEX[v and 0x0F])
        }
        return sb.toString()
    }

    /** Outcome of verifying a fully-downloaded bundle. */
    sealed interface Verification {
        data object Valid : Verification
        data class CountMismatch(val expected: Int, val actual: Int) : Verification
        data class HashMismatch(val expected: String, val actual: String) : Verification
    }

    /**
     * Verifies a downloaded set against the manifest's figures.
     *
     * Count is checked before hash purely so a truncated download reports the
     * more actionable of the two failures.
     *
     * A partially valid bundle is NEVER acceptable — the caller must discard the
     * staging data entirely and re-download. There is no "close enough".
     */
    fun verify(
        guests: List<HashableGuest>,
        expectedCount: Int,
        expectedHash: String,
    ): Verification {
        if (guests.size != expectedCount) {
            return Verification.CountMismatch(expectedCount, guests.size)
        }
        val actual = contentHash(guests)
        if (!actual.equals(expectedHash, ignoreCase = true)) {
            return Verification.HashMismatch(expectedHash, actual)
        }
        return Verification.Valid
    }
}
