'use client';

import React from 'react';

// General-purpose line icons — replaces the plain emoji glyphs (📅 📍 🔒 ⏳…)
// scattered across the product, which render inconsistently across
// browsers/OSes and read as an unfinished placeholder next to the rest of
// the engraved-gold visual language. One consistent stroke weight, rounded
// caps, no fills. Every path lives in a 24x24 box. For event-category icons
// (wedding, birthday, etc.) see EventCategoryIcon.js instead.
const PATHS = {
  sparkle: <path d="M12 2.5 13.3 9 19.5 10.3 13.3 11.6 12 18 10.7 11.6 4.5 10.3 10.7 9 12 2.5Z" />,
  calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 9.5h17 M8 3v4 M16 3v4" /></>,
  mapPin: <><path d="M12 21c4.5-4.8 7-8.4 7-11.5A7 7 0 0 0 5 9.5C5 12.6 7.5 16.2 12 21Z" /><circle cx="12" cy="9.3" r="2.3" /></>,
  guests: <><circle cx="8.5" cy="8" r="3" /><circle cx="16" cy="9" r="2.4" /><path d="M2.8 20c.5-3.6 2.9-5.8 5.7-5.8s5.2 2.2 5.7 5.8 M14.8 14.6c2.3.2 4.1 2.2 4.5 5.4" /></>,
  mic: <><rect x="9.5" y="3" width="5" height="10" rx="2.5" /><path d="M6 11a6 6 0 0 0 12 0 M12 17v4 M9 21h6" /></>,
  discoBall: <><circle cx="12" cy="11" r="6.2" /><path d="M12 4.8v12.4 M5.8 11h12.4 M7.4 6.4l9.2 9.2 M16.6 6.4 7.4 15.6" /><path d="M12 2.5v2.3 M12 19.2v2.3" /></>,
  cocktail: <><path d="M5 4h14l-7 8.2L5 4Z" /><path d="M12 12.2V20 M8 20h8" /><path d="M7.2 6h9.6" /></>,
  headphones: <><path d="M4 15v-3a8 8 0 0 1 16 0v3" /><rect x="3" y="14" width="4.2" height="6" rx="1.6" /><rect x="16.8" y="14" width="4.2" height="6" rx="1.6" /></>,
  door: <><rect x="5.5" y="3" width="13" height="18" rx="1.2" /><circle cx="14.6" cy="12" r="0.9" /></>,
  star: <path d="M12 3.5 14.6 9.2 20.8 9.9 16.2 14.1 17.5 20.3 12 17.1 6.5 20.3 7.8 14.1 3.2 9.9 9.4 9.2 12 3.5Z" />,
  plug: <><path d="M9 3v6 M15 3v6 M6.5 9h11v3a5.5 5.5 0 0 1-11 0V9Z" /><path d="M12 17.5V21" /></>,
  partyPopper: <><path d="M4 20 14 10" /><path d="M14 4 19 10 4 15Z" transform="translate(0.5 0)" /><circle cx="18" cy="5" r="0.9" /><circle cx="21" cy="9" r="0.9" /><circle cx="6" cy="20" r="0.9" /></>,
  creditCard: <><rect x="2.5" y="5.5" width="19" height="13" rx="2" /><path d="M2.5 9.8h19 M6 14.5h4" /></>,
  lock: <><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /></>,
  lockKey: <><circle cx="9" cy="8" r="4" /><path d="M11.8 10.8 20 19 M16.5 15.5 19 18 M14 13l2.5 2.5" /></>,
  hourglass: <><path d="M6 3.5h12 M6 20.5h12 M7 3.5v3.2c0 2 1.8 3.6 5 5.3 3.2-1.7 5-3.3 5-5.3V3.5 M7 20.5v-3.2c0-2 1.8-3.6 5-5.3 3.2 1.7 5 3.3 5 5.3v3.2" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="M19.5 19.5 15.3 15.3" /></>,
  download: <><path d="M12 3v12.5 M7.5 11 12 15.5 16.5 11" /><path d="M4.5 18.5h15" /></>,
  compass: <><circle cx="12" cy="12" r="8.5" /><path d="M15 9 13.2 13.2 9 15l1.8-4.2Z" /></>,
  dressCode: <><path d="M9 3h6l1.3 3-2.3 1.5L12 6l-2 1.5L7.7 6 9 3Z" /><path d="M9 6.5 6 8.5v12h12v-12l-3-2" /></>,
  clock: <><circle cx="12" cy="12.5" r="8.2" /><path d="M12 8v4.7l3.2 2 M9 3.2h6" /></>,
  chapel: <><path d="M12 2.5v3 M10 4h4" /><path d="M6 21V11l6-5 6 5v10Z" /><path d="M12 21v-6 M9 21v-3.5h6V21" /></>,
  toast: <><path d="M6 3.5h4l-.7 6.2a1.65 1.65 0 0 1-3.28 0L4.8 3.6" transform="translate(0.4 0)" /><path d="M14 3.5h4l-.7 6.2a1.65 1.65 0 0 1-3.28 0L13.4 3.6" transform="translate(0.2 0)" /><path d="M8 9.7V17 M16 9.7V17 M5.5 21h5 M13.5 21h5" /></>,
  hotel: <><rect x="3" y="10" width="18" height="11" rx="1.4" /><path d="M7 21v-4h4v4 M13 21v-3h4v3" /><path d="M6.5 10V6.5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2V10" /></>,
  gift: <><rect x="4" y="9.5" width="16" height="11" rx="1.2" /><path d="M4 13.2h16" /><path d="M12 9.5V20.5" /><path d="M12 9.5c-1.3-4.2-6.5-4.4-6.5-1.2 0 1.6 2 1.9 6.5 1.2Z" /><path d="M12 9.5c1.3-4.2 6.5-4.4 6.5-1.2 0 1.6-2 1.9-6.5 1.2Z" /></>,
  clipboard: <><rect x="5" y="4.5" width="14" height="17" rx="2" /><rect x="8.5" y="3" width="7" height="3" rx="1" /><path d="M8.5 11h7 M8.5 15h7 M8.5 19h4" /></>,
  handshake: <><path d="M2.5 12 7 8.5l3 2 2.5-2 3 1 4-2.5" /><path d="M4 13l3.5 4a2 2 0 0 0 3 .1l.5-.6a2 2 0 0 1 2.9-.1l.4.4a2 2 0 0 0 3-.2L20.5 13" /></>,
  masks: <><path d="M3.5 6c3 0 4.5 2 4.5 5s-1.5 6-4.5 6" transform="translate(-0.5 0)" /><circle cx="6.3" cy="10.5" r="0.7" /><path d="M20.5 6c-3 0-4.5 2-4.5 5s1.5 6 4.5 6" transform="translate(0.5 0)" /><circle cx="17.7" cy="10.5" r="0.7" /></>,
  music: <><path d="M9 17.5V5l10-1.8v12.3" /><circle cx="6.7" cy="17.8" r="2.7" /><circle cx="16.7" cy="15.5" r="2.7" /></>,
  trophy: <><path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" /><path d="M7 5.5H4a3 3 0 0 0 3 5 M17 5.5h3a3 3 0 0 1-3 5" /><path d="M12 14v3.5 M8.5 21h7 M9.5 17.5h5l.6 3.5H8.9l.6-3.5Z" /></>,
  camera: <><path d="M4 8.5h3l1.4-2h7.2l1.4 2h3v11H4v-11Z" /><circle cx="12" cy="14" r="3.6" /></>,
  person: <><circle cx="12" cy="8" r="3.6" /><path d="M4.8 20.5c.8-4.2 3.6-6.5 7.2-6.5s6.4 2.3 7.2 6.5" /></>,
  key: <><circle cx="7.5" cy="15" r="3.7" /><path d="M10.5 12.3 19 3.8 M16.5 6.3 19 8.8 M14 8.8l2 2" /></>,
  unlock: <><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V7a4 4 0 0 1 7.6-1.8" /></>,
  ban: <><circle cx="12" cy="12" r="8.5" /><path d="M6.4 6.4 17.6 17.6" /></>,
  bank: <><path d="M3 9.5 12 4l9 5.5Z" /><path d="M4.5 9.5v9.5 M8 9.5v9.5 M16 9.5v9.5 M19.5 9.5v9.5" /><path d="M3 20.5h18" /></>,
  mobile: <><rect x="6.5" y="2.5" width="11" height="19" rx="2.2" /><path d="M10.5 18.3h3" /></>,
  lightning: <path d="M13 2.5 5 13.5h5.5L11 21.5l8-11.5h-5.5L13 2.5Z" />,
  cash: <><rect x="2.5" y="6.5" width="19" height="11" rx="1.6" /><circle cx="12" cy="12" r="3" /><path d="M5.5 9v0 M18.5 15v0" /></>,
  wallet: <><path d="M3.5 7.5A2.5 2.5 0 0 1 6 5h12a2.5 2.5 0 0 1 2.5 2.5V17A2.5 2.5 0 0 1 18 19.5H6A2.5 2.5 0 0 1 3.5 17V7.5Z" /><path d="M14.5 13a1.6 1.6 0 1 0 0-3H20v3h-5.5Z" /></>,
  link: <><path d="M9.5 14.5 14.5 9.5" /><path d="M11 6.5 13.3 4.2a3.6 3.6 0 0 1 5.1 5.1L16 11.7 M13 17.5l-2.3 2.3a3.6 3.6 0 0 1-5.1-5.1L8 12.3" /></>,
  chat: <path d="M4 5.5h16v11H10l-4 3.5v-3.5H4v-11Z" />,
  sentMail: <><path d="M3.5 6.5h17v11h-17v-11Z" /><path d="M3.5 7 12 13l8.5-6" /><path d="M13.5 20.5 21 20.5 21 16" /><path d="M21 20.5 16.5 17" /></>,
  book: <><path d="M4 5.2c2.4-1 5.4-1 8 .5v13.6c-2.6-1.5-5.6-1.5-8-.5V5.2Z" /><path d="M20 5.2c-2.4-1-5.4-1-8 .5v13.6c2.6-1.5 5.6-1.5 8-.5V5.2Z" /></>,
  question: <><circle cx="12" cy="12" r="8.5" /><path d="M9.5 9.3a2.5 2.5 0 1 1 3.7 2.2c-.9.5-1.2 1-1.2 1.9" /><circle cx="12" cy="17" r="0.15" fill="currentColor" /></>,
  ticket: <><path d="M3.5 8.5A2 2 0 0 1 5.5 6.5h13a2 2 0 0 1 2 2v2.2a1.8 1.8 0 0 0 0 3.6v2.2a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-2.2a1.8 1.8 0 0 0 0-3.6V8.5Z" /><path d="M14 6.5v11" strokeDasharray="1.6 2" /></>,
  car: <><path d="M4 16V11l2-4.5h12L20 11v5" /><path d="M4 16h16v3h-2.5v-1.5h-11V19H4v-3Z" /><circle cx="7.5" cy="16" r="1.4" /><circle cx="16.5" cy="16" r="1.4" /></>,
  globe: <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17 M12 3.5a13 13 0 0 1 0 17 13 13 0 0 1 0-17Z" /></>,
  mountain: <path d="M3 19 9 8.5l3.5 5.5L15 10l6 9H3Z" />,
  restaurant: <><path d="M6 3v8a2 2 0 0 0 4 0V3 M8 3v18 M8 11V3" /><path d="M17 3c-1.6 0-2.5 2-2.5 4.5S15.4 12 17 12v9" /></>,
  wave: <><path d="M2.5 15c2 1.6 4 1.6 6 0s4-1.6 6 0 4 1.6 6 0" /><path d="M2.5 19.5c2 1.6 4 1.6 6 0s4-1.6 6 0 4 1.6 6 0" /><path d="M8 10.5c0-3 2-5 4-7 0 3 2 4 2 6.5s-1.8 4-4 4-2-1.7-2-3.5Z" /></>,
  shopping: <><path d="M6.5 8V6a3.5 3.5 0 0 1 7 0v2" /><path d="M4.5 8h11l1 12.5h-13L4.5 8Z" /></>,
  wine: <><path d="M7 3.5h10l-1 6a4 4 0 0 1-8 0l-1-6Z" /><path d="M12 13.5V20 M8 20.5h8" /></>,
  pencil: <><path d="M4 20.5 4.7 16.8 16 5.5a1.8 1.8 0 0 1 2.5 0l0.3.3a1.8 1.8 0 0 1 0 2.5L7.5 19.8 4 20.5Z" /><path d="M14.3 7.2 16.8 9.7" /></>,
  plate: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.3" /></>,
  confetti: <><rect x="4" y="4" width="3" height="3" transform="rotate(15 5.5 5.5)" /><circle cx="18" cy="6" r="1.4" /><rect x="16" y="16" width="3" height="3" transform="rotate(20 17.5 17.5)" /><circle cx="5" cy="18" r="1.4" /><path d="M11 3v3 M11 18v3" /></>,
  candle: <><rect x="9.5" y="7.5" width="5" height="13" rx="1" /><path d="M12 3.2c-1.1 1-1.1 2.1 0 3.1 1.1-1 1.1-2.1 0-3.1Z" /><path d="M9.5 12h5" /></>,
  folder: <path d="M3.5 6.5h6l2 2.2h9v11H3.5V6.5Z" />,
  scroll: <><path d="M6.5 3.5h11v14a2.5 2.5 0 0 1-2.5 2.5h-6a2.5 2.5 0 0 1-2.5-2.5V3.5Z" /><path d="M6.5 3.5a2.5 2.5 0 0 0-2.5 2.5v0a2.5 2.5 0 0 0 2.5 2.5 M17.5 20a2.5 2.5 0 0 0 2.5-2.5v-9" /><path d="M9 9h6 M9 12.5h6" /></>,
  document: <><path d="M6 3h8l4 4v14H6V3Z" /><path d="M14 3v4h4" /><path d="M8.5 12.5h7 M8.5 16h7" /></>,
  check: <><circle cx="12" cy="12" r="8.5" /><path d="M8 12.3 10.8 15 16 9.5" /></>,
  cross: <><circle cx="12" cy="12" r="8.5" /><path d="M9 9l6 6M15 9l-6 6" /></>,
  warning: <><path d="M12 3.5 21.5 20h-19L12 3.5Z" /><path d="M12 10v4.2" /><circle cx="12" cy="17" r="0.15" fill="currentColor" /></>,
  noSignal: <><path d="M3 3l18 18" /><path d="M5 12.5a11 11 0 0 1 4-2.5 M9.5 8.3A15 15 0 0 1 19 5.5 M2 8.5A15 15 0 0 1 6.5 6" /><path d="M8.5 16a5.5 5.5 0 0 1 5-1.5" /><circle cx="12" cy="20" r="1" /></>,
  stop: <rect x="5" y="5" width="14" height="14" rx="3" />,
  envelope: <><rect x="3" y="5.5" width="18" height="13" rx="1.6" /><path d="M3.5 6.5 12 13 20.5 6.5" /></>,
  medal: <><circle cx="12" cy="15" r="5.5" /><path d="M9.5 10 7 3.5h3L12 8l2-4.5h3L14.5 10" /><path d="M12 12.5 13 15l1.7.2-1.3 1.1.4 1.7-1.8-1-1.8 1 .4-1.7-1.3-1.1L11 15l1-2.5Z" /></>,
  rocket: <><path d="M12 2.5c3 1.7 4.5 5 4.5 8.5 0 3-1.5 6-4.5 10.5-3-4.5-4.5-7.5-4.5-10.5 0-3.5 1.5-6.8 4.5-8.5Z" /><circle cx="12" cy="10.5" r="1.8" /><path d="M8 16.5 5 19.5 M16 16.5l3 3 M9 20.5l-1.5 1.5 M15 20.5l1.5 1.5" /></>,
  emptyMailbox: <><path d="M3.5 7.5A2 2 0 0 1 5.5 5.5h13a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-9Z" /><path d="M4 7.5 12 13l8-5.5" strokeDasharray="1.6 2" /></>,
  dove: <><path d="M3 13.5c2.5-3 5.3-3.6 7.5-2.2" /><path d="M10.5 11.3C11.5 7 15 4 19.5 4c-1 3-1 5.5.5 7.5-2.5 1.3-5 1-6.7-.6" /><path d="M10.5 11.3c1.2 1.7 1.2 4-.3 6.2-2 .2-4-.5-5.2-2.2" /><circle cx="16.3" cy="7" r="0.4" fill="currentColor" /></>,
  rings: <><circle cx="9" cy="14" r="5.4" /><circle cx="15" cy="14" r="5.4" /></>,
  palette: <><path d="M12 3.5a8.5 8.5 0 1 0 0 17c1 0 1.7-.8 1.7-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.7-1.7 1.7-1.7h1.8a3.8 3.8 0 0 0 3.8-3.8c0-4-3.7-7.4-8-7.4Z" /><circle cx="8.3" cy="10.5" r="1.1" fill="currentColor" stroke="none" /><circle cx="12" cy="7.8" r="1.1" fill="currentColor" stroke="none" /><circle cx="16" cy="9.8" r="1.1" fill="currentColor" stroke="none" /><circle cx="8" cy="14.8" r="1.1" fill="currentColor" stroke="none" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 3.5v2.3 M12 18.2v2.3 M20.5 12h-2.3 M5.8 12H3.5 M18 6 16.4 7.6 M7.6 16.4 6 18 M18 18l-1.6-1.6 M7.6 7.6 6 6" /></>,
  gallery: <><rect x="3" y="4.5" width="18" height="15" rx="2" /><circle cx="8.3" cy="9.5" r="1.8" /><path d="M3 16.5 8 12l3 2.5 4-4 6 5.5" /></>,
  map: <><path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4Z" /><path d="M9 4v14 M15 6v14" /></>,
  info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.5" /><circle cx="12" cy="7.8" r="0.15" fill="currentColor" /></>,
  sun: <><circle cx="12" cy="12" r="4.2" /><path d="M12 3v2.2 M12 18.8V21 M3 12h2.2 M18.8 12H21 M5.6 5.6l1.6 1.6 M16.8 16.8l1.6 1.6 M5.6 18.4l1.6-1.6 M16.8 7.2l1.6-1.6" /></>,
  play: <path d="M6.5 4.5v15l13-7.5-13-7.5Z" />,
};

export default function Icon({ name, size = 17, color = 'currentColor', strokeWidth = 1.5, style }) {
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
      style={style}
    >
      {path}
    </svg>
  );
}
