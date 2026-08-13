'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import SeatingMiniMap from '../SeatingMiniMap';
import SeatingMapFullscreen from '../SeatingMapFullscreen';
import { UtensilsIcon, WarningIcon } from '../../../components/guest/RsvpIcons';
import { formatTableLabel } from '../../../utils/tableLabel';

/**
 * Shows the guest's table + a highlighted map + the companions THEY brought.
 * Distinguishes the host (gold-bordered card with crown) from companions and
 * surfaces their meal/dietary notes. Deliberately never lists other parties
 * seated at the same table.
 *
 * `compact` tightens everything for the emailed entry pass (/ticket/[token]),
 * where this panel sits BELOW a 200px QR code inside a 540px card rather than
 * being the whole screen. Same component, same "you only ever see your own
 * party" guarantee — only the map preview and the spacing change, so the two
 * surfaces cannot drift apart in what they disclose.
 */
export default function SeatingResultPanel({ view, loading, isRTL, onBack, compact = false }) {
  const [fullscreen, setFullscreen] = useState(false);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '16px 0' }}>
        <div style={{ width: '28px', height: '28px', border: '3px solid #E8E2D6', borderTop: '3px solid #B8944F', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
        <p style={{ color: '#77736A', fontSize: '12px' }}>{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
      </div>
    );
  }
  if (!view) return null;
  const assigned = !!view.myTableName;
  const members = view.party || [];
  const host = members.find((p) => p.isHost) || null;
  const companions = members.filter((p) => !p.isHost);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: isRTL ? 'right' : 'left' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div>
          <span style={{
            fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1.2px',
            color: '#77736A', fontWeight: 700, display: 'block', fontFamily: 'var(--font-sans)',
          }}>
            {isRTL ? 'طاولتك' : 'Your table'}
          </span>
          <strong style={{
            fontSize: '18px', color: assigned ? '#B8944F' : '#A09A91',
            fontFamily: 'var(--font-serif)',
          }}>
            {assigned ? formatTableLabel(view.myTableName, isRTL) : (isRTL ? 'لم تُخصّص بعد' : 'Not assigned yet')}
          </strong>
        </div>
        {onBack && (
          <button onClick={onBack} style={{
            background: 'none', border: 'none', color: '#77736A', fontSize: '12px',
            fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', textDecoration: 'underline',
          }}>
            {isRTL ? 'رجوع' : 'Back'}
          </button>
        )}
      </div>

      {/**
        * MAP PREVIEW + A REAL BUTTON UNDER IT.
        *
        * The expand control used to be a small pill floating in the map's top
        * corner. Three things were wrong with that on a phone: it covered the
        * corner of the plan it was inviting you to look at, it sat exactly
        * where a thumb rests while scrolling, and a translucent chip on top of
        * a drawing does not read as the primary action — so guests pinched at
        * the thumbnail instead, which does nothing, and concluded the map was
        * simply too small to use.
        *
        * Now the preview is a tappable card and the action is stated in full
        * underneath it, at touch size, in the event's own gold. `compact`
        * callers (the emailed entry pass) shrink the preview further; the
        * button is what carries the detail either way.
        */}
      {(view.tables || []).length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setFullscreen(true)}
            aria-label={isRTL ? 'فتح خريطة الجلوس كاملة' : 'Open the full seating map'}
            style={{
              display: 'block', width: '100%', padding: 0, border: 'none',
              background: 'none', cursor: 'zoom-in', textAlign: 'inherit',
            }}
          >
            <SeatingMiniMap
              tables={view.tables}
              myTableId={view.myTableId}
              youLabel={isRTL ? 'مكانك' : "You're here"}
              maxHeight={compact ? 190 : 320}
            />
          </button>
          <button
            type="button"
            onClick={() => setFullscreen(true)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              width: '100%', minHeight: '44px', padding: '11px 16px',
              borderRadius: '12px', border: '1px solid #E7D9B8', cursor: 'pointer',
              background: 'linear-gradient(180deg, #FFFDF8 0%, #F8F1E2 100%)',
              fontFamily: 'var(--font-sans)', fontSize: '13.5px', fontWeight: 700, color: '#8A6D34',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
            </svg>
            {assigned
              ? (isRTL ? 'كبّر الخريطة وشوف مكانك' : 'Open full map & find my seat')
              : (isRTL ? 'كبّر خريطة القاعة' : 'Open the full venue map')}
          </button>
        </div>
      ) : (
        <SeatingMiniMap tables={view.tables} myTableId={view.myTableId} youLabel={isRTL ? 'مكانك' : "You're here"} maxHeight={compact ? 190 : 320} />
      )}

      {/* Host card */}
      {host && (
        <div style={{
          padding: '1.5px', borderRadius: '14px',
          background: 'linear-gradient(135deg, #E7D4A8 0%, #B8944F 50%, #D7BE80 100%)',
        }}>
          <div style={{
            background: 'linear-gradient(180deg, #FFFCF6 0%, #F8F4EC 100%)',
            borderRadius: '12.5px', padding: '12px 14px',
            display: 'flex', alignItems: 'center', gap: '12px',
          }}>
            <span aria-hidden style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: '34px', height: '34px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #D7BE80, #B8944F)',
              color: '#FFFFFF', fontSize: '16px', flexShrink: 0,
              boxShadow: '0 4px 10px rgba(184,148,79,0.4)',
            }}>♛</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{
                fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.18em',
                color: '#8A6D34', fontWeight: 700, fontFamily: 'var(--font-sans)',
              }}>
                {isRTL ? 'صاحب الدعوة' : 'Invitee'}{isRTL ? ' (أنت)' : ' (you)'}
              </span>
              <strong style={{
                display: 'block', fontSize: '15px', color: '#191B1E',
                fontFamily: 'var(--font-serif)', fontWeight: 600, lineHeight: 1.25,
              }}>{host.name}</strong>
              {host.meal && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#77736A', fontFamily: 'var(--font-sans)' }}>
                  <UtensilsIcon size={11} strokeWidth={1.8} /> {host.meal}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Companions list */}
      {companions.length > 0 && (
        <div style={{
          background: '#FAFAF8', border: '1px solid #E8E2D6', borderRadius: '12px', padding: '14px',
        }}>
          <span style={{
            fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px',
            color: '#77736A', fontWeight: 700, display: 'block', marginBottom: '10px',
            fontFamily: 'var(--font-sans)',
          }}>
            {isRTL ? `مرافقوك (${companions.length})` : `Your guests (${companions.length})`}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {companions.map((p, i) => {
              return (
                <div key={i} style={{
                  background: '#FFFFFF', border: '1px solid #F0ECE3', borderRadius: '10px',
                  padding: '10px 12px',
                  display: 'flex', alignItems: 'center', gap: '10px',
                }}>
                  <span aria-hidden style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: '26px', height: '26px', borderRadius: '50%',
                    background: '#F0ECE3', color: '#8A6D34',
                    fontSize: '11px', fontWeight: 700, flexShrink: 0,
                    fontFamily: 'var(--font-sans)',
                  }}>{i + 2}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: '13px', color: '#191B1E', fontWeight: 600, fontFamily: 'var(--font-sans)' }}>
                      {p.name}
                    </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                      {p.meal && <Tag color="gold"><UtensilsIcon size={11} strokeWidth={1.8} />{p.meal}</Tag>}
                      {p.dietaryNotes && <Tag color="muted" dim><WarningIcon size={11} strokeWidth={1.8} />{p.dietaryNotes}</Tag>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p style={{ fontSize: '11px', color: '#A09A91', fontStyle: 'italic', fontFamily: 'var(--font-sans)' }}>
        {isRTL ? 'الخريطة توضّح مكان طاولتك في القاعة فقط.' : 'The map shows where your table is in the venue.'}
      </p>

      {fullscreen && (
        <SeatingMapFullscreen
          tables={view.tables}
          myTableId={view.myTableId}
          myTableName={view.myTableName}
          hostName={host?.name}
          isRTL={isRTL}
          onClose={() => setFullscreen(false)}
        />
      )}
    </motion.div>
  );
}

function Tag({ color = 'muted', dim, children }) {
  const palette = {
    rose:   { bg: 'rgba(190,128,140,0.10)', fg: '#9B5A6A' },
    sky:    { bg: 'rgba(110,150,180,0.10)', fg: '#4B7088' },
    gold:   { bg: 'rgba(184,148,79,0.12)',  fg: '#8A6D34' },
    muted:  { bg: '#F0ECE3',                fg: '#77736A' },
  };
  const p = palette[color] || palette.muted;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '3px',
      padding: '2px 8px', borderRadius: '999px',
      background: p.bg, color: p.fg,
      fontSize: '10.5px', fontWeight: dim ? 500 : 600, lineHeight: 1.4,
      fontFamily: 'var(--font-sans)',
    }}>{children}</span>
  );
}
