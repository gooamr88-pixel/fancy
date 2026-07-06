'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { HERITAGE_ARCH_COLORS as C } from '../defaultContent';
import { SectionShell, SectionHeading, ScrollToRsvpHint } from '../shared';

export default function FaqSection({ items, isRTL }) {
  const [openIndex, setOpenIndex] = useState(null);

  return (
    <SectionShell>
      <span style={{ fontSize: '34px', marginBottom: '8px' }} aria-hidden="true">📜</span>
      <SectionHeading isRTL={isRTL}>{isRTL ? 'الأسئلة الشائعة' : 'FAQ'}</SectionHeading>

      <div style={{ width: '100%', maxWidth: '540px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {items.map((item, i) => {
          const open = openIndex === i;
          return (
            <div key={i} style={{ border: `1px solid ${C.border}`, borderRadius: '14px', background: C.cream, overflow: 'hidden' }}>
              <button
                type="button"
                onClick={() => setOpenIndex(open ? null : i)}
                aria-expanded={open}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '18px 20px', background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--font-serif)', fontSize: '16px', color: C.maroon, textAlign: isRTL ? 'right' : 'left',
                }}
              >
                <span>{item.question}</span>
                <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} aria-hidden="true">⌄</motion.span>
              </button>
              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <p style={{ margin: 0, padding: '0 20px 18px', fontSize: '14px', color: C.ink, opacity: 0.8, lineHeight: 1.7 }}>
                      {item.answer}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      <ScrollToRsvpHint isRTL={isRTL} />
    </SectionShell>
  );
}
