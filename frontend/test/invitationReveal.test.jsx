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
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onComplete = vi.fn();
    renderReveal({ onComplete });
    await waitFor(() => expect(seal()).toBeEnabled());

    await act(async () => { seal().click(); seal().click(); });
    expect(onComplete).not.toHaveBeenCalled();       // the animation still has to run
    await act(async () => { vi.advanceTimersByTime(4000); });
    expect(onComplete).toHaveBeenCalledTimes(1);
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

  it('moves focus onto the seal once the artwork is ready', async () => {
    renderReveal();
    await waitFor(() => expect(seal()).toHaveFocus());
  });
});
