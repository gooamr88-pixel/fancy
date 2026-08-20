import React, { useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
import { useModalA11y } from '../src/app/hooks/useModalA11y';

/* ═══════════════════════════════════════════════════════════════════════════
   YOU MUST BE ABLE TO TYPE IN A MODAL.

   useModalA11y's effect used to depend on [isOpen, onClose]. Every caller in
   this app passes an inline `onClose={() => setOpen(false)}`, so the identity
   changed on every render of the parent — and a modal form re-renders its
   parent on every keystroke. React therefore tore the effect down and re-ran
   it per character: the teardown restored focus to the element that opened the
   modal, the re-run focused the dialog's first focusable child, and the field
   being typed into lost focus after every letter.

   Reported against the shop's "Add a piece" form; it affected all sixteen
   modals that use this hook, Edit guest and Import guests included.

   The first test below is the regression. It fails on the old dependency
   array — verified by reverting the hook, not assumed.
   ═══════════════════════════════════════════════════════════════════════════ */

afterEach(cleanup);

/** A modal whose parent re-renders on every keystroke — i.e. every real one. */
function Harness({ onCloseSpy }) {
  const [open, setOpen] = useState(true);
  const [value, setValue] = useState('');

  // Inline arrow, recreated every render. This is what every caller does, and
  // reproducing it is the entire point of the harness.
  const dialogRef = useModalA11y(open, {
    onClose: () => { setOpen(false); onCloseSpy?.(); },
  });

  if (!open) return <div>closed</div>;
  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" tabIndex={-1}>
      <button type="button">Close</button>
      <input
        aria-label="Title"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    </div>
  );
}

describe('typing inside a modal', () => {
  it('keeps focus in the field across many keystrokes', async () => {
    render(<Harness />);
    const input = screen.getByLabelText('Title');

    input.focus();
    expect(document.activeElement).toBe(input);

    // One rAF tick, so the hook's initial-focus frame has already fired and
    // cannot be blamed for a later focus change.
    await act(async () => { await new Promise((r) => requestAnimationFrame(r)); });
    input.focus();

    for (const ch of 'Velvet Ring') {
      const next = input.value + ch;
      fireEvent.change(input, { target: { value: next } });
      // Let any effect React scheduled for this render actually run.
      await act(async () => { await new Promise((r) => requestAnimationFrame(r)); });

      expect(
        document.activeElement,
        `focus left the field after typing "${ch}" (value so far: "${next}")`,
      ).toBe(input);
    }

    expect(input.value).toBe('Velvet Ring');
  });

  it('still closes on Escape, using the latest handler', async () => {
    const spy = vi.fn();
    render(<Harness onCloseSpy={spy} />);
    await act(async () => { await new Promise((r) => requestAnimationFrame(r)); });

    // Typing first, so the handler the listener calls is a LATER closure than
    // the one captured when the effect first ran — the thing the ref exists to
    // get right.
    const input = screen.getByLabelText('Title');
    fireEvent.change(input, { target: { value: 'abc' } });
    await act(async () => { await new Promise((r) => requestAnimationFrame(r)); });

    await act(async () => { fireEvent.keyDown(document, { key: 'Escape' }); });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(screen.getByText('closed')).toBeTruthy();
  });

  it('restores focus to the opener when it closes, exactly once', async () => {
    function Outer() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Add a piece</button>
          {open && <Inner onDone={() => setOpen(false)} />}
        </>
      );
    }
    function Inner({ onDone }) {
      const [value, setValue] = useState('');
      const dialogRef = useModalA11y(true, { onClose: onDone });
      return (
        <div ref={dialogRef} role="dialog" tabIndex={-1}>
          <input aria-label="Field" value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
      );
    }

    render(<Outer />);
    const opener = screen.getByText('Add a piece');
    opener.focus();
    fireEvent.click(opener);
    await act(async () => { await new Promise((r) => requestAnimationFrame(r)); });

    // Type — under the old deps this alone bounced focus back to the opener.
    const field = screen.getByLabelText('Field');
    field.focus();
    fireEvent.change(field, { target: { value: 'x' } });
    await act(async () => { await new Promise((r) => requestAnimationFrame(r)); });

    expect(document.activeElement, 'focus returned to the opener mid-typing').toBe(field);
  });
});
