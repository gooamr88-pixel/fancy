const { test, before } = require('node:test');
const assert = require('node:assert/strict');

// Regression tests for security finding H2 (stored XSS via JSON-LD breakout).
// The escaper is the exact ESM module the frontend pages import; we load it via
// dynamic import so this CommonJS test can exercise the real code.
let safeJsonLdHtml;
before(async () => {
  ({ safeJsonLdHtml } = await import('../../frontend/src/app/utils/jsonLdSafe.mjs'));
});

test('H2: a </script> breakout in event data is neutralized', () => {
  const malicious = 'Wedding</script><script>alert(document.cookie)</script>';
  const out = safeJsonLdHtml({ name: malicious });
  assert.ok(!out.includes('</script>'), 'output must not contain a literal </script>');
  assert.ok(!out.includes('<'), 'no literal < survives');
  // Still valid JSON that round-trips to the ORIGINAL value (SEO data intact).
  assert.equal(JSON.parse(out).name, malicious);
});

test('H2: < > & are escaped to JSON unicode escapes', () => {
  const out = safeJsonLdHtml({ a: '<b>', amp: 'x&y' });
  assert.ok(out.includes('\\u003c'), '< -> \\u003c');
  assert.ok(out.includes('\\u003e'), '> -> \\u003e');
  assert.ok(out.includes('\\u0026'), '& -> \\u0026');
  assert.ok(!/[<>&]/.test(out), 'no raw HTML-significant characters remain');
});

test('safeJsonLdHtml is null/undefined-safe', () => {
  assert.equal(safeJsonLdHtml(null), 'null');
  assert.equal(safeJsonLdHtml(undefined), 'null');
});
