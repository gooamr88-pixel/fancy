'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '../../utils/apiClient';
import { usePublicPricing } from '../../utils/usePublicPricing';

const C = {
  gold: '#B8944F', charcoal: '#191B1E', ivory: '#F8F4EC', stone: '#77736A',
  border: '#E8E2D6', white: '#FFFFFF', softBg: '#FAFAF8', success: '#2E7D5B',
};

// The registry label, verbatim. The public pricing endpoint renders tier
// features by label (paymentController -> getFeatureByKey(...).label), so this
// is how a tier is recognised as including the app — matching on the key would
// find nothing, because keys never reach the client.
const FEATURE_LABEL = 'Fancy Check-in app (offline door scanner)';

const formatSize = (bytes) => (bytes > 0 ? `${(bytes / 1024 / 1024).toFixed(0)} MB` : null);

/**
 * "Get the app" — the first thing an organizer needs and the one thing the
 * check-in setup page never mentioned.
 *
 * The page used to open on "Tablets → Create pairing code": a code for an app
 * with no download link anywhere in the product. This closes that gap, and it
 * has to answer three different questions depending on who is looking:
 *
 *   not entitled  → what it is, and which plans include it
 *   not released  → it exists, it is coming, we will tell you
 *   available     → the file, how to verify it, and how to install it
 *
 * Which plans include it is read from the LIVE pricing config rather than
 * written here. A hardcoded "Enterprise and above" is a promise this file
 * cannot keep — the admin can move the feature between tiers in one click, and
 * the sentence would go on claiming the old arrangement.
 */
export default function CheckinAppDownload({ eventId }) {
  const [state, setState] = useState({ phase: 'loading', release: null });
  const { tiers } = usePublicPricing();

  useEffect(() => {
    if (!eventId) return undefined;
    let cancelled = false;

    (async () => {
      try {
        const res = await apiFetch(`/events/${eventId}/checkin-app/release`);
        if (!cancelled) setState({ phase: 'ok', release: res?.data || null });
      } catch (err) {
        if (cancelled) return;
        // A feature-gate denial is not an error to apologise for — it is the
        // upsell. Matched on the code rather than the message: featureGate.js
        // returns FEATURE_REQUIRES_PAYMENT for an unpaid event and
        // FEATURE_NOT_AVAILABLE when the tier simply doesn't carry it, both 403.
        // Anything else genuinely failed and should say so.
        // `err.code` is apiClient's own passthrough of the API's `error` field,
        // added for precisely this ("a feature-gated 403 wants an upgrade
        // prompt, not the raw sentence the API returned").
        const locked = err?.code === 'FEATURE_REQUIRES_PAYMENT'
          || err?.code === 'FEATURE_NOT_AVAILABLE';
        setState({ phase: locked ? 'locked' : 'error', release: null });
      }
    })();

    return () => { cancelled = true; };
  }, [eventId]);

  const includedIn = (tiers || [])
    .filter((t) => (t.features || []).includes(FEATURE_LABEL))
    .map((t) => t.name);

  if (state.phase === 'loading') {
    return <Shell><p style={{ margin: 0, color: C.stone, fontSize: '15px' }}>Checking your plan…</p></Shell>;
  }

  if (state.phase === 'error') {
    return (
      <Shell>
        <p style={{ margin: 0, color: C.stone, fontSize: '15px' }}>
          We couldn&apos;t check the app release just now. Refresh the page to try again.
        </p>
      </Shell>
    );
  }

  if (state.phase === 'locked') return <LockedState includedIn={includedIn} />;

  const r = state.release || {};
  return r.available ? <AvailableState release={r} eventId={eventId} /> : <ComingSoonState release={r} />;
}

/* ── Shared frame ───────────────────────────────────────────────────────── */

function Shell({ children, accent = C.border }) {
  return (
    <div style={{
      background: C.white, border: `1px solid ${C.border}`, borderLeft: `4px solid ${accent}`,
      borderRadius: '14px', padding: '24px',
    }}>
      {children}
    </div>
  );
}

function Heading({ title, sub }) {
  return (
    <>
      <h3 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 600, color: C.charcoal }}>
        {title}
      </h3>
      {sub && <p style={{ margin: '6px 0 0', fontSize: '15px', lineHeight: 1.65, color: C.stone }}>{sub}</p>}
    </>
  );
}

/* ── States ─────────────────────────────────────────────────────────────── */

function LockedState({ includedIn }) {
  return (
    <Shell accent={C.gold}>
      <Heading
        title="Fancy Check-in — the door app"
        sub="A dedicated Android app for the door. It holds your whole guest list on the tablet, so it keeps scanning and admitting guests with no internet at the venue — then syncs everything the moment it is back."
      />
      <p style={{ margin: '16px 0 0', fontSize: '15px', lineHeight: 1.65, color: C.charcoal }}>
        {includedIn.length > 0
          ? <>Included with <strong>{includedIn.join(', ')}</strong>.</>
          : <>Not included in this event&apos;s plan.</>}
      </p>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '18px' }}>
        <Link href="/pricing" style={btnPrimary}>See plans</Link>
        <Link href="/checkin-app" style={btnGhost}>How it works</Link>
      </div>
    </Shell>
  );
}

