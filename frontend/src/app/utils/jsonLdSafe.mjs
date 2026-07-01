/**
 * Safely serialize an object for embedding inside a
 * <script type="application/ld+json"> block via dangerouslySetInnerHTML.
 *
 * SECURITY (fixes H2 - stored XSS): JSON.stringify does NOT escape '<', '>' or
 * '&', so a value containing "</script>" (e.g. an organizer-controlled event
 * title/description) would terminate the <script> element early and inject
 * arbitrary markup into the public event page - a stored XSS affecting every
 * guest who opens the link.
 *
 * We map those three HTML-significant characters to their JSON unicode escapes.
 * The result is still valid JSON (it round-trips to the original value) but is
 * inert as HTML: "</script>" becomes "\u003c/script\u003e" and cannot break out.
 * (The block is parsed as application/ld+json, i.e. JSON, so escaping < > & is
 * sufficient; no JS-string-context escaping is required for this sink.)
 *
 * @param {unknown} obj  the object to serialize (null/undefined -> "null")
 * @returns {string} an HTML-safe JSON string for dangerouslySetInnerHTML
 */
const UNSAFE_JSONLD = /[<>&]/g;

const REPLACEMENTS = {
  '<': '\\u003c',
  '>': '\\u003e',
  '&': '\\u0026',
};

export function safeJsonLdHtml(obj) {
  return JSON.stringify(obj == null ? null : sanitizeValue(obj)).replace(
    UNSAFE_JSONLD,
    (c) => REPLACEMENTS[c],
  );
}

/**
 * Recursively sanitize values to ensure nested objects are handled.
 * Strings are returned as-is (JSON.stringify + the replace above handle them).
 * Objects and arrays are walked so every nested string value is covered by
 * the top-level replace.
 */
function sanitizeValue(val) {
  if (val === null || val === undefined) return val;
  if (Array.isArray(val)) return val.map(sanitizeValue);
  if (typeof val === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(val)) {
      out[k] = sanitizeValue(v);
    }
    return out;
  }
  return val;
}
