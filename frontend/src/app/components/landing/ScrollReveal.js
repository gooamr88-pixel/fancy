'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * ScrollReveal — IntersectionObserver wrapper for scroll-triggered animations.
 * Wraps any child and animates it when scrolled into view.
 *
 * @param {string} direction - 'up' | 'down' | 'left' | 'right' | 'fade' | 'scale'
 * @param {number} delay - delay in ms before animation starts
 * @param {number} duration - animation duration in ms
 * @param {number} distance - translation distance in px
 * @param {number} threshold - IntersectionObserver threshold (0-1)
 * @param {boolean} once - if true, only animate once (default true)
 * @param {object} style - additional inline styles
 * @param {string} className - additional CSS classes
 */
export default function ScrollReveal({
  children,
  direction = 'up',
  delay = 0,
  duration = 800,
  distance = 40,
  threshold = 0.15,
  once = true,
  style = {},
  className = '',
  as: Component = 'div',
}) {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (once) observer.unobserve(element);
        } else if (!once) {
          setIsVisible(false);
        }
      },
      { threshold, rootMargin: '0px 0px -40px 0px' }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold, once]);

  const getInitialTransform = () => {
    switch (direction) {
      case 'up': return `translateY(${distance}px)`;
      case 'down': return `translateY(-${distance}px)`;
      case 'left': return `translateX(${distance}px)`;
      case 'right': return `translateX(-${distance}px)`;
      case 'scale': return 'scale(0.92)';
      case 'fade': return 'none';
      default: return `translateY(${distance}px)`;
    }
  };

  const revealStyle = {
    opacity: isVisible ? 1 : 0,
    transform: isVisible ? 'none' : getInitialTransform(),
    transition: `opacity ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
    willChange: 'opacity, transform',
    ...style,
  };

  return (
    <Component ref={ref} className={className} style={revealStyle}>
      {children}
    </Component>
  );
}
