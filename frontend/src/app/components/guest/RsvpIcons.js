'use client';

/**
 * Line-art icon set for the guest RSVP flow — replaces the native-emoji icons
 * previously used there (rendering is inconsistent across iOS/Android/Windows
 * and reads as a lower-quality, less considered surface than the rest of the
 * app's own SVG iconography). Same 24x24, round-cap/join stroke style used
 * throughout the rest of the product.
 */

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export function CelebrateIcon({ size = 24, color = 'currentColor', strokeWidth = 1.6 }) {
  return (
    <svg width={size} height={size} {...base} stroke={color} strokeWidth={strokeWidth}>
      <path d="M12 2.5l1.8 4.6 4.9.6-3.7 3.3 1.1 4.8L12 13.4l-4.1 2.4 1.1-4.8-3.7-3.3 4.9-.6z" />
      <path d="M4 20l1.2-1.2M20 20l-1.2-1.2M4.5 4.5l1 1M19.5 4.5l-1 1" opacity="0.55" />
    </svg>
  );
}

export function ClockIcon({ size = 24, color = 'currentColor', strokeWidth = 1.6 }) {
  return (
    <svg width={size} height={size} {...base} stroke={color} strokeWidth={strokeWidth}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

export function EnvelopeIcon({ size = 24, color = 'currentColor', strokeWidth = 1.6 }) {
  return (
    <svg width={size} height={size} {...base} stroke={color} strokeWidth={strokeWidth}>
      <rect x="3" y="5.5" width="18" height="13" rx="1.8" />
      <path d="M3.5 6.5L12 13l8.5-6.5" />
    </svg>
  );
}

export function BoltIcon({ size = 24, color = 'currentColor', strokeWidth = 1.6 }) {
  return (
    <svg width={size} height={size} {...base} stroke={color} strokeWidth={strokeWidth}>
      <path d="M12.5 2.5L5 14h5.5L11 21.5 19 10h-5.5z" />
    </svg>
  );
}

export function CalendarIcon({ size = 24, color = 'currentColor', strokeWidth = 1.6 }) {
  return (
    <svg width={size} height={size} {...base} stroke={color} strokeWidth={strokeWidth}>
      <rect x="3.5" y="4.5" width="17" height="16" rx="1.8" />
      <path d="M3.5 9.5h17M8 2.5v4M16 2.5v4" />
      <circle cx="8.2" cy="14" r="0.9" fill={color} stroke="none" />
      <circle cx="12" cy="14" r="0.9" fill={color} stroke="none" />
      <circle cx="15.8" cy="14" r="0.9" fill={color} stroke="none" />
    </svg>
  );
}

export function PlaneIcon({ size = 24, color = 'currentColor', strokeWidth = 1.6 }) {
  return (
    <svg width={size} height={size} {...base} stroke={color} strokeWidth={strokeWidth}>
      <path d="M21.5 2.5L11 13" />
      <path d="M21.5 2.5l-6.9 19-4-9-9-4 19.9-6z" />
    </svg>
  );
}

export function ClipboardIcon({ size = 24, color = 'currentColor', strokeWidth = 1.6 }) {
  return (
    <svg width={size} height={size} {...base} stroke={color} strokeWidth={strokeWidth}>
      <rect x="5.5" y="4.5" width="13" height="16.5" rx="1.8" />
      <rect x="9" y="2.5" width="6" height="3.5" rx="1" />
      <path d="M8.5 11h7M8.5 14.5h7M8.5 18h4.5" />
    </svg>
  );
}

export function HeartPulseIcon({ size = 24, color = 'currentColor', strokeWidth = 1.6 }) {
  return (
    <svg width={size} height={size} {...base} stroke={color} strokeWidth={strokeWidth}>
      <path d="M12 20s-7.2-4.6-9.6-9.3C.8 7.4 2.5 4 6 4c2 0 3.5 1.1 4.3 2.6L12 8.6l1.7-2C14.5 5.1 16 4 18 4c3.5 0 5.2 3.4 3.6 6.7C19.2 15.4 12 20 12 20z" />
      <path d="M4 12h2.4l1.4-2.4 1.6 4.3 1.3-3.4 1 1.5h2.6" />
    </svg>
  );
}

export function DotsIcon({ size = 24, color = 'currentColor', strokeWidth = 1.6 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
      <circle cx="6" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="18" cy="12" r="1.8" />
    </svg>
  );
}

export function CheckIcon({ size = 24, color = 'currentColor', strokeWidth = 2 }) {
  return (
    <svg width={size} height={size} {...base} stroke={color} strokeWidth={strokeWidth}>
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  );
}

export function LinkIcon({ size = 24, color = 'currentColor', strokeWidth = 1.6 }) {
  return (
    <svg width={size} height={size} {...base} stroke={color} strokeWidth={strokeWidth}>
      <path d="M10 14a4.5 4.5 0 006.4 0l2.6-2.6a4.5 4.5 0 00-6.4-6.4L11 6.5" />
      <path d="M14 10a4.5 4.5 0 00-6.4 0L5 12.6a4.5 4.5 0 006.4 6.4L13 17.5" />
    </svg>
  );
}

export function MapPinIcon({ size = 24, color = 'currentColor', strokeWidth = 1.6 }) {
  return (
    <svg width={size} height={size} {...base} stroke={color} strokeWidth={strokeWidth}>
      <path d="M12 21.5S4.5 14.8 4.5 9.8a7.5 7.5 0 0115 0c0 5-7.5 11.7-7.5 11.7z" />
      <circle cx="12" cy="9.6" r="2.6" />
    </svg>
  );
}

export function PeopleIcon({ size = 24, color = 'currentColor', strokeWidth = 1.6 }) {
  return (
    <svg width={size} height={size} {...base} stroke={color} strokeWidth={strokeWidth}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19c.6-3.4 3-5.2 5.5-5.2s4.9 1.8 5.5 5.2" />
      <path d="M15.3 5.2a3.2 3.2 0 010 5.9M19 19c-.4-2.3-1.5-3.9-3-4.7" />
    </svg>
  );
}

export function UtensilsIcon({ size = 24, color = 'currentColor', strokeWidth = 1.6 }) {
  return (
    <svg width={size} height={size} {...base} stroke={color} strokeWidth={strokeWidth}>
      <path d="M5 3v5M7 3v5M9 3v5M7 8v13" />
      <path d="M16.5 3c-1.6.6-2.7 2.3-2.7 4.4 0 1.8 1 3.3 2.2 3.9V21" />
    </svg>
  );
}

export function WarningIcon({ size = 24, color = 'currentColor', strokeWidth = 1.6 }) {
  return (
    <svg width={size} height={size} {...base} stroke={color} strokeWidth={strokeWidth}>
      <path d="M12 3.5l9.5 16.5H2.5z" />
      <path d="M12 9.8v4.2" />
      <circle cx="12" cy="17" r="0.9" fill={color} stroke="none" />
    </svg>
  );
}

export function LockIcon({ size = 24, color = 'currentColor', strokeWidth = 1.6 }) {
  return (
    <svg width={size} height={size} {...base} stroke={color} strokeWidth={strokeWidth}>
      <rect x="4.5" y="10.5" width="15" height="10.5" rx="2" />
      <path d="M7.5 10.5V7.2a4.5 4.5 0 0 1 9 0v3.3" />
      <circle cx="12" cy="15" r="1.4" fill={color} stroke="none" />
      <path d="M12 16.4v2.1" />
    </svg>
  );
}

export function CreditCardIcon({ size = 24, color = 'currentColor', strokeWidth = 1.6 }) {
  return (
    <svg width={size} height={size} {...base} stroke={color} strokeWidth={strokeWidth}>
      <rect x="2.5" y="5.5" width="19" height="13" rx="2" />
      <path d="M2.5 9.8h19" />
      <path d="M6 14.5h4" />
    </svg>
  );
}

export function SearchIcon({ size = 24, color = 'currentColor', strokeWidth = 1.6 }) {
  return (
    <svg width={size} height={size} {...base} stroke={color} strokeWidth={strokeWidth}>
      <circle cx="10.8" cy="10.8" r="7.3" />
      <path d="M20.5 20.5l-4.8-4.8" />
    </svg>
  );
}

export function DoorIcon({ size = 24, color = 'currentColor', strokeWidth = 1.6 }) {
  return (
    <svg width={size} height={size} {...base} stroke={color} strokeWidth={strokeWidth}>
      <rect x="5.5" y="2.5" width="13" height="19" rx="1" />
      <circle cx="14.2" cy="12.5" r="0.9" fill={color} stroke="none" />
    </svg>
  );
}

export function PencilIcon({ size = 24, color = 'currentColor', strokeWidth = 1.6 }) {
  return (
    <svg width={size} height={size} {...base} stroke={color} strokeWidth={strokeWidth}>
      <path d="M15.2 4.2l4.6 4.6L7.5 21.1l-5 .9.9-5z" />
      <path d="M13.1 6.3l4.6 4.6" />
    </svg>
  );
}