function ComingSoonState({ release }) {
  return (
    <Shell accent={C.gold}>
      <Heading
        title="Fancy Check-in — opening soon"
        sub="Your plan includes the door app. We are finishing hardware testing on real tablets before we hand it out — we would rather you meet it working than meet it at a door."
      />
      {release.version && (
        <p style={{ margin: '14px 0 0', fontSize: '14px', color: C.stone }}>
          Next release: <strong style={{ color: C.charcoal }}>v{release.version}</strong>
          {release.releaseNotes ? ` — ${release.releaseNotes}` : ''}
        </p>
      )}
      <p style={{ margin: '14px 0 0', fontSize: '14px', color: C.stone }}>
        We will email you the moment it opens. Everything else on this page — pairing, your door
        team, the live arrivals board — you can set up now.
      </p>
    </Shell>
  );
}

function AvailableState({ release, eventId }) {
  const size = formatSize(release.sizeBytes);
  return (
    <Shell accent={C.success}>
      <Heading
        title="Fancy Check-in — the door app"
        sub="Install this on every tablet that will work the door. Pair it in the next step, load the guest list, and it runs the whole event without internet."
      />

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', margin: '20px 0 0' }}>
        {/* A plain anchor, not fetch(): the endpoint 302s to a signed storage
            URL, and letting the browser follow it is what makes the file
            download instead of landing in memory. */}
        <a
          href={`${process.env.NEXT_PUBLIC_API_URL || '/api/v1'}/events/${eventId}/checkin-app/download`}
          style={btnPrimary}
        >
          Download for Android{release.version ? ` · v${release.version}` : ''}
        </a>
        <span style={{ fontSize: '14px', color: C.stone }}>
          {[size, release.minAndroid ? `Android ${release.minAndroid}+` : null].filter(Boolean).join(' · ')}
        </span>
      </div>

      {release.sha256 && (
        <div style={{ marginTop: '18px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.stone }}>
            SHA-256
          </span>
          {/* Published so a venue's IT can verify the file is the one we
              shipped. It is the only defence a sideloaded APK has. */}
          <code style={{
            display: 'block', marginTop: '6px', fontSize: '12px', lineHeight: 1.6,
            color: C.charcoal, background: C.softBg, border: `1px solid ${C.border}`,
            borderRadius: '8px', padding: '10px 12px', overflowWrap: 'anywhere',
          }}>{release.sha256}</code>
        </div>
      )}

      <InstallGuide />
    </Shell>
  );
}

/**
 * Android refuses to install a file from outside a store until the user allows
 * it, per-app, in a settings screen whose name changes by manufacturer. This is
 * the single most likely place an organizer gets stuck, and one line of fine
 * print does not get anyone through it.
 */
function InstallGuide() {
  const steps = [
    'On the tablet, open this page and tap Download. Chrome will warn that this file type can harm your device — that warning appears for every APK, including ones from a vendor you trust. Tap Download anyway.',
    'Open the downloaded file. Android will say your browser is not allowed to install unknown apps, and offer a Settings button.',
    'Tap Settings and turn on "Allow from this source" for the browser you used. On Samsung this reads "Install unknown apps"; on Xiaomi, "Install via USB / unknown sources".',
    'Go back and tap Install. This permission only applies to that one browser — you can turn it off again afterwards.',
    'Open Fancy Check-in and enter the pairing code from the next step.',
  ];

  return (
    <details style={{ marginTop: '20px', borderTop: `1px solid ${C.border}`, paddingTop: '16px' }}>
      <summary style={{ cursor: 'pointer', fontSize: '15px', fontWeight: 600, color: C.charcoal }}>
        Installing it on the tablet — step by step
      </summary>
      <ol style={{ margin: '14px 0 0', paddingInlineStart: '22px', color: C.stone, fontSize: '14.5px', lineHeight: 1.75 }}>
        {steps.map((s, i) => <li key={i} style={{ marginBottom: '8px' }}>{s}</li>)}
      </ol>
      <p style={{ margin: '12px 0 0', fontSize: '13.5px', color: C.stone, fontStyle: 'italic' }}>
        Do this at the office on wifi, not at the venue. The app works offline once the guest list
        is loaded, but installing it and loading the list both need a connection.
      </p>
    </details>
  );
}

const btnPrimary = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  background: C.charcoal, color: C.ivory, border: `1px solid ${C.charcoal}`,
  borderRadius: '10px', padding: '13px 22px', fontSize: '15px', fontWeight: 600,
  textDecoration: 'none', cursor: 'pointer', minHeight: '44px',
};

const btnGhost = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  background: 'transparent', color: C.charcoal, border: `1px solid ${C.border}`,
  borderRadius: '10px', padding: '13px 22px', fontSize: '15px', fontWeight: 600,
  textDecoration: 'none', cursor: 'pointer', minHeight: '44px',
};
