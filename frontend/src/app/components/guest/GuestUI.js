'use client';

import React, { useState, useRef, useEffect, useCallback, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ConfettiExplosion } from './GuestAnimations';
import { lighten, darken } from '../../utils/color';
import { useModalA11y } from '../../hooks/useModalA11y';
import { CelebrateIcon, ClockIcon, EnvelopeIcon, CalendarIcon, CheckIcon, LinkIcon } from './RsvpIcons';

/* ═══════════════════════════════════════════════════════════════
   FANCY RSVP — Premium Guest UI Component Library
   Shared components for the guest experience
   ═══════════════════════════════════════════════════════════════ */

// ─── GlassmorphismCard ───
export function GlassmorphismCard({
  children, style = {}, className = '', onClick, hoverable = true,
  bg = 'rgba(255, 255, 255, 0.85)', blur = 16, border = 'rgba(255,255,255,0.3)',
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.div
      className={className}
      onClick={onClick}
      onMouseEnter={() => hoverable && setHovered(true)}
      onMouseLeave={() => hoverable && setHovered(false)}
      animate={hovered ? { y: -4, boxShadow: '0 20px 60px rgba(0,0,0,0.12)' } : { y: 0, boxShadow: '0 8px 32px rgba(0,0,0,0.06)' }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      style={{
        background: bg,
        backdropFilter: `blur(${blur}px)`,
        WebkitBackdropFilter: `blur(${blur}px)`,
        border: `1px solid ${border}`,
        borderRadius: '20px',
        padding: '32px',
        ...style,
      }}
    >
      {children}
    </motion.div>
  );
}

// ─── PremiumButton ───
export function PremiumButton({
  children, onClick, disabled = false, variant = 'gold', size = 'md', fullWidth = false,
  style = {}, icon, loading = false, testId, accentColor,
}) {
  const variants = {
    gold: accentColor
      // When the caller passes the event's own theme color, override the
      // otherwise-fixed gold CTA fill so this button (the actual RSVP submit/
      // continue action) isn't permanently gold for every non-gold event.
      // Darkened for contrast the same way the fixed gold value was chosen
      // (DES-1: white text must stay AA-safe against the fill).
      ? {
          bg: darken(accentColor, 0.15), hoverBg: darken(accentColor, 0.3), color: '#FFFFFF',
          shadow: `0 8px 25px ${accentColor}4D`,
          glow: `0 0 30px ${accentColor}33`,
        }
      : {
          // DES-1: contrast-safe CTA gold (white text = 4.86:1, passes AA).
          bg: '#8A6D34', hoverBg: '#765C2B', color: '#FFFFFF',
          shadow: '0 8px 25px rgba(184, 148, 79, 0.3)',
          glow: '0 0 30px rgba(184, 148, 79, 0.2)',
        },
    dark: {
      bg: '#191B1E', hoverBg: '#2a2d32', color: '#D7BE80',
      shadow: '0 8px 25px rgba(25, 27, 30, 0.3)',
      glow: '0 0 30px rgba(25, 27, 30, 0.15)',
    },
    outline: {
      bg: 'transparent', hoverBg: '#191B1E', color: '#191B1E',
      shadow: 'none', glow: 'none', border: '2px solid #191B1E', hoverColor: '#FFFFFF',
    },
    ghost: {
      // DES-1: gold text on a light surface must use the contrast-safe gold.
      bg: 'transparent', hoverBg: 'rgba(184, 148, 79, 0.08)', color: '#8A6D34',
      shadow: 'none', glow: 'none',
    },
    'outline-light': {
      bg: 'transparent', hoverBg: '#FFFFFF', color: '#FFFFFF', hoverColor: '#121212',
      shadow: '0 8px 25px rgba(255, 255, 255, 0.2)', glow: 'none', border: '1.5px solid rgba(255, 255, 255, 0.5)',
    },
    'ghost-light': {
      bg: 'transparent', hoverBg: 'rgba(255, 255, 255, 0.1)', color: 'rgba(255, 255, 255, 0.85)', hoverColor: '#FFFFFF',
      shadow: 'none', glow: 'none',
    },
    'outline-gold': {
      bg: 'transparent', hoverBg: '#D7BE80', color: '#D7BE80', hoverColor: '#121212',
      shadow: '0 8px 25px rgba(215, 190, 128, 0.25)', glow: 'none', border: '1.5px solid rgba(215, 190, 128, 0.5)',
    },
    'ghost-gold': {
      bg: 'transparent', hoverBg: 'rgba(215, 190, 128, 0.1)', color: '#D7BE80', hoverColor: '#FFFFFF',
      shadow: 'none', glow: 'none',
    },
  };

  const sizes = {
    sm: { padding: '10px 20px', fontSize: '12px' },
    md: { padding: '14px 32px', fontSize: '14px' },
    lg: { padding: '18px 40px', fontSize: '16px' },
  };

  const v = variants[variant] || variants.gold;
  const s = sizes[size];

  return (
    <motion.button
      data-testid={testId}
      onClick={onClick}
      disabled={disabled || loading}
      whileHover={disabled ? {} : {
        scale: 1.02, y: -2,
        boxShadow: v.shadow,
        backgroundColor: v.hoverBg,
        color: v.hoverColor || v.color,
      }}
      whileTap={disabled ? {} : { scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        padding: s.padding, fontSize: s.fontSize,
        minHeight: '44px', // MOB-2: minimum touch target
        background: v.bg, color: v.color,
        border: v.border || 'none', borderRadius: '12px',
        fontWeight: 700, fontFamily: 'var(--font-sans)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        letterSpacing: '0.03em',
        width: fullWidth ? '100%' : 'auto',
        transition: 'background 0.2s, color 0.2s',
        ...style,
      }}
    >
      {loading ? (
        <div style={{
          width: '18px', height: '18px', border: '2px solid transparent',
          borderTop: `2px solid ${v.color}`, borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
      ) : (
        <>
          {icon && <span style={{ fontSize: '1.1em' }}>{icon}</span>}
          {children}
        </>
      )}
    </motion.button>
  );
}

// ─── BentoCard ───
export function BentoCard({
  children, style = {}, className = '', bg = 'rgba(255, 255, 255, 0.85)',
  border = 'rgba(232,226,214,0.6)', glowColor = 'rgba(184, 148, 79, 0.1)', delay = 0
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.div
      className={className}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, delay, type: 'spring', stiffness: 100 }}
      animate={hovered ? { y: -4, boxShadow: `0 20px 40px rgba(0,0,0,0.08), 0 0 20px ${glowColor}` } : { y: 0, boxShadow: '0 8px 32px rgba(0,0,0,0.04)' }}
      style={{
        background: bg,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: `1px solid ${border}`,
        borderRadius: '24px',
        padding: '32px',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        ...style,
      }}
    >
      {children}
    </motion.div>
  );
}

// ─── MagneticButton ───
export function MagneticButton({
  children, onClick, variant = 'gold', size = 'md', fullWidth = false,
  style = {}, icon, disabled = false, testId
}) {
  const containerRef = useRef(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e) => {
    if (!containerRef.current || disabled) return;
    const { clientX, clientY } = e;
    const { height, width, left, top } = containerRef.current.getBoundingClientRect();
    const middleX = clientX - (left + width / 2);
    const middleY = clientY - (top + height / 2);
    setPosition({ x: middleX * 0.2, y: middleY * 0.2 });
  };

  const reset = () => setPosition({ x: 0, y: 0 });

  const { x, y } = position;

  return (
    <motion.div
      ref={containerRef}
      style={{ display: fullWidth ? 'block' : 'inline-block', position: 'relative' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={reset}
      animate={{ x, y }}
      transition={{ type: 'spring', stiffness: 150, damping: 15, mass: 0.1 }}
    >
      <PremiumButton
        testId={testId}
        variant={variant}
        size={size}
        fullWidth={fullWidth}
        style={style}
        icon={icon}
        disabled={disabled}
        onClick={onClick}
      >
        {children}
      </PremiumButton>
    </motion.div>
  );
}


// ─── AttendanceCard: Interactive attendance choice ───
/* AttendanceCard renders in two weights so the three responses aren't three
   equal boxes competing for attention: "yes" is the emotionally-primary
   answer a wedding invitation is written to receive, so it gets the large,
   theme-colored hero treatment; "maybe"/"no" are real, necessary options but
   sit as quieter secondary chips beneath it. `accentColor` (the event's own
   theme color) drives the "yes" card so it matches the invitation itself
   instead of a fixed green. */
export function AttendanceCard({ type, selected, onClick, isRTL = false, variant = 'primary', accentColor = '#10b981' }) {
  const configs = {
    yes: {
      Icon: CelebrateIcon, label: isRTL ? 'سأحضر بكل سرور' : 'Joyfully Accept',
      subtitle: isRTL ? 'أتطلع للمشاركة في هذه المناسبة الجميلة' : 'I look forward to celebrating with you',
      borderColor: accentColor, glowColor: `${accentColor}33`,
    },
    maybe: {
      Icon: ClockIcon, label: isRTL ? 'ربما' : 'Tentative',
      borderColor: '#6366f1', glowColor: 'rgba(99,102,241,0.18)',
    },
    no: {
      Icon: EnvelopeIcon, label: isRTL ? 'أعتذر' : "Can't make it",
      borderColor: '#A09A91', glowColor: 'rgba(160,154,145,0.15)',
    },
  };

  const config = configs[type];
  const isSelected = selected === type;

  // A quick sparkle right when "Yes" is picked — the guest shouldn't have to
  // wait until final submit to feel something happen.
  const [celebrate, setCelebrate] = useState(false);
  const handleClick = () => {
    const wasAlreadySelected = selected === type;
    onClick(type);
    if (wasAlreadySelected) return;
    if (type === 'yes') {
      setCelebrate(true);
      setTimeout(() => setCelebrate(false), 1000);
    }
  };
  const sparkle = celebrate && (
    <ConfettiExplosion
      active duration={950} particleCount={46} spread={0.45}
      colors={[accentColor, lighten(accentColor, 0.35), lighten(accentColor, 0.7), '#FFFFFF']}
      shapes={['star', 'circle']}
    />
  );

  if (variant === 'compact') {
    return (
      <>
        <motion.button
          data-testid={`attendance-${type}`}
          aria-pressed={isSelected}
          aria-label={config.label}
          onClick={handleClick}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.97 }}
          animate={isSelected ? {
            borderColor: config.borderColor,
            boxShadow: `0 6px 18px ${config.glowColor}`,
          } : {
            borderColor: '#E8E2D6',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 24 }}
          style={{
            width: '100%', padding: '13px 10px',
            border: `1.5px solid ${isSelected ? config.borderColor : '#E8E2D6'}`,
            borderRadius: '12px', textAlign: 'center',
            background: isSelected ? `${config.borderColor}0D` : '#FFFFFF',
            cursor: 'pointer', fontFamily: 'var(--font-sans)',
            display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '7px',
          }}
        >
          <span style={{ display: 'flex', color: isSelected ? config.borderColor : '#9A958A' }}>
            <config.Icon size={17} />
          </span>
          <span style={{ fontWeight: 600, fontSize: '13px', color: isSelected ? config.borderColor : '#4A463F' }}>
            {config.label}
          </span>
        </motion.button>
        {sparkle}
      </>
    );
  }

  return (
    <>
    <motion.button
      data-testid={`attendance-${type}`}
      aria-pressed={isSelected}
      aria-label={config.label}
      onClick={handleClick}
      whileHover={{ scale: 1.01, y: -3 }}
      whileTap={{ scale: 0.98 }}
      animate={isSelected ? {
        borderColor: config.borderColor,
        boxShadow: `0 0 34px ${config.glowColor}, 0 14px 40px rgba(0,0,0,0.08)`,
      } : {
        borderColor: `${config.borderColor}55`,
        boxShadow: '0 6px 20px rgba(0,0,0,0.05)',
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      style={{
        width: '100%', padding: '24px 20px',
        border: `2px solid ${isSelected ? config.borderColor : `${config.borderColor}55`}`,
        borderRadius: '18px', textAlign: isRTL ? 'right' : 'left',
        background: isSelected
          ? `linear-gradient(135deg, ${config.borderColor}14, ${config.borderColor}04)`
          : `linear-gradient(135deg, ${config.borderColor}08, transparent)`,
        cursor: 'pointer', fontFamily: 'var(--font-sans)',
        display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '16px',
      }}
    >
      <motion.span
        animate={isSelected ? { scale: [1, 1.08, 1] } : { scale: 1 }}
        transition={{ duration: 0.5 }}
        style={{
          width: '52px', height: '52px', borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `${config.borderColor}14`, color: config.borderColor,
        }}
      >
        <config.Icon size={26} strokeWidth={1.5} />
      </motion.span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, minWidth: 0 }}>
        <span style={{ fontWeight: 700, fontSize: '16px', color: isSelected ? config.borderColor : '#191B1E' }}>
          {config.label}
        </span>
        <span style={{ fontSize: '12px', color: '#77736A', fontWeight: 400, lineHeight: 1.4 }}>
          {config.subtitle}
        </span>
      </span>
      <motion.div
        initial={false}
        animate={isSelected ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 15 }}
        style={{
          width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
          background: config.borderColor, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </motion.div>
    </motion.button>
    {sparkle}
    </>
  );
}

// ─── ProgressBar: Animated step progress ───
export function ProgressBar({ currentStep, totalSteps, color = '#B8944F' }) {
  const progress = (currentStep / totalSteps) * 100;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '28px' }}>
      <div style={{
        height: '4px', borderRadius: '2px', background: '#F0ECE3', overflow: 'hidden',
      }}>
        <motion.div
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          style={{ height: '100%', borderRadius: '2px', background: color }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
        {Array.from({ length: totalSteps }, (_, i) => (
          <motion.div
            key={i}
            animate={{
              width: currentStep >= i + 1 ? '20px' : '8px',
              background: currentStep >= i + 1 ? color : '#E8E2D6',
            }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            style={{ height: '8px', borderRadius: '4px' }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── GalleryLightbox: Full-screen image viewer ───
export function GalleryLightbox({ images, initialIndex = 0, onClose }) {
  const [current, setCurrent] = useState(initialIndex);
  const touchStartX = useRef(0);

  const next = useCallback(() => setCurrent(i => (i + 1) % images.length), [images.length]);
  const prev = useCallback(() => setCurrent(i => (i - 1 + images.length) % images.length), [images.length]);

  // Escape-to-close, focus trap, initial focus, and scroll lock are handled
  // by the shared useModalA11y hook — this effect only owns the
  // arrow-key gallery navigation, which isn't part of that hook's contract.
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [next, prev]);

  const dialogRef = useModalA11y(true, { onClose });

  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) diff > 0 ? next() : prev();
  };

  return (
    <motion.div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Photo gallery"
      tabIndex={-1}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(20px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
        outline: 'none',
      }}
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: '20px', right: '20px', zIndex: 10001,
          width: '44px', height: '44px', borderRadius: '50%',
          background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
          color: '#FFFFFF', fontSize: '20px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >✕</button>

      {/* Navigation arrows */}
      {images.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); prev(); }}
            style={{
              position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)',
              width: '48px', height: '48px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
              color: '#FFF', fontSize: '22px', cursor: 'pointer', zIndex: 10001,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >‹</button>
          <button
            onClick={(e) => { e.stopPropagation(); next(); }}
            style={{
              position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)',
              width: '48px', height: '48px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
              color: '#FFF', fontSize: '22px', cursor: 'pointer', zIndex: 10001,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >›</button>
        </>
      )}

      {/* Image */}
      <AnimatePresence mode="wait">
        <motion.img
          key={current}
          src={images[current]}
          alt={`Gallery photo ${current + 1}`}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.3 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain',
            borderRadius: '8px', cursor: 'default',
          }}
        />
      </AnimatePresence>

      {/* Dots */}
      {images.length > 1 && (
        <div style={{
          position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: '8px',
        }}>
          {images.map((_, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); setCurrent(i); }}
              style={{
                width: current === i ? '24px' : '8px', height: '8px',
                borderRadius: '4px', border: 'none', cursor: 'pointer',
                background: current === i ? '#B8944F' : 'rgba(255,255,255,0.3)',
                transition: 'all 0.3s ease',
              }}
            />
          ))}
        </div>
      )}

      {/* Counter */}
      <span style={{
        position: 'absolute', top: '24px', left: '24px',
        color: 'rgba(255,255,255,0.6)', fontSize: '14px',
        fontFamily: 'var(--font-sans)', fontWeight: 500,
      }}>
        {current + 1} / {images.length}
      </span>
    </motion.div>
  );
}

