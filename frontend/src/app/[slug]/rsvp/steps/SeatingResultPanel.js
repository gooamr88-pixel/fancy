'use client';

import React from 'react';
import { motion } from 'framer-motion';
import SeatingMiniMap from '../SeatingMiniMap';

/**
 * Shows the guest's table + a highlighted map + the companions THEY brought.
 * Deliberately never lists other parties seated at the same table.
 */
export default function SeatingResultPanel({ view, loading, isRTL, onBack }) {
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
            {assigned ? view.myTableName : (isRTL ? 'لم تُخصّص بعد' : 'Not assigned yet')}
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

      <SeatingMiniMap tables={view.tables} myTableId={view.myTableId} youLabel={isRTL ? 'مكانك' : "You're here"} />

      {view.party && view.party.length > 0 && (
        <div style={{
          background: '#FAFAF8', border: '1px solid #E8E2D6', borderRadius: '12px', padding: '14px',
        }}>
          <span style={{
            fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px',
            color: '#77736A', fontWeight: 700, display: 'block', marginBottom: '8px',
            fontFamily: 'var(--font-sans)',
          }}>
            {isRTL ? 'مرافقوك على نفس الطاولة' : 'Your party at this table'}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {view.party.map((p, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                gap: '8px', fontSize: '13px',
              }}>
                <span style={{
                  color: '#191B1E', fontWeight: p.isPrimary ? 700 : 500,
                  fontFamily: 'var(--font-sans)',
                }}>
                  {p.name}{p.isPrimary ? (isRTL ? ' (أنت)' : ' (you)') : ''}
                </span>
                {p.meal && (
                  <span style={{ fontSize: '11px', color: '#77736A', fontFamily: 'var(--font-sans)' }}>
                    {p.meal}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      <p style={{ fontSize: '11px', color: '#A09A91', fontStyle: 'italic', fontFamily: 'var(--font-sans)' }}>
        {isRTL ? 'الخريطة توضّح مكان طاولتك في القاعة فقط.' : 'The map shows where your table is in the venue.'}
      </p>
    </motion.div>
  );
}
