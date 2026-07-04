'use client';

import { useEffect, useState, useCallback } from 'react';
import QRCode from 'qrcode';
import { toast } from '../../utils/toast';
import { useIsClient } from '../../utils/useIsClient';

/* ═══════════════════════════════════════════════
   Brand palette
   ═══════════════════════════════════════════════ */
const C = {
  gold: '#B8944F', goldDark: '#9A7B3F', champagne: '#D7BE80',
  charcoal: '#191B1E', ivory: '#F8F4EC', stone: '#77736A',
  border: '#E8E2D6', white: '#FFFFFF', soft: '#FAF8F3',
  ok: '#3A8B55', okBg: 'rgba(58,139,85,0.08)', okBorder: 'rgba(58,139,85,0.22)',
  warn: '#B0820F', warnBg: 'rgba(210,160,60,0.10)', warnBorder: 'rgba(210,160,60,0.28)',
  info: '#9A7B2E', infoBg: 'rgba(184,148,79,0.08)', infoBorder: 'rgba(184,148,79,0.24)',
  muted: '#6B8EAE', mutedBg: 'rgba(107,142,174,0.08)', mutedBorder: 'rgba(107,142,174,0.22)',
};

// Shared QR options. Level "H" keeps the code scannable even when printed small
// or lightly damaged — important for professional flyers / printed invitations.
const qrOptions = (size) => ({
  width: size,
  margin: 2,
  errorCorrectionLevel: 'H',
  color: { dark: C.charcoal, light: C.white },
});

/* ═══ Status → organizer-facing guidance (covers the draft / pending edge cases) ═══ */
function resolveStatus(event) {
  const isPaid = !!event?.is_paid;
  const status = event?.status || 'draft';
  if (!isPaid) {
    return {
      live: false, tone: 'warn', label: 'Not live — payment required',
      detail: 'Your link and QR are reserved, but anyone who scans now sees a placeholder until you activate the event.',
    };
  }
  if (status === 'pending_review') {
    return {
      live: false, tone: 'info', label: 'Under review',
      detail: 'Payment received. Your page goes live the moment our team approves it — you can print and share now.',
    };
  }
  if (status === 'draft') {
    return {
      live: false, tone: 'warn', label: 'Not live yet',
      detail: 'Activate this event to start collecting RSVPs through your link.',
    };
  }
  if (status === 'paused') {
    return {
      live: false, tone: 'warn', label: 'Paused',
      detail: 'Your link is temporarily paused. Resume the event to accept RSVPs again.',
    };
  }
  if (status === 'completed') {
    return {
      live: false, tone: 'muted', label: 'Completed',
      detail: 'This event has ended. The link still resolves but is no longer collecting RSVPs.',
    };
  }
  return {
    live: true, tone: 'ok', label: 'Live · collecting RSVPs',
    detail: 'Anyone with this link or QR can open your page and RSVP instantly.',
  };
}

const toneStyles = {
  ok: { color: C.ok, bg: C.okBg, border: C.okBorder },
  warn: { color: C.warn, bg: C.warnBg, border: C.warnBorder },
  info: { color: C.info, bg: C.infoBg, border: C.infoBorder },
  muted: { color: C.muted, bg: C.mutedBg, border: C.mutedBorder },
};

async function copyToClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* fall through to legacy path */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed'; ta.style.top = '-9999px'; ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}

function triggerDownload(href, filename, revoke) {
  const a = document.createElement('a');
  a.href = href; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  if (revoke) setTimeout(() => URL.revokeObjectURL(href), 1500);
}

/* ═══ Small inline icons ═══ */
const IconCopy = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>);
const IconCheck = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>);
const IconDownload = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>);
const IconShare = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>);
const IconExternal = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>);

/**
 * EventSharePanel — the premium, brand-true "Public Event Sharing" surface.
 *
 * Encodes the GENERAL public entry point (`/{slug}` → landing + RSVP form) — NOT a
 * guest-specific ticket. Copy Link (with global toast), high-resolution downloadable
 * QR (PNG @2048 + vector SVG, generated on-demand client-side), broadcast actions,
 * and a status-aware banner for draft / pending / paused events.
 *
 * Pass `compact` when embedding inside an event card; the full layout is used on the
 * dedicated Share tab.
 */