// ─── CalendarButton: Add to Calendar ───
export function CalendarButton({ event, isRTL = false, variant = 'outline', style = {}, buttonStyle = {} }) {
  const [open, setOpen] = useState(false);

  if (!event) return null;

  const formatDate = (date) => {
    return new Date(date).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  };

  const title = encodeURIComponent(event.title || '');
  const location = encodeURIComponent(event.location_name || event.location_address || '');
  const description = encodeURIComponent(event.description || '');
  const startDate = event.event_date ? formatDate(event.event_date) : '';
  const endDate = event.event_end_date ? formatDate(event.event_end_date) : (event.event_date ? formatDate(new Date(new Date(event.event_date).getTime() + 3 * 60 * 60 * 1000)) : '');

  const googleUrl = `https://www.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDate}/${endDate}&details=${description}&location=${location}`;

  const generateICS = () => {
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Fancy RSVP//EN',
      'BEGIN:VEVENT',
      `DTSTART:${startDate}`, `DTEND:${endDate}`,
      `SUMMARY:${event.title || ''}`,
      `DESCRIPTION:${event.description || ''}`,
      `LOCATION:${event.location_name || ''}`,
      'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n');
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(event.title || 'event').replace(/[^a-zA-Z0-9]/g, '_')}.ics`;
    a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  };

  const options = [
    { label: 'Google Calendar', action: () => { window.open(googleUrl, '_blank'); setOpen(false); } },
    { label: 'Apple Calendar', action: generateICS },
    { label: 'Outlook / Other', action: generateICS },
  ];

  return (
    <div style={{ position: 'relative', display: 'inline-block', ...style }}>
      <MagneticButton variant={variant} size="sm" icon={<CalendarIcon size={15} />} onClick={() => setOpen(!open)} style={buttonStyle}>
        {isRTL ? 'أضف إلى التقويم' : 'Add to Calendar'}
      </MagneticButton>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
              marginBottom: '8px', background: '#FFFFFF',
              border: '1px solid #E8E2D6', borderRadius: '12px',
              boxShadow: '0 12px 40px rgba(0,0,0,0.12)', padding: '8px',
              minWidth: '200px', zIndex: 100,
            }}
          >
            {options.map((opt, i) => (
              <button
                key={i}
                onClick={opt.action}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  width: '100%', padding: '10px 14px', border: 'none',
                  background: 'transparent', borderRadius: '8px',
                  cursor: 'pointer', fontFamily: 'var(--font-sans)',
                  fontSize: '13px', fontWeight: 500, color: '#191B1E',
                  textAlign: isRTL ? 'right' : 'left',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#F8F4EC'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ display: 'flex', color: '#B8944F' }}><CalendarIcon size={16} /></span>
                <span>{opt.label}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── ShareButton: Native Share API or fallback ───
export function ShareButton({ title, text, url, isRTL = false, variant = 'ghost', style = {} }) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url: url || window.location.href });
      } catch (e) { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(url || window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <MagneticButton variant={variant} size="sm" icon={copied ? <CheckIcon size={15} /> : <LinkIcon size={15} />} onClick={handleShare} style={style}>
      {copied ? (isRTL ? 'تم النسخ!' : 'Link Copied!') : (isRTL ? 'مشاركة الدعوة' : 'Share Invitation')}
    </MagneticButton>
  );
}

// ─── PartySizeStepper: Animated +/- stepper for party size ───
export function PartySizeStepper({ value, onChange, min = 1, max = 20, label, isRTL = false }) {
  return (
    <div>
      {label && <label style={{
        fontSize: '12px', fontWeight: 600, color: '#77736A',
        display: 'block', marginBottom: '8px', fontFamily: 'var(--font-sans)',
      }}>{label}</label>}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '16px',
        background: '#F8F4EC', borderRadius: '14px', padding: '8px 16px',
        border: '1px solid #E8E2D6',
      }}>
        <motion.button
          type="button"
          aria-label={isRTL ? 'إنقاص عدد الأفراد' : 'Decrease party size'}
          whileTap={{ scale: 0.85 }}
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          style={{
            width: '44px', height: '44px', borderRadius: '12px',
            border: '1px solid #E8E2D6', background: '#FFFFFF',
            fontSize: '20px', cursor: value <= min ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: value <= min ? '#D7BE80' : '#191B1E', fontWeight: 700,
          }}
        >−</motion.button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <AnimatePresence mode="popLayout">
            <motion.span
              key={value}
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{
                fontSize: '28px', fontWeight: 800, color: '#B8944F',
                fontFamily: 'var(--font-sans)', display: 'block',
              }}
            >
              {value}
            </motion.span>
          </AnimatePresence>
          <span style={{ fontSize: '11px', color: '#77736A', fontWeight: 500 }}>
            {value === 1 ? (isRTL ? 'شخص' : 'person') : (isRTL ? 'أشخاص' : 'people')}
          </span>
        </div>
        <motion.button
          type="button"
          aria-label={isRTL ? 'زيادة عدد الأفراد' : 'Increase party size'}
          whileTap={{ scale: 0.85 }}
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          style={{
            width: '44px', height: '44px', borderRadius: '12px',
            border: '1px solid #E8E2D6', background: '#FFFFFF',
            fontSize: '20px', cursor: value >= max ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: value >= max ? '#D7BE80' : '#191B1E', fontWeight: 700,
          }}
        >+</motion.button>
      </div>
    </div>
  );
}

// ─── FormField: Premium animated form field ───
export function FormField({
  label, required, error, children, style = {}, htmlFor,
}) {
  // A11Y-3: associate the <label> with its control and wire the error message to
  // the input via aria-describedby + role="alert" so screen readers announce both
  // the field name and validation errors. A stable id is generated when the caller
  // doesn't supply one, and injected into a single child element.
  const autoId = useId();
  const fieldId = htmlFor || autoId;
  const errorId = `${fieldId}-error`;

  const control = React.isValidElement(children)
    ? React.cloneElement(children, {
        id: children.props.id || fieldId,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': error ? errorId : children.props['aria-describedby'],
      })
    : children;

  return (
    <div style={{ ...style }}>
      {label && (
        <label htmlFor={fieldId} style={{
          fontSize: '12px', fontWeight: 600, color: '#77736A',
          display: 'block', marginBottom: '6px', fontFamily: 'var(--font-sans)',
        }}>
          {label} {required && <span style={{ color: '#ef4444' }} aria-hidden="true">*</span>}
        </label>
      )}
      {control}
      <AnimatePresence>
        {error && (
          <motion.span
            id={errorId}
            role="alert"
            initial={{ opacity: 0, y: -4, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            style={{ fontSize: '11px', color: '#ef4444', display: 'block', marginTop: '4px' }}
          >
            {error}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
export const inputStyle = {
  width: '100%', boxSizing: 'border-box', padding: '14px 16px',
  background: '#FFFFFF', border: '1px solid #E8E2D6',
  borderRadius: '12px', fontSize: '14px', color: '#191B1E',
  outline: 'none', fontFamily: 'var(--font-sans)',
  transition: 'border-color 0.25s ease, box-shadow 0.25s ease',
};

export const inputFocus = (e, accentColor = '#B8944F') => {
  e.target.style.borderColor = accentColor;
  e.target.style.boxShadow = `0 0 0 3px ${accentColor}1A`;
};

export const inputBlur = (e, hasError) => {
  e.target.style.borderColor = hasError ? '#ef4444' : '#E8E2D6';
  e.target.style.boxShadow = 'none';
};

// ─── DressCodeVisualizer: Realistic 3D Dress Code Illustrations ───
export function DressCodeVisualizer({ dressCodeText = '', isRTL = false }) {
  const normalized = dressCodeText.toLowerCase();

  // Determine dress code category
  let category = 'formal'; // default fallback
  if (normalized.includes('smart casual') || normalized.includes('كاجوال أنيق') || normalized.includes('سمارت كاجوال')) {
    category = 'smart_casual';
  } else if (normalized.includes('business casual') || normalized.includes('كاجوال عمل') || normalized.includes('عمل كاجوال') || normalized.includes('بيزنس كاجوال')) {
    category = 'business_casual';
  } else if (normalized.includes('semi-formal') || normalized.includes('semi formal') || normalized.includes('شبه رسمي') || normalized.includes('شبه-رسمي')) {
    category = 'semi_formal';
  } else if (normalized.includes('casual') || normalized.includes('كاجوال') || normalized.includes('غير رسمي') || normalized.includes('مريح')) {
    category = 'casual';
  } else if (normalized.includes('cocktail') || normalized.includes('كوكتيل')) {
    category = 'cocktail';
  } else if (normalized.includes('traditional') || normalized.includes('تقليدي') || normalized.includes('تراثي') || normalized.includes('وطني')) {
    category = 'traditional';
  } else if (normalized.includes('festive') || normalized.includes('احتفالي') || normalized.includes('مبهج')) {
    category = 'festive';
  } else if (normalized.includes('formal') || normalized.includes('black tie') || normalized.includes('رسمي') || normalized.includes('بدلة')) {
    category = 'formal';
  }

  // Visual configuration for each category
  const configs = {
    formal: {
      titleMen: isRTL ? 'ملابس الرجال (رسمي / بلاك تاي)' : 'Men (Formal / Black Tie)',
      titleWomen: isRTL ? 'ملابس السيدات (رسمي / فستان سهرة)' : 'Women (Formal / Evening Gown)',
      descMen: isRTL ? 'بدلة توكسيدو كاملة، قميص أبيض، وربطة عنق فراشة سوداء.' : 'Classic tuxedo, white wingtip shirt, and black bow tie.',
      descWomen: isRTL ? 'فستان سهرة طويل أنيق مع إكسسوارات راقية.' : 'Floor-length evening gown, elegant jewelry, and heels.',
      svgMen: (
        <svg viewBox="0 0 200 240" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
          <defs>
            <linearGradient id="tuxGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1E2022" />
              <stop offset="50%" stopColor="#111215" />
              <stop offset="100%" stopColor="#070809" />
            </linearGradient>
            <linearGradient id="lapelGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#2E3033" />
              <stop offset="100%" stopColor="#0B0C0D" />
            </linearGradient>
            <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F5E3B5" />
              <stop offset="50%" stopColor="#D5B066" />
              <stop offset="100%" stopColor="#A8823B" />
            </linearGradient>
            <filter id="shadow3D" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="8" stdDeviation="6" floodOpacity="0.4" floodColor="#000" />
            </filter>
          </defs>
          <path d="M20 80 C20 80, 50 20, 100 20 C150 20, 180 80, 180 80 L180 240 L20 240 Z" fill="url(#tuxGrad)" />
          <path d="M70 20 L130 20 L100 110 Z" fill="#FFFFFF" />
          <g filter="url(#shadow3D)">
            <path d="M75 35 L100 48 L75 60 Z" fill="#111" />
            <path d="M125 35 L100 48 L125 60 Z" fill="#111" />
            <circle cx="100" cy="48" r="8" fill="#1A1A1A" />
            <circle cx="100" cy="48" r="4" fill="url(#goldGrad)" />
          </g>
          <path d="M20 80 L72 20 L100 125 L75 160 Z" fill="url(#lapelGrad)" filter="url(#shadow3D)" />
          <path d="M180 80 L128 20 L100 125 L125 160 Z" fill="url(#lapelGrad)" filter="url(#shadow3D)" />
          <path d="M45 110 L65 95 L55 115 Z" fill="#FFFFFF" />
          <path d="M40 115 L50 100 L55 115 Z" fill="url(#goldGrad)" />
          <rect x="38" y="114" width="32" height="4" rx="1" fill="#1A1A1A" />
        </svg>
      ),
      svgWomen: (
        <svg viewBox="0 0 200 240" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
          <defs>
            <linearGradient id="gownGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#7A1D2B" />
              <stop offset="50%" stopColor="#510A14" />
              <stop offset="100%" stopColor="#300309" />
            </linearGradient>
            <linearGradient id="goldSilk" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#E3C485" />
              <stop offset="50%" stopColor="#FDF1D6" />
              <stop offset="100%" stopColor="#C49B45" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          <path d="M35 80 C35 45, 60 30, 100 30 C140 30, 165 45, 165 80 L165 140 L35 140 Z" fill="#FCEAD0" />
          <path d="M65 52 Q100 80 135 52" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" filter="url(#glow)" />
          <circle cx="100" cy="67" r="5" fill="url(#goldSilk)" filter="url(#glow)" />
          <path d="M40 85 C40 85, 70 95, 100 95 C130 95, 160 85, 160 85 L180 240 L20 240 Z" fill="url(#gownGrad)" />
          <path d="M40 85 C55 65, 90 70, 100 82 C110 70, 145 65, 160 85 Z" fill="#FCEAD0" />
          <path d="M52 140 Q100 148 148 140 L152 155 Q100 163 48 155 Z" fill="url(#goldSilk)" />
          <path d="M75 160 L65 240" stroke="#42060F" strokeWidth="2" opacity="0.6" />
          <path d="M100 162 L100 240" stroke="#42060F" strokeWidth="2" opacity="0.6" />
          <path d="M125 160 L135 240" stroke="#42060F" strokeWidth="2" opacity="0.6" />
        </svg>
      )
    },
    cocktail: {
      titleMen: isRTL ? 'ملابس الرجال (كوكتيل / شبه رسمي)' : 'Men (Cocktail)',
      titleWomen: isRTL ? 'ملابس السيدات (فستان كوكتيل)' : 'Women (Cocktail)',
      descMen: isRTL ? 'بدلة أنيقة مع قميص أبيض ورابطة عنق ملونة.' : 'Smart suit jacket, color tie, and leather dress shoes.',
      descWomen: isRTL ? 'فستان كوكتيل قصير أو متوسط الطول جذاب.' : 'Elegant cocktail dress (midi/knee length) and heels.',
      svgMen: (
        <svg viewBox="0 0 200 240" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
          <defs>
            <linearGradient id="suitGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2D3748" />
              <stop offset="100%" stopColor="#1A202C" />
            </linearGradient>
            <linearGradient id="tieGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#E53E3E" />
              <stop offset="100%" stopColor="#9B2C2C" />
            </linearGradient>
          </defs>
          <path d="M20 80 C20 80, 50 20, 100 20 C150 20, 180 80, 180 80 L180 240 L20 240 Z" fill="url(#suitGrad)" />
          <path d="M70 20 L130 20 L100 110 Z" fill="#FFFFFF" />
          <path d="M94 40 L106 40 L110 130 L100 150 L90 130 Z" fill="url(#tieGrad)" />
          <path d="M92 38 L108 38 L104 46 L96 46 Z" fill="#C53030" />
          <path d="M20 80 L70 20 L100 120 L75 155 Z" fill="#4A5568" />
          <path d="M180 80 L130 20 L100 120 L125 155 Z" fill="#4A5568" />
        </svg>
      ),
      svgWomen: (
        <svg viewBox="0 0 200 240" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
          <defs>
            <linearGradient id="cocktailGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4A122C" />
              <stop offset="50%" stopColor="#2D0B1B" />
              <stop offset="100%" stopColor="#17030D" />
            </linearGradient>
          </defs>
          <path d="M35 80 C35 45, 60 30, 100 30 C140 30, 165 45, 165 80 L165 140 L35 140 Z" fill="#FCEAD0" />
          <path d="M35 80 C40 50, 75 75, 100 75 C125 75, 165 40, 165 80 Z" fill="url(#cocktailGrad)" />
          <path d="M42 80 C42 80, 72 85, 100 85 C128 85, 158 80, 158 80 L170 220 C140 225, 100 225, 30 220 Z" fill="url(#cocktailGrad)" />
          <path d="M38 100 Q100 130 162 100" stroke="#3D0F24" strokeWidth="3" opacity="0.5" />
          <path d="M36 125 Q100 155 164 125" stroke="#3D0F24" strokeWidth="3" opacity="0.5" />
        </svg>
      )
    },
    semi_formal: {
      titleMen: isRTL ? 'ملابس الرجال (شبه رسمي)' : 'Men (Semi-Formal)',
      titleWomen: isRTL ? 'ملابس السيدات (فستان رسمي قصير)' : 'Women (Semi-Formal)',
      descMen: isRTL ? 'بدلة كلاسيكية بلون داكن أو سترة بليزر مع قميص وبنطال مريح (الربطة اختيارية).' : 'Smart suit or blazer with dress shirt and slacks (tie optional).',
      descWomen: isRTL ? 'فستان رسمي قصير أو جمبسوت أنيقة مع حذاء بكعب.' : 'Classy cocktail dress, wrap dress, or chic evening jumpsuit.',
      svgMen: (
        <svg viewBox="0 0 200 240" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
          <defs>
            <linearGradient id="sfSuit" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1A365D" />
              <stop offset="100%" stopColor="#0A182F" />
            </linearGradient>
          </defs>
          <path d="M20 80 C20 80, 50 20, 100 20 C150 20, 180 80, 180 80 L180 240 L20 240 Z" fill="url(#sfSuit)" />
          <path d="M70 20 L130 20 L100 110 Z" fill="#FFFFFF" />
          <path d="M74 20 L100 55 L82 20 Z" fill="#E2E8F0" />
          <path d="M126 20 L100 55 L118 20 Z" fill="#E2E8F0" />
          <path d="M20 80 L68 20 L100 120 L74 150 Z" fill="#2B6CB0" />
          <path d="M180 80 L132 20 L100 120 L126 150 Z" fill="#2B6CB0" />
        </svg>
      ),
      svgWomen: (
        <svg viewBox="0 0 200 240" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
          <defs>
            <linearGradient id="sfDress" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#D53F8C" />
              <stop offset="100%" stopColor="#97266D" />
            </linearGradient>
          </defs>
          <path d="M35 80 C35 45, 60 30, 100 30 C140 30, 165 45, 165 80 L165 140 L35 140 Z" fill="#FCEAD0" />
          <path d="M40 82 C40 82, 70 90, 100 90 C130 90, 160 82, 160 82 L172 210 L28 210 Z" fill="url(#sfDress)" />
          <path d="M40 82 L80 40 L100 85 L120 40 L160 82 Z" fill="url(#sfDress)" />
          <circle cx="100" cy="55" r="4" fill="#FFFFFF" />
        </svg>
      )
    },
    business_casual: {
      titleMen: isRTL ? 'ملابس الرجال (كاجوال العمل)' : 'Men (Business Casual)',
      titleWomen: isRTL ? 'ملابس السيدات (كاجوال عمل أنيق)' : 'Women (Business Casual)',
      descMen: isRTL ? 'قميص ياقة أزرار، سترة خفيفة (اختيارية)، وبنطال قطني (تشينو).' : 'Collared button-down, optional sweater vest/blazer, slacks.',
      descWomen: isRTL ? 'بلوزة فاخرة، بنطال رسمي مريح أو تنورة كلاسيكية.' : 'Smart blouse, tailored trousers, or elegant pencil skirt.',
      svgMen: (
        <svg viewBox="0 0 200 240" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
          <defs>
            <linearGradient id="vestGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4A5568" />
              <stop offset="100%" stopColor="#2D3748" />
            </linearGradient>
          </defs>
          <path d="M20 80 C20 80, 50 30, 100 30 C150 30, 180 80, 180 80 L180 240 L20 240 Z" fill="#EDF2F7" />
          <path d="M25 90 C25 90, 50 45, 100 45 C150 45, 175 90, 175 90 L170 240 L30 240 Z" fill="url(#vestGrad)" />
          <path d="M72 45 L100 95 L128 45 Z" fill="#EDF2F7" />
          <path d="M72 30 L100 60 L85 30 Z" fill="#FFFFFF" stroke="#CBD5E0" />
          <path d="M128 30 L100 60 L115 30 Z" fill="#FFFFFF" stroke="#CBD5E0" />
          <circle cx="100" cy="72" r="2.5" fill="#4A5568" />
          <circle cx="100" cy="85" r="2.5" fill="#4A5568" />
        </svg>
      ),
      svgWomen: (
        <svg viewBox="0 0 200 240" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
          <defs>
            <linearGradient id="bcBlouse" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#E2E8F0" />
              <stop offset="100%" stopColor="#CBD5E0" />
            </linearGradient>
            <linearGradient id="bcSkirt" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1A202C" />
              <stop offset="100%" stopColor="#2D3748" />
            </linearGradient>
          </defs>
          <path d="M35 80 C35 45, 60 30, 100 30 C140 30, 165 45, 165 80 L165 140 L35 140 Z" fill="#FCEAD0" />
          <path d="M40 80 C40 80, 70 85, 100 85 C130 85, 160 80, 160 80 L155 150 L45 150 Z" fill="url(#bcBlouse)" />
          <path d="M78 30 L100 68 L122 30 Z" fill="#FFFFFF" stroke="#E2E8F0" />
          <path d="M45 150 L155 150 L145 240 L55 240 Z" fill="url(#bcSkirt)" />
        </svg>
      )
    },
    smart_casual: {
      titleMen: isRTL ? 'ملابس الرجال (كاجوال أنيق)' : 'Men (Smart Casual)',
      titleWomen: isRTL ? 'ملابس السيدات (كاجوال أنيق)' : 'Women (Smart Casual)',
      descMen: isRTL ? 'سترة (بليزر)، قميص أنيق بدون كرافتة، وبنطال تشينو.' : 'Tailored blazer, crisp collared shirt (no tie), chinos.',
      descWomen: isRTL ? 'فستان متوسط الطول أنيق أو بلوزة راقية مع بنطال.' : 'Chic midi dress, elegant jumpsuit, or blouse and trousers.',
      svgMen: (
        <svg viewBox="0 0 200 240" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
          <defs>
            <linearGradient id="blazerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2A4365" />
              <stop offset="100%" stopColor="#1A202C" />
            </linearGradient>
            <linearGradient id="blazerLapel" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3182CE" />
              <stop offset="100%" stopColor="#1A365D" />
            </linearGradient>
          </defs>
          <path d="M20 80 C20 80, 50 25, 100 25 C150 25, 180 80, 180 80 L180 240 L20 240 Z" fill="url(#blazerGrad)" />
          <path d="M68 25 L132 25 L100 120 Z" fill="#EBF8FF" />
          <path d="M68 25 L100 65 L76 25 Z" fill="#FFFFFF" stroke="#E2E8F0" />
          <path d="M132 25 L100 65 L124 25 Z" fill="#FFFFFF" stroke="#E2E8F0" />
          <path d="M20 80 L68 25 L100 135 L75 170 Z" fill="url(#blazerLapel)" />
          <path d="M180 80 L132 25 L100 135 L125 170 Z" fill="url(#blazerLapel)" />
          <path d="M42 112 L50 98 L58 112 Z" fill="#ED8936" />
          <rect x="38" y="112" width="24" height="3" rx="1" fill="#1A202C" />
        </svg>
      ),
      svgWomen: (
        <svg viewBox="0 0 200 240" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
          <defs>
            <linearGradient id="blouseGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F687B3" />
              <stop offset="100%" stopColor="#D53F8C" />
            </linearGradient>
            <linearGradient id="skirtGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4A5568" />
              <stop offset="100%" stopColor="#2D3748" />
            </linearGradient>
          </defs>
          <path d="M35 80 C35 45, 60 30, 100 30 C140 30, 165 45, 165 80 L165 140 L35 140 Z" fill="#FCEAD0" />
          <path d="M40 80 C40 80, 70 85, 100 85 C130 85, 160 80, 160 80 L155 160 L45 160 Z" fill="url(#blouseGrad)" />
          <path d="M80 30 C80 30, 100 65, 120 30 Z" fill="#FCEAD0" />
          <rect x="42" y="156" width="116" height="8" rx="2" fill="#ECC94B" />
          <circle cx="100" cy="160" r="8" fill="#ECC94B" stroke="#D69E2E" strokeWidth="2" />
          <path d="M45 164 L30 240 L170 240 L155 164 Z" fill="url(#skirtGrad)" />
        </svg>
      )
    },
    casual: {
      titleMen: isRTL ? 'ملابس الرجال (كاجوال / مريح)' : 'Men (Casual)',
      titleWomen: isRTL ? 'ملابس السيدات (كاجوال / فستان صيفي)' : 'Women (Casual)',
      descMen: isRTL ? 'قميص بولو أنيق أو قميص كتان مريح مع بنطال جينز.' : 'Polos, linen button-downs, or smart tees with jeans.',
      descWomen: isRTL ? 'فستان صيفي خفيف أو ملابس كاجوال مريحة وجذابة.' : 'Sun dresses, casual skirts, or neat summer coordinates.',
      svgMen: (
        <svg viewBox="0 0 200 240" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
          <defs>
            <linearGradient id="poloGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#319795" />
              <stop offset="100%" stopColor="#234E52" />
            </linearGradient>
          </defs>
          <path d="M20 80 C20 80, 50 30, 100 30 C150 30, 180 80, 180 80 L180 240 L20 240 Z" fill="url(#poloGrad)" />
          <path d="M85 30 L115 30 L100 95 Z" fill="#FCEAD0" />
          <path d="M60 30 L100 70 L80 30 Z" fill="#2C7A7B" stroke="#234E52" />
          <path d="M140 30 L100 70 L120 30 Z" fill="#2C7A7B" stroke="#234E52" />
          <circle cx="100" cy="80" r="3" fill="#FFFFFF" />
          <circle cx="100" cy="90" r="3" fill="#FFFFFF" />
        </svg>
      ),
      svgWomen: (
        <svg viewBox="0 0 200 240" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
          <defs>
            <linearGradient id="casualDress" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ED8936" />
              <stop offset="100%" stopColor="#C05621" />
            </linearGradient>
          </defs>
          <path d="M35 80 C35 45, 60 30, 100 30 C140 30, 165 45, 165 80 L165 140 L35 140 Z" fill="#FCEAD0" />
          <path d="M55 45 L58 90" stroke="#DD6B20" strokeWidth="3" />
          <path d="M145 45 L142 90" stroke="#DD6B20" strokeWidth="3" />
          <path d="M45 85 C45 85, 75 90, 100 90 C125 90, 155 85, 155 85 L175 240 L25 240 Z" fill="url(#casualDress)" />
          <path d="M45 85 C60 75, 90 78, 100 85 C110 78, 140 75, 155 85 Z" fill="#FCEAD0" />
        </svg>
      )
    },
    festive: {
      titleMen: isRTL ? 'ملابس الرجال (احتفالي / مبهج)' : 'Men (Festive)',
      titleWomen: isRTL ? 'ملابس السيدات (ألوان مبهجة / ترتر)' : 'Women (Festive)',
      descMen: isRTL ? 'بدلة كلاسيكية مع ربطة عنق أو منديل جيب بألوان زاهية ومبهجة.' : 'Bold colored blazer or suit, bright tie/pocket square.',
      descWomen: isRTL ? 'فستان كوكتيل براق، ملون ومزين بالترتر أو بتصميمات مميزة.' : 'Vibrant cocktail dress, sequins, or statement jewelry.',
      svgMen: (
        <svg viewBox="0 0 200 240" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
          <defs>
            <linearGradient id="festiveSuit" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4C1D95" />
              <stop offset="100%" stopColor="#2E1065" />
            </linearGradient>
          </defs>
          <path d="M20 80 C20 80, 50 20, 100 20 C150 20, 180 80, 180 80 L180 240 L20 240 Z" fill="url(#festiveSuit)" />
          <path d="M70 20 L130 20 L100 110 Z" fill="#FFFFFF" />
          <path d="M95 40 L105 40 L108 120 L100 135 L92 120 Z" fill="#ED8936" />
          <path d="M20 80 L70 20 L100 120 L75 155 Z" fill="#6B21A8" />
          <path d="M180 80 L130 20 L100 120 L125 155 Z" fill="#6B21A8" />
          <path d="M42 110 L52 95 L58 110 Z" fill="#ED8936" />
          <path d="M48 110 L54 90 L60 110 Z" fill="#ECC94B" />
        </svg>
      ),
      svgWomen: (
        <svg viewBox="0 0 200 240" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
          <defs>
            <linearGradient id="festiveDress" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ECC94B" />
              <stop offset="50%" stopColor="#ED8936" />
              <stop offset="100%" stopColor="#E53E3E" />
            </linearGradient>
            <filter id="festiveSparkle">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          <path d="M35 80 C35 45, 60 30, 100 30 C140 30, 165 45, 165 80 L165 140 L35 140 Z" fill="#FCEAD0" />
          <path d="M40 85 C40 85, 70 95, 100 95 C130 95, 160 85, 160 85 L178 240 L22 240 Z" fill="url(#festiveDress)" />
          <circle cx="70" cy="120" r="2" fill="#FFFFFF" filter="url(#festiveSparkle)" />
          <circle cx="130" cy="140" r="2.5" fill="#FFFFFF" filter="url(#festiveSparkle)" />
          <circle cx="95" cy="170" r="2" fill="#FFFFFF" filter="url(#festiveSparkle)" />
          <circle cx="110" cy="110" r="3" fill="#FFFFFF" filter="url(#festiveSparkle)" />
          <circle cx="65" cy="190" r="2" fill="#FFFFFF" filter="url(#festiveSparkle)" />
          <circle cx="140" cy="190" r="2" fill="#FFFFFF" filter="url(#festiveSparkle)" />
        </svg>
      )
    },
    traditional: {
      titleMen: isRTL ? 'الزي التقليدي (ثوب وبشت فاخر)' : 'Men (Traditional / Bisht)',
      titleWomen: isRTL ? 'ملابس السيدات (عباية أو قفطان مطرز)' : 'Women (Traditional / Kaftan)',
      descMen: isRTL ? 'الثوب السعودي/العربي، مع البشت الفاخر المطرز بالقصب الذهبي والغترة.' : 'Traditional thobe or elegant cultural formal wear with bisht.',
      descWomen: isRTL ? 'القفطان المغربي المطرز، أو العباءة الراقية المزينة بخيوط الذهب.' : 'Luxurious embroidered kaftan, abaya, or cultural formal dress.',
      svgMen: (
        <svg viewBox="0 0 200 240" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
          <defs>
            <linearGradient id="bishtGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#231F20" />
              <stop offset="100%" stopColor="#0B090A" />
            </linearGradient>
            <linearGradient id="goldEmb" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#E3C485" />
              <stop offset="50%" stopColor="#FDF1D6" />
              <stop offset="100%" stopColor="#C49B45" />
            </linearGradient>
          </defs>
          <path d="M30 80 C30 80, 50 30, 100 30 C150 30, 170 80, 170 80 L170 240 L30 240 Z" fill="#F7FAFC" />
          <path d="M45 30 L100 10 L155 30 L165 140 L140 180 L100 100 L60 180 L35 140 Z" fill="#FFFFFF" stroke="#E2E8F0" />
          <path d="M55 40 Q100 25 145 40" stroke="#E53E3E" strokeWidth="1.5" strokeDasharray="3 3" />
          <path d="M48 70 Q100 55 152 70" stroke="#E53E3E" strokeWidth="1.5" strokeDasharray="3 3" />
          <path d="M42 100 Q100 85 158 100" stroke="#E53E3E" strokeWidth="1.5" strokeDasharray="3 3" />
          <rect x="68" y="25" width="64" height="6" rx="3" fill="#1A1A1A" />
          <rect x="72" y="29" width="56" height="5" rx="2.5" fill="#000" />
          <path d="M30 110 L50 240 L20 240 Z" fill="url(#bishtGrad)" />
          <path d="M170 110 L150 240 L180 240 Z" fill="url(#bishtGrad)" />
          <path d="M50 110 L68 240" stroke="url(#goldEmb)" strokeWidth="4" />
          <path d="M150 110 L132 240" stroke="url(#goldEmb)" strokeWidth="4" />
        </svg>
      ),
      svgWomen: (
        <svg viewBox="0 0 200 240" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
          <defs>
            <linearGradient id="kaftanBg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1E3A8A" />
              <stop offset="100%" stopColor="#0D1B2A" />
            </linearGradient>
            <linearGradient id="goldKaftan" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#F5E3B5" />
              <stop offset="50%" stopColor="#D5B066" />
              <stop offset="100%" stopColor="#A8823B" />
            </linearGradient>
          </defs>
          <path d="M35 80 C35 45, 60 30, 100 30 C140 30, 165 45, 165 80 L165 140 L35 140 Z" fill="#FCEAD0" />
          <path d="M40 75 C40 75, 70 85, 100 85 C130 85, 160 75, 160 75 L180 240 L20 240 Z" fill="url(#kaftanBg)" />
          <path d="M70 30 C70 30, 100 80, 130 30 Z" stroke="url(#goldKaftan)" strokeWidth="4" fill="none" />
          <line x1="100" y1="80" x2="100" y2="240" stroke="url(#goldKaftan)" strokeWidth="5" />
          <rect x="52" y="135" width="96" height="10" rx="3" fill="url(#goldKaftan)" />
          <path d="M80 100 C90 110, 95 105, 100 120 C105 105, 110 110, 120 100" stroke="url(#goldKaftan)" strokeWidth="1.5" fill="none" />
          <path d="M80 160 C90 170, 95 165, 100 180 C105 165, 110 170, 120 160" stroke="url(#goldKaftan)" strokeWidth="1.5" fill="none" />
        </svg>
      )
    }
  };

  const config = configs[category];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
      gap: '20px',
      marginTop: '20px',
      perspective: '1000px'
    }}>
      {/* Men's Card */}
      <motion.div
        whileHover={{
          scale: 1.02,
          rotateY: -5,
          rotateX: 5,
          boxShadow: '0 20px 40px rgba(0,0,0,0.15), 0 0 15px rgba(184, 148, 79, 0.15)'
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        style={{
          background: 'rgba(255, 255, 255, 0.8)',
          border: '1px solid rgba(184, 148, 79, 0.25)',
          borderRadius: '16px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          backdropFilter: 'blur(10px)',
          transformStyle: 'preserve-3d',
          boxShadow: '0 10px 25px rgba(0,0,0,0.06)'
        }}
      >
        <div style={{
          width: '130px',
          height: '150px',
          background: 'rgba(0,0,0,0.03)',
          borderRadius: '12px',
          padding: '8px',
          marginBottom: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: 'translateZ(20px)',
          filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.1))'
        }}>
          {config.svgMen}
        </div>
        <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#191B1E', margin: '0 0 6px 0', fontFamily: 'var(--font-sans)', transform: 'translateZ(10px)' }}>
          {config.titleMen}
        </h4>
        <p style={{ fontSize: '12px', color: '#77736A', margin: 0, lineHeight: '1.5', fontFamily: 'var(--font-sans)', transform: 'translateZ(5px)' }}>
          {config.descMen}
        </p>
      </motion.div>

      {/* Women's Card */}
      <motion.div
        whileHover={{
          scale: 1.02,
          rotateY: 5,
          rotateX: 5,
          boxShadow: '0 20px 40px rgba(0,0,0,0.15), 0 0 15px rgba(184, 148, 79, 0.15)'
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        style={{
          background: 'rgba(255, 255, 255, 0.8)',
          border: '1px solid rgba(184, 148, 79, 0.25)',
          borderRadius: '16px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          backdropFilter: 'blur(10px)',
          transformStyle: 'preserve-3d',
          boxShadow: '0 10px 25px rgba(0,0,0,0.06)'
        }}
      >
        <div style={{
          width: '130px',
          height: '150px',
          background: 'rgba(0,0,0,0.03)',
          borderRadius: '12px',
          padding: '8px',
          marginBottom: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: 'translateZ(20px)',
          filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.1))'
        }}>
          {config.svgWomen}
        </div>
        <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#191B1E', margin: '0 0 6px 0', fontFamily: 'var(--font-sans)', transform: 'translateZ(10px)' }}>
          {config.titleWomen}
        </h4>
        <p style={{ fontSize: '12px', color: '#77736A', margin: 0, lineHeight: '1.5', fontFamily: 'var(--font-sans)', transform: 'translateZ(5px)' }}>
          {config.descWomen}
        </p>
      </motion.div>
    </div>
  );
}
