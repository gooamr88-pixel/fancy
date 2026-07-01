'use client';

import React from 'react';
import { motion } from 'framer-motion';

export default function PremiumEnvelopeIcon() {
  return (
    <div style={{ position: 'relative', width: '100px', height: '100px', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Soft luxurious background radial glow */}
      <motion.div
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        style={{
          position: 'absolute',
          width: '90px',
          height: '90px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(184, 148, 79, 0.25) 0%, rgba(184, 148, 79, 0) 70%)',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />
      
      {/* Floating wrapper for the whole envelope */}
      <motion.div
        animate={{
          y: [0, -4, 0],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        style={{ zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <motion.svg
          width="80"
          height="80"
          viewBox="0 0 80 80"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          initial="initial"
          animate="animate"
          whileHover="hover"
          style={{ cursor: 'pointer' }}
        >
          <defs>
            {/* Elegant Luxury Gold Gradient */}
            <linearGradient id="goldGradient" x1="0" y1="0" x2="80" y2="80" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFE08A" />
              <stop offset="30%" stopColor="#D7BE80" />
              <stop offset="70%" stopColor="#B8944F" />
              <stop offset="100%" stopColor="#8C6A27" />
            </linearGradient>

            {/* Dark Charcoal Premium Paper Gradient */}
            <linearGradient id="charcoalGradient" x1="10" y1="20" x2="70" y2="70" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#2D3035" />
              <stop offset="50%" stopColor="#191B1E" />
              <stop offset="100%" stopColor="#0F1012" />
            </linearGradient>

            {/* Ivory Card Gradient */}
            <linearGradient id="ivoryCardGradient" x1="20" y1="10" x2="60" y2="50" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#F8F4EC" />
            </linearGradient>

            {/* Realistic soft shadow filter */}
            <filter id="softShadow" x="-10%" y="-10%" width="120%" height="130%" filterUnits="userSpaceOnUse">
              <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000000" floodOpacity="0.3" />
            </filter>
            
            <filter id="waxShadow" x="-20%" y="-20%" width="140%" height="140%" filterUnits="userSpaceOnUse">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#3E2810" floodOpacity="0.4" />
            </filter>
          </defs>

          {/* Envelope Main Pocket (Back and sides) */}
          <path
            d="M10 24C10 21.7909 11.7909 20 14 20H66C68.2091 20 70 21.7909 70 24V56C70 58.2091 68.2091 60 66 60H14C11.7909 60 10 58.2091 10 56V24Z"
            fill="url(#charcoalGradient)"
            stroke="url(#goldGradient)"
            strokeWidth="1.5"
            filter="url(#softShadow)"
          />

          {/* Invitation Card sliding up on load and hover */}
          <motion.g
            variants={{
              initial: { y: 15, opacity: 0 },
              animate: { 
                y: 0, 
                opacity: 1, 
                transition: { delay: 0.4, duration: 0.8, ease: [0.16, 1, 0.3, 1] } 
              },
              hover: { 
                y: -8, 
                transition: { duration: 0.4, ease: "easeOut" } 
              }
            }}
          >
            {/* The luxury card itself */}
            <rect
              x="18"
              y="12"
              width="44"
              height="34"
              rx="3"
              fill="url(#ivoryCardGradient)"
              stroke="url(#goldGradient)"
              strokeWidth="1"
            />
            {/* Inner gold frame border inside the card */}
            <rect
              x="21"
              y="15"
              width="38"
              height="28"
              rx="1.5"
              fill="none"
              stroke="#D7BE80"
              strokeWidth="0.75"
              strokeOpacity="0.6"
            />
            {/* Simulated elegant text lines on the card */}
            <line x1="26" y1="21" x2="38" y2="21" stroke="#B8944F" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="26" y1="26" x2="54" y2="26" stroke="#77736A" strokeWidth="0.75" strokeLinecap="round" opacity="0.5" />
            <line x1="26" y1="30" x2="48" y2="30" stroke="#77736A" strokeWidth="0.75" strokeLinecap="round" opacity="0.5" />
            <line x1="26" y1="34" x2="52" y2="34" stroke="#77736A" strokeWidth="0.75" strokeLinecap="round" opacity="0.5" />
            
            {/* Small gold sparkle/star inside card to denote premium feel */}
            <path
              d="M50 18.5C50 18.5 51 19 51 20C51 19 52 18.5 52 18.5C52 18.5 51 18 51 17C51 18 50 18.5 50 18.5Z"
              fill="#D7BE80"
            />
          </motion.g>

          {/* Envelope Side Folds (overlapping card slightly in visual depth) */}
          <path
            d="M10 56L32 38M70 56L48 38"
            stroke="url(#goldGradient)"
            strokeWidth="1"
            strokeLinecap="round"
            opacity="0.6"
          />

          {/* Envelope Front V-Shape Cover (lower part) */}
          <path
            d="M10 56L40 35L70 56"
            fill="#121315"
            fillOpacity="0.3"
            stroke="url(#goldGradient)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />

          {/* Envelope Top Flap (Animated opening from top on mount) */}
          <motion.path
            d="M10 20L40 40L70 20"
            stroke="url(#goldGradient)"
            strokeWidth="1.5"
            strokeLinecap="round"
            variants={{
              initial: { d: "M10 20L40 20L70 20", opacity: 0.3 },
              animate: { 
                d: "M10 20L40 40L70 20", 
                opacity: 1, 
                transition: { delay: 0.1, duration: 0.6, ease: "easeOut" } 
              },
              hover: {
                d: "M10 20L40 36L70 20",
                transition: { duration: 0.3, ease: "easeInOut" }
              }
            }}
          />

          {/* 3D Wax Seal with monogram / crown / heart design */}
          <motion.g
            variants={{
              initial: { scale: 0, opacity: 0 },
              animate: { 
                scale: 1, 
                opacity: 1, 
                transition: { delay: 0.8, type: "spring", stiffness: 260, damping: 14 } 
              },
              hover: {
                scale: 1.12,
                transition: { duration: 0.2, ease: "easeOut" }
              }
            }}
          >
            {/* Outer wavy realistic wax seal base */}
            <path
              d="M40 46.5C43.5899 46.5 46.5 43.5899 46.5 40C46.5 36.4101 43.5899 33.5 40 33.5C36.4101 33.5 33.5 36.4101 33.5 40C33.5 43.5899 36.4101 46.5 40 46.5Z"
              fill="url(#goldGradient)"
              filter="url(#waxShadow)"
            />
            {/* Secondary inner wax circle ring */}
            <circle
              cx="40"
              cy="40"
              r="4.5"
              stroke="#8C6A27"
              strokeWidth="0.5"
              fill="none"
              opacity="0.5"
            />
            {/* Custom Embossed Monogram/Icon inside the seal (Luxurious Heart) */}
            <path
              d="M40 42.5C40 42.5 37.5 41.1 37.5 39.7C37.5 38.7335 38.2835 37.95 39.25 37.95C39.838 37.95 40.356 38.237 40.65 38.678C40.944 38.237 41.462 37.95 42.05 37.95C43.0165 37.95 43.8 38.7335 43.8 39.7C43.8 41.1 41.3 42.5 41.3 42.5"
              fill="#FFFFFF"
              fillOpacity="0.9"
            />
          </motion.g>
        </motion.svg>
      </motion.div>
    </div>
  );
}
