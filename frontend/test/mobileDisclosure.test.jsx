import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import React from 'react';
import MobileDisclosure from '../src/app/dashboard/components/MobileDisclosure';

/* ═══════════════════════════════════════════════════════════════════════════
   THE COLLAPSE MUST NOT COST ANYTHING.

   This component's whole justification is that a phone leads with content while
   a desktop is untouched. Two ways that goes wrong, and both are invisible:

     1. The chrome is rendered TWICE — once as a summary, once as the real
        thing — and the two drift. That is the bug the guest-list export had
        (three copies, two different files), so the test below pins that the
        children are rendered exactly once and are the caller's own markup.
     2. Something is genuinely lost. Collapsing the stat tiles would be
        unacceptable if the tiles were the only way to reach the filter — so the
        expanded body has to contain the real, interactive children, not a
        static summary of them.

   What these CANNOT check is the media query: jsdom has no layout engine, so
   "hidden below md, forced visible above" is enforced by the class names being
   correct here plus the rules existing in globals.css, which is asserted at the
   bottom.
   ═══════════════════════════════════════════════════════════════════════════ */

function Tiles({ onPick = () => {} }) {
  return (
    <div style={{ display: 'grid' }}>
      <button type="button" onClick={() => onPick('accepted')}>Accepted 84</button>
      <button type="button" onClick={() => onPick('pending')}>Pending 12</button>
    </div>
  );
}

describe('MobileDisclosure', () => {
  it('renders the summary and the chrome exactly once each', () => {
    render(
      <MobileDisclosure summary="120 guests · 84 accepted" label="Guest counts">
        <Tiles />
      </MobileDisclosure>,
    );

    expect(screen.getByText(/120 guests/)).toBeInTheDocument();
    // One copy of the real children — not a mobile duplicate beside a desktop one.
    expect(screen.getAllByText('Accepted 84')).toHaveLength(1);
  });

  it('the chrome is the caller’s own interactive markup, not a rendering of it', () => {
    // If the tiles were re-described rather than passed through, the filter they
    // carry would silently stop working on a phone.
    const onPick = vi.fn();
    render(
      <MobileDisclosure summary="…" label="Guest counts">
        <Tiles onPick={onPick} />
      </MobileDisclosure>,
    );

    fireEvent.click(screen.getByText('Pending 12'));
    expect(onPick).toHaveBeenCalledWith('pending');
  });

  it('starts collapsed and toggles, reporting state to assistive tech', () => {
    const { container } = render(
      <MobileDisclosure summary="120 guests" label="Guest counts">
        <Tiles />
      </MobileDisclosure>,
    );

    const toggle = screen.getByRole('button', { name: /details/i });
    const body = container.querySelector('.fx-disclose__body');

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(body.className).not.toContain('--open');

    fireEvent.click(toggle);

    expect(screen.getByRole('button', { name: /hide/i })).toHaveAttribute('aria-expanded', 'true');
    expect(container.querySelector('.fx-disclose__body').className).toContain('--open');
  });

  it('points the toggle at the body it controls', () => {
    const { container } = render(
      <MobileDisclosure summary="120 guests" label="Guest counts">
        <Tiles />
      </MobileDisclosure>,
    );

    const toggle = screen.getByRole('button', { name: /details/i });
    const body = container.querySelector('.fx-disclose__body');
    expect(toggle.getAttribute('aria-controls')).toBe(body.id);
    expect(body.id).toBeTruthy();
  });

  it('names the collapsed region, so it is not an unlabelled group', () => {
    render(
      <MobileDisclosure summary="120 guests" label="Guest counts and filters">
        <Tiles />
      </MobileDisclosure>,
    );
    expect(screen.getByRole('group', { name: 'Guest counts and filters' })).toBeInTheDocument();
  });

  it('the toggle is a full-size touch target', () => {
    render(<MobileDisclosure summary="x" label="y"><Tiles /></MobileDisclosure>);
    const toggle = screen.getByRole('button', { name: /details/i });
    // The token, not a literal — so raising --fx-touch raises this with it.
    expect(toggle.style.minHeight).toBe('var(--fx-touch)');
  });

  it('carries no inline display on the body, which would beat the media rules', () => {
    // The single way this component can silently stop working: an inline
    // `display` on the wrapper outranks `.fx-disclose__body`, so the chrome
    // would either never hide on a phone or never show on a desktop.
    const { container } = render(
      <MobileDisclosure summary="x" label="y"><Tiles /></MobileDisclosure>,
    );
    const body = container.querySelector('.fx-disclose__body');
    expect(body.style.display).toBe('');
  });
});

describe('the stylesheet half of the contract', () => {
  it('globals.css hides the body below md and forces it visible above', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const here = path.dirname(fileURLToPath(import.meta.url));
    const css = fs.readFileSync(path.join(here, '..', 'src', 'app', 'globals.css'), 'utf8');

    expect(css).toMatch(/\.fx-disclose__body \{ display: none; \}/);
    expect(css).toMatch(/\.fx-disclose__body--open \{ display: block/);
    // The !important is load-bearing: `open` is React state and may be false at
    // a desktop width, where the chrome must show regardless.
    expect(css).toMatch(/\.fx-disclose__body \{ display: block !important; \}/);
    expect(css).toMatch(/\.fx-disclose__summary \{ display: none !important; \}/);
  });

  it('the sticky selection bar clears the mobile nav bar and reverts at lg', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const here = path.dirname(fileURLToPath(import.meta.url));
    const css = fs.readFileSync(path.join(here, '..', 'src', 'app', 'globals.css'), 'utf8');

    // Anchored on the RULE, not the first mention — the docblock above it names
    // the class too, and slicing from there swallows the comment instead.
    const block = css.slice(css.indexOf('.fx-sticky-actions {'));
    expect(block).toMatch(/position: sticky/);
    // 60px is the bottom bar; the safe-area inset is the home indicator under it.
    expect(block).toMatch(/bottom: calc\(60px \+ env\(safe-area-inset-bottom\)/);
    // lg, not md — the bottom bar itself only exists below 1023.98px, so the
    // sticky behaviour has to revert on exactly the viewports where that bar is
    // gone. Asserted as two facts rather than one span: the distance between
    // them is a comment whose length is nobody's business.
    // `block` runs to the end of the file, so only positive assertions are
    // meaningful here — a "not md" check would trip over every later md rule in
    // the stylesheet rather than saying anything about this one.
    expect(block).toMatch(/@media \(width >= theme\(--breakpoint-lg\)\)/);
    expect(block).toMatch(/\.fx-sticky-actions \{ position: static; \}/);
  });
});
