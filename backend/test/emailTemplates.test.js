const { test } = require('node:test');
const assert = require('node:assert/strict');
const { escapeHtml } = require('../utils/emailTemplates');

test('escapeHtml neutralizes all five HTML-significant characters', () => {
  assert.equal(
    escapeHtml(`<script>alert("x")&'`),
    '&lt;script&gt;alert(&quot;x&quot;)&amp;&#039;'
  );
});

test('escapeHtml prevents tag injection from a guest name', () => {
  const out = escapeHtml('<img src=x onerror=alert(1)>');
  assert.ok(!out.includes('<'));
  assert.ok(!out.includes('>'));
});

test('escapeHtml returns empty string for falsy input', () => {
  assert.equal(escapeHtml(''), '');
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
});

test('escapeHtml leaves safe text untouched', () => {
  assert.equal(escapeHtml('Julian Vance'), 'Julian Vance');
});
