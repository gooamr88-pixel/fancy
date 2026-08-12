import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import SendInvitationModal from '../src/app/dashboard/components/SendInvitationModal';

/* ═══════════════════════════════════════════════════════════════════════════
   THE PANEL IS THE PRODUCT.

   This modal's job is not to collect four fields — the old Add Guest form did
   that. Its job is that the organizer, who is frequently older and not
   technical, can say out loud what pressing the button will do BEFORE they
   press it: who is contacted, on which channel, what it costs, and what state
   that guest lands in.

   That is a state machine over two contact fields, a consent tick, and whether
   texting is switched on — six outcomes, each of which has to say a different
   true thing. It is exactly the kind of logic that reads correctly and behaves
   wrongly, so it is rendered here rather than reasoned about.

   These tests drive the real component in jsdom. They cannot see pixels; they
   check what the panel SAYS and whether the send button is armed, which is the
   part a screenshot would not verify anyway.
   ═══════════════════════════════════════════════════════════════════════════ */

const BASE = {
  isOpen: true,
  onClose: () => {},
  eventId: '11111111-1111-4111-8111-111111111111',
  event: { track_guest_side: false },
  customFields: [],
  onSent: () => {},
};

/** Renders with sensible defaults and returns the helpers a test needs. */
function setup(props = {}) {
  const utils = render(<SendInvitationModal {...BASE} {...props} />);
  const nameField = () => screen.getByLabelText(/guest name/i);
  const emailField = () => screen.getByLabelText(/email address/i);
  const consentBox = () => screen.getByRole('checkbox');
  const sendButton = () => screen.getByRole('button', { name: /send invitation/i });
  // react-international-phone renders a bare tel input; there is no label to
  // query it by, so it is reached by type — the same way a user reaches it.
  const phoneField = () => utils.container.querySelector('input[type="tel"]');
  const panel = () => screen.getByText(/what will happen|cannot be sent yet/i).closest('div');
  return { ...utils, nameField, emailField, phoneField, consentBox, sendButton, panel };
}

const type = (el, value) => fireEvent.change(el, { target: { value } });

