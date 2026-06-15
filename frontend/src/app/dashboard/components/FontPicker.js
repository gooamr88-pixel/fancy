'use client';

import React, { useEffect } from 'react';

const GOOGLE_FONTS = [
  // Serif
  { name: 'Playfair Display', category: 'Serif (Elegant)' },
  { name: 'Cormorant Garamond', category: 'Serif (Elegant)' },
  { name: 'Cinzel', category: 'Serif (Classic)' },
  { name: 'EB Garamond', category: 'Serif (Classic)' },
  { name: 'Lora', category: 'Serif (Warm)' },
  { name: 'Merriweather', category: 'Serif (Warm)' },
  { name: 'Georgia', category: 'Serif (Standard)' },
  
  // Sans-serif
  { name: 'Inter', category: 'Sans-Serif (Modern)' },
  { name: 'Outfit', category: 'Sans-Serif (Modern)' },
  { name: 'Montserrat', category: 'Sans-Serif (Geometric)' },
  { name: 'Poppins', category: 'Sans-Serif (Geometric)' },
  { name: 'Raleway', category: 'Sans-Serif (Clean)' },
  { name: 'Lato', category: 'Sans-Serif (Clean)' },
  { name: 'Roboto', category: 'Sans-Serif (Standard)' },

  // Script
  { name: 'Great Vibes', category: 'Script (Romantic)' },
  { name: 'Alex Brush', category: 'Script (Romantic)' },
  { name: 'Dancing Script', category: 'Script (Casual)' },
  { name: 'Pinyon Script', category: 'Script (Formal)' },
  { name: 'Sacramento', category: 'Script (Delicate)' },
  { name: 'Parisienne', category: 'Script (Delicate)' }
];

export default function FontPicker({ label, value, onChange, style }) {
  // Inject Google Font stylesheets dynamically so previews render properly
  useEffect(() => {
    const loadedFonts = window._loadedFonts || new Set();
    window._loadedFonts = loadedFonts;

    GOOGLE_FONTS.forEach(font => {
      if (!loadedFonts.has(font.name)) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?family=${font.name.replace(/ /g, '+')}&display=swap`;
        document.head.appendChild(link);
        loadedFonts.add(font.name);
      }
    });
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
      {label && <label style={{ fontSize: '11px', fontWeight: 600, color: '#77736a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>}
      <select
        value={value || 'Inter'}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          backgroundColor: '#FFFFFF',
          border: '1px solid #E8E2D6',
          borderRadius: '10px',
          padding: '10px 14px',
          fontSize: '14px',
          color: '#191B1E',
          outline: 'none',
          fontFamily: value || 'sans-serif',
          cursor: 'pointer',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
          transition: 'border-color 0.2s',
          ...style
        }}
      >
        {GOOGLE_FONTS.map(font => (
          <option 
            key={font.name} 
            value={font.name}
            style={{ fontFamily: font.name }}
          >
            {font.name}
          </option>
        ))}
      </select>
    </div>
  );
}
