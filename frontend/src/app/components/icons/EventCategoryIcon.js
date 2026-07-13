'use client';

import React from 'react';

// A single-family set of hand-drawn line icons for every event category —
// replaces the plain emoji glyphs (💍🎂🎉…) that render inconsistently
// across browsers/OSes and read as an unfinished placeholder next to the
// rest of the product's engraved-gold visual language. One consistent
// stroke weight, rounded caps, no fills — matches the thin gold hairlines
// already used elsewhere (HeroSection's corner flourishes, accordion
// chevrons). Every path lives in a 24x24 box.
const PATHS = {
  wedding: (
    <>
      <circle cx="9" cy="14" r="5.4" />
      <circle cx="15" cy="14" r="5.4" />
    </>
  ),
  engagement: (
    <path d="M8 4h8l3.5 5L12 21 4.5 9 8 4Z M4.5 9h15 M9.3 4l-1.8 5 4.5 12 4.5-12-1.8-5" />
  ),
  birthday: (
    <>
      <path d="M4 21v-8.5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2V21" />
      <path d="M4 17c1.6 1.1 2.9 1.1 4.5 0s2.9-1.1 4.5 0 2.9 1.1 4.5 0 2.9-1.1 4.5 0" />
      <path d="M12 10.5V7" />
      <path d="M12 3.2c-1.1 1-1.1 2 0 3 1.1-1 1.1-2 0-3Z" />
    </>
  ),
  bridalShower: (
    <>
      <circle cx="9" cy="7" r="2.6" />
      <circle cx="15" cy="7" r="2.6" />
      <circle cx="12" cy="10.6" r="2.6" />
      <path d="M12 13.2V21 M12 21c-2.6 0-4-1.3-4-3 M12 21c2.6 0 4-1.3 4-3" />
    </>
  ),
  anniversary: (
    <>
      <path d="M8.2 10.2a3.8 3.8 0 1 1 7.6 0c0 3.6-3.8 5.5-3.8 5.5s-3.8-1.9-3.8-5.5Z" transform="translate(0 -1)" />
      <path d="M5 19h14" />
    </>
  ),
  graduation: (
    <>
      <path d="M2.5 9.5 12 5l9.5 4.5-9.5 4.5-9.5-4.5Z" />
      <path d="M7 11.7V16c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5v-4.3" />
      <path d="M21.5 9.5V15" />
    </>
  ),
  corporate: (
    <>
      <rect x="3.5" y="8" width="17" height="11" rx="1.6" />
      <path d="M9 8V6.5A1.5 1.5 0 0 1 10.5 5h3A1.5 1.5 0 0 1 15 6.5V8" />
      <path d="M3.5 13h17" />
    </>
  ),
  gala: (
    <>
      <path d="M6 3.5h4l-.6 5.4a1.8 1.8 0 0 1-1.8 1.6h0a1.8 1.8 0 0 1-1.8-1.6L6 3.5Z" transform="rotate(-18 8 7)" />
      <path d="M6 3.5h4l-.6 5.4a1.8 1.8 0 0 1-1.8 1.6h0a1.8 1.8 0 0 1-1.8-1.6L6 3.5Z" transform="translate(9.2 0) rotate(18 8 7)" />
      <path d="M8 10.6V16 M17 10.6V16 M6 20.5h4 M15 20.5h4 M8 16h0 M17 16h0" />
      <path d="M8 16v4.5 M17 16v4.5" />
    </>
  ),
  celebration: (
    <>
      <path d="M12 3.2 13 8l4.8 1-4.8 1L12 15l-1-5-4.8-1L11 8l1-4.8Z" />
      <circle cx="19" cy="6" r="1" />
      <circle cx="5" cy="16" r="1.1" />
      <circle cx="18.5" cy="17.5" r="0.9" />
    </>
  ),
  babyShower: (
    <>
      <path d="M9.5 3.5h5l-1 3v2h-3V6.5l-1-3Z" />
      <rect x="8" y="8.5" width="8" height="12" rx="2.6" />
      <path d="M8 13.5h8" />
    </>
  ),
  custom: (
    <path d="M12 2.5 13.3 9 19.5 10.3 13.3 11.6 12 18 10.7 11.6 4.5 10.3 10.7 9 12 2.5Z" />
  ),
  bachelorParty: (
    <>
      <path d="M5 4h14l-7 8.2L5 4Z" />
      <path d="M12 12.2V20 M8 20h8" />
      <path d="M17 4 18 5.4 19.4 4.6" />
    </>
  ),
  quinceanera: (
    <path d="M4 17V10l4 4 4-6 4 6 4-4v7Z M4 17h16" />
  ),
  barMitzvah: (
    <>
      <path d="M12 3 19.5 16.5 4.5 16.5Z" />
      <path d="M12 21 4.5 7.5 19.5 7.5Z" />
    </>
  ),
  christening: (
    <>
      <path d="M4 13.5c2-2.5 5-3 7-1.5" />
      <path d="M11 12C12 8 15 5.5 19 5.5c-1 2.5-1 4.5 0.5 6-2 1-4 0.8-5.5-0.5" />
      <path d="M11 12c1 1.5 1 3.5-0.5 5-1.8 0.2-3.5-0.5-4.5-2" />
      <circle cx="16.5" cy="7" r="0.4" fill="currentColor" stroke="none" />
    </>
  ),
  housewarming: (
    <>
      <path d="M4 11 12 4 20 11" />
      <path d="M6 10v9h12v-9" />
      <path d="M10 19v-5h4v5" />
    </>
  ),
  retirement: (
    <>
      <circle cx="12" cy="13.5" r="7" />
      <path d="M12 13.5V9.5 M12 13.5l3 1.8" />
      <path d="M9.5 3h5 M12 3v2.5" />
    </>
  ),
  reunion: (
    <>
      <path d="M4 12a8 8 0 0 1 13.5-5.5 M20 12a8 8 0 0 1-13.5 5.5" />
      <path d="M17.5 3.2v3.5h-3.5 M6.5 20.8v-3.5h3.5" />
    </>
  ),
  holidayParty: (
    <>
      <circle cx="12" cy="14" r="6.3" />
      <path d="M12 7.7V5 M10.2 5h3.6" />
      <path d="M9 13.6 10.7 15.3 15 11" />
    </>
  ),
  farewell: (
    <path d="M3 12 21 4 14 21 11 13 3 12Z M11 13 21 4" />
  ),
  memorial: (
    <>
      <rect x="9.5" y="9" width="5" height="11" rx="1" />
      <path d="M12 3.2c-1.1 1-1.1 2.2 0 3.3 1.1-1.1 1.1-2.3 0-3.3Z" />
      <path d="M9.5 13.5h5" />
    </>
  ),
  genderReveal: (
    <>
      <path d="M12 3.5a5.5 5.5 0 0 1 5.5 5.5c0 3.5-2.5 6-5.5 8-3-2-5.5-4.5-5.5-8A5.5 5.5 0 0 1 12 3.5Z" />
      <path d="M12 17v2.3" />
      <path d="M10.6 19.3h2.8l-1.4 2Z" />
    </>
  ),
  vowRenewal: (
    <>
      <circle cx="9" cy="15" r="5" />
      <circle cx="15" cy="15" r="5" />
      <path d="M12 5 12.8 7.3 15 8 12.8 8.7 12 11 11.2 8.7 9 8 11.2 7.3 12 5Z" />
    </>
  ),
  religiousHoliday: (
    <>
      <path d="M9 3.5h6 M10 3.5v2.3h4V3.5" />
      <rect x="7.2" y="5.8" width="9.6" height="11.4" rx="2" />
      <path d="M12 17.2V21 M10 21h4" />
      <path d="M10 11.5h4" />
    </>
  ),
  henna: (
    <>
      <path d="M14 4c3 1 5 4 4 8-0.8 3.2-4 5-7 4-2.5-0.8-4-3-3.3-5.3 0.5-1.7 2.2-2.6 3.7-2 1.2 0.5 1.8 1.8 1.3 2.8" />
      <circle cx="9.3" cy="9.5" r="0.4" fill="currentColor" stroke="none" />
    </>
  ),
  sportsEvent: (
    <>
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M7 5.5H4a3 3 0 0 0 3 5 M17 5.5h3a3 3 0 0 1-3 5" />
      <path d="M12 14v3.5 M8.5 21h7 M9.5 17.5h5l.6 3.5H8.9l.6-3.5Z" />
    </>
  ),
};

export default function EventCategoryIcon({ name, size = 17, color = 'currentColor', strokeWidth = 1.5 }) {
  const path = PATHS[name];
  if (!path) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {path}
    </svg>
  );
}
