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
  accept: 'https://app.test/rsvp?token=ACCEPT',
  decline: 'https://app.test/rsvp?token=DECLINE',
  maybe: 'https://app.test/rsvp?token=MAYBE',
  manage: 'https://app.test/rsvp?token=MANAGE',
};

test('invitation template renders all three response buttons with their links', () => {
  const html = getInvitationTemplate({ guest_name: 'Ada Lovelace' }, event, links);
  assert.match(html, /Accept/);
  assert.match(html, /Decline/);
  assert.match(html, /Maybe/);
  assert.ok(html.includes(links.accept), 'accept link present');
  assert.ok(html.includes(links.decline), 'decline link present');
  assert.ok(html.includes(links.maybe), 'maybe link present');
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
