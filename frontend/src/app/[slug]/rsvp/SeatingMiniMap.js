'use client';

import React, { useRef, useState, useEffect } from 'react';

/* Mirrors the world/element model used by the organizer seating map
   (dashboard/seating-map). Read-only: it never shows who is seated where — only
   the room layout, with the current guest's own table highlighted. */
const WORLD_W = 2600;
const WORLD_H = 1700;

const SHAPES = {
  round:       { cat: 'table', w: 96,  h: 96,  round: true },
  oval:        { cat: 'table', w: 132, h: 86,  round: true },
  square:      { cat: 'table', w: 96,  h: 96,  round: false },
  rectangle:   { cat: 'table', w: 168, h: 84,  round: false },
  banquet:     { cat: 'table', w: 230, h: 80,  round: false },
  head:        { cat: 'table', w: 250, h: 76,  round: false },
  stage:       { cat: 'zone',  w: 360, h: 150, icon: '🎤', color: '#3B3A55' },
  dance_floor: { cat: 'zone',  w: 280, h: 280, icon: '🪩', color: '#6B5FA8' },
  bar:         { cat: 'zone',  w: 240, h: 92,  icon: '🍸', color: '#9C5A3C' },
  dj_booth:    { cat: 'zone',  w: 132, h: 112, icon: '🎧', color: '#2F5E8C' },
  entrance:    { cat: 'zone',  w: 150, h: 70,  icon: '🚪', color: '#4A7C59' },
  custom:      { cat: 'zone',  w: 190, h: 130, icon: '⭐', color: '#B8944F' },
};

const shapeMeta = (shape) => SHAPES[shape === 'rectangular' ? 'rectangle' : shape] || SHAPES.round;
const isZone = (el) => (el.element_type === 'zone') || (shapeMeta(el.shape).cat === 'zone');
const elWidth = (el) => (isZone(el) ? Number(el.width) || shapeMeta(el.shape).w : shapeMeta(el.shape).w);
const elHeight = (el) => (isZone(el) ? Number(el.height) || shapeMeta(el.shape).h : shapeMeta(el.shape).h);
const pctToPx = (pct, total) => (Number(pct) || 0) / 100 * total;

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
                fontFamily: 'var(--font-sans)',
              }}>
                {zone ? (meta.icon || '') : ''}{zone ? ' ' : ''}{el.table_name}
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
