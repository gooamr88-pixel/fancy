const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  escapeHtml, getQRTicketTemplate, getRSVPConfirmationTemplate, buildTicketLinks,
} = require('../utils/emailTemplates');

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

/* ── Entry pass ──────────────────────────────────────────────────────────
 * The pass is the guest's only credential at the door, and its failure mode
 * is silent: a template that drops the QR still renders as a perfectly
 * pleasant email. These assert the parts a human proofreading the design
 * would not notice were missing.
 */

const EVENT = {
  id: 'evt-1', title: 'Evan & Angelina', event_date: '2026-09-19T18:30:00Z',
  location_name: 'The Grand Ballroom', location_address: '100 Front St W, Toronto',
};
const PARTY = { id: '9f3a1c2e-77bd-4a11-9c0e-b2d4e5f6a1b7', guest_name: 'Rouida Mousa', party_size: 2, response: 'yes' };
const LINKS = { qrImageUrl: 'https://api.example.com/qr/tok.png', qrDownloadUrl: 'https://api.example.com/qr/tok.png?download=1', ticketUrl: 'https://example.com/ticket/tok' };

test('entry pass renders without a table assignment', () => {
  const html = getQRTicketTemplate(PARTY, EVENT, { tableName: null, links: LINKS });
  assert.ok(html.includes(LINKS.qrImageUrl), 'the QR image is present');
  assert.ok(html.includes('Assigned when you arrive'), 'the seat line explains there is no table yet');
  assert.ok(!html.includes('undefined') && !html.includes('null'), 'no placeholder leaked into the copy');
});

test('entry pass shows an assigned table, prefixing bare numbers only', () => {
  assert.ok(getQRTicketTemplate(PARTY, EVENT, { tableName: '5', links: LINKS }).includes('Table 5'));
  const named = getQRTicketTemplate(PARTY, EVENT, { tableName: 'Rose Garden', links: LINKS });
  assert.ok(named.includes('Rose Garden') && !named.includes('Table Rose Garden'));
});

test('entry pass always offers a download and an online copy', () => {
  const html = getQRTicketTemplate(PARTY, EVENT, { tableName: '5', links: LINKS });
  assert.ok(html.includes(LINKS.qrDownloadUrl), 'download link present');
  assert.ok(html.includes(LINKS.ticketUrl), 'web ticket link present');
});

test('entry pass escapes a hostile guest name', () => {
  const html = getQRTicketTemplate({ ...PARTY, guest_name: '<img src=x onerror=alert(1)>' }, EVENT, { links: LINKS });
  assert.ok(!html.includes('<img src=x'), 'the injected tag is escaped');
});

test('a confirmed RSVP carries the pass inline; a maybe does not', () => {
  const yes = getRSVPConfirmationTemplate(PARTY, EVENT, 'en', LINKS);
  assert.ok(yes.includes(LINKS.qrImageUrl), 'confirmed guest gets the QR in the confirmation itself');
  assert.ok(yes.includes(LINKS.qrDownloadUrl), 'and can save it');

  const maybe = getRSVPConfirmationTemplate({ ...PARTY, response: 'maybe' }, EVENT, 'en', LINKS);
  assert.ok(!maybe.includes(LINKS.qrImageUrl), 'a tentative guest gets no entry credential');
});

test('a confirmation with no minted token falls back to the old wording, not a broken pass', () => {
  const html = getRSVPConfirmationTemplate(PARTY, EVENT, 'en', null);
  assert.ok(html.includes('separate email'));
  assert.ok(!html.includes('<img src="undefined"'));
});

test('the Arabic pass renders RTL and in Arabic', () => {
  const html = getQRTicketTemplate(PARTY, EVENT, { tableName: null, links: LINKS, lang: 'ar' });
  assert.ok(html.includes('dir="rtl"'));
  assert.ok(html.includes('بطاقة دخولك'));
  assert.ok(!html.includes('Assigned when you arrive'), 'no English copy leaks into the Arabic pass');
});

test('buildTicketLinks derives all three URLs from one token', () => {
  const links = buildTicketLinks('a.b.c');
  assert.ok(links.qrImageUrl.endsWith('/api/v1/public/qr/a.b.c.png'));
  assert.equal(links.qrDownloadUrl, `${links.qrImageUrl}?download=1`);
  assert.ok(links.ticketUrl.endsWith('/ticket/a.b.c'));
});
