import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import AdultsOnlyNotice from '../src/app/components/guest/AdultsOnlyNotice';

/**
 * The notice a guest sees on the RSVP form when the organizer has switched on
 * "Adults-Only Notice" (`events.no_kids_allowed`).
 *
 * Rendered here in isolation. Whether each of the two RSVP forms actually
 * renders it — and whether the API sends the flag at all — is pinned separately
 * by `backend/test/adultsOnlyReachesGuest.test.js`, because those are missing
 * lines in other files rather than behaviour of this one.
 */
describe('AdultsOnlyNotice', () => {
  it('states the rule and what to do about it', () => {
    const { container } = render(<AdultsOnlyNotice />);
    const text = container.textContent;
    expect(text).toContain('An adults-only celebration');
    // The actionable half. A heading alone leaves the guest to infer whether it
    // applies to the number they are about to pick.
    expect(text).toContain('Please count adults only');
  });

  it('speaks Arabic when the guest does', () => {
    const { container } = render(<AdultsOnlyNotice isRTL />);
    expect(container.textContent).toContain('دعوة خاصة بالكبار فقط');
    expect(container.firstChild.getAttribute('dir')).toBe('rtl');
  });

  /**
   * NOT asserted through the rendered style attribute.
   *
   * The tint is `${themeColor}12` — 8-digit #RRGGBBAA, the notation this
   * codebase uses everywhere for a translucent brand wash. Every browser
   * accepts it; jsdom's CSS parser does not, and silently DROPS the whole
   * declaration, so reading `style` here would test the parser rather than the
   * component. The glyph inherits the same colour via `currentColor`, which
   * jsdom does keep, so that is what gets checked — and the two are set from
   * the one prop. `backend/test/adultsOnlyReachesGuest.test.js` pins the source.
   *
   * Compared as rgb(), not as the hex that was passed in: jsdom normalises
   * `color` on the way into the style declaration, so a substring check for
   * "7a1f3d" fails against a component that is behaving perfectly.
   */
  it('carries the event colour rather than a hardcoded gold', () => {
    // Every guest surface recolours per event; a fixed gold panel on a burgundy
    // or midnight palette is the tell that a component was bolted on.
    const { container } = render(<AdultsOnlyNotice themeColor="#7A1F3D" />);
    const glyphHost = container.querySelector('span[aria-hidden]');
    expect(glyphHost.style.color).toBe('rgb(122, 31, 61)');
  });

  it('is announced as a note, not read as a form control', () => {
    const { container } = render(<AdultsOnlyNotice />);
    expect(container.firstChild.getAttribute('role')).toBe('note');
  });
});
