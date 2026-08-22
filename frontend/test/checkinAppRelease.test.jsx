import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act, screen } from '@testing-library/react';

/* ═══════════════════════════════════════════════════════════════════════════
   THE DOOR APP IS OUT, AND EVERY SURFACE HAS TO AGREE.

   The product used to contradict itself. /checkin-app said "Now available" and
   linked a working APK; the dashboard announcement card said the same; and the
   check-in SETUP page — the one place an organizer goes when they are actually
   trying to run a door — told them "opening soon, we will email you the moment
   it opens".

   That state was keyed on `platform_config.checkin_app.enabled`, which no admin
   screen has ever written, so it could only be cleared by editing a config row
   by hand. The email it promised does not exist in the codebase at all.

   These tests pin the resolution: an entitled organizer is always shown the
   announcement and always handed a file that exists.
   ═══════════════════════════════════════════════════════════════════════════ */

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(''),
  usePathname: () => '/dashboard/checkin-setup',
}));

const FEATURE = 'Fancy Check-in app (offline door scanner)';
vi.mock('../src/app/utils/usePublicPricing', () => ({
  usePublicPricing: () => ({
    tiers: [
      { name: 'Essential', features: ['Basic RSVP forms'] },
      { name: 'Enterprise', features: ['Basic RSVP forms', FEATURE] },
    ],
    error: null,
  }),
}));

let release;
let thrown = null;
vi.mock('../src/app/utils/apiClient', () => ({
  apiFetch: async () => {
    if (thrown) throw thrown;
    return { data: release };
  },
}));

import CheckinAppDownload from '../src/app/dashboard/components/CheckinAppDownload';

async function mount() {
  let r;
  await act(async () => { r = render(<CheckinAppDownload eventId="evt-1" />); });
  await act(async () => { await new Promise((res) => setTimeout(res, 20)); });
  return r;
}

beforeEach(() => {
  thrown = null;
  release = {};
});

describe('the check-in app is announced as available', () => {
  it('announces even when no admin release has been configured', async () => {
    // Production's actual state: nothing has ever written checkin_app config.
    // This is the exact case that used to render "opening soon".
    release = { available: false };
    const r = await mount();

    expect(screen.getByText(/now available/i)).toBeTruthy();
    expect(r.container.innerHTML).not.toMatch(/opening soon/i);
    expect(r.container.innerHTML).not.toMatch(/we will email you/i);
  });

  it('falls back to the public APK when no signed build is published', async () => {
    // The file the marketing site already serves. Handing over a working
    // download beats handing over a wait — and installing it grants nothing on
    // its own, because pairing is what requireFeature('checkin_app') gates.
    release = { available: false };
    const r = await mount();

    const link = r.container.querySelector('a[href*="fancy-checkin.apk"]');
    expect(link, 'no public APK link rendered').toBeTruthy();
  });

  it('prefers the gated, audited endpoint once a release is published', async () => {
    // That path 302s to a 120-second signed Storage URL and writes an audit
    // row, so it must win whenever an admin has actually published through it.
    release = { available: true, version: '1.4.0', sizeBytes: 62914560, minAndroid: '8.0' };
    const r = await mount();

    const link = r.container.querySelector('a[href*="/checkin-app/download"]');
    expect(link, 'no gated download link rendered').toBeTruthy();
    expect(r.container.innerHTML).toMatch(/v1\.4\.0/);
  });

  it('still upsells rather than announcing when the plan does not include it', async () => {
    // The one state that legitimately withholds the app. featureGate returns
    // 403 with these codes, and apiClient passes the code through as err.code.
    thrown = Object.assign(new Error('nope'), { code: 'FEATURE_NOT_AVAILABLE' });
    const r = await mount();

    expect(r.container.innerHTML).toMatch(/Included with/i);
    expect(r.container.innerHTML).not.toMatch(/now available/i);
  });

  it('names the including plans from live pricing, never hardcoded', async () => {
    // An admin can move this feature between tiers in one click; a written-in
    // "Enterprise and above" would go on claiming the old arrangement.
    release = { available: false };
    const r = await mount();
    expect(r.container.innerHTML).toMatch(/Enterprise/);
    expect(r.container.innerHTML).not.toMatch(/Essential/);
  });
});
