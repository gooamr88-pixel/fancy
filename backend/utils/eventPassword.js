const crypto = require('crypto');

/**
 * Event access-password hashing (SEC-9).
 *
 * Event passwords are low-value, shareable door codes — not account credentials —
 * but they were previously stored and compared in PLAINTEXT, so an `events` table
 * leak would expose every one. We hash them with scrypt (built into Node, no new
 * dependency) and a per-password random salt, stored as `scrypt$<saltHex>$<hashHex>`.
 * Verification is constant-time via timingSafeEqual.
 */

const SCRYPT_KEYLEN = 32;
const PREFIX = 'scrypt';

/** Hash a plaintext event password → `scrypt$<saltHex>$<hashHex>`. */
function hashEventPassword(plaintext) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16);
    crypto.scrypt(String(plaintext), salt, SCRYPT_KEYLEN, (err, derived) => {
      if (err) return reject(err);
      resolve(`${PREFIX}$${salt.toString('hex')}$${derived.toString('hex')}`);
    });
  });
}

/** True if a stored value is in our hashed format (vs. an unmigrated plaintext value). */
function isHashedEventPassword(stored) {
  return typeof stored === 'string' && stored.startsWith(`${PREFIX}$`);
}

/**
 * Constant-time verify of a candidate password against a stored value.
 * Falls back to a timing-safe plaintext compare if the stored value predates
 * hashing (defensive — fresh launches won't have these).
 */
function verifyEventPassword(candidate, stored) {
  return new Promise((resolve) => {
    if (!stored) return resolve(false);
    const cand = String(candidate || '');

    if (!isHashedEventPassword(stored)) {
      // Legacy plaintext — timing-safe compare, then callers should re-hash on next write.
      const a = Buffer.from(cand, 'utf8');
      const b = Buffer.from(String(stored), 'utf8');
      const len = Math.max(a.length, b.length, 1);
      const pa = Buffer.alloc(len); a.copy(pa);
      const pb = Buffer.alloc(len); b.copy(pb);
      return resolve(a.length === b.length && crypto.timingSafeEqual(pa, pb));
    }

    const [, saltHex, hashHex] = stored.split('$');
    if (!saltHex || !hashHex) return resolve(false);
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    crypto.scrypt(cand, salt, expected.length || SCRYPT_KEYLEN, (err, derived) => {
      if (err) return resolve(false);
      resolve(derived.length === expected.length && crypto.timingSafeEqual(derived, expected));
    });
  });
}

module.exports = { hashEventPassword, isHashedEventPassword, verifyEventPassword };
