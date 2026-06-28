require('./helpers/env');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getInvitationTemplate } = require('../utils/emailTemplates');

const event = {
  title: 'Spring Gala',
  event_date: '2026-09-01T18:00:00Z',
  slug: 'spring-gala',
  location_name: 'The Grand Hall',
};

const links = {
  view: 'https://app.test/spring-gala?party_id=PARTY-1',
};

test('invitation template renders a single "View Invitation" link to the guest\'s card', () => {
  const html = getInvitationTemplate({ guest_name: 'Ada Lovelace' }, event, links);
  assert.match(html, /View Invitation/);
  assert.ok(html.includes(links.view), 'card link present');
});

test('invitation template includes event title, date and location', () => {
  const html = getInvitationTemplate({ guest_name: 'Ada' }, event, links);
  assert.match(html, /Spring Gala/);
  assert.match(html, /The Grand Hall/);
});

test('invitation template escapes the guest name to prevent HTML injection', () => {
  const html = getInvitationTemplate({ guest_name: '<script>alert(1)</script>' }, event, links);
  assert.ok(!html.includes('<script>alert(1)</script>'), 'raw script tag must not appear');
  assert.match(html, /&lt;script&gt;/);
});
