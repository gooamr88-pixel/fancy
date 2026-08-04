'use client';

import React, { useRef, useState, useEffect } from 'react';
import Icon from '../../components/icons/Icon';
/* The world/element model is shared verbatim with the organizer seating map
   (dashboard/seating-map) — imported, never re-declared, because a local copy
   that fell behind drew the organizer's zones as round tables here without
   erroring. Read-only: this never shows who is seated where, only the room
   layout, with the current guest's own table highlighted. */
import {
  WORLD_W, WORLD_H, shapeMeta, isZone, elWidth, elHeight, pctToPx,
} from '../../utils/seatingGeometry';

const GOLD = '#B8944F';

export default function SeatingMiniMap({ tables, myTableId, youLabel = "You're here" }) {
  const wrapRef = useRef(null);
  const [boxW, setBoxW] = useState(0);

  useEffect(() => {
    const node = wrapRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect?.width;
      if (w) setBoxW(w);
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  const els = (tables || []).filter(Boolean);
  if (els.length === 0) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#A09A91', fontSize: '13px', background: '#FAFAF8', border: '1px dashed #E8E2D6', borderRadius: '12px' }}>
        The seating chart hasn&apos;t been published yet.
      </div>
    );
  }

  // Bounding box of all elements (world px), so a sparse layout still fills the card.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  els.forEach(el => {
    const left = pctToPx(el.position_x, WORLD_W);
    const top = pctToPx(el.position_y, WORLD_H);
    const w = elWidth(el), h = elHeight(el);
    minX = Math.min(minX, left); minY = Math.min(minY, top);
    maxX = Math.max(maxX, left + w); maxY = Math.max(maxY, top + h);
  });
  const pad = 40;
  minX -= pad; minY -= pad; maxX += pad; maxY += pad;
  const contentW = Math.max(maxX - minX, 1);
  const contentH = Math.max(maxY - minY, 1);

  const targetW = boxW || 320;
  const maxH = 320;
  const scale = Math.min(targetW / contentW, maxH / contentH);
  const renderW = contentW * scale;
  const renderH = contentH * scale;

  return (
    <div ref={wrapRef} style={{ width: '100%', overflow: 'hidden' }}>
      <div style={{ position: 'relative', width: renderW, height: renderH, margin: '0 auto', background: '#FAFAF8', border: '1px solid #E8E2D6', borderRadius: '12px' }}>
        {els.map(el => {
          const zone = isZone(el);
          const meta = shapeMeta(el.shape);
          const left = (pctToPx(el.position_x, WORLD_W) - minX) * scale;
          const top = (pctToPx(el.position_y, WORLD_H) - minY) * scale;
          const w = elWidth(el) * scale;
          const h = elHeight(el) * scale;
          const rotation = Number(el.rotation) || 0;
          const mine = !zone && el.id === myTableId;
          const color = el.color || meta.color || GOLD;
          return (
            <div key={el.id} style={{
              position: 'absolute', left, top, width: w, height: h,
              transform: `rotate(${rotation}deg)`, transformOrigin: 'center center',
              display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
              borderRadius: meta.round ? '50%' : zone ? '8px' : '6px',
              border: mine ? `2px solid ${GOLD}` : `1px solid ${zone ? color : '#E0D8C8'}`,
              background: mine ? 'rgba(184,148,79,0.18)' : zone ? `${color}1A` : '#FFFFFF',
              boxShadow: mine ? '0 0 0 4px rgba(184,148,79,0.18), 0 6px 18px rgba(184,148,79,0.3)' : 'none',
              zIndex: mine ? 3 : 1,
            }}>
              <span style={{
                fontSize: Math.max(7, Math.min(11, h / 3)), fontWeight: mine ? 800 : 600,
                color: mine ? '#7A5C1E' : zone ? '#5b574e' : '#77736A',
                lineHeight: 1.1, padding: '0 2px', overflow: 'hidden', maxWidth: '100%',
                fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2,
              }}>
                {zone && meta.icon && <Icon name={meta.icon} size={Math.max(8, Math.min(11, h / 3))} strokeWidth={1.6} style={{ flexShrink: 0 }} />}
                {el.table_name}
              </span>
              {mine && (
                <span style={{
                  position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                  background: GOLD, color: '#FFFFFF', fontSize: '8px', fontWeight: 800,
                  padding: '2px 7px', borderRadius: '8px', whiteSpace: 'nowrap',
                  fontFamily: 'var(--font-sans)', letterSpacing: '0.04em', zIndex: 4,
                }}>★ {youLabel}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
