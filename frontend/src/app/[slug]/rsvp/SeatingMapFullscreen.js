'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useModalA11y } from '../../hooks/useModalA11y';
import { formatTableLabel } from '../../utils/tableLabel';
import Icon from '../../components/icons/Icon';
import {
  WORLD_W, WORLD_H, shapeMeta, isZone, elWidth, elHeight, pctToPx, elCenterX, elCenterY,
} from '../../utils/seatingGeometry';

/**
 * Fullscreen, pannable + zoomable viewer for the guest's seating chart.
 * Uses the same world-coordinate model as SeatingMiniMap (and the organizer
 * editor) — imported from utils/seatingGeometry rather than re-declared, so
 * the layout the host drew is mirrored exactly. We just lift it into a wrapper
 * transform so the guest can pinch/scroll/drag it around. The host's table is
 * highlighted with a gold ring + "you" badge so it's obvious at a glance among
 * dozens of tables.
 */
const GOLD = '#B8944F';
const MIN_SCALE = 0.15;
const MAX_SCALE = 3;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export default function SeatingMapFullscreen({ tables, myTableId, myTableName, hostName, isRTL, onClose }) {
  const els = useMemo(() => (tables || []).filter(Boolean), [tables]);
  const containerRef = useRef(null);
  const [view, setView] = useState({ scale: 0.4, tx: 0, ty: 0 });
  const [dragging, setDragging] = useState(false);
  const drag = useRef({ active: false, startX: 0, startY: 0, origTx: 0, origTy: 0 });
  const pinch = useRef({ active: false, startDist: 0, startScale: 1, midX: 0, midY: 0 });

  // Element bounding box (world coords) — used both for initial fit and "center on my table".
  const bounds = useMemo(() => {
    if (els.length === 0) return { minX: 0, minY: 0, maxX: WORLD_W, maxY: WORLD_H };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    els.forEach((el) => {
      const left = pctToPx(el.position_x, WORLD_W);
      const top = pctToPx(el.position_y, WORLD_H);
      minX = Math.min(minX, left); minY = Math.min(minY, top);
      maxX = Math.max(maxX, left + elWidth(el)); maxY = Math.max(maxY, top + elHeight(el));
    });
    const pad = 80;
    return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
  }, [els]);

  const fitToScreen = useCallback(() => {
    const c = containerRef.current;
    if (!c) return;
    const w = c.clientWidth, h = c.clientHeight;
    const contentW = bounds.maxX - bounds.minX;
    const contentH = bounds.maxY - bounds.minY;
    const scale = clamp(Math.min(w / contentW, h / contentH), MIN_SCALE, MAX_SCALE);
    const tx = (w - contentW * scale) / 2 - bounds.minX * scale;
    const ty = (h - contentH * scale) / 2 - bounds.minY * scale;
    setView({ scale, tx, ty });
  }, [bounds]);

  const centerOnMyTable = useCallback(() => {
    const c = containerRef.current;
    if (!c || !myTableId) return;
    const el = els.find((e) => e.id === myTableId);
    if (!el) return;
    const cx = elCenterX(el);
    const cy = elCenterY(el);
    const scale = clamp(0.85, MIN_SCALE, MAX_SCALE);
    const tx = c.clientWidth / 2 - cx * scale;
    const ty = c.clientHeight / 2 - cy * scale;
    setView({ scale, tx, ty });
  }, [els, myTableId]);

  // Fit-to-screen (or center on the guest's own table) once on open. Scroll
  // lock, focus trap, initial focus, and Escape-to-close are handled by the
  // shared useModalA11y hook below.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (myTableId) centerOnMyTable();
      else fitToScreen();
    });
    return () => cancelAnimationFrame(id);
    // We deliberately only run this on mount — the callbacks close over the
    // initial bounds, which is what we want for the open animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dialogRef = useModalA11y(true, { onClose });

  // Zoom-at-cursor on wheel (non-passive listener attached manually to allow preventDefault).
  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    const handleWheel = (e) => {
      e.preventDefault();
      const rect = c.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const factor = Math.exp(-e.deltaY * 0.0015);
      setView((v) => {
        const next = clamp(v.scale * factor, MIN_SCALE, MAX_SCALE);
        const ratio = next / v.scale;
        return { scale: next, tx: px - (px - v.tx) * ratio, ty: py - (py - v.ty) * ratio };
      });
    };
    c.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      c.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Pan with mouse + single-touch.
  const onPointerDown = (e) => {
    const tl = e.touches;
    if (tl && tl.length === 2) {
      const dx = tl[0].clientX - tl[1].clientX;
      const dy = tl[0].clientY - tl[1].clientY;
      pinch.current = {
        active: true,
        startDist: Math.hypot(dx, dy),
        startScale: view.scale,
        midX: (tl[0].clientX + tl[1].clientX) / 2,
        midY: (tl[0].clientY + tl[1].clientY) / 2,
      };
      return;
    }
    const point = tl ? tl[0] : e;
    drag.current = { active: true, startX: point.clientX, startY: point.clientY, origTx: view.tx, origTy: view.ty };
    setDragging(true);
  };

  const onPointerMove = (e) => {
    if (pinch.current.active && e.touches?.length === 2) {
      const c = containerRef.current;
      if (!c) return;
      const rect = c.getBoundingClientRect();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const px = pinch.current.midX - rect.left;
      const py = pinch.current.midY - rect.top;
      setView((v) => {
        const next = clamp(pinch.current.startScale * (dist / pinch.current.startDist), MIN_SCALE, MAX_SCALE);
        const ratio = next / v.scale;
        return { scale: next, tx: px - (px - v.tx) * ratio, ty: py - (py - v.ty) * ratio };
      });
      return;
    }
    if (!drag.current.active) return;
    const point = e.touches ? e.touches[0] : e;
    setView((v) => ({ ...v, tx: drag.current.origTx + (point.clientX - drag.current.startX), ty: drag.current.origTy + (point.clientY - drag.current.startY) }));
  };

  const onPointerUp = () => {
    drag.current.active = false;
    pinch.current.active = false;
    setDragging(false);
  };

  const zoom = (factor) => {
    const c = containerRef.current;
    if (!c) return;
    const px = c.clientWidth / 2;
    const py = c.clientHeight / 2;
    setView((v) => {
      const next = clamp(v.scale * factor, MIN_SCALE, MAX_SCALE);
      const ratio = next / v.scale;
      return { scale: next, tx: px - (px - v.tx) * ratio, ty: py - (py - v.ty) * ratio };
    });
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={isRTL ? 'خريطة الجلوس' : 'Seating chart'}
      tabIndex={-1}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: '#FAFAF8',
        display: 'flex', flexDirection: 'column',
        fontFamily: 'var(--font-sans)',
        outline: 'none',
      }}
    >
      {/* Header — same light ivory/gold letterhead language as the rest of
          the guest experience, so expanding the map reads as a zoom, not a
          jump into an unrelated dark screen. */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px', paddingTop: 'max(14px, calc(env(safe-area-inset-top) + 8px))', gap: '12px',
        background: '#FFFFFF', borderBottom: '1px solid #E8E2D6',
        boxShadow: '0 2px 10px rgba(25,27,30,0.04)',
      }}>
        <div style={{ minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: GOLD, fontWeight: 700 }}>
            {isRTL ? 'خريطة الجلوس' : 'Seating Chart'}
          </span>
          <strong style={{ display: 'block', fontSize: '16px', fontFamily: 'var(--font-serif)', fontWeight: 600, color: '#191B1E' }}>
            {myTableName ? (isRTL ? `طاولتك: ${formatTableLabel(myTableName, isRTL)}` : `Your table: ${formatTableLabel(myTableName, isRTL)}`) : (isRTL ? 'حدد طاولتك من الخريطة' : 'Find your table')}
          </strong>
        </div>
        <button
          onClick={onClose}
          aria-label={isRTL ? 'إغلاق' : 'Close'}
          style={{
            background: '#FFFFFF', border: '1px solid #E8E2D6',
            color: '#3A3631', borderRadius: '999px',
            width: '44px', height: '44px', cursor: 'pointer', flexShrink: 0,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(25,27,30,0.06)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Canvas — plain white/ivory floor with the same fine dot-grid used by
          the organizer's own editor and the printed seating chart, so every
          seating-map surface in the product shares one visual language. */}
      <div
        ref={containerRef}
        onMouseDown={onPointerDown}
        onMouseMove={onPointerMove}
        onMouseUp={onPointerUp}
        onMouseLeave={onPointerUp}
        onTouchStart={onPointerDown}
        onTouchMove={onPointerMove}
        onTouchEnd={onPointerUp}
        style={{
          flex: 1, position: 'relative', overflow: 'hidden',
          cursor: dragging ? 'grabbing' : 'grab',
          background: '#FFFFFF',
          touchAction: 'none',
        }}
      >
        <div style={{
          position: 'absolute', left: 0, top: 0, width: WORLD_W, height: WORLD_H,
          transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`,
          transformOrigin: '0 0', willChange: 'transform',
        }}>
          {/* Floor dot-grid — subtle, fades out at high zoom */}
          <div aria-hidden style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'radial-gradient(#E0D8C6 1.5px, transparent 1.5px)',
            backgroundSize: '32px 32px',
            opacity: 0.7, pointerEvents: 'none',
          }} />

          {els.map((el) => {
            const zone = isZone(el);
            const meta = shapeMeta(el.shape);
            const left = pctToPx(el.position_x, WORLD_W);
            const top = pctToPx(el.position_y, WORLD_H);
            const w = elWidth(el), h = elHeight(el);
            const rotation = Number(el.rotation) || 0;
            const mine = !zone && el.id === myTableId;
            const color = el.color || meta.color || GOLD;
            return (
              <div key={el.id} style={{
                position: 'absolute', left, top, width: w, height: h,
                transform: `rotate(${rotation}deg)`, transformOrigin: 'center center',
                display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
                borderRadius: meta.round ? '50%' : zone ? '12px' : '10px',
                border: mine ? `4px solid ${GOLD}` : `1.5px solid ${zone ? color : '#E0D8C8'}`,
                background: mine
                  ? 'linear-gradient(135deg, #FFFBF0, #F3E4C4)'
                  : zone ? `${color}1A` : '#FFFFFF',
                boxShadow: mine
                  ? '0 0 0 10px rgba(184,148,79,0.16), 0 16px 40px rgba(184,148,79,0.35)'
                  : '0 2px 8px rgba(25,27,30,0.06)',
                zIndex: mine ? 5 : (zone ? 1 : 2),
              }}>
                <span style={{
                  fontSize: Math.max(11, Math.min(22, h / 4)),
                  fontWeight: mine ? 800 : 700,
                  color: mine ? '#5C4516' : zone ? '#3A3631' : '#3A3631',
                  lineHeight: 1.1, padding: '0 4px', maxWidth: '100%',
                  fontFamily: 'var(--font-sans)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                }}>
                  {zone && meta.icon && <Icon name={meta.icon} size={Math.max(11, Math.min(18, h / 5))} strokeWidth={1.8} color={color} style={{ flexShrink: 0 }} />}
                  {el.table_name}
                </span>
                {mine && (
                  <>
                    <span style={{
                      position: 'absolute', top: -28, left: '50%', transform: 'translateX(-50%)',
                      background: GOLD, color: '#FFFFFF',
                      fontSize: '13px', fontWeight: 800,
                      padding: '5px 14px', borderRadius: '999px', whiteSpace: 'nowrap',
                      fontFamily: 'var(--font-sans)', letterSpacing: '0.05em',
                      boxShadow: '0 8px 20px rgba(184,148,79,0.55)',
                    }}>♛ {isRTL ? (hostName ? `${hostName} — طاولتك` : 'طاولتك') : (hostName ? `${hostName} — your table` : 'Your table')}</span>
                    {/**
                      * Pulsing ring — the thing that makes "your table" findable
                      * at a glance in a room of forty identical circles.
                      *
                      * It has never animated. The @keyframes lived in a
                      * <style jsx> block at the bottom of this file, and
                      * styled-jsx renames a scoped keyframe to
                      * `fancySeatPulse-jsx-<hash>` — it cannot rewrite the name
                      * inside an inline style object, so this `animation` was
                      * resolving against a keyframe that does not exist and the
                      * ring just sat there. Exactly the trap the ticket page
                      * already documents for its spinner.
                      *
                      * The keyframe now lives in globals.css, unscoped, which is
                      * the only place an inline-style animation can reach.
                      */}
                    <span aria-hidden style={{
                      position: 'absolute', inset: -14,
                      borderRadius: meta.round ? '50%' : '14px',
                      border: `2px solid ${GOLD}`,
                      animation: 'fancySeatPulse 1.8s ease-out infinite',
                      pointerEvents: 'none',
                    }} />
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Controls — bottom right */}
        <div style={{
          position: 'absolute', bottom: 'max(18px, calc(env(safe-area-inset-bottom) + 10px))',
          ...(isRTL ? { left: '18px' } : { right: '18px' }),
          display: 'flex', flexDirection: 'column', gap: '8px',
        }}>
          <CircleBtn aria-label="Zoom in" onClick={() => zoom(1.25)}>+</CircleBtn>
          <CircleBtn aria-label="Zoom out" onClick={() => zoom(0.8)}>−</CircleBtn>
          <CircleBtn aria-label="Fit to screen" onClick={fitToScreen} title={isRTL ? 'ملء الشاشة' : 'Fit'}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 14 4 20 10 20" /><polyline points="20 10 20 4 14 4" />
              <line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          </CircleBtn>
          {myTableId && (
            <button
              onClick={centerOnMyTable}
              style={{
                marginTop: '4px', padding: '10px 14px', borderRadius: '999px',
                background: 'linear-gradient(135deg, #D7BE80, #B8944F)', color: '#FFFFFF',
                border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 700,
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                boxShadow: '0 10px 20px rgba(184,148,79,0.4)',
              }}
            >
              ♛ {isRTL ? 'مكاني' : 'My seat'}
            </button>
          )}
        </div>

        {/* Help hint — bottom left, fades out after first interaction */}
        <div style={{
          position: 'absolute', bottom: '18px',
          ...(isRTL ? { right: '18px' } : { left: '18px' }),
          fontSize: '11px', color: '#77736A',
          background: 'rgba(255,255,255,0.92)', border: '1px solid #E8E2D6',
          padding: '8px 12px', borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(25,27,30,0.06)',
          fontFamily: 'var(--font-sans)', maxWidth: '210px', lineHeight: 1.5,
          pointerEvents: 'none',
        }}>
          {isRTL ? 'اسحب للتحريك • العجلة أو الإصبعين للتكبير' : 'Drag to pan • Scroll or pinch to zoom'}
        </div>
      </div>

      {/* No <style jsx> here on purpose — fancySeatPulse is defined in
          globals.css. A scoped keyframe gets renamed by styled-jsx and can
          never be referenced from an inline style object; see the ring above. */}
    </div>
  );
}

function CircleBtn({ children, onClick, ...rest }) {
  return (
    <button
      onClick={onClick}
      {...rest}
      style={{
        width: '44px', height: '44px', borderRadius: '50%',
        background: '#FFFFFF', border: '1px solid #E8E2D6',
        color: '#3A3631', cursor: 'pointer', fontSize: '20px', fontWeight: 700,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 14px rgba(25,27,30,0.10)',
        fontFamily: 'var(--font-sans)', lineHeight: 1,
      }}
    >{children}</button>
  );
}
