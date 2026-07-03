/* Shared Title/First/Last name helpers for the RSVP wizard (host + companions). */

export const TITLE_OPTIONS = ['Mr', 'Mrs', 'Ms', 'Dr', 'Child'];
export const KNOWN_TITLES = new Set(['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Child', 'Mr', 'Mrs', 'Ms', 'Dr']);

/** Parse "Title. First Last" / "Title First Last" / "First Last" into 3 parts. */
export function splitName(fullName) {
  const parts = (fullName || '').split(' ').filter(Boolean);
  if (parts.length === 0) return { title: '', first: '', last: '' };
  const head = parts[0];
  const isTitle = KNOWN_TITLES.has(head);
  if (isTitle) {
    const t = head.endsWith('.') ? head : head + '.';
    return { title: t === 'Child.' ? 'Child' : t, first: parts[1] || '', last: parts.slice(2).join(' ') };
  }
  return { title: '', first: parts[0] || '', last: parts.slice(1).join(' ') };
}

export function joinName(title, first, last) {
  const t = title ? `${title} ` : '';
  return `${t}${first} ${last}`.replace(/\s+/g, ' ').trim();
}
