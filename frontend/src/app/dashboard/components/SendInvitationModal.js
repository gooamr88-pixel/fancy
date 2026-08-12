'use client';

/**
 * SEND ONE GUEST THEIR INVITATION.
 *
 * ── What this replaces, and why it moved ──
 *
 * This was `AddGuestModal`, and it lived in the Guest list section. Three things
 * about it were wrong, and they were wrong together:
 *
 *   1. IT WAS IN THE WRONG SECTION. "Guest list" is where you BUILD the list —
 *      import a spreadsheet, download it, organise it. "Invitations & replies" is
 *      where you REACH it. Adding one person by hand is overwhelmingly the second
 *      thing: an organizer types a name and an address precisely because they
 *      want that person invited now.
 *
 *   2. IT ASKED FOR AN ANSWER IT COULD NOT HAVE. `Response *` was a required
 *      field with Yes / No / Maybe, on a form whose submit sends the invitation.
 *      The guest has not been asked yet. Whatever the organizer picked was a
 *      guess recorded as fact — and picking "Yes" suppressed the RSVP reminder
 *      (the scheduler chases `pending` parties only) for somebody who had never
 *      replied.
 *
 *   3. IT DEMANDED AN EMAIL AND IGNORED THE PHONE. Email was required; the phone
 *      number was stored and never used. An organizer who has a mobile number and
 *      no address could not add the guest at all, and one who had both got an
 *      email only, with no indication that the text they were expecting had not
 *      been sent.
 *
 * ── The rule this screen is built around ──
 *
 * The organizer must be able to say, out loud, before pressing the button: who is
 * being contacted, on which channel, what it costs, what the guest will see, what
 * state that guest will be in afterwards, and what the platform will do next
 * without being asked. Every one of those is a sentence in the panel at the
 * bottom, and the panel updates as they type rather than reporting afterwards.
 *
 * That panel is not decoration. Our organizers are frequently older and not
 * technical, and the failure this design exists to prevent is not a wrong click —
 * it is somebody pressing send while holding a materially wrong idea of what send
 * means.
 *
 * ── Dead ends are refused BEFORE the guest exists ──
 *
 * A phone number alone can only carry an invitation if texting is switched on for
 * the event AND the organizer confirms they hold the guest's permission. Without
 * both, a phone-only guest would be created and then invited to nothing, silently.
 * `deliverable` below is what the send button is gated on, so that state is
 * explained on the form instead of discovered later on the guest list.
 */

import React, { useState, useEffect, useRef, useMemo, useId } from 'react';
import { normalizeToE164 } from '../../utils/phone';
import { findMealField } from '../../utils/mealField';
import { sideLabel } from '../../utils/sideLabel';
import PhoneNumberInput from '../../components/PhoneNumberInput';
import { toast } from '../../utils/toast';
import { useModalA11y } from '../../hooks/useModalA11y';

