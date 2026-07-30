package com.fancyrsvp.checkin.data.security

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * CROSS-LANGUAGE CONTRACT TEST — staff PIN hashing.
 *
 * The golden vector below was produced by the SERVER's exact hashing path
 * (backend/controllers/authController.js `hashPassword`, PBKDF2-HMAC-SHA512,
 * 600,000 iterations, 64-byte output, "saltHex:keyHex"). It is pinned in
 * backend/test/checkinPinHashContract.test.js too.
 *
 * If this test fails, offline staff login is broken for every device in the
 * field — and the failure at the door would present as "everyone's PIN is
 * wrong", with nothing pointing at a hashing mismatch.
 *
 * These tests are slow by design: each derivation is 600k iterations. That cost
 * IS the security property (§18.5) and must not be lowered to make the suite
 * quicker.
 */
class PinVerifierTest {

    // ── Golden vector, generated from the server implementation ──
    private val saltHex = "0123456789abcdef0123456789abcdef"
    private val pin = "4821"
    private val expectedKeyHex =
        "dfb8e26e2ddb3ce63c3f63a9a84672d8ceec3131c2ecc2b9dd1b0cabfd6e824a" +
            "8e6169ac0712a64653a465e422acbff6c51a5951277a78927f2b01b5ce06eae3"
    private val storedHash = "$saltHex:$expectedKeyHex"

    @Test
    fun `CONTRACT derivation matches the server byte for byte`() {
        assertEquals(expectedKeyHex, PinVerifier.toHex(PinVerifier.derive(pin, saltHex)))
    }

    @Test
    fun `CONTRACT the correct PIN verifies against a server-produced hash`() {
        assertTrue(PinVerifier.verify(pin, storedHash))
    }

    @Test
    fun `CONTRACT the salt is the UTF-8 hex TEXT, not the decoded bytes`() {
        // This is the interop trap. The server passes the hex string straight to
        // crypto.pbkdf2, so Node uses its 32 ASCII bytes as salt material. Using
        // the 16 decoded bytes yields a different key and rejects every PIN.
        val decodedSaltBytes = ByteArray(16) { i ->
            val hi = Character.digit(saltHex[i * 2], 16)
            val lo = Character.digit(saltHex[i * 2 + 1], 16)
            ((hi shl 4) or lo).toByte()
        }
        val wrong = javax.crypto.SecretKeyFactory.getInstance("PBKDF2WithHmacSHA512")
            .generateSecret(
                javax.crypto.spec.PBEKeySpec(
                    pin.toCharArray(), decodedSaltBytes, PinVerifier.ITERATIONS, 512,
                ),
            ).encoded

        assertNotEquals(
            "if these matched, the trap would be harmless and this guard pointless",
            expectedKeyHex,
            PinVerifier.toHex(wrong),
        )
    }

    @Test
    fun `CONTRACT the iteration count matches the server`() {
        assertEquals(600_000, PinVerifier.ITERATIONS)
    }

    // ── Rejection behaviour ──

    @Test
    fun `a wrong PIN is rejected`() {
        assertFalse(PinVerifier.verify("4822", storedHash))
    }

    @Test
    fun `an off-by-one-digit PIN is rejected`() {
        assertFalse(PinVerifier.verify("4820", storedHash))
        assertFalse(PinVerifier.verify("3821", storedHash))
    }

    @Test
    fun `an empty PIN is rejected`() {
        assertFalse(PinVerifier.verify("", storedHash))
    }

    // ── Malformed input must fail login, never crash a tablet at a door ──

    @Test
    fun `a null or blank stored hash is rejected without throwing`() {
        assertFalse(PinVerifier.verify(pin, null))
        assertFalse(PinVerifier.verify(pin, ""))
        assertFalse(PinVerifier.verify(pin, "   "))
    }

    @Test
    fun `a stored hash with no separator is rejected`() {
        assertFalse(PinVerifier.verify(pin, "nocolonhere"))
    }

    @Test
    fun `a stored hash with too many parts is rejected`() {
        assertFalse(PinVerifier.verify(pin, "a:b:c"))
    }

    @Test
    fun `a stored hash with an empty half is rejected`() {
        assertFalse(PinVerifier.verify(pin, ":$expectedKeyHex"))
        assertFalse(PinVerifier.verify(pin, "$saltHex:"))
    }

    @Test
    fun `a stored hash with non-hex characters is rejected`() {
        assertFalse(PinVerifier.verify(pin, "$saltHex:zzzz"))
    }

    @Test
    fun `a stored hash with odd-length hex is rejected`() {
        assertFalse(PinVerifier.verify(pin, "$saltHex:abc"))
    }

    @Test
    fun `a truncated but otherwise valid hash is rejected, not partially matched`() {
        // The constant-time comparison folds the length difference in, so a
        // prefix of the correct key must not pass.
        assertFalse(PinVerifier.verify(pin, "$saltHex:${expectedKeyHex.substring(0, 64)}"))
    }

    @Test
    fun `hex output is lowercase, matching Buffer toString hex`() {
        val hex = PinVerifier.toHex(byteArrayOf(0x0A, 0xFF.toByte(), 0x00, 0x7B))
        assertEquals("0aff007b", hex)
    }
}
