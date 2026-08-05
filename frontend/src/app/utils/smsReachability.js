'use client';

/**
 * Can this guest be reached by text, and if not, why not?
 *
 * ── Why this is shared ──
 *
 * Two screens answer this question — the Guests tab and the RSVPs list — and a
 * third place acts on it (the send modal). If each kept its own copy they would
 * eventually disagree about who can be messaged, and the organizer would be told
 * one thing by the list and another by the message history. That is the single
 * most damaging kind of drift in this subsystem, so there is one function.
 *
 * ── Why the states are what they are ──
 *
 * `sms_consent === false` is ambiguous on its own: it means "declined" or "never
 * asked" depending on whether a decision was ever recorded, and those two call for
 * completely different action. `sms_consent_at` separates them. A guest who
 * DECLINED must never be shown as merely missing something the organizer can
 * supply — no attestation can override a refusal (see
 * guestService.recordHostConsentAttestation), so the copy must not imply one
 * would help.
 *
 * STOP outranks everything, including a consent recorded a minute earlier, and is
 * checked first for that reason.
 *
 * The wording mirrors backend/utils/smsUsage.js `explainSkip`, so the reason shown
 * on the list before sending is the same sentence shown in the message history
 * after — and the same one support reads on a ticket.
 */

const PALETTE = {
  ok: { bg: 'rgba(34,197,94,0.12)', color: '#15803D' },
  host: { bg: 'rgba(184,148,79,0.12)', color: '#8A6D34' },
  blocked: { bg: 'rgba(196,94,94,0.12)', color: '#B04A4A' },
  neutral: { bg: '#F8F4EC', color: '#77736A' },
};

/**
 * @param {object} guest a dashboard rsvp row (phone, sms_consent, sms_consent_at,
 *                       sms_consent_method, sms_opted_out)
 * @returns {{ reachable: boolean, state: string, label: string, title: string,
 *             bg: string, color: string }}
 */
export function smsReachability(guest) {
  const hasPhone = guest?.phone && guest.phone !== '-';

  if (!hasPhone) {
    return {
      reachable: false,
      state: 'no_phone',
      label: 'No number',
      title: 'No phone number on file, so this guest cannot receive texts. Add one by editing them.',
      ...PALETTE.neutral,
    };
  }

  // Checked before consent: a STOP reply is a legal instruction that overrides
  // any consent on record, however recent.
  if (guest.sms_opted_out) {
    return {
      reachable: false,
      state: 'opted_out',
      label: 'Replied STOP',
      title: 'This guest replied STOP to a previous message. They are excluded from every text, on every event, until they text START themselves. This cannot be overridden.',
      ...PALETTE.blocked,
    };
  }

  if (guest.sms_consent) {
    return guest.sms_consent_method === 'host_attested'
      ? {
          reachable: true,
          state: 'host_attested',
          label: 'Can text — you confirmed',
          title: 'You confirmed you obtained this guest’s permission to receive event texts, so they can be included in sends.',
          ...PALETTE.host,
        }
      : {
          reachable: true,
          state: 'opted_in',
          label: 'Can text',
          title: 'This guest agreed to receive texts on their RSVP form.',
          ...PALETTE.ok,
        };
  }

  // Asked and declined — a dated refusal. Deliberately NOT phrased as something
  // the organizer can fix, because they cannot.
  if (guest.sms_consent_at) {
    return {
      reachable: false,
      state: 'declined',
      label: 'Declined texts',
      title: 'This guest was shown the consent box and left it unticked. Their choice cannot be overridden — they are excluded from every text.',
      ...PALETTE.blocked,
    };
  }

  // Never asked — the one state the organizer CAN act on.
  return {
    reachable: false,
    state: 'never_asked',
    label: "Hasn't agreed to texts",
    title: 'No consent on record, so this guest is excluded from texts. They can agree on their RSVP form, or you can confirm their permission when editing them.',
    ...PALETTE.neutral,
  };
}

/**
 * How many of a selection would actually receive a text.
 *
 * The honest number for an action bar: "5 of 8 will get this". Selecting an
 * unreachable guest is allowed — they may still be emailed from the same bar —
 * so the count has to state the difference rather than the selection hiding it.
 */
export function countReachable(guests) {
  const list = Array.isArray(guests) ? guests : [];
  const reachable = list.filter((g) => smsReachability(g).reachable).length;
  return { total: list.length, reachable, unreachable: list.length - reachable };
}