export default function EventSharePanel({ event, compact = false }) {
  const [qrPreview, setQrPreview] = useState('');
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState('');
  // One-time client-side capability detection — no effect needed, see useIsClient.
  const isClient = useIsClient();
  const canNativeShare = isClient && typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const slug = event?.slug || '';
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://fancyrsvp.com';
  const publicUrl = slug ? `${origin}/${slug}` : '';
  const displayUrl = slug ? `${origin.replace(/^https?:\/\//, '')}/${slug}` : '';
  const status = resolveStatus(event);
  const tone = toneStyles[status.tone] || toneStyles.info;
  const title = event?.title || 'Your event';
  const shareText = `You're invited to ${title}. Tap to view the details and RSVP:`;

  // Clear the stale preview the moment the URL changes (mirrors the previous
  // effect's synchronous `setQrPreview('')` early-return — done during render
  // instead of in an effect to avoid the setState-in-effect cascading-render
  // pattern). The real, asynchronously-generated QR image is produced by the
  // effect below, which only ever calls setQrPreview from inside a promise
  // callback (already effect-safe).
  const [prevPublicUrl, setPrevPublicUrl] = useState(publicUrl);
  if (publicUrl !== prevPublicUrl) {
    setPrevPublicUrl(publicUrl);
    setQrPreview('');
  }

  // Lightweight preview QR — generated once per URL, off the main render path so it
  // never blocks the dashboard. High-res variants are produced only on download.
  useEffect(() => {
    let cancelled = false;
    if (!publicUrl) return;
    QRCode.toDataURL(publicUrl, qrOptions(420))
      .then((url) => { if (!cancelled) setQrPreview(url); })
      .catch((err) => { console.error('QR preview generation failed:', err); });
    return () => { cancelled = true; };
  }, [publicUrl]);

  const handleCopy = useCallback(async () => {
    if (!publicUrl) return;
    const ok = await copyToClipboard(publicUrl);
    if (ok) {
      setCopied(true);
      toast.success('Public link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error('Could not copy the link — please copy it manually.');
    }
  }, [publicUrl]);

  const handleDownloadPng = useCallback(async () => {
    if (!publicUrl) return;
    setDownloading('png');
    try {
      // 2048px is print-grade — crisp at poster size and well beyond invitation cards.
      const dataUrl = await QRCode.toDataURL(publicUrl, qrOptions(2048));
      triggerDownload(dataUrl, `fancy-rsvp-${slug || 'event'}.png`);
      toast.success('High-resolution QR (PNG) downloaded');
    } catch (err) {
      console.error('PNG QR download failed:', err);
      toast.error('Could not generate the PNG. Please try again.');
    } finally {
      setDownloading('');
    }
  }, [publicUrl, slug]);

  const handleDownloadSvg = useCallback(async () => {
    if (!publicUrl) return;
    setDownloading('svg');
    try {
      // Vector — scales infinitely with no quality loss; ideal for professional print.
      const svg = await QRCode.toString(publicUrl, { ...qrOptions(1024), type: 'svg' });
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      triggerDownload(url, `fancy-rsvp-${slug || 'event'}.svg`, true);
      toast.success('Vector QR (SVG) downloaded');
    } catch (err) {
      console.error('SVG QR download failed:', err);
      toast.error('Could not generate the SVG. Please try again.');
    } finally {
      setDownloading('');
    }
  }, [publicUrl, slug]);

  const handleNativeShare = useCallback(async () => {
    if (!publicUrl) return;
    try {
      await navigator.share({ title, text: shareText, url: publicUrl });
    } catch { /* user dismissed the share sheet — no-op */ }
  }, [publicUrl, title, shareText]);

  const channels = [
    { key: 'whatsapp', label: 'WhatsApp', color: '#25D366',
      href: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${publicUrl}`)}`,
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.51 5.26l-.999 3.648 3.978-1.207zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg> },
    { key: 'email', label: 'Email', color: C.stone,
      href: `mailto:?subject=${encodeURIComponent(`You're invited: ${title}`)}&body=${encodeURIComponent(`${shareText}\n\n${publicUrl}`)}`,
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/></svg> },
    { key: 'x', label: 'X', color: C.charcoal,
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(publicUrl)}`,
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> },
    { key: 'facebook', label: 'Facebook', color: '#1877F2',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(publicUrl)}`,
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg> },
  ];

  if (!slug) {
    return (
      <div style={{ padding: '40px 24px', textAlign: 'center', background: C.soft, border: `1px dashed ${C.border}`, borderRadius: 16 }}>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: C.stone, margin: 0 }}>
          This event doesn&apos;t have a public link yet.
        </p>
      </div>
    );
  }

  /* ── QR card (shared by both layouts) ── */
  const qrBlock = (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
      background: `linear-gradient(160deg, ${C.white} 0%, ${C.soft} 100%)`,
      border: `1px solid ${C.border}`, borderRadius: 18, padding: compact ? 18 : 24,
      boxShadow: '0 1px 4px rgba(25,27,30,0.03)',
    }}>
      <div style={{
        position: 'relative', background: C.white, borderRadius: 16, padding: 14,
        border: `1px solid ${C.border}`, boxShadow: '0 6px 22px rgba(184,148,79,0.10)',
      }}>
        {qrPreview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrPreview} alt={`QR code linking to ${title}`}
            style={{ display: 'block', width: compact ? 168 : 208, height: compact ? 168 : 208, borderRadius: 8 }} />
        ) : (
          <div style={{
            width: compact ? 168 : 208, height: compact ? 168 : 208, borderRadius: 8,
            background: 'linear-gradient(90deg, #F0ECE3 25%, #FAF8F4 37%, #F0ECE3 63%)',
            backgroundSize: '400% 100%', animation: 'sharePulse 1.4s ease infinite',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 11, color: C.stone, fontFamily: 'var(--font-sans)' }}>Generating…</span>
          </div>
        )}
      </div>
      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: C.stone, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        High-resolution · ready for print
      </span>
      <div style={{ display: 'flex', gap: 8, width: '100%' }}>
        <button onClick={handleDownloadPng} disabled={!!downloading}
          style={{
            flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            height: 40, borderRadius: 10, border: 'none', cursor: downloading ? 'wait' : 'pointer',
            background: C.charcoal, color: C.white, fontFamily: 'var(--font-sans)', fontSize: 12.5, fontWeight: 700,
            opacity: downloading && downloading !== 'png' ? 0.55 : 1, transition: 'opacity 0.2s',
          }}>
          <IconDownload /> {downloading === 'png' ? 'Preparing…' : 'PNG'}
        </button>
        <button onClick={handleDownloadSvg} disabled={!!downloading}
          style={{
            flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            height: 40, borderRadius: 10, cursor: downloading ? 'wait' : 'pointer',
            background: C.white, color: C.goldDark, border: `1.5px solid ${C.gold}`,
            fontFamily: 'var(--font-sans)', fontSize: 12.5, fontWeight: 700,
            opacity: downloading && downloading !== 'svg' ? 0.55 : 1, transition: 'opacity 0.2s',
          }}>
          <IconDownload /> {downloading === 'svg' ? 'Preparing…' : 'SVG'}
        </button>
      </div>
    </div>
  );

  /* ── Details column (link + status + broadcast) ── */
  const detailsBlock = (
    <div style={{ flex: 1, minWidth: compact ? 'auto' : 280, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Public link */}
      <div>
        <label style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.stone, marginBottom: 8 }}>
          Public event link
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={{
            flex: 1, minWidth: 180, display: 'flex', alignItems: 'center', gap: 8,
            background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: '0 12px', height: 44,
          }}>
            <span style={{ color: C.gold, flexShrink: 0, display: 'flex' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            </span>
            <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 13, color: C.charcoal, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {displayUrl}
            </span>
          </div>
          <button onClick={handleCopy}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, height: 44, padding: '0 18px',
              borderRadius: 10, border: 'none', cursor: 'pointer',
              background: copied ? C.okBg : 'linear-gradient(135deg, #B8944F, #D7BE80)',
              color: copied ? C.ok : C.white, fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700,
              boxShadow: copied ? 'none' : '0 4px 14px rgba(184,148,79,0.28)', transition: 'all 0.2s',
            }}>
            {copied ? <IconCheck /> : <IconCopy />} {copied ? 'Copied' : 'Copy Link'}
          </button>
        </div>
        <a href={publicUrl} target="_blank" rel="noopener noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8, fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, color: C.gold, textDecoration: 'none' }}>
          Preview public page <IconExternal />
        </a>
      </div>

      {/* Status banner (handles draft / pending / paused / completed) */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: tone.bg, border: `1px solid ${tone.border}`, borderRadius: 12, padding: '12px 14px' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: tone.color, marginTop: 5, flexShrink: 0, boxShadow: status.live ? `0 0 8px ${tone.color}` : 'none' }} />
        <div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5, fontWeight: 700, color: tone.color }}>{status.label}</div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: C.stone, marginTop: 2, lineHeight: 1.5 }}>{status.detail}</div>
        </div>
      </div>

      {/* Broadcast */}
      <div>
        <label style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.stone, marginBottom: 8 }}>
          Broadcast everywhere
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {canNativeShare && (
            <button onClick={handleNativeShare}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, height: 38, padding: '0 14px', borderRadius: 10,
                border: `1px solid ${C.border}`, background: C.charcoal, color: C.white, cursor: 'pointer',
                fontFamily: 'var(--font-sans)', fontSize: 12.5, fontWeight: 600,
              }}>
              <IconShare /> Share…
            </button>
          )}
          {channels.map((ch) => (
            <a key={ch.key} href={ch.href} target="_blank" rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, height: 38, padding: '0 14px', borderRadius: 10,
                border: `1px solid ${C.border}`, background: C.white, color: ch.color, textDecoration: 'none',
                fontFamily: 'var(--font-sans)', fontSize: 12.5, fontWeight: 600, transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = ch.color; e.currentTarget.style.background = C.soft; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.white; }}>
              {ch.icon}<span style={{ color: C.charcoal }}>{ch.label}</span>
            </a>
          ))}
        </div>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 11.5, color: C.stone, margin: '10px 0 0', lineHeight: 1.6 }}>
          Drop the QR onto printed invitations or signage, and share the link across social media and broadcast groups — every scan lands on your event&apos;s RSVP page.
        </p>
      </div>
    </div>
  );

  return (
    <div style={{
      display: 'flex', gap: compact ? 18 : 28, flexWrap: 'wrap',
      alignItems: 'flex-start',
    }}>
      <style>{`@keyframes sharePulse { 0%,100% { background-position: 0% 0; } 50% { background-position: 100% 0; } }`}</style>
      <div style={{ flexShrink: 0 }}>{qrBlock}</div>
      {detailsBlock}
    </div>
  );
}
