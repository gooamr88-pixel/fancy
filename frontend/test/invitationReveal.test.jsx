import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

/* framer-motion's useReducedMotion resolves the media query ONCE per module
   load and caches the subscription, so swapping window.matchMedia between
   tests does nothing — the first test to run decides for all of them. Mocking
   the hook itself is the only way to exercise both paths in one file. The
   rest of framer-motion is passed through untouched, because the component
   renders real motion.div elements. */
let reducedMotion = false;
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reducedMotion };
});

const InvitationReveal = (await import('../src/app/components/guest/InvitationReveal')).default;

/* ═══════════════════════════════════════════════════════════════════════════
   InvitationReveal — the contract.

   Everything asserted here is a promise the component's own header comment
   makes to its callers, plus the behaviours that silently break a guest if
   they regress. Deliberately NOT asserted: layout, colour, timing curves —
   jsdom has no layout engine, and a test that claimed to check those would be
   worse than none.

   The failure mode each test guards against is named in its title, because a
   test whose name only describes the mechanism tells a future reader nothing
   about why it may not be deleted.
   ═══════════════════════════════════════════════════════════════════════════ */

const EVENT = {
  slug: 'demo',                 // keeps useGuestAnalytics from firing beacons
  title: 'Aria & Julian',
  event_date: '2026-10-24T16:00:00.000Z',
  custom_colors: { primary: '#5f8154', secondary: '#c6a24d' },
  template_data: { seal_text: 'AJ' },
};

const setReducedMotion = (on) => { reducedMotion = on; };

const renderReveal = (props = {}) =>
  render(<InvitationReveal event={EVENT} onComplete={() => {}} {...props} />);

/* The seal is the only way forward, so every interaction test needs it. */
const seal = () => screen.getByRole('button', { name: /tap to open/i });