beforeEach(() => { vi.restoreAllMocks(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('what the organizer is told before they send', () => {
  it('says nothing definite until a way to reach the guest exists', () => {
    const { sendButton } = setup();

    expect(screen.getByText(/what will happen/i)).toBeInTheDocument();
    expect(screen.getByText(/add an email address or a mobile number above/i)).toBeInTheDocument();
    // Nothing can be sent, so the button must not look pressable.
    expect(sendButton()).toBeDisabled();
  });

  it('email only → one free channel, named, and the button arms', () => {
    const { nameField, emailField, sendButton } = setup();
    type(nameField(), 'Sara Mahmoud');
    type(emailField(), 'sara@example.com');

    expect(screen.getByText('By email')).toBeInTheDocument();
    expect(screen.getByText('sara@example.com')).toBeInTheDocument();
    expect(screen.getByText('Free')).toBeInTheDocument();
    // The name the organizer typed, not a placeholder — this sentence is the
    // one that catches "I typed the wrong person's address".
    expect(screen.getByText('Sara Mahmoud')).toBeInTheDocument();
    expect(screen.queryByText('By text message')).not.toBeInTheDocument();
    expect(sendButton()).toBeEnabled();
  });

  it('both channels → it says the invitation arrives twice, and what the text costs', () => {
    const { nameField, emailField, phoneField, consentBox } = setup({
      smsAddonActive: true, smsRemaining: 1250,
    });
    type(nameField(), 'Sara');
    type(emailField(), 'sara@example.com');
    type(phoneField(), '+15551234567');
    fireEvent.click(consentBox());

    expect(screen.getByText(/gets their invitation/i).textContent).toMatch(/twice/i);
    expect(screen.getByText('By email')).toBeInTheDocument();
    expect(screen.getByText('By text message')).toBeInTheDocument();
    // The balance is stated in the same breath as the channel, formatted — an
    // unformatted 1250 is the number an organizer misreads.
    expect(screen.getByText(/uses 1 of your 1,250/i)).toBeInTheDocument();
  });
});

describe('the three ways a text cannot be sent, each said differently', () => {
  it('a number with no consent tick blocks the send and names the tick', () => {
    const { nameField, phoneField, sendButton } = setup({ smsAddonActive: true, smsRemaining: 100 });
    type(nameField(), 'Sara');
    type(phoneField(), '+15551234567');

    expect(screen.getByText(/this cannot be sent yet/i)).toBeInTheDocument();
    expect(screen.getByText(/tick the permission box above/i)).toBeInTheDocument();
    // The dead end this replaces: the old form would have created the guest and
    // sent them nothing, silently.
    expect(sendButton()).toBeDisabled();
  });

  it('ticking the box then arms the send', () => {
    const { nameField, phoneField, consentBox, sendButton } = setup({ smsAddonActive: true, smsRemaining: 100 });
    type(nameField(), 'Sara');
    type(phoneField(), '+15551234567');
    expect(sendButton()).toBeDisabled();

    fireEvent.click(consentBox());

    expect(sendButton()).toBeEnabled();
    expect(screen.getByText('By text message')).toBeInTheDocument();
  });

  it('texting not switched on → it says so, and offers the way to switch it on', () => {
    const onBuySms = vi.fn();
    const { nameField, phoneField } = setup({ smsAddonActive: false, onBuySms });
    type(nameField(), 'Sara');
    type(phoneField(), '+15551234567');

    expect(screen.getByText(/text messaging is not switched on/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /switch on texting/i }));
    expect(onBuySms).toHaveBeenCalled();
  });

  it('an empty balance is its own sentence, not "no consent"', () => {
    const { nameField, phoneField, consentBox } = setup({ smsAddonActive: true, smsRemaining: 0 });
    type(nameField(), 'Sara');
    type(phoneField(), '+15551234567');
    fireEvent.click(consentBox());

    expect(screen.getByText(/no text messages left/i)).toBeInTheDocument();
  });

  it('adding an email rescues a phone-only guest who cannot be texted', () => {
    // The escape hatch the copy points at has to actually work.
    const { nameField, phoneField, emailField, sendButton } = setup({ smsAddonActive: false });
    type(nameField(), 'Sara');
    type(phoneField(), '+15551234567');
    expect(sendButton()).toBeDisabled();

    type(emailField(), 'sara@example.com');

    expect(sendButton()).toBeEnabled();
    expect(screen.getByText('By email')).toBeInTheDocument();
  });
});

describe('what it promises about the guest afterwards', () => {
  it('states the pending status and the automatic messages that follow', () => {
    const { nameField, emailField } = setup();
    type(nameField(), 'Sara');
    type(emailField(), 'sara@example.com');

    expect(screen.getByText('PENDING')).toBeInTheDocument();
    const followUps = screen.getByText(/from then on they are treated like every other guest/i).textContent;
    expect(followUps).toMatch(/reminder/i);
    expect(followUps).toMatch(/confirmation/i);
    expect(followUps).toMatch(/entry pass/i);
    expect(followUps).toMatch(/change the details or call the event off/i);
  });

  it('never asks for the guest\'s answer — that is the whole point of the move', () => {
    setup();
    // A Response field here would be the organizer guessing, and a guess of
    // "yes" drops the guest out of the reminder sweep.
    expect(screen.queryByLabelText(/response/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^maybe$/i)).not.toBeInTheDocument();
  });

  it('keeps the optional detail collapsed, and says the guest answers it', () => {
    setup();
    expect(screen.queryByLabelText(/coming with them/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /anything you already know/i }));

    expect(screen.getByLabelText(/coming with them/i)).toBeInTheDocument();
    expect(screen.getByText(/your guest answers all of this on the invitation/i)).toBeInTheDocument();
  });
});

describe('submitting', () => {
  it('posts no response field, and sends the normalized number', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { invitation: { email: { attempted: true, sent: true } } } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const onSent = vi.fn();

    const { nameField, emailField, phoneField, consentBox, sendButton } = setup({
      smsAddonActive: true, smsRemaining: 50, onSent,
    });
    type(nameField(), '  Sara Mahmoud  ');
    type(emailField(), 'sara@example.com');
    type(phoneField(), '+15551234567');
    fireEvent.click(consentBox());
    fireEvent.click(sendButton());

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);

    expect(body.guestName).toBe('Sara Mahmoud');
    expect(body.response).toBeUndefined();
    expect(body.phone).toBe('+15551234567');
    expect(body.smsConsentAttested).toBe(true);
    // The channels the panel promised, stated rather than left to the server to
    // re-derive — the two must not be able to disagree.
    expect(body.channels).toEqual(['email', 'sms']);
    await waitFor(() => expect(onSent).toHaveBeenCalled());
  });

  it('posts only the channels the panel promised, and still stores the number', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ success: true, data: { invitation: { email: { attempted: true, sent: true } } } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    // Texting is off, so the panel says "by email only". The number is still
    // typed, and still has to reach the guest record for a later send.
    const { nameField, emailField, phoneField, sendButton } = setup({ smsAddonActive: false });
    type(nameField(), 'Sara');
    type(emailField(), 'sara@example.com');
    type(phoneField(), '+15551234567');
    fireEvent.click(sendButton());

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);

    expect(body.channels).toEqual(['email']);
    expect(body.phone).toBe('+15551234567');
  });

  it('a rejected save keeps the modal open with the server\'s reason', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ success: false, message: 'This event has reached its plan’s guest limit.' }),
    }));
    const onClose = vi.fn();

    const { nameField, emailField, sendButton } = setup({ onClose });
    type(nameField(), 'Sara');
    type(emailField(), 'sara@example.com');
    fireEvent.click(sendButton());

    // Closing on failure would leave the error in a toast with nothing to retry.
    expect(await screen.findByRole('alert')).toHaveTextContent(/guest limit/i);
    expect(onClose).not.toHaveBeenCalled();
  });
});
