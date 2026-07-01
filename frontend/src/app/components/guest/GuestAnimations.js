'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence, useInView, useScroll, useTransform, useReducedMotion } from 'framer-motion';

/* ═══════════════════════════════════════════════════════════════
   FANCY RSVP — Premium Guest Animation Library
   Reusable Framer Motion wrappers for the guest experience
   ═══════════════════════════════════════════════════════════════ */

// ─── Spring presets ───
const springs = {
  gentle: { type: 'spring', stiffness: 120, damping: 14 },
  snappy: { type: 'spring', stiffness: 300, damping: 24 },
  bouncy: { type: 'spring', stiffness: 400, damping: 10 },
  smooth: { type: 'spring', stiffness: 100, damping: 20, mass: 0.8 },
};

// ─── FadeInUp: Scroll-triggered fade with upward motion ───
export function FadeInUp({ children, delay = 0, duration = 0.7, y = 40, className = '', style = {}, once = true }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once, margin: '-60px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y }}
      transition={{ duration, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}

// ─── StaggerChildren: Container that staggers children entrance ───
export function StaggerChildren({ children, delay = 0, staggerDelay = 0.1, className = '', style = {} }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      variants={{
        hidden: {},
        visible: { transition: { delayChildren: delay, staggerChildren: staggerDelay } },
      }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}

// ─── StaggerItem: Individual child inside StaggerChildren ───
export function StaggerItem({ children, className = '', style = {} }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 30 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
      }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}

// ─── ScaleIn: Scale entrance for cards ───
export function ScaleIn({ children, delay = 0, className = '', style = {} }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={inView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
      transition={{ ...springs.gentle, delay }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}

// ─── SlideTransition: Directional slide for step transitions ───
export function SlideTransition({ children, direction = 1, keyProp }) {
  return (
    <AnimatePresence mode="wait" custom={direction}>
      <motion.div
        key={keyProp}
        custom={direction}
        initial={(d) => ({ opacity: 0, x: (d || 1) * 80 })}
        animate={{ opacity: 1, x: 0 }}
        exit={(d) => ({ opacity: 0, x: (d || 1) * -80 })}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// ─── ParallaxHero: Scroll-linked parallax effect ───
export function ParallaxHero({ children, imageUrl, height = '70vh', overlayGradient, style = {} }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0.3]);

  return (
    <div ref={ref} style={{ position: 'relative', height, width: '100%', overflow: 'hidden', ...style }}>
      <motion.div
        style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url(${imageUrl})`,
          backgroundSize: 'cover', backgroundPosition: 'center',
          y, scale: 1.1,
        }}
      />
      {overlayGradient && (
        <div style={{ position: 'absolute', inset: 0, background: overlayGradient }} />
      )}
      <motion.div style={{ position: 'relative', zIndex: 10, height: '100%', opacity }}>
        {children}
      </motion.div>
    </div>
  );
}

// ─── CountdownDigit: Animated flip-style digit ───
export function CountdownDigit({ value, label, color = '#B8944F', bgColor = 'rgba(255,255,255,0.08)' }) {
  const displayValue = String(value).padStart(2, '0');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
      <div style={{
        position: 'relative', width: '72px', height: '80px',
        borderRadius: '14px', background: bgColor,
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}>
        <AnimatePresence mode="popLayout">
          <motion.span
            key={displayValue}
            initial={{ y: -40, opacity: 0, filter: 'blur(4px)' }}
            animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
            exit={{ y: 40, opacity: 0, filter: 'blur(4px)' }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            style={{
              fontSize: '36px', fontWeight: 800, color,
              fontFamily: 'var(--font-sans)', lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {displayValue}
          </motion.span>
        </AnimatePresence>
        {/* Shine line */}
        <div style={{
          position: 'absolute', top: '50%', left: 0, right: 0, height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
        }} />
      </div>
      <span style={{
        fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.18em', color: 'rgba(255,255,255,0.5)',
        fontFamily: 'var(--font-sans)',
      }}>
        {label}
      </span>
    </div>
  );
}

// ─── FloatingParticles: Ambient gold particles background ───
export function FloatingParticles({ count = 30, color = '#B8944F' }) {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const animFrameRef = useRef(null);
  const reduceMotion = useReducedMotion(); // A11Y-4

  useEffect(() => {
    if (reduceMotion) return; // honor prefers-reduced-motion — no ambient drift
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w = canvas.width = canvas.offsetWidth;
    let h = canvas.height = canvas.offsetHeight;

    // Parse color to RGB
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Create particles
    particlesRef.current = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      size: Math.random() * 3 + 1,
      speedX: (Math.random() - 0.5) * 0.4,
      speedY: -Math.random() * 0.3 - 0.1,
      opacity: Math.random() * 0.5 + 0.1,
      pulse: Math.random() * Math.PI * 2,
    }));

    const animate = () => {
      ctx.clearRect(0, 0, w, h);
      particlesRef.current.forEach(p => {
        p.x += p.speedX;
        p.y += p.speedY;
        p.pulse += 0.02;
        const alpha = p.opacity * (0.6 + 0.4 * Math.sin(p.pulse));

        if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.fill();
      });
      animFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      w = canvas.width = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, [count, color, reduceMotion]);

  if (reduceMotion) return null; // A11Y-4: render nothing rather than a static canvas

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute', inset: 0, zIndex: 5,
        pointerEvents: 'none', width: '100%', height: '100%',
      }}
    />
  );
}

// ─── ConfettiExplosion: Canvas-based celebration ───
export function ConfettiExplosion({ active = false, duration = 4000, particleCount = 120, colors }) {
  const canvasRef = useRef(null);
  const [show, setShow] = useState(active);
  const reduceMotion = useReducedMotion(); // A11Y-4
  const confettiColors = colors || ['#B8944F', '#D7BE80', '#F8F4EC', '#E8C564', '#A67C2E', '#FFFFFF', '#FF6B6B', '#4ECDC4'];

  useEffect(() => {
    if (active && !reduceMotion) setShow(true);
  }, [active, reduceMotion]);

  useEffect(() => {
    if (!show || reduceMotion) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = window.innerWidth;
    const h = canvas.height = window.innerHeight;

    const pieces = Array.from({ length: particleCount }, () => ({
      x: w / 2 + (Math.random() - 0.5) * 200,
      y: h * 0.4,
      vx: (Math.random() - 0.5) * 20,
      vy: -(Math.random() * 18 + 5),
      size: Math.random() * 8 + 4,
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 12,
      color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
      shape: Math.random() > 0.5 ? 'rect' : 'circle',
      gravity: 0.15 + Math.random() * 0.1,
      friction: 0.99,
      opacity: 1,
    }));

    let startTime = Date.now();
    let frame;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed > duration) {
        setShow(false);
        return;
      }

      ctx.clearRect(0, 0, w, h);
      const fadeOut = elapsed > duration * 0.7 ? 1 - (elapsed - duration * 0.7) / (duration * 0.3) : 1;

      pieces.forEach(p => {
        p.vy += p.gravity;
        p.vx *= p.friction;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotSpeed;
        p.opacity = fadeOut;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;

        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });

      frame = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(frame);
  }, [show, duration, particleCount, confettiColors]);

  if (!show) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        pointerEvents: 'none', width: '100vw', height: '100vh',
      }}
    />
  );
}

// ─── GlowPulse: Subtle glow animation for CTAs ───
export function GlowPulse({ children, color = '#B8944F', intensity = 0.3, className = '', style = {} }) {
  return (
    <motion.div
      animate={{
        boxShadow: [
          `0 0 20px rgba(${hexToRgb(color)}, 0)`,
          `0 0 30px rgba(${hexToRgb(color)}, ${intensity})`,
          `0 0 20px rgba(${hexToRgb(color)}, 0)`,
        ],
      }}
      transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
      className={className}
      style={{ borderRadius: '12px', ...style }}
    >
      {children}
    </motion.div>
  );
}

// ─── AnimatedText: Letter-by-letter stagger text entrance ───
export function AnimatedText({ text, tag: Tag = 'h1', delay = 0, style = {}, className = '', dir = 'auto' }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const words = text.split(' ');

  return (
    <Tag ref={ref} style={{ ...style, overflow: 'hidden' }} className={className} dir={dir}>
      {words.map((word, wi) => (
        <span key={wi} style={{ display: 'inline-block', marginInlineEnd: '0.3em' }} dir={dir}>
          {word.split('').map((char, ci) => (
            <motion.span
              key={ci}
              initial={{ opacity: 0, y: 40 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{
                duration: 0.5,
                delay: delay + wi * 0.08 + ci * 0.03,
                ease: [0.16, 1, 0.3, 1],
              }}
              style={{ display: 'inline-block' }}
            >
              {char}
            </motion.span>
          ))}
        </span>
      ))}
    </Tag>
  );
}

// ─── ShimmerPlaceholder: Skeleton loading shimmer ───
export function ShimmerPlaceholder({ width = '100%', height = '20px', borderRadius = '8px', style = {} }) {
  return (
    <div style={{
      width, height, borderRadius,
      background: 'linear-gradient(90deg, #F0ECE3 25%, #F8F4EC 50%, #F0ECE3 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s ease-in-out infinite',
      ...style,
    }} />
  );
}

// ─── PageTransition: Wrapper for full page transitions ───
export function PageTransition({ children, className = '' }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── Helper ───
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return `${parseInt(h.substring(0, 2), 16)}, ${parseInt(h.substring(2, 4), 16)}, ${parseInt(h.substring(4, 6), 16)}`;
}

export { springs };