describe('InvitationReveal — caller contract', () => {
  beforeEach(() => { vi.useRealTimers(); setReducedMotion(false); });

  it('exposes the test ids its own contract promises', async () => {
    renderReveal();
    expect(screen.getByTestId('guest-envelope-reveal')).toBeInTheDocument();
    expect(screen.getByTestId('guest-envelope-skip')).toBeInTheDocument();
  });

  it('is a labelled modal dialog — without this a screen reader announces nothing', () => {
    renderReveal();
    const root = screen.getByTestId('guest-envelope-reveal');
    expect(root).toHaveAttribute('role', 'dialog');
    expect(root).toHaveAttribute('aria-modal', 'true');
    expect(root).toHaveAccessibleName();
  });

  it('calls onComplete exactly once when skipped — a second call re-dismisses a page the guest is already reading', async () => {
    const onComplete = vi.fn();
    renderReveal({ onComplete });
    const user = userEvent.setup();
    const skip = screen.getByTestId('guest-envelope-skip');
    await user.click(skip);
    await user.click(skip);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('calls onComplete exactly once after the seal is tapped, however many times it is tapped', async () => {
    const onComplete = vi.fn();
    renderReveal({ onComplete });

    // Waiting for the seal is load-bearing, and worth understanding: the
    // component injects its own <style>, jsdom applies it, and the artboard is
    // visibility:hidden until the artwork has decoded — so until then the seal
    // is genuinely absent from the accessibility tree and getByRole cannot
    // (and should not) find it. That is the a11y gate working.
    //
    // This wait runs on REAL timers on purpose. Doing it under fake ones is
    // what made this test pass alone and time out whenever the suite ran in
    // parallel: waitFor's poller and a faked clock advance independently, so
    // the poll can outlive the test without the gate ever resolving. Fake
    // timers are installed only for the part that actually needs them — the
    // handoff delay after the tap.
    await waitFor(() => expect(seal()).toBeEnabled());

    vi.useFakeTimers();
    await act(async () => { seal().click(); seal().click(); });
    expect(onComplete).not.toHaveBeenCalled();       // the animation still has to run
    await act(async () => { vi.advanceTimersByTime(4000); });
    expect(onComplete).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

describe('InvitationReveal — per-session memory', () => {
  beforeEach(() => setReducedMotion(false));
  it('replays when given no sessionKey (the invitation page default)', () => {
    const onComplete = vi.fn();
    const { unmount } = renderReveal({ onComplete });
    unmount();
    renderReveal({ onComplete });
    expect(screen.getByTestId('guest-envelope-reveal')).toBeInTheDocument();
  });

  it('with a sessionKey, a second visit completes immediately and renders nothing', async () => {
    const first = vi.fn();
    const { unmount } = renderReveal({ sessionKey: 'my-event', onComplete: first });
    // Finishing is what writes the "seen" flag.
    await userEvent.setup().click(screen.getByTestId('guest-envelope-skip'));
    unmount();

    const second = vi.fn();
    renderReveal({ sessionKey: 'my-event', onComplete: second });
    await waitFor(() => expect(second).toHaveBeenCalled());
    expect(screen.queryByTestId('guest-envelope-reveal')).not.toBeInTheDocument();
  });

  it('scopes that memory to the key — a different event still gets its own envelope', async () => {
    const { unmount } = renderReveal({ sessionKey: 'event-a', onComplete: vi.fn() });
    await userEvent.setup().click(screen.getByTestId('guest-envelope-skip'));
    unmount();

    renderReveal({ sessionKey: 'event-b', onComplete: vi.fn() });
    expect(screen.getByTestId('guest-envelope-reveal')).toBeInTheDocument();
  });
});

describe('InvitationReveal — reduced motion', () => {
  beforeEach(() => setReducedMotion(true));
  it('serves the static card, and it is still a complete way through', async () => {
    const onComplete = vi.fn();
    renderReveal({ onComplete });

    // No wax to tap on this path; the card's own call to action is the way on.
    expect(screen.queryByRole('button', { name: /tap to open/i })).not.toBeInTheDocument();
    const enter = screen.getByRole('button', { name: /view invitation/i });
    await userEvent.setup().click(enter);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('keeps the skip control on the reduced-motion path too', () => {
    renderReveal();
    expect(screen.getByTestId('guest-envelope-skip')).toBeInTheDocument();
  });
});

describe('InvitationReveal — the monogram', () => {
  beforeEach(() => setReducedMotion(false));
  it("engraves the organizer's own seal text when they set one", () => {
    renderReveal();
    expect(screen.getByText('AJ')).toBeInTheDocument();
  });

  it('falls back to initials derived from the event when the field is blank', () => {
    renderReveal({ event: { ...EVENT, template_data: {} } });
    expect(screen.getByText('AJ')).toBeInTheDocument();   // Aria & Julian
  });

  it('never renders an empty seal, even with nothing to derive from', () => {
    renderReveal({ event: { slug: 'demo', template_data: {} } });
    const svgText = document.querySelector('.ir3-sl text');
    expect(svgText?.textContent?.trim()).toBeTruthy();
  });
});

describe('InvitationReveal — keyboard', () => {
  beforeEach(() => setReducedMotion(false));
  it('Escape skips — the overlay covers the page and must not be a dead end', async () => {
    const onComplete = vi.fn();
    renderReveal({ onComplete });
    await userEvent.setup().keyboard('{Escape}');
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('does not hijack Escape when embedded, where it belongs to the surrounding form', async () => {
    const onComplete = vi.fn();
    renderReveal({ embedded: true, onComplete });
    await userEvent.setup().keyboard('{Escape}');
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('moves focus into the dialog once the artwork is ready, without ringing the seal', async () => {
    renderReveal();
    // The DIALOG, not the seal: focusing the control directly made browsers
    // paint its focus ring for every guest, keyboard user or not.
    await waitFor(() => expect(screen.getByTestId('guest-envelope-reveal')).toHaveFocus());
    expect(seal()).not.toHaveFocus();
  });

  it('keeps the seal reachable by Tab from there', async () => {
    renderReveal();
    await waitFor(() => expect(screen.getByTestId('guest-envelope-reveal')).toHaveFocus());
    await userEvent.setup().tab();
    // Focus has left the container and landed on something operable inside it.
    expect(document.activeElement).not.toBe(document.body);
    expect(screen.getByTestId('guest-envelope-reveal')).toContainElement(document.activeElement);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   THE ADDRESSEE — the guest's own name on the face of the envelope.

   An SMS invitation links to `/{slug}?party_id=…`, which resolves to one named
   person. Before this, that name reached only the reduced-motion card, as a
   10.5px letterspaced "Welcome, X" — the ANIMATED envelope, which is what all
   but a handful of guests see, printed it nowhere. A text sent to one person
   opened exactly the same envelope as a link pasted in a group chat.

   These tests are about WHICH NAME IS SHOWN and WHEN, not about how it looks:
   jsdom has no layout engine, so anything asserting size or position here would
   be claiming a check it cannot make.
   ═══════════════════════════════════════════════════════════════════════════ */
describe('InvitationReveal — the addressee', () => {
  beforeEach(() => { vi.useRealTimers(); setReducedMotion(false); });

  it('prints the guest name on the ANIMATED envelope, not only on the static card', () => {
    renderReveal({ guestName: 'Sarah Ahmed El-Sayed' });
    expect(screen.getByText('Sarah Ahmed El-Sayed')).toBeInTheDocument();
  });

  it('prints it on the reduced-motion card too — that guest is not a lesser guest', () => {
    setReducedMotion(true);
    renderReveal({ guestName: 'Sarah Ahmed El-Sayed' });
    expect(screen.getByText('Sarah Ahmed El-Sayed')).toBeInTheDocument();
  });

  it.each([false, true])('shows no addressee at all on a shared link (reducedMotion=%s)', (rm) => {
    setReducedMotion(rm);
    renderReveal({ guestName: '' });
    // A link with no party has no addressee. Printing "For Esteemed Guest" would
    // turn the absence of personalisation into a visible apology for it.
    expect(screen.queryByText(/^For$/)).not.toBeInTheDocument();
    // …and the generic eyebrow is what stands in, so the card is never blank.
    if (rm) expect(screen.getByText('You are invited')).toBeInTheDocument();
  });

  it('treats a whitespace-only name as no name, rather than addressing an empty line', () => {
    renderReveal({ guestName: '   ' });
    expect(screen.queryByText(/^For$/)).not.toBeInTheDocument();
  });

  it('collapses the stray whitespace a CSV always arrives with', () => {
    renderReveal({ guestName: '  Sarah   Ahmed  ' });
    expect(screen.getByText('Sarah Ahmed')).toBeInTheDocument();
  });

  it('cuts an over-long name at a word boundary instead of letting it run off the paper', () => {
    // Guest lists contain whole sentences. Two lines of script is the most the
    // envelope face can hold before it stops reading as an address.
    const long = 'Alexandria Wilhelmina Fitzgerald Montgomery Beaumont The Third';
    renderReveal({ guestName: long });

    const shown = screen.getByText(/^Alexandria/).textContent;
    expect(shown.length).toBeLessThanOrEqual(47); // 46 + the ellipsis
    expect(shown.endsWith('…')).toBe(true);
    expect(shown).not.toContain('  ');
    // Cut between words, so no half-word is left hanging before the ellipsis.
    expect(long).toContain(shown.slice(0, -1).trim());
  });

  it('keeps a name that is exactly at the limit whole, with no ellipsis', () => {
    const exact = 'A'.repeat(46);
    renderReveal({ guestName: exact });
    expect(screen.getByText(exact)).toBeInTheDocument();
  });

  /* ── The font has to follow the NAME, not the page language ────────────── */

  it('renders an Arabic name in the Arabic face even while the page is in English', () => {
    // The common case for this product, not an edge one: an Egyptian organizer's
    // list is full of Arabic names while the page language is still English. The
    // script face carries no Arabic glyphs, so keying off the page language would
    // render exactly those names as fallback boxes.
    renderReveal({ guestName: 'سارة أحمد' });
    const el = screen.getByText('سارة أحمد');
    expect(el.className).toContain('is-ar');
  });

  it('renders a Latin name in the script face', () => {
    renderReveal({ guestName: 'Sarah Ahmed' });
    expect(screen.getByText('Sarah Ahmed').className).not.toContain('is-ar');
  });
});
