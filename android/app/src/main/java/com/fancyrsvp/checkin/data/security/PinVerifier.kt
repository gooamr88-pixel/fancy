package com.fancyrsvp.checkin.data.security

import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec

/**
 * Offline staff PIN verification (spec §18.5).
 *
 * Staff log in against a hash shipped in the bundle, with no network. A
 * plaintext PIN is never stored or transmitted in either direction.
 *
 * ── This must match the server's hashing exactly ──
 *
 * Format produced by backend/controllers/authController.js `hashPassword()`:
 *
 *     "<saltHex>:<derivedKeyHex>"
 *     PBKDF2-HMAC-SHA512, 600,000 iterations, 64-byte output
 *
 * THE TRAP: the server calls `crypto.pbkdf2(password, salt, ...)` where `salt`
 * is the hex STRING. Node converts a string salt to bytes as UTF-8, so the salt
 * material is the 32 ASCII bytes of the hex text — NOT the 16 bytes it decodes
 * to. Passing the decoded bytes here produces a completely different key and
 * every PIN would be rejected, with nothing in the failure pointing at the
 * cause. Verified against the server: hashing with decoded bytes yields a
 * different result (see the golden vector in PinVerifierTest).
 *
 * ── Why 600,000 iterations ──
 *
 * A 4-digit PIN is a 10,000-value keyspace, so a fast hash is trivially
 * reversible from a stolen tablet — the slow hash is the entire defence,
 * alongside the per-device lockout. §18.5 asks for bcrypt or Argon2id; this
 * project uses the platform's existing PBKDF2 rather than adding a native
 * dependency, and 600k PBKDF2-SHA512 satisfies the requirement the spec is
 * actually expressing.
 *
 * PERFORMANCE NOTE, needs hardware validation: 600k PBKDF2-SHA512 costs roughly
 * 0.2–0.5 s on a desktop and can be several times that on a low-end tablet.
 * That is acceptable for a once-per-shift login, but §18.5 also wants staff
 * switching to be fast because handover happens mid-rush. Measure this on the
 * purchased hardware (decision D-1); if it exceeds ~1.5 s, the fix is a
 * progress indicator on the PIN screen, NOT a lower iteration count.
 */
object PinVerifier {

    const val ITERATIONS = 600_000
    private const val KEY_LENGTH_BITS = 512 // 64 bytes
    private const val ALGORITHM = "PBKDF2WithHmacSHA512"

    /**
     * Constant-time comparison of a PIN against a stored `salt:hash` string.
     *
     * Returns false rather than throwing on any malformed input: a corrupt
     * roster entry must fail login, never crash the app at a door.
     */
    fun verify(pin: String, storedHash: String?): Boolean {
        if (storedHash.isNullOrBlank()) return false

        val parts = storedHash.split(':')
        if (parts.size != 2) return false
        val saltHex = parts[0]
        val expectedHex = parts[1]
        if (saltHex.isEmpty() || expectedHex.isEmpty()) return false

        val expected = hexToBytes(expectedHex) ?: return false

        val derived = try {
            derive(pin, saltHex)
        } catch (_: Exception) {
            return false
        }

        return constantTimeEquals(derived, expected)
    }

    /**
     * Derives the key for a PIN and a salt.
     *
     * `saltHex.toByteArray(UTF_8)` is the critical line — see the class comment.
     */
    fun derive(pin: String, saltHex: String): ByteArray {
        val spec = PBEKeySpec(
            pin.toCharArray(),
            saltHex.toByteArray(Charsets.UTF_8),
            ITERATIONS,
            KEY_LENGTH_BITS,
        )
        return try {
            SecretKeyFactory.getInstance(ALGORITHM).generateSecret(spec).encoded
        } finally {
            // Clears the internal char[] copy so the PIN does not linger on the
            // heap longer than necessary.
            spec.clearPassword()
        }
    }

    /** Lowercase hex, matching the server's Buffer.toString('hex'). */
    fun toHex(bytes: ByteArray): String {
        val out = StringBuilder(bytes.size * 2)
        for (b in bytes) {
            val v = b.toInt() and 0xFF
            out.append(HEX[v ushr 4]).append(HEX[v and 0x0F])
        }
        return out.toString()
    }

    private val HEX = "0123456789abcdef".toCharArray()

    private fun hexToBytes(hex: String): ByteArray? {
        if (hex.length % 2 != 0) return null
        val out = ByteArray(hex.length / 2)
        var i = 0
        while (i < hex.length) {
            val hi = Character.digit(hex[i], 16)
            val lo = Character.digit(hex[i + 1], 16)
            if (hi < 0 || lo < 0) return null
            out[i / 2] = ((hi shl 4) or lo).toByte()
            i += 2
        }
        return out
    }

    /**
     * Length-independent, branch-free comparison.
     *
     * A `==` on ByteArray in Kotlin is reference equality, and
     * `contentEquals` short-circuits on the first differing byte — which leaks
     * how many leading bytes were correct. Over a 10,000-value keyspace that is
     * a real signal.
     */
    private fun constantTimeEquals(a: ByteArray, b: ByteArray): Boolean {
        var diff = a.size xor b.size
        val len = minOf(a.size, b.size)
        for (i in 0 until len) {
            diff = diff or (a[i].toInt() xor b[i].toInt())
        }
        return diff == 0
    }
}
