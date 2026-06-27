'use client';

import React from 'react';
import { motion } from 'framer-motion';

/**
 * StepRail — the wizard's signature progress indicator: a gold thread strung
 * between numbered waypoints, replacing the generic dot-progress bar. Each
 * node morphs outline -> filled-gold-with-checkmark as it's passed, and the
 * current node carries a soft breathing halo.
 */
const STEP_META = [
  { key: 1, label: { en: 'Identify', ar: 'الاسم' } },
  { key: 2, label: { en: 'Attend', ar: 'الحضور' } },
  { key: 3, label: { en: 'Details', ar: 'التفاصيل' } },
  { key: 4, label: { en: 'Questions', ar: 'أسئلة' } },
];

export default function StepRail({ currentStep, totalSteps = 4, isRTL = false, color = '#B8944F' }) {
  const progress = Math.max(0, Math.min(1, (currentStep - 1) / (totalSteps - 1)));

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 30 }}
      aria-label={isRTL ? `الخطوة ${currentStep} من ${totalSteps}` : `Step ${currentStep} of ${totalSteps}`}
    >
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
        {/* Track */}
        <div style={{
          position: 'absolute', left: 18, right: 18, top: '50%', height: 2, transform: 'translateY(-50%)',
          background: 'linear-gradient(90deg, #EFE6D4, #F0ECE3)', borderRadius: 2, overflow: 'hidden',
        }}>
          <motion.div
            initial={false}
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            style={{
              height: '100%', borderRadius: 2,
              background: `linear-gradient(90deg, #D7BE80, ${color})`,
              boxShadow: `0 0 10px ${color}88`,
            }}
          />
        </div>

        {STEP_META.slice(0, totalSteps).map((s) => {
          const isDone = s.key < currentStep;
          const isActive = s.key === currentStep;
          return (
            <div key={s.key} style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
              {isActive && (
                <motion.span
                  aria-hidden
                  animate={{ scale: [1, 1.55, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                  style={{ position: 'absolute', top: 0, width: 30, height: 30, borderRadius: '50%', background: color }}
                />
              )}
              <motion.div
                initial={false}
                animate={{
                  background: isDone || isActive ? `linear-gradient(150deg, #E7D4A8, ${color})` : '#FFFFFF',
                  borderColor: isDone || isActive ? color : '#E8E2D6',
                  scale: isActive ? 1.12 : 1,
                }}
                transition={{ duration: 0.35 }}
                style={{
                  position: 'relative', width: 30, height: 30, borderRadius: '50%',
                  border: '2px solid', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: isActive ? `0 4px 14px ${color}55` : 'none',
                }}
              >
                {isDone ? (
                  <motion.svg initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                    width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </motion.svg>
                ) : (
                  <span style={{
                    fontSize: 12, fontWeight: 800, fontFamily: 'var(--font-sans)',
                    color: isActive ? '#FFFFFF' : '#C9C2B2',
                  }}>{s.key}</span>
                )}
              </motion.div>
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                color: isActive ? color : '#B8B1A1', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap',
                opacity: isActive || isDone ? 1 : 0.7, transition: 'color 0.3s, opacity 0.3s',
              }}>
                {isRTL ? s.label.ar : s.label.en}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
