'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useFullPageTheme } from '../theme';
import { SectionShell, SectionHeading, ScrollToRsvpHint } from '../shared';

/* Deterministic scattered confetti pieces (no physics/canvas) — a light,
   always-cheap decorative background matching the reference's gift page.
   The seed keeps SSR and client markup identical (no hydration mismatch). */
function pseudoRandom(seed) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
const CONFETTI_COLORS = ['#E8B7C4', '#F0D98C', '#A9C7E8', '#F2B7A0', '#CBB0DE'];
const CONFETTI = Array.from({ length: 26 }, (_, i) => ({
  id: i,
  left: `${pseudoRandom(i + 1) * 100}%`,
  top: `${pseudoRandom(i + 2) * 100}%`,
  size: 6 + pseudoRandom(i + 3) * 6,
  rotate: pseudoRandom(i + 4) * 360,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  round: pseudoRandom(i + 5) > 0.6,
}));

function ConfettiBackground() {
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      {CONFETTI.map((p) => (
        <span key={p.id} style={{
          position: 'absolute', left: p.left, top: p.top, width: `${p.size}px`, height: `${p.size}px`,
          background: p.color, borderRadius: p.round ? '50%' : '2px',
          transform: `rotate(${p.rotate}deg)`, opacity: 0.7,
        }} />
      ))}
    </div>
  );
}

function CopyIcon({ color }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  );
}

export default function GiftListSection({ registryUrl, registryLabel, bank, message, isRTL }) {
  const C = useFullPageTheme();
  const hasBank = !!(bank && (bank.name || bank.accountName || bank.iban));
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Graceful hide when the organizer configured neither a registry link nor bank details.
  if (!registryUrl && !hasBank) return null;

  const copyIban = async () => {
    if (!bank?.iban) return;
    try {
      await navigator.clipboard.writeText(bank.iban);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard unavailable — no-op */ }
  };

  const rows = [
    bank?.name && { label: isRTL ? 'البنك' : 'Bank', value: bank.name, copyable: false },
    bank?.accountName && { label: isRTL ? 'الحساب' : 'Account', value: bank.accountName, copyable: false },
    bank?.iban && { label: 'IBAN', value: bank.iban, copyable: true },
  ].filter(Boolean);

  return (
    <SectionShell background={C.paper}>
      <ConfettiBackground />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '480px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <span style={{ fontSize: '30px', marginBottom: '8px' }} aria-hidden="true">🎁</span>
        <SectionHeading isRTL={isRTL}>{isRTL ? 'قائمة الهدايا' : 'Gift List'}</SectionHeading>

        <div style={{
          width: '100%', background: C.cream, borderRadius: '20px', border: `1px solid ${C.border}`,
          padding: '28px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px',
        }}>
          <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '17px', color: C.maroon, textAlign: 'center', margin: 0, lineHeight: 1.5 }}>
            {message || (isRTL ? 'حضوركم هو أجمل هدية، ويمكن إرسال أي مساهمة عبر التفاصيل البنكية أدناه' : 'Your presence is your gift, but all contributions can go to the bank details below')}
          </p>

          {registryUrl && (
            <a
              href={registryUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '10px', padding: '14px 32px',
                borderRadius: '999px', background: C.maroon, color: '#FFF', textDecoration: 'none',
                fontWeight: 700, fontSize: '15px', fontFamily: 'var(--font-sans)',
              }}
            >
              <span aria-hidden="true">🎁</span>
              {registryLabel || (isRTL ? 'قائمة الهدايا' : 'Gift Registry')}
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <path d="M15 3h6v6M10 14 21 3" />
              </svg>
            </a>
          )}

          {hasBank && (
            <>
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none',
                  cursor: 'pointer', fontFamily: 'var(--font-serif)', fontSize: '16px', color: C.maroon,
                }}
              >
                {isRTL ? 'تفضل المساهمة مباشرة؟' : 'Prefer to contribute directly?'}
                <motion.span animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }} aria-hidden="true">⌄</motion.span>
              </button>

              <AnimatePresence initial={false}>
                {expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    style={{ overflow: 'hidden', width: '100%' }}
                  >
                    <div style={{ background: C.paper, borderRadius: '14px', padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {rows.map((row) => (
                        <div key={row.label} style={{ textAlign: 'center' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: C.ink, opacity: 0.6, textTransform: 'uppercase' }}>{row.label}</span>
                          {row.copyable ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '4px' }}>
                              <span style={{ fontFamily: 'monospace', fontSize: '15px', color: C.maroon, letterSpacing: '0.04em' }}>{row.value}</span>
                              <button type="button" onClick={copyIban} aria-label={isRTL ? 'نسخ الآيبان' : 'Copy IBAN'} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 0 }}>
                                <CopyIcon color={C.maroon} />
                              </button>
                            </div>
                          ) : (
                            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', color: C.maroon, marginTop: '2px' }}>{row.value}</div>
                          )}
                        </div>
                      ))}
                      {copied && (
                        <span style={{ fontSize: '12px', color: C.gold, textAlign: 'center' }}>{isRTL ? 'تم النسخ!' : 'Copied!'}</span>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </div>

      <ScrollToRsvpHint isRTL={isRTL} />
    </SectionShell>
  );
}
