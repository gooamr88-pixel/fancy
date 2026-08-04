'use client';

import React from 'react';

/**
 * "This email is already registered for this event."
 *
 * Shown when submit_rsvp_v2 matches the submitted email (or phone) to a party
 * that has ALREADY answered. Before this, that case either hard-locked the form
 * ("you have already responded") or — when the host allowed guest edits —
 * silently overwrote the other person's RSVP with no word to anyone.
 *
 * Rendered inline, against the field it is about, rather than as a toast: it
 * carries an action, and a toast that disappears after four seconds is no place
 * to put a decision. Deliberately NOT the terminal locked card either — this is
 * recoverable, and the form stays exactly as the guest left it so a typo is one
 * keystroke from fixed.
 *
 * It names nobody. Whoever typed the address may not be its owner, so revealing
 * WHO responded (or how) would hand out the guest list one address at a time.
 * The most it ever confirms is that the address is in use — which the older
 * "already responded" lock already revealed.
 */
export default function ContactRegisteredNotice({
  field = 'email',
  canUpdate = false,
  onConfirm,
  busy = false,
  sent = false,
  isRTL = false,
  accentColor = '#B8944F',
}) {
  const isEmail = field !== 'phone';

  // Once the link is away the card stops being about a problem and becomes an
  // instruction, so it says so plainly instead of leaving the guest looking at
  // a rejection with a button they already pressed.
  const title = sent
    ? (isRTL ? 'ابعتنالك لينك على إيميلك.' : "We've sent a link to your email.")
    : isRTL
      ? (isEmail ? 'الإيميل ده مسجّل بالفعل في المناسبة دي.' : 'رقم التليفون ده مسجّل بالفعل في المناسبة دي.')
      : (isEmail
          ? 'This email is already registered for this event.'
          : 'This phone number is already registered for this event.');

  const body = sent
    ? (isRTL
        // Never "we sent it to alice@…": whoever is looking at this screen may
        // not be the owner of the address, and echoing it back confirms it is
        // registered. The inbox is the only place that confirmation belongs.
        ? 'افتح اللينك عشان تعدّل ردّك. صالح لمدة ٣٠ دقيقة. لو ملقتوش، بصّ في الـ Spam.'
        : 'Open it to update your response. It works for the next 30 minutes — check your spam folder if it hasn’t arrived.')
    : canUpdate
      ? (isRTL
          ? 'لو ده أنت، هنبعتلك لينك على نفس الإيميل تعدّل بيه ردّك. غير كده راجع اللي كتبته.'
          : "If that's you, we'll email that address a link to update the response. Otherwise, check what you entered.")
      : (isRTL
          ? 'المضيف قافل تعديل الردود بعد إرسالها. لو ده أنت، كلّمه عشان يحدّث ردّك.'
          : 'The host has turned off changes after submitting. If this is you, please contact them to update your response.');

  return (
    <div
      role="alert"
      style={{
        marginTop: '8px',
        padding: '14px 16px',
        borderRadius: '12px',
        border: '1px solid rgba(184,148,79,0.42)',
        background: 'rgba(184,148,79,0.08)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        textAlign: isRTL ? 'right' : 'left',
      }}
    >
      <div>
        <strong style={{
          display: 'block', fontSize: '13.5px', fontWeight: 700, color: '#191B1E',
          lineHeight: 1.45, fontFamily: 'var(--font-sans)',
        }}>
          {title}
        </strong>
        <span style={{
          display: 'block', marginTop: '4px', fontSize: '12.5px', color: '#77736A',
          lineHeight: 1.6, fontFamily: 'var(--font-sans)',
        }}>
          {body}
        </span>
      </div>

      {canUpdate && !sent && (
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          style={{
            alignSelf: isRTL ? 'flex-end' : 'flex-start',
            padding: '10px 18px',
            borderRadius: '10px',
            border: `1px solid ${accentColor}`,
            background: busy ? 'rgba(255,255,255,0.6)' : '#FFFFFF',
            color: accentColor,
            fontSize: '13px',
            fontWeight: 700,
            fontFamily: 'var(--font-sans)',
            cursor: busy ? 'default' : 'pointer',
            minHeight: '44px',
          }}
        >
          {busy
            ? (isRTL ? 'جاري الإرسال...' : 'Sending…')
            : (isRTL ? 'ده أنا — ابعتلي لينك' : "That's me — email me a link")}
        </button>
      )}
    </div>
  );
}
