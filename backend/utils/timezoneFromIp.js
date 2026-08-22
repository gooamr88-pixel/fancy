/**
 * ─────────────────────────────────────────────────────────────────────────────
 * WHICH CLOCK DOES THIS NEW ACCOUNT KEEP?
 *
 * Called exactly twice — once in each signup path — and never again for the
 * life of the account. That rarity is the design, not an accident of the
 * current call sites:
 *
 *   • It is why a network round-trip is affordable here. One outbound request
 *     per account created is nothing; one per request would be indefensible.
 *   • It is why the answer is written to a column instead of recomputed. An
 *     account opened in San Diego keeps San Diego time when its owner later
 *     signs in from Cairo, because nothing ever asks the question again.
 *
 * That second point is the whole feature. A timezone that tracked the current
 * IP would rewrite the advertised start time of a wedding because the planner
 * took a holiday — the resolved zone is a fact about where the business is,
 * not about where its owner is standing this morning.
 *
 * COUNTRY IS NOT ENOUGH, WHICH IS WHY THIS FILE EXISTS AT ALL
 *
 * The cheap ways to geolocate an IP return a country code, and for this
 * platform's home market a country code answers nothing: the United States
 * spans six zones, so 'US' does not distinguish San Diego from New York. Only
 * a city-level lookup yields a usable IANA name, so the provider must return
 * `timezone` directly rather than something this code maps from a country.
 *
 * FAILURE IS ROUTINE AND MUST NEVER BE FATAL
 *
 * Every path out of here is non-throwing and bounded by a short timeout. A
 * geo-IP provider being slow, rate-limited, down, or simply wrong about a
 * VPN exit node is a normal Tuesday, and none of those may block someone from
 * creating an account. The caller falls back to PLATFORM_TIMEZONE and records
 * `timezone_source: 'default'`, which leaves a durable marker that this
 * account's zone was never actually established — so it can be re-resolved
 * later, and so an organizer disputing their times can be answered honestly.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const logger = require('./logger');
const { isValidTimeZone } = require('./timezone');

/** Bounded hard. Signup latency is a user-visible cost; a correct zone is not worth two extra seconds of spinner. */
const LOOKUP_TIMEOUT_MS = Number(process.env.GEOIP_TIMEOUT_MS || 2000);

/**
 * The provider, isolated to one object so swapping vendors is an edit here and
 * nowhere else. `url` builds the request; `parse` pulls the two fields we keep
 * out of whatever shape that vendor returns.
 *
 * The default is a keyless HTTPS endpoint, chosen so this works on a fresh
 * deployment with no credential to provision. Point GEOIP_LOOKUP_URL at a
 * different service (or a self-hosted one) to override; it is templated on
 * `{ip}` and expected to answer with `timezone` and `country_code` fields.
 *
 * Note the deliberate absence of a retry. A second attempt doubles the worst
 * case a signing-up user waits, to recover a value that is both optional and
 * correctable later — a bad trade. One try, then fall back.
 */
const PROVIDER = {
  url: (ip) => (process.env.GEOIP_LOOKUP_URL
    ? process.env.GEOIP_LOOKUP_URL.replace('{ip}', encodeURIComponent(ip))
    : `https://ipapi.co/${encodeURIComponent(ip)}/json/`),
  parse: (json) => ({
    timeZone: json && typeof json.timezone === 'string' ? json.timezone : null,
    country: json && typeof json.country_code === 'string' ? json.country_code : null,
  }),
};

/**
 * Normalises what Express hands us into something a lookup can use, or null.
 *
 * Two cases produce null, and both are ordinary rather than exceptional:
 *
 *   • IPv4-mapped IPv6 ("::ffff:203.0.113.4") is unwrapped rather than
 *     rejected — Node reports client addresses this way on dual-stack
 *     listeners, so treating it as unusable would mean no production signup
 *     ever resolved a zone.
 *
 *   • Loopback and RFC1918 private ranges are rejected outright. These are
 *     every local development signup and every request that arrived without a
 *     usable forwarded header. Sending them to a geo provider cannot succeed —
 *     10.0.0.x is not a place — and would either burn quota on a guaranteed
 *     miss or, worse, return the SERVER's own location, silently stamping a
 *     hosting-region timezone onto a real account as though it were detected.
 */
function normalizeIp(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let ip = raw.trim();

  if (ip.startsWith('::ffff:')) ip = ip.slice(7);

  if (
    ip === '::1' || ip === '127.0.0.1' || ip.startsWith('127.') ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    ip.startsWith('169.254.') ||
    ip.startsWith('fc') || ip.startsWith('fd')
  ) return null;

  return ip;
}

/**
 * Resolves an IANA zone from a client IP.
 *
 * @param {string|null} rawIp — typically `req.ip`, which honours trust-proxy.
 * @returns {Promise<{timeZone: string, country: string|null}|null>}
 *          null whenever no zone could be established, for ANY reason. The
 *          caller decides what to record; this function never guesses and
 *          never substitutes a default of its own, so that "we looked and
 *          failed" stays distinguishable from "we found San Diego".
 */
async function resolveTimezoneFromIp(rawIp) {
  const ip = normalizeIp(rawIp);
  if (!ip) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);

  try {
    const resp = await fetch(PROVIDER.url(ip), {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!resp.ok) {
      logger.warn({ status: resp.status }, '[geoip] lookup returned a non-OK status — falling back to the platform default');
      return null;
    }

    const { timeZone, country } = PROVIDER.parse(await resp.json());

    // Validated against the runtime's own tz database before it can reach a
    // column. A provider returning a renamed, misspelled or empty zone is a
    // real occurrence, and an unvalidated value would sit in the database
    // until it threw inside an email render months later — far from here,
    // with nothing pointing back at this lookup.
    if (!isValidTimeZone(timeZone)) {
      logger.warn({ timeZone }, '[geoip] lookup returned an unrecognised timezone — falling back to the platform default');
      return null;
    }

    return { timeZone, country: country || null };
  } catch (err) {
    // Timeout, DNS failure, rate limit, malformed JSON — all identical from
    // here: no zone. Logged at warn because a sustained run of these means
    // every new account is silently landing on the default and someone should
    // notice before the pattern is a month old.
    logger.warn({ err: err.message }, '[geoip] lookup failed — falling back to the platform default');
    return null;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { resolveTimezoneFromIp, normalizeIp };
