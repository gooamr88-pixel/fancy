'use client';

import React, { useState, useRef, useEffect, useCallback, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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
  style = {}, icon, loading = false, testId,
}) {
  const variants = {
    gold: {
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
  };

  const sizes = {
    sm: { padding: '10px 20px', fontSize: '12px' },
    md: { padding: '14px 32px', fontSize: '14px' },
    lg: { padding: '18px 40px', fontSize: '16px' },
  };

  const v = variants[variant];
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

// ─── AttendanceCard: Interactive attendance choice ───
export function AttendanceCard({ type, selected, onClick, isRTL = false }) {
  const configs = {
    yes: {
      icon: '🎉', label: isRTL ? 'سأحضر بكل سرور' : 'Joyfully Accept',
      subtitle: isRTL ? 'أتطلع للمشاركة في هذه المناسبة الجميلة' : 'I look forward to celebrating with you',
      gradient: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.02))',
      borderColor: '#10b981', glowColor: 'rgba(16,185,129,0.2)',
    },
    maybe: {
      icon: '🤔', label: isRTL ? 'ربما' : 'Tentatively Accept',
      subtitle: isRTL ? 'سأؤكد حضوري قريباً' : "I'll confirm closer to the date",
      gradient: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(99,102,241,0.02))',
      borderColor: '#6366f1', glowColor: 'rgba(99,102,241,0.2)',
    },
    no: {
      icon: '💌', label: isRTL ? 'أعتذر عن الحضور' : 'Respectfully Decline',
      subtitle: isRTL ? 'أتمنى لكم أمسية رائعة' : 'Wishing you a wonderful celebration',
      gradient: 'linear-gradient(135deg, rgba(239,68,68,0.06), rgba(239,68,68,0.02))',
      borderColor: '#ef4444', glowColor: 'rgba(239,68,68,0.15)',
    },
  };

  const config = configs[type];
  const isSelected = selected === type;

  return (
    <motion.button
      data-testid={`attendance-${type}`}
      aria-pressed={isSelected}
      aria-label={config.label}
      onClick={() => onClick(type)}
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      animate={isSelected ? {
        borderColor: config.borderColor,
        boxShadow: `0 0 30px ${config.glowColor}, 0 12px 40px rgba(0,0,0,0.08)`,
      } : {
        borderColor: '#E8E2D6',
        boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      style={{
        width: '100%', padding: '28px 20px',
        border: `2px solid ${isSelected ? config.borderColor : '#E8E2D6'}`,
        borderRadius: '16px', textAlign: 'center',
        background: isSelected ? config.gradient : '#FFFFFF',
        cursor: 'pointer', fontFamily: 'var(--font-sans)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
      }}
    >
      <motion.span
        animate={isSelected ? { scale: [1, 1.3, 1], rotate: [0, 10, -10, 0] } : { scale: 1 }}
        transition={{ duration: 0.5 }}
        style={{ fontSize: '36px', display: 'block' }}
      >
        {config.icon}
      </motion.span>
      <span style={{
        fontWeight: 700, fontSize: '15px',
        color: isSelected ? config.borderColor : '#191B1E',
      }}>
        {config.label}
      </span>
      <span style={{ fontSize: '12px', color: '#77736A', fontWeight: 400, lineHeight: 1.4 }}>
        {config.subtitle}
      </span>
      {isSelected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 15 }}
          style={{
            marginTop: '4px', width: '24px', height: '24px', borderRadius: '50%',
            background: config.borderColor, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </motion.div>
      )}
    </motion.button>
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

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [onClose, next, prev]);

  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) diff > 0 ? next() : prev();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(20px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
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
export function CalendarButton({ event, isRTL = false, style = {} }) {
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
    { label: 'Google Calendar', icon: '📅', action: () => { window.open(googleUrl, '_blank'); setOpen(false); } },
    { label: 'Apple Calendar', icon: '🍎', action: generateICS },
    { label: 'Outlook / Other', icon: '📧', action: generateICS },
  ];

  return (
    <div style={{ position: 'relative', display: 'inline-block', ...style }}>
      <PremiumButton variant="outline" size="sm" icon="📅" onClick={() => setOpen(!open)}>
        {isRTL ? 'أضف إلى التقويم' : 'Add to Calendar'}
      </PremiumButton>
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
                <span>{opt.icon}</span>
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
export function ShareButton({ title, text, url, isRTL = false, style = {} }) {
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
    <PremiumButton variant="ghost" size="sm" icon={copied ? '✓' : '🔗'} onClick={handleShare} style={style}>
      {copied ? (isRTL ? 'تم النسخ!' : 'Link Copied!') : (isRTL ? 'مشاركة الدعوة' : 'Share Invitation')}
    </PremiumButton>
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

// ─── Input style helper (re-exported for use in pages) ───
export const inputStyle = {
  width: '100%', boxSizing: 'border-box', padding: '14px 16px',
  background: '#FFFFFF', border: '1px solid #E8E2D6',
  borderRadius: '12px', fontSize: '14px', color: '#191B1E',
  outline: 'none', fontFamily: 'var(--font-sans)',
  transition: 'border-color 0.25s ease, box-shadow 0.25s ease',
};

export const inputFocus = (e) => {
  e.target.style.borderColor = '#B8944F';
  e.target.style.boxShadow = '0 0 0 3px rgba(184, 148, 79, 0.1)';
};

export const inputBlur = (e, hasError) => {
  e.target.style.borderColor = hasError ? '#ef4444' : '#E8E2D6';
  e.target.style.boxShadow = 'none';
};