const COLORS = {
  gold: '#B8944F', goldHover: '#a6833f', charcoal: '#191B1E', ivory: '#F8F4EC',
  champagne: '#D7BE80', stone: '#77736A', border: '#E8E2D6', white: '#FFFFFF', softBg: '#FAFAF8',
  green: '#3D7A3D', greenBg: '#F0FAF0', rose: '#C45E5E', roseBg: '#FDF2F2',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EMPTY_FORM = {
  guest_name: '', email: '', phone: '', party_size: 1, notes: '', side: '', meal: '',
};

/* ── icons ─────────────────────────────────────────────────────── */
const MailIcon = ({ color }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);

const ChatIcon = ({ color }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

export default function SendInvitationModal({
  isOpen, onClose, eventId, event, customFields, onSent,
  /* Texting state, passed down rather than refetched — the dashboard already
     holds it, and a second fetch would eventually put two different balances on
     the same screen. */
  smsAddonActive = false, smsRemaining = 0, onBuySms,
}) {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showOptional, setShowOptional] = useState(false);
  /* The organizer's attestation that they already hold this guest's permission to
     be texted (TCPA/CTIA + Terms §5). Never carried over between guests — see the
     reset below. */
  const [smsConsentAttested, setSmsConsentAttested] = useState(false);
  const nameRef = useRef(null);
  // Generated, not a literal: the submit button lives outside the form and finds
  // it by id, and a hardcoded one would collide the moment two of these render.
  const formId = useId();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
  const mealField = findMealField(customFields);

  /* Reset during render on the closed→open transition rather than in an effect —
     an effect would commit the previous guest's details for one frame first. */
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setFormData(EMPTY_FORM);
      setError('');
      setLoading(false);
      setShowOptional(false);
      // Consent is re-affirmed per guest. Carrying it over would mean attesting,
      // silently, on behalf of somebody the organizer has not thought about yet.
      setSmsConsentAttested(false);
    }
  }

  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => nameRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  const dialogRef = useModalA11y(isOpen, { onClose });

  /**
   * WHAT WILL ACTUALLY HAPPEN, recomputed on every keystroke.
   *
   * One derivation feeding both the explanation panel and the submit gate, so the
   * sentence the organizer reads and the decision the button makes can never be
   * two different answers.
   */
  const plan = useMemo(() => {
    const email = formData.email.trim();
    const phone = formData.phone.trim();
    const emailValid = !!email && EMAIL_RE.test(email);
    const phoneE164 = phone ? normalizeToE164(phone) : '';
    const phoneValid = !!phoneE164;

    // Texting needs three things, and each missing one has its own sentence:
    // a valid number, the add-on bought for this event, and the organizer's
    // confirmation that the guest agreed to be texted.
    const smsBlocked = !phoneValid ? null
      : !smsAddonActive ? 'no_addon'
        : !smsConsentAttested ? 'no_consent'
          : smsRemaining <= 0 ? 'no_balance'
            : null;

    const willEmail = emailValid;
    const willSms = phoneValid && smsBlocked === null;

    return {
      email, phone, emailValid, phoneValid, phoneE164,
      willEmail, willSms, smsBlocked,
      channels: (willEmail ? 1 : 0) + (willSms ? 1 : 0),
      // Anything typed into a contact field at all — used to tell "they have not
      // filled this in yet" apart from "what they filled in cannot be used".
      anyContactTyped: !!email || !!phone,
    };
  }, [formData.email, formData.phone, smsAddonActive, smsConsentAttested, smsRemaining]);

  const deliverable = plan.channels > 0;

  if (!isOpen) return null;

  const handleChange = (field) => (e) => setFormData(prev => ({ ...prev, [field]: e.target.value }));

  /** Builds the result sentence from what each channel actually did. */
  const reportOutcome = (invitation, name) => {
    const em = invitation?.email || {};
    const sm = invitation?.sms || {};
    const landed = [em.sent && 'by email', sm.sent && 'by text'].filter(Boolean);

    if (landed.length > 0) {
      toast.success(`Invitation sent to ${name} ${landed.join(' and ')}.`);
      // A partial send is still a success, but the half that failed has to say so
      // — otherwise the organizer believes both arrived.
      const missed = [
        em.attempted && !em.sent && `email: ${em.reasonText || 'not delivered'}`,
        sm.attempted && !sm.sent && `text: ${sm.reasonText || 'not delivered'}`,
      ].filter(Boolean);
      if (missed.length > 0) toast(`${name} — ${missed.join('; ')}.`, { icon: 'ℹ️' });
      return;
    }

    // Nothing reached them. The guest is on the list, which is worth saying
    // plainly so the organizer does not add them a second time.
    const why = em.reasonText || sm.reasonText || 'the invitation could not be sent';
    toast.error(`${name} was added to your list, but ${why.toLowerCase()}.`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const name = formData.guest_name.trim();
    if (!name) { setError('Please enter your guest’s name.'); return; }
    if (!plan.anyContactTyped) {
      setError('Add an email address or a mobile number — that is how the invitation reaches them.');
      return;
    }
    if (plan.email && !plan.emailValid) { setError('That email address does not look right. Check it, or clear it and use a mobile number instead.'); return; }
    if (plan.phone && !plan.phoneValid) { setError('Enter the mobile number in international format, e.g. +1 555 123 4567 — or leave it blank.'); return; }
    if (!deliverable) {
      // Only reachable with a valid number that cannot be texted for one of the
      // three reasons above; the panel already names which one.
      setError('There is no way to send this invitation yet — see the note below.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${apiUrl}/events/${eventId}/rsvps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          guestName: name,
          email: plan.emailValid ? plan.email : '',
          phone: plan.phoneE164,
          /**
           * The channels the panel just PROMISED, sent as intent rather than left
           * to the server to re-derive.
           *
           * Without this the two can disagree, and the disagreement is the exact
           * failure this screen exists to prevent: a guest with both an email and
           * a number, on an event with no texting, is told "by email only" and
           * would then get a result toast reporting a failed text.
           *
           * Note the number is still sent when `sms` is not among them — it
           * belongs on the guest record either way, so it is there for a later
           * send from the list once texting is switched on.
           */
          channels: [plan.willEmail && 'email', plan.willSms && 'sms'].filter(Boolean),
          partySize: parseInt(formData.party_size, 10),
          // No `response`. The guest has not answered yet, and the server defaults
          // to pending — which is what keeps them in the reminder sweep.
          notes: formData.notes.trim() || undefined,
          side: formData.side || undefined,
          primaryGuestMeal: formData.meal || undefined,
          smsConsentAttested,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not send the invitation.');

      reportOutcome(data.data?.invitation, name);
      onSent?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  /* ── shared field styling ─────────────────────────────────────── */
  const labelStyle = {
    display: 'block', fontSize: '11px', fontWeight: 600, color: COLORS.stone,
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px', fontFamily: 'var(--font-sans)',
  };
  const inputStyle = {
    width: '100%', padding: '11px 14px', border: `1px solid ${COLORS.border}`, borderRadius: '8px',
    fontSize: '14px', fontFamily: 'var(--font-sans)', color: COLORS.charcoal,
    background: COLORS.white, outline: 'none', transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  };
  const hintStyle = {
    margin: '6px 0 0', fontSize: '11.5px', lineHeight: 1.6,
    color: COLORS.stone, fontFamily: 'var(--font-sans)',
  };
  const sectionTitle = {
    fontSize: '12px', fontWeight: 700, color: COLORS.charcoal,
    fontFamily: 'var(--font-sans)', letterSpacing: '0.02em',
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', flexWrap: 'wrap', alignItems: 'center',
        justifyContent: 'center', background: 'rgba(25, 27, 30, 0.45)', backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)', animation: 'siFadeIn 0.2s ease', padding: '16px',
        boxSizing: 'border-box',
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="send-invitation-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: COLORS.white, borderRadius: '16px', width: '100%', maxWidth: '560px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.12), 0 0 0 1px rgba(232,226,214,0.5)',
          animation: 'siSlideUp 0.25s ease', overflow: 'hidden',
          maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        }}
      >
        {/* ── Header ──────────────────────────────────────────────
            flexWrap because a nowrap row's min-content is the SUM of its
            children: the title block plus a 44px close button cannot be talked
            down below their combined width, however narrow the screen. Wrapping
            makes it max(children) instead. Caught by test/mobileFit. */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
          flexWrap: 'wrap', padding: '20px 24px 18px',
          borderBottom: `1px solid ${COLORS.border}`, flexShrink: 0,
        }}>
          <div style={{ minWidth: 0 }}>
            <h2 id="send-invitation-title" style={{
              fontFamily: 'var(--font-serif)', fontSize: '21px', fontWeight: 600,
              color: COLORS.charcoal, margin: 0, lineHeight: 1.25,
            }}>Send an invitation</h2>
            {/* The whole flow in one sentence, before any field. Somebody who reads
                only this line should still know what pressing the button does. */}
            <p style={{ ...hintStyle, marginTop: '5px', fontSize: '12.5px' }}>
              Add one guest and send them their invitation now. They reply on the invitation itself.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: '36px', height: '36px', flexShrink: 0, borderRadius: '8px', border: 'none',
              background: COLORS.ivory, cursor: 'pointer', display: 'flex', flexWrap: 'wrap',
              alignItems: 'center', justifyContent: 'center', color: COLORS.stone, transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#EDE8DD'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = COLORS.ivory; }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/**
          * ONLY THIS SCROLLS. The actions are pinned below it.
          *
          * The comment that used to sit here claimed the internal scroll kept the
          * footer reachable — and the footer was INSIDE this element, so it did
          * the opposite. On a phone the form is a name, two contact fields, a
          * consent box, a disclosure and a ten-line explanation panel; "Send
          * invitation" sat under all of it. Reaching the button meant scrolling
          * past every word, every time, including on the second and tenth guest.
          *
          * The panel is worth its length — an organizer must be able to say what
          * pressing the button does — but it must not be a toll gate in front of
          * the button.
          */}
        <form id={formId} onSubmit={handleSubmit} style={{ padding: '22px 24px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

            {/* ── Who ─────────────────────────────────────────── */}
            <div>
              <label style={labelStyle} htmlFor="si-name">Guest name *</label>
              <input
                id="si-name" ref={nameRef} value={formData.guest_name} onChange={handleChange('guest_name')}
                placeholder="e.g. Sara Mahmoud" required style={inputStyle}
                onFocus={(e) => { e.target.style.borderColor = COLORS.gold; }}
                onBlur={(e) => { e.target.style.borderColor = COLORS.border; }}
              />
              <p style={hintStyle}>This is the name that appears on their invitation.</p>
            </div>

            {/* ── How to reach them ───────────────────────────── */}
            <div>
              <div style={{ ...sectionTitle, marginBottom: '4px' }}>How should we send it?</div>
              <p style={{ ...hintStyle, margin: '0 0 10px' }}>
                Fill in <strong style={{ color: COLORS.charcoal }}>one or both</strong>. Give both and they
                receive it twice — once by email and once as a text.
              </p>

              <div className="si-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle} htmlFor="si-email">Email address</label>
                  <input
                    id="si-email" value={formData.email} onChange={handleChange('email')} type="email"
                    placeholder="name@example.com" style={inputStyle}
                    onFocus={(e) => { e.target.style.borderColor = COLORS.gold; }}
                    onBlur={(e) => { e.target.style.borderColor = COLORS.border; }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Mobile number</label>
                  <PhoneNumberInput
                    value={formData.phone}
                    onChange={(val) => handleChange('phone')({ target: { value: val } })}
                  />
                </div>
              </div>

              {/* Host SMS consent attestation. Appears only once a number exists to
                  attest about — asking before there is anything to confirm is
                  noise. It is what makes the text possible; without it the number
                  is still saved and simply never messaged. */}
              {formData.phone.trim() && (
                <div style={{
                  marginTop: '12px', padding: '12px 14px', borderRadius: '10px',
                  background: smsConsentAttested ? 'rgba(184,148,79,0.08)' : COLORS.softBg,
                  border: `1px solid ${smsConsentAttested ? COLORS.champagne : COLORS.border}`,
                  transition: 'background 0.2s, border-color 0.2s',
                }}>
                  <label style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={smsConsentAttested}
                      onChange={(e) => setSmsConsentAttested(e.target.checked)}
                      style={{ marginTop: '2px', width: '16px', height: '16px', accentColor: COLORS.gold, flexShrink: 0, cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '12.5px', color: COLORS.charcoal, lineHeight: 1.6, fontFamily: 'var(--font-sans)' }}>
                      I confirm that I have obtained this recipient&apos;s consent to receive event-related SMS messages.
                    </span>
                  </label>
                  <p style={{ ...hintStyle, margin: '8px 0 0 26px' }}>
                    {smsConsentAttested
                      ? 'Recorded with your name and today’s date. This guest can now be texted.'
                      : 'Required before we can text anyone. Without it the number is saved to your list, but no text is sent.'}
                  </p>
                </div>
              )}
            </div>

            {/* ── Optional detail ─────────────────────────────── */}
            <div style={{ borderTop: `1px dashed ${COLORS.border}`, paddingTop: '14px' }}>
              <button
                type="button"
                onClick={() => setShowOptional(v => !v)}
                aria-expanded={showOptional}
                style={{
                  display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', width: '100%',
                  background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span style={{ fontSize: '11px', color: COLORS.gold, width: 10 }}>{showOptional ? '▾' : '▸'}</span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ ...sectionTitle, display: 'block' }}>
                    Anything you already know <span style={{ fontWeight: 500, color: COLORS.stone }}>(optional)</span>
                  </span>
                  <span style={{ ...hintStyle, display: 'block', margin: '3px 0 0' }}>
                    Who is coming with them, what they eat, whose side they are on — your guest answers
                    all of this on the invitation, so leave it blank unless you already know.
                  </span>
                </span>
              </button>

              {showOptional && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '14px' }}>
                  <div className="si-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={labelStyle} htmlFor="si-party">Coming with them</label>
                      <select
                        id="si-party" value={formData.party_size} onChange={handleChange('party_size')}
                        style={{ ...inputStyle, cursor: 'pointer' }}
                      >
                        <option value={1}>Just them</option>
                        {Array.from({ length: 19 }, (_, i) => i + 2).map(n => (
                          <option key={n} value={n}>{n} people in total</option>
                        ))}
                      </select>
                    </div>

                    {/* Side — only when this event tracks it at all. */}
                    {event?.track_guest_side && (
                      <div>
                        <label style={labelStyle} htmlFor="si-side">
                          {event?.event_type === 'wedding' ? 'Whose side' : 'Partner’s side'}
                        </label>
                        <select
                          id="si-side" value={formData.side} onChange={handleChange('side')}
                          style={{ ...inputStyle, cursor: 'pointer' }}
                        >
                          <option value="">They can say</option>
                          <option value="partner1">{sideLabel('partner1', event)}</option>
                          <option value="partner2">{sideLabel('partner2', event)}</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Meal — only when the event has a configured meal question. */}
                  {mealField && (
                    <div>
                      <label style={labelStyle} htmlFor="si-meal">{mealField.field_label}</label>
                      <select
                        id="si-meal" value={formData.meal} onChange={handleChange('meal')}
                        style={{ ...inputStyle, cursor: 'pointer' }}
                      >
                        <option value="">They can choose</option>
                        {(mealField.options || []).map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                      </select>
                    </div>
                  )}

                  <div>
                    <label style={labelStyle} htmlFor="si-notes">A private note to yourself</label>
                    <textarea
                      id="si-notes" value={formData.notes} onChange={handleChange('notes')} rows={2}
                      placeholder="Uses a wheelchair · sitting with the Hassan family"
                      style={{ ...inputStyle, resize: 'vertical', minHeight: '62px' }}
                      onFocus={(e) => { e.target.style.borderColor = COLORS.gold; }}
                      onBlur={(e) => { e.target.style.borderColor = COLORS.border; }}
                    />
                    <p style={hintStyle}>Only you see this. It never appears on the invitation.</p>
                  </div>
                </div>
              )}
            </div>

            {/* ── What will happen ────────────────────────────── */}
            <WhatWillHappen
              name={formData.guest_name.trim()}
              plan={plan}
              smsRemaining={smsRemaining}
              onBuySms={onBuySms}
            />

          </div>
        </form>

        {/**
          * ── Actions, PINNED ──────────────────────────────────
          *
          * Outside the scrolling form, so "Send invitation" is on screen from the
          * moment the dialog opens rather than ten lines below the fold.
          *
          * `form={formId}` is what keeps the button attached to a form it is no
          * longer inside — a plain `type="submit"` out here would submit nothing.
          * Enter in any field still submits, because that is the form's own
          * behaviour and does not depend on where the button lives.
          *
          * The error moved up here with them: it is the reason the button will not
          * work, and leaving it in the scroll area meant it could be off screen
          * while the disabled button it explains was visible.
          */}
        <div style={{ flexShrink: 0, borderTop: `1px solid ${COLORS.border}`, padding: '14px 24px' }}>
          {error && (
            <div role="alert" style={{
              padding: '11px 14px', borderRadius: '8px', marginBottom: '12px',
              background: COLORS.roseBg, border: '1px solid #FECACA',
              color: COLORS.rose, fontSize: '13px', lineHeight: 1.55, fontFamily: 'var(--font-sans)',
            }}>
              {error}
            </div>
          )}
          {/* flexWrap as the floor, and the media rule below turns the wrap into
              a deliberate full-width stack on a phone. Without the wrap, Cancel
              + "Send invitation" sum to more than a 320px screen offers and the
              row pushes the dialog sideways. */}
          <div className="si-actions" style={{
            display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap',
          }}>
            <button
              type="button" onClick={onClose} className="si-action-btn"
              style={{
                padding: '11px 20px', borderRadius: '8px', border: `1px solid ${COLORS.border}`,
                background: COLORS.white, color: COLORS.stone, fontSize: '13px', fontWeight: 600,
                fontFamily: 'var(--font-sans)', cursor: 'pointer', transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.ivory; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = COLORS.white; }}
            >Cancel</button>
            <button
              type="submit"
              form={formId}
              className="si-action-btn"
              disabled={loading || !deliverable}
              /* Disabled rather than failing on submit: the panel above has already
                 said what is missing, and letting the press through only to reject
                 it would move the explanation away from the field that fixes it. */
              title={deliverable ? undefined : 'Add an email address, or switch on texting and confirm permission'}
              style={{
                padding: '11px 22px', borderRadius: '8px', border: 'none',
                background: loading ? COLORS.champagne : !deliverable ? '#EFECE5' : COLORS.gold,
                color: !deliverable && !loading ? '#9A958B' : COLORS.white,
                fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-sans)',
                cursor: loading ? 'wait' : !deliverable ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px',
              }}
              onMouseEnter={(e) => { if (!loading && deliverable) e.currentTarget.style.background = COLORS.goldHover; }}
              onMouseLeave={(e) => { if (!loading && deliverable) e.currentTarget.style.background = COLORS.gold; }}
            >
              {loading && (
                <span style={{
                  width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.35)',
                  borderTopColor: COLORS.white, borderRadius: '50%', display: 'inline-block',
                  animation: 'siSpin 0.6s linear infinite',
                }} />
              )}
              {loading ? 'Sending…' : 'Send invitation'}
            </button>
          </div>
        </div>
      </div>

      {/* Plain <style>, not <style jsx>. A scoped block here would compile its
          rules against this component's own hash and is a documented silent
          failure mode in this build; these rules are namespaced with `si-`
          instead. Breakpoint is the shared sm line (639.98px) — see AGENTS.md. */}
      <style>{`
        @keyframes siFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes siSlideUp { from { opacity: 0; transform: translateY(16px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes siSpin { to { transform: rotate(360deg); } }
        @media (max-width: 639.98px) {
          /* important, because the inline style sets gridTemplateColumns and a
             class can never beat an inline declaration.
             Never write a dotted class name inside one of these comments: the
             repo's inline-trap scanner parses this block with a regex and reads
             any "dot word" as the start of a real selector, so a comment can
             silently attach the NEXT rule's declarations to the wrong element.
             Same family as the backtick trap in AGENTS.md. */
          .si-row { grid-template-columns: 1fr !important; }
          /* Full-width, thumb-sized buttons, and Send on top so Cancel is not the
             one under the thumb. No important needed on flex-direction: this
             element does not set it inline, and adding one where it is not needed
             hides the day somebody does. */
          .si-actions { flex-direction: column-reverse; }
          /* The buttons carry their own class rather than being reached by a
             descendant selector. A descendant selector would read — to the
             scanner and to the next person — as a rule aimed at the container,
             which does set justify-content inline and would beat it. */
          .si-action-btn { width: 100%; justify-content: center; min-height: 46px; }
        }
      `}</style>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
 * THE PANEL THIS SCREEN EXISTS FOR.
 *
 * Six questions, answered in the organizer's own language, updating as they
 * type: who is contacted, how, what it costs, what the guest sees, what state
 * they will be in, and what happens afterwards without anyone doing anything.
 *
 * It renders in three states — nothing typed yet, cannot send, will send — and
 * the middle one is the important one: it names the single missing thing and
 * where to get it, rather than leaving a greyed-out button to be interpreted.
 * ───────────────────────────────────────────────────────────────── */
function WhatWillHappen({ name, plan, smsRemaining, onBuySms }) {
  const who = name || 'Your guest';
  const deliverable = plan.channels > 0;

  const shellStyle = {
    borderRadius: '12px', padding: '15px 17px',
    background: deliverable ? COLORS.greenBg : COLORS.softBg,
    border: `1px solid ${deliverable ? 'rgba(61,122,61,0.25)' : COLORS.border}`,
    fontFamily: 'var(--font-sans)',
  };
  const headingStyle = {
    fontSize: 'var(--fx-micro)', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
    color: deliverable ? COLORS.green : COLORS.stone, margin: 0,
  };
  const lineStyle = {
    margin: '6px 0 0', fontSize: '12.5px', lineHeight: 1.65, color: COLORS.charcoal,
  };

  /* Nothing to say yet. Still rendered rather than hidden, so the panel does not
     appear from nowhere the moment an address is typed. */
  if (!plan.anyContactTyped) {
    return (
      <div style={shellStyle}>
        <p style={headingStyle}>What will happen</p>
        <p style={{ ...lineStyle, color: COLORS.stone }}>
          Add an email address or a mobile number above, and this will show you exactly
          what {who.toLowerCase() === 'your guest' ? 'your guest' : who} receives, and what it costs.
        </p>
      </div>
    );
  }

  return (
    <div style={shellStyle}>
      <p style={headingStyle}>{deliverable ? 'What will happen' : 'This cannot be sent yet'}</p>

      {/* 1 — WHO, HOW, AND WHAT IT COSTS. */}
      {deliverable && (
        <>
          <p style={{ ...lineStyle, marginTop: '8px' }}>
            <strong>{who}</strong> gets their invitation
            {plan.channels === 2 ? ' twice — once each way:' : ':'}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', margin: '9px 0 0' }}>
            {plan.willEmail && (
              <ChannelLine
                icon={<MailIcon color={COLORS.green} />}
                what="By email"
                to={plan.email}
                cost="Free"
                costColor={COLORS.green}
              />
            )}
            {plan.willSms && (
              <ChannelLine
                icon={<ChatIcon color={COLORS.gold} />}
                what="By text message"
                to={plan.phoneE164}
                cost={`Uses 1 of your ${Number(smsRemaining).toLocaleString()}`}
                costColor={COLORS.gold}
              />
            )}
          </div>
        </>
      )}

      {/* 2 — WHY IT CANNOT GO, and the one thing that would fix it. */}
      {!deliverable && (
        <div style={{ marginTop: '8px' }}>
          {plan.email && !plan.emailValid && (
            <p style={{ ...lineStyle, color: COLORS.rose }}>
              That email address does not look complete, so nothing can be sent to it yet.
            </p>
          )}
          {plan.phone && !plan.phoneValid && (
            <p style={{ ...lineStyle, color: COLORS.rose }}>
              That mobile number is not in international format (for example +1 555 123 4567),
              so it cannot receive a text.
            </p>
          )}
          {plan.smsBlocked === 'no_consent' && (
            <p style={lineStyle}>
              You have a mobile number and nothing else. Before we can text anyone, tick the
              permission box above to confirm this guest agreed to receive texts — or add their
              email address instead, which costs nothing and needs no permission.
            </p>
          )}
          {plan.smsBlocked === 'no_addon' && (
            <p style={lineStyle}>
              Text messaging is not switched on for this event, so a mobile number alone cannot
              carry an invitation. Add an email address instead
              {onBuySms ? ', or ' : '.'}
              {onBuySms && (
                <button
                  type="button"
                  onClick={onBuySms}
                  style={{
                    background: 'none', border: 'none', padding: 0, font: 'inherit',
                    color: COLORS.gold, fontWeight: 700, textDecoration: 'underline', cursor: 'pointer',
                  }}
                >
                  switch on texting
                </button>
              )}
              {onBuySms ? '.' : ''}
            </p>
          )}
          {plan.smsBlocked === 'no_balance' && (
            <p style={lineStyle}>
              You have no text messages left, so this invitation cannot go by text. Add an email
              address instead, or top up your balance.
            </p>
          )}
        </div>
      )}

      {/* 3 — WHAT THE GUEST SEES, AND WHAT STATE THEY LAND IN.
             Shown in both states: it is the answer to "what am I actually doing",
             which does not stop being useful because a field is incomplete. */}
      <div style={{
        marginTop: '12px', paddingTop: '11px',
        borderTop: `1px solid ${deliverable ? 'rgba(61,122,61,0.18)' : COLORS.border}`,
      }}>
        <p style={{ ...lineStyle, margin: 0 }}>
          They open your full invitation and reply there — whether they are coming, who is
          with them, and what they would like to eat. You are not asking any of that here.
        </p>
        <p style={{ ...lineStyle, marginTop: '7px' }}>
          Until they reply, {who} shows on this list as{' '}
          <span style={{
            display: 'inline-block', padding: '1px 8px', borderRadius: '5px',
            background: COLORS.ivory, color: COLORS.stone,
            fontSize: 'var(--fx-micro)', fontWeight: 800, letterSpacing: '0.06em', verticalAlign: '1px',
          }}>PENDING</span>.
        </p>
        {/* The user's actual requirement: that the organizer knows this guest is
            now inside every flow, not a one-off send. */}
        <p style={{ ...lineStyle, marginTop: '7px', color: COLORS.stone }}>
          From then on they are treated like every other guest — a reminder before your RSVP
          deadline, a confirmation the moment they answer, their table and entry pass, and a
          notice if you ever change the details or call the event off.
        </p>
      </div>
    </div>
  );
}

/** One "By email — name@example.com — Free" row. */
function ChannelLine({ icon, what, to, cost, costColor }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px',
      padding: '8px 11px', borderRadius: '8px',
      background: COLORS.white, border: `1px solid ${COLORS.border}`,
    }}>
      <span style={{ display: 'flex', flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: '12px', fontWeight: 700, color: COLORS.charcoal, flexShrink: 0 }}>{what}</span>
      {/* fx-break: an address with no spaces has a min-content width equal to its
          full length, which is what pushes a 320px phone sideways. */}
      <span className="fx-break" style={{ fontSize: '12px', color: COLORS.stone, minWidth: 0, flex: '1 1 120px' }}>
        {to}
      </span>
      <span style={{ fontSize: 'var(--fx-micro)', fontWeight: 800, color: costColor, whiteSpace: 'nowrap', flexShrink: 0 }}>
        {cost}
      </span>
    </div>
  );
}
