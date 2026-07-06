/**
 * GuestService — single owner of all party/guest reads and writes.
 *
 * Replaces the scattered direct `supabase.from('rsvps')...` calls that used
 * to live inline in rsvpController.js. Multi-row writes that need atomicity
 * (submitting an RSVP, responding via an email token, adding a guest) are
 * delegated to the Postgres RPCs from the Phase 1 migration
 * (submit_rsvp_v2 / update_party_response / add_guest_to_party) rather than
 * reimplemented as sequential JS round-trips — that atomicity guarantee is
 * the whole reason those RPCs exist.
 */
const { supabase } = require('../config/supabase');
const logger = require('../utils/logger');
const { normalizeEmail, escapeLikePattern } = require('../utils/normalize');
const { normalizeToE164 } = require('../utils/phone');

const MAX_ADDITIONAL_GUESTS = 100;
const MAX_CUSTOM_ANSWERS = 200;
const SEATING_REVEAL_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

/** True once we're within 24h of the event start (seating may be shown to guests). */
function isSeatingRevealed(eventDate) {
  if (!eventDate) return false;
  const start = new Date(eventDate).getTime();
  if (Number.isNaN(start)) return false;
  return Date.now() >= start - SEATING_REVEAL_WINDOW_MS;
}

/** ISO timestamp of the moment seating unlocks (event start − 24h), or null. */
function seatingRevealAtISO(eventDate) {
  const start = new Date(eventDate).getTime();
  if (Number.isNaN(start)) return null;
  return new Date(start - SEATING_REVEAL_WINDOW_MS).toISOString();
}

/** Locale-aware natural comparator: "Table 2" < "Table 10", and orders Arabic names. */
function naturalCompare(a, b) {
  return String(a == null ? '' : a)
    .localeCompare(String(b == null ? '' : b), undefined, { numeric: true, sensitivity: 'base' });
}

/* ─────────────────────────────────────────────────────────────────────────
 * Atomic writes — delegate to the Phase 1 RPCs
 * ───────────────────────────────────────────────────────────────────────── */

/** Public RSVP form submission (insert or update). Mirrors submit_rsvp_v2's contract 1:1. */
async function submitPublicRsvp({
  slug, partyId, guestName, email, phone, response, partySize, notes,
  primaryMeal, additionalGuests, customAnswers, declineReason, maybeConfirmBy, side, smsConsent,
  dietaryNotes,
}) {
  const { data, error } = await supabase.rpc('submit_rsvp_v2', {
    p_slug: slug,
    p_party_id: partyId || null,
    p_guest_name: guestName,
    p_email: email || null,
    p_phone: phone || null,
    p_response: response,
    p_party_size: partySize || 1,
    p_notes: notes || null,
    p_primary_meal: primaryMeal || null,
    p_additional_guests: Array.isArray(additionalGuests) ? additionalGuests : [],
    p_custom_answers: Array.isArray(customAnswers) ? customAnswers : [],
    p_decline_reason: declineReason || null,
    p_maybe_confirm_by: maybeConfirmBy || null,
    p_side: side || null,
    p_sms_consent: !!smsConsent,
    p_primary_dietary_notes: dietaryNotes || null,
  });
  if (error) throw error;
  return data;
}

/** One-click email-button response (the token flow). */
async function respondToInvite({ eventId, partyId, response, partySize, additionalGuests, actor = 'guest', source = 'email' }) {
  const { data, error } = await supabase.rpc('update_party_response', {
    p_event_id: eventId,
    p_party_id: partyId,
    p_response: response,
    p_party_size: partySize ?? null,
    p_actor: actor,
    p_source: source,
    p_additional_guests: Array.isArray(additionalGuests) ? additionalGuests : [],
  });
  if (error) throw error;
  return data;
}

/**
 * Best-effort (non-atomic — see caller) check of the paid tier's guest cap
 * before adding `additionalCount` more committed (yes/maybe) guests. Mirrors
 * the tier_max_guests logic enforced atomically inside submit_rsvp_v2 and
 * add_guest_to_party, but this JS-side guard is needed for the extra-
 * companions bulk insert below, which happens as a second round-trip after
 * add_guest_to_party's own single-row RPC check and isn't covered by it.
 */
async function checkGuestCapacity(eventId, response, additionalCount) {
  if (!['yes', 'maybe'].includes(response) || additionalCount <= 0) return { ok: true };
  const { data: event } = await supabase.from('events').select('tier_max_guests, slug').eq('id', eventId).single();
  if (!event || event.slug === 'demo' || !event.tier_max_guests) return { ok: true };

  const { data: parties } = await supabase
    .from('rsvp_parties')
    .select('id, guests(id)')
    .eq('event_id', eventId)
    .in('response', ['yes', 'maybe']);
  const committed = (parties || []).reduce((sum, p) => sum + ((p.guests || []).length || 1), 0);
  if (committed + additionalCount > event.tier_max_guests) return { ok: false };
  return { ok: true };
}

/**
 * Organizer manually adds a guest — a new party (primary contact) or a companion
 * to an existing one. When partySize > 1 on a fresh party, the extra companions
 * are inserted directly (same reconciliation pattern as updateParty) since
 * add_guest_to_party only ever creates one person per call. Companion count is
 * driven purely by partySize regardless of `response` — matching updateParty,
 * so the same "party size" concept behaves identically from Add vs Edit.
 */
async function addGuest({
  eventId, actorUserId, fullName, phone, partyId = null, email = null, response = 'pending',
  partySize = 1, notes = null, side = null, primaryMeal = null,
}) {
  const isNewParty = !partyId;
  const extraCount = isNewParty ? Math.min(Math.max(partySize, 1), MAX_ADDITIONAL_GUESTS) - 1 : 0;

  if (extraCount > 0) {
    const capacity = await checkGuestCapacity(eventId, response, extraCount);
    if (!capacity.ok) {
      return { success: false, error: 'GUEST_LIMIT_REACHED', message: "This event has reached its plan's guest limit." };
    }
  }

  const { data, error } = await supabase.rpc('add_guest_to_party', {
    p_event_id: eventId,
    p_actor: actorUserId,
    p_full_name: fullName,
    p_party_id: partyId,
    p_phone: phone || null,
    p_email: email || null,
    p_response: response,
    p_side: side || null,
  });
  if (error) throw error;
  if (!data || data.success === false) return data;

  // add_guest_to_party has no meal parameter (meal_selection didn't exist when it
  // was written) — set it with a follow-up update on the guest row it just created
  // rather than threading a new RPC arg through for one field.
  if (primaryMeal && data.guest_id) {
    const { error: mealErr } = await supabase.from('guests').update({ meal_selection: primaryMeal }).eq('id', data.guest_id);
    if (mealErr) logger.error({ err: mealErr, guestId: data.guest_id }, '[addGuest] failed to set primary meal_selection');
  }

  if (isNewParty && (notes || extraCount > 0)) {
    const updates = {};
    if (notes) updates.notes = notes;
    if (Object.keys(updates).length > 0) {
      const { error: notesErr } = await supabase.from('rsvp_parties').update(updates).eq('id', data.party_id);
      if (notesErr) logger.error({ err: notesErr, partyId: data.party_id }, '[addGuest] failed to save party notes');
    }
    if (extraCount > 0) {
      const companions = Array.from({ length: extraCount }, (_, i) => ({
        party_id: data.party_id, event_id: eventId, full_name: `Guest ${i + 2}`, is_primary_contact: false,
      }));
      const { error: companionsErr } = await supabase.from('guests').insert(companions);
      if (companionsErr) logger.error({ err: companionsErr, partyId: data.party_id }, '[addGuest] failed to insert placeholder companions');
    }
  }
  return data;
}

/* ─────────────────────────────────────────────────────────────────────────
 * Public, PII-free reads (power the guest-facing resolvers)
 * ───────────────────────────────────────────────────────────────────────── */

/**
 * Resolves a party for the public invitation/discovery surfaces. NEVER
 * selects or returns email/phone/notes — a party id is an enumerable
 * capability that travels in shared invitation/SMS links.
 */
async function getPartyForPublicResolve(partyId) {
  const { data: party, error } = await supabase
    .from('rsvp_parties')
    .select(`
      id, label, response, created_by_organizer,
      events!inner(id, slug, is_paid, status, event_date),
      seating_assignments(tables(table_name)),
      guests(id)
    `)
    .eq('id', partyId)
    .single();

  if (error || !party) return null;

  const partySize = (party.guests || []).length || 1;
  // Organizer-added guests (CSV import / Add Guest) skip the 24h wait —
  // their identity/contact info is already confirmed by the organizer, so
  // there's no reason to hide their table from them. Genuinely self-serve
  // parties still wait for the normal window.
  const seatingRevealed = party.created_by_organizer === true || isSeatingRevealed(party.events.event_date);
  const tableName = seatingRevealed ? (party.seating_assignments?.[0]?.tables?.table_name || null) : null;

  return {
    id: party.id,
    eventId: party.events.id,
    label: party.label,
    response: party.response,
    partySize,
    event: party.events,
    seatingRevealed,
    revealAt: seatingRevealed ? null : seatingRevealAtISO(party.events.event_date),
    tableName,
  };
}

/** Name search for the public "find my invitation" surface. Min 2 chars enforced by the caller. */
async function searchPartiesPublic(eventId, term, limit = 10) {
  // SEC C7: Only fetch PII-free columns for the public surface.
  const { data, error } = await supabase
    .from('rsvp_parties')
    .select('id, label, response, guests(id, full_name, is_primary_contact)')
    .eq('event_id', eventId)
    .ilike('label', `%${escapeLikePattern(term)}%`)
    .limit(limit);

  if (error) throw error;

  return (data || []).map((item) => {
    const allGuests = item.guests || [];
    // We no longer fetch email in this query, so we check if the primary
    // contact exists (the claimable-party logic still works because
    // email-less parties are host-imported and withhold the id).
    const primary = allGuests.find((g) => g.is_primary_contact);
    const hasEmail = !!primary; // presence of a primary contact implies email was set at import
    return {
      // Only expose the partyId when the primary contact has an email — updating
      // such a record still requires a matching email, so the id is safe to
      // surface. Email-less (host-imported) parties withhold the id: their only
      // authorized entry point is the host's private invitation link.
      id: hasEmail ? item.id : null,
      guestName: item.label,
      response: item.response,
      partySize: allGuests.length || 1,
      // SEC C7: Only expose companion id and name — no PII (phone, email,
      // meal, dietary notes).
      additionalGuests: hasEmail
        ? allGuests.filter((g) => !g.is_primary_contact).map((g) => ({
            id: g.id,
            fullName: g.full_name || '',
          }))
        : [],
    };
  });
}

/**
 * "Find my table" verification — replaces the old name-only search, which
 * enumerated every attending party that matched a name (so typing a common
 * first name leaked strangers' tables + companion names). A guest must now
 * prove identity with BOTH their exact name AND the last 4 digits of the
 * primary contact's phone. We only ever return a seating map when EXACTLY ONE
 * attending party matches both factors; 0 matches and >1 ambiguous matches are
 * indistinguishable to the caller (returns null), so no information leaks about
 * who exists or which factor was wrong.
 */
/**
 * Public seating response shape — host first, then companions, with meal/
 * dietary notes so the result panel can distinguish the inviter from their
 * guests. Phone is deliberately omitted — the panel never needs it and we
 * don't want to echo PII back over a guest-facing endpoint.
 */
function shapeSeatingParty(partyRow) {
  const assignment = Array.isArray(partyRow.seating_assignments)
    ? partyRow.seating_assignments[0]
    : partyRow.seating_assignments;

  const members = (partyRow.guests || [])
    .slice()
    .sort((a, b) => (b.is_primary_contact ? 1 : 0) - (a.is_primary_contact ? 1 : 0))
    .map((g) => ({
      name: g.full_name,
      meal: g.meal_selection || null,
      isHost: !!g.is_primary_contact,
      dietaryNotes: g.dietary_notes || null,
    }))
    .filter((g) => g.name);

  return {
    party: { id: partyRow.id, label: partyRow.label, response: partyRow.response, partySize: members.length || 1 },
    myTableId: assignment?.table_id || null,
    myTableName: assignment?.tables?.table_name || null,
    companions: members,
    // Organizer-added guests (CSV import / Add Guest) bypass the 24h reveal
    // window — the caller (rsvpController) decides the final reveal/lock
    // using this alongside the event's own date-based rule.
    createdByOrganizer: partyRow.created_by_organizer === true,
  };
}

async function verifyGuestSeating(eventId, name, phoneLast4) {
  const cleanName = String(name || '').trim();
  const last4 = String(phoneLast4 || '').replace(/\D/g, '');
  if (!cleanName || last4.length !== 4) return null;

  // ilike with no wildcards = case-insensitive exact match on the party label.
  const { data, error } = await supabase
    .from('rsvp_parties')
    .select(`
      id, label, response, created_by_organizer,
      seating_assignments(table_id, tables(table_name)),
      guests(full_name, is_primary_contact, meal_selection, phone, dietary_notes)
    `)
    .eq('event_id', eventId)
    .eq('response', 'yes')
    .ilike('label', escapeLikePattern(cleanName))
    .limit(20);

  if (error) throw error;

  const matches = (data || []).filter((party) => {
    const primary = (party.guests || []).find((g) => g.is_primary_contact) || (party.guests || [])[0];
    const digits = String(primary?.phone || '').replace(/\D/g, '');
    return digits.length >= 4 && digits.slice(-4) === last4;
  });

  // Exactly one match or nothing — never disambiguate for the caller.
  if (matches.length !== 1) return null;
  return shapeSeatingParty(matches[0]);
}

/** Personal seating view: venue layout + this party's own table + own companions. Never other parties. */
async function getPartySeatingMap(eventId, partyId) {
  const { data: party, error } = await supabase
    .from('rsvp_parties')
    .select(`
      id, label, response, created_by_organizer,
      seating_assignments(table_id, tables(table_name)),
      guests(full_name, is_primary_contact, meal_selection, dietary_notes)
    `)
    .eq('id', partyId)
    .eq('event_id', eventId)
    .single();

  if (error || !party) return null;
  return shapeSeatingParty(party);
}

/* ─────────────────────────────────────────────────────────────────────────
 * Organizer dashboard reads/writes
 * ───────────────────────────────────────────────────────────────────────── */

/**
 * Lists parties for an event with server-side filtering + pagination.
 *
 * All filtering (response, name search, seated/unseated, meal, custom-answer),
 * ordering, paging, AND the exact total happen inside the get_event_parties RPC
 * in ONE round trip. The previous implementation resolved the cross-table filters
 * by pulling id-sets into Node, intersecting them here, then re-querying with a
 * (potentially enormous) `.in('id', [...])`; an earlier version even capped the
 * post-filtered set at 5,000 rows, so large filtered events reported short pages
 * and wrong totals. The RPC returns the SAME nested shape the old PostgREST embed
 * did (see migration 20260713000000), so the frontend mapping is unchanged.
 */
async function listParties(eventId, {
  response, search, seated, sort, meal, customFieldId, customFieldValue, page = 1, limit = 50,
} = {}) {
  const safeLimit = Math.min(limit, 100);
  const offset = (page - 1) * safeLimit;

  // Validate the discriminated inputs here so only known-safe values reach the RPC.
  const validResponse = response && ['yes', 'no', 'maybe', 'pending', 'waitlist'].includes(response) ? response : null;
  const validSeated = seated === 'true' || seated === 'false' ? seated : null;
  const validSort = ['name_asc', 'name_desc', 'date_asc'].includes(sort) ? sort : null;
  // Pre-escape the search term so a guest-typed %/_ can't act as an ILIKE wildcard
  // (the RPC only adds the match-anywhere %…%). Mirrors the old .ilike() escaping.
  const searchTerm = search && search.trim() ? escapeLikePattern(search.trim()) : null;

  const { data, error } = await supabase.rpc('get_event_parties', {
    p_event_id: eventId,
    p_response: validResponse,
    p_search: searchTerm,
    p_seated: validSeated,
    p_meal: meal && meal.trim() ? meal.trim() : null,
    p_custom_field_id: customFieldId || null,
    p_custom_field_value: customFieldValue != null && String(customFieldValue).trim() ? String(customFieldValue).trim() : null,
    p_sort: validSort,
    p_limit: safeLimit,
    p_offset: offset,
  });
  if (error) throw error;

  const parties = (data && data.parties) || [];
  const total = data && Number.isFinite(Number(data.total)) ? Number(data.total) : 0;

  return {
    parties,
    pagination: { page, limit: safeLimit, count: parties.length, total },
  };
}

/** Organizer edit of a party + its guests (full reconciliation of the headcount). */
async function updateParty(eventId, partyId, {
  guestName, email, phone, response, partySize, notes, primaryMeal, additionalGuests, side,
}) {
  const updates = {};
  if (guestName !== undefined) updates.label = guestName.trim();
  if (response !== undefined) updates.response = response;
  if (notes !== undefined) updates.notes = notes;
  if (side !== undefined) updates.side = side || null;

  const { data: party, error } = await supabase
    .from('rsvp_parties')
    .update(updates)
    .eq('id', partyId)
    .eq('event_id', eventId)
    .select('*, guests(*), seating_assignments(id, table_id, tables(table_name))')
    .single();

  if (error) throw error;
  if (!party) return null;

  // Reconcile guests whenever party_size, name/contact, or guest detail
  // changed — regardless of `response`, matching addGuest (which creates
  // companions purely from partySize with no response gate). Previously this
  // was gated on effectiveResponse === 'yes', so editing a Maybe/Pending/No
  // guest's party size silently did nothing.
  const guestDetailProvided = additionalGuests !== undefined || primaryMeal !== undefined
    || guestName !== undefined || email !== undefined || phone !== undefined;
  const partySizeProvided = partySize !== undefined;

  if (guestDetailProvided || partySizeProvided) {
    const existing = party.guests || [];
    const existingPrimary = existing.find((g) => g.is_primary_contact);
    const existingAdditional = existing.filter((g) => !g.is_primary_contact);
    const effectivePartySize = partySize !== undefined
      ? Math.min(Math.max(parseInt(partySize) || 1, 1), 20)
      : Math.max(existing.length, 1);
    const provided = Array.isArray(additionalGuests) ? additionalGuests : null;

    // SEC C12: Atomic guest reconciliation — upsert existing, insert new, delete removed.
    // Build the desired guest list first.
    const primaryRow = {
      party_id: partyId,
      event_id: eventId,
      full_name: guestName !== undefined ? guestName.trim() : (existingPrimary?.full_name || party.label),
      email: email !== undefined ? normalizeEmail(email) : (existingPrimary?.email || null),
      phone: phone !== undefined ? (phone ? normalizeToE164(phone) : null) : (existingPrimary?.phone || null),
      is_primary_contact: true,
      meal_selection: primaryMeal !== undefined ? (primaryMeal || null) : (existingPrimary?.meal_selection || null),
    };
    // If the primary already exists, update in place; otherwise insert.
    if (existingPrimary?.id) {
      primaryRow.id = existingPrimary.id;
    }

    const companionRows = [];
    const keepGuestIds = new Set();
    if (existingPrimary?.id) keepGuestIds.add(existingPrimary.id);

    for (let i = 0; i < Math.max(0, effectivePartySize - 1); i++) {
      const fromBody = provided ? provided[i] : null;
      const prev = existingAdditional[i];
      const row = {
        party_id: partyId,
        event_id: eventId,
        full_name: (fromBody?.fullName && fromBody.fullName.trim()) || prev?.full_name || `Guest ${i + 2}`,
        is_primary_contact: false,
        email: fromBody && fromBody.email !== undefined ? (normalizeEmail(fromBody.email) || null) : (prev?.email || null),
        phone: fromBody && fromBody.phone !== undefined ? (fromBody.phone ? normalizeToE164(fromBody.phone) : null) : (prev?.phone || null),
        meal_selection: fromBody ? (fromBody.mealSelection || null) : (prev?.meal_selection || null),
        dietary_notes: fromBody ? (fromBody.dietaryNotes || null) : (prev?.dietary_notes || null),
      };
      if (prev?.id) {
        row.id = prev.id;
        keepGuestIds.add(prev.id);
      }
      companionRows.push(row);
    }

    const allRows = [primaryRow, ...companionRows];

    // Determine which existing guests should be removed (not in the new list).
    const existingIds = existing.map((g) => g.id).filter(Boolean);
    const toDelete = existingIds.filter((id) => !keepGuestIds.has(id));

    try {
      // Upsert all desired guests (update existing by id, insert new ones).
      const { error: upsertErr } = await supabase.from('guests').upsert(allRows, { onConflict: 'id' });
      if (upsertErr) throw upsertErr;

      // Delete only the guests that were removed from the party.
      if (toDelete.length > 0) {
        const { error: delErr } = await supabase.from('guests').delete().in('id', toDelete).eq('party_id', partyId);
        if (delErr) throw delErr;
      }
    } catch (reconcileErr) {
      // C12: Log the error with original guest data so recovery is possible.
      logger.error({
        err: reconcileErr, partyId, eventId,
        originalGuestIds: existingIds, desiredGuestCount: allRows.length,
      }, '[updateParty] guest reconciliation failed — original guests preserved where possible');
      throw reconcileErr;
    }
  }

  // Seating cleanup on response leaving 'yes' is handled by trg_party_response_change.

  return party;
}

/** Deletes a party and its related data (guests/custom_answers cascade via FK). */
async function deleteParty(eventId, partyId) {
  await supabase.from('seating_assignments').delete().eq('event_id', eventId).eq('party_id', partyId);
  const { error } = await supabase.from('rsvp_parties').delete().eq('id', partyId).eq('event_id', eventId);
  if (error) throw error;
}

/** Aggregated stats for the dashboard cards. */
async function getStats(eventId) {
  const { data: parties, error } = await supabase
    .from('rsvp_parties').select('response, guests(id)').eq('event_id', eventId);
  if (error) throw error;

  const { count: invitationsSent } = await supabase
    .from('invitations').select('party_id', { count: 'exact', head: true })
    .eq('event_id', eventId).in('status', ['sent', 'delivered', 'opened', 'responded']);

  const stats = {
    totalParties: parties.length, totalGuests: 0, invitationsSent: invitationsSent || 0,
    acceptedParties: 0, acceptedGuests: 0, declinedParties: 0, maybeParties: 0, pendingParties: 0, waitlistParties: 0,
  };
  parties.forEach((p) => {
    const size = (p.guests || []).length || 1;
    stats.totalGuests += size;
    if (p.response === 'yes') { stats.acceptedParties++; stats.acceptedGuests += size; }
    else if (p.response === 'no') stats.declinedParties++;
    else if (p.response === 'maybe') stats.maybeParties++;
    else if (p.response === 'waitlist') stats.waitlistParties++;
    else stats.pendingParties++;
  });
  return stats;
}

/**
 * Bulk-creates parties from parsed CSV/XLSX rows via add_guest_to_party (one
 * RPC call per row). Each row's party+primary-guest insert is atomic and
 * dedup-safe — slower than the old single bulk `.insert()` into one flat
 * table, but correct: a partial chunk failure can no longer leave an
 * orphaned party with no guest row.
 */
async function importGuests(eventId, actorUserId, rows) {
  const CONCURRENCY = 20;
  const imported = [];
  const errors = [];
  let skippedExisting = 0;

  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const batch = rows.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(batch.map((row) => addGuest({
      eventId,
      actorUserId,
      fullName: row.guest_name || 'Unnamed Guest',
      phone: row.phone || null,
      email: row.email || null,
      response: 'pending',
      partySize: row.party_size || 1,
      notes: row.notes || null,
      side: row.side || null,
    })));

    results.forEach((r, idx) => {
      const row = batch[idx];
      if (r.status === 'fulfilled' && r.value?.success) {
        imported.push({ id: r.value.guest_id, guest_name: row.guest_name });
      } else if (r.status === 'fulfilled' && r.value?.error === 'DUPLICATE_GUEST') {
        skippedExisting++;
      } else if (r.status === 'rejected' && r.reason?.code === 'P0001' && /GUEST_LIMIT_REACHED/.test(r.reason.message || '')) {
        errors.push({ guest_name: row.guest_name, error: 'GUEST_LIMIT_REACHED — this event\'s plan guest limit has been reached.' });
      } else {
        errors.push({ guest_name: row.guest_name, error: r.status === 'fulfilled' ? r.value?.message : String(r.reason) });
      }
    });
  }

  return { imported, skippedExisting, errors };
}

/** Export dataset for CSV/Excel. */
async function exportParties(eventId, { attendingOnly, sort } = {}) {
  const EXPORT_LIMIT = 10000;
  const { data: parties, error } = await supabase
    .from('rsvp_parties')
    .select(`
      id, label, response, notes, side,
      guests(full_name, email, phone, is_primary_contact, meal_selection),
      seating_assignments(table_id, tables(table_name)),
      check_ins(checked_in_at, method)
    `)
    .eq('event_id', eventId)
    .limit(EXPORT_LIMIT);
  if (error) throw error;

  let rows = parties || [];

  // M18: Warn when the export limit is hit — data may be truncated.
  const exportTruncated = rows.length >= EXPORT_LIMIT;
  if (exportTruncated) {
    logger.warn({ eventId, limit: EXPORT_LIMIT }, '[exportParties] export limit reached — export may be incomplete');
  }

  if (attendingOnly) rows = rows.filter((p) => p.response === 'yes');

  const tableNameOf = (p) => {
    const sa = p.seating_assignments;
    const first = Array.isArray(sa) ? sa[0] : sa;
    return first?.tables?.table_name || '';
  };

  if (sort === 'table') {
    rows = [...rows].sort((a, b) => {
      const ta = tableNameOf(a), tb = tableNameOf(b);
      if (!ta && tb) return 1;
      if (ta && !tb) return -1;
      const cmp = naturalCompare(ta, tb);
      return cmp !== 0 ? cmp : naturalCompare(a.label, b.label);
    });
  } else if (sort === 'name') {
    rows = [...rows].sort((a, b) => naturalCompare(a.label, b.label));
  }

  const mapped = rows.map((p) => {
    const primary = (p.guests || []).find((g) => g.is_primary_contact) || {};
    const partySize = (p.guests || []).length || 1;
    // Name-attributed so a party with different meals per person is legible in
    // the export ("John: Chicken; Guest 2: Fish") instead of an ambiguous
    // semicolon-joined blob with no way to tell whose meal is whose.
    const meals = (p.guests || []).filter((g) => g.meal_selection)
      .map((g) => `${g.full_name}: ${g.meal_selection}`).join('; ');
    const tableName = tableNameOf(p);
    const checkIns = p.check_ins || [];
    return {
      guest_name: p.label,
      email: primary.email || '',
      phone: primary.phone || '',
      response: p.response,
      party_size: partySize,
      side: p.side || '',
      table_name: tableName,
      meal_selections: meals,
      checked_in: checkIns.length > 0 ? 'Yes' : 'No',
      checked_in_at: checkIns[0]?.checked_in_at || '',
      check_in_method: checkIns[0]?.method || '',
      notes: p.notes || '',
      guests: p.guests || [],
    };
  });

  // M18: Return metadata so the caller can inform the user about truncation.
  return {
    rows: mapped,
    meta: {
      total: mapped.length,
      truncated: exportTruncated,
      limit: EXPORT_LIMIT,
    },
  };
}

/* ─────────────────────────────────────────────────────────────────────────
 * Check-in — per-guest rows, party-level scan/search semantics
 * ───────────────────────────────────────────────────────────────────────── */

/**
 * Checks in every guest belonging to a party in one shot (QR scan / manual
 * party lookup / self-service all check in the whole arriving group). Each
 * individual still gets their own `check_ins` row — replacing the old
 * `party_count_arrived` integer with real per-person arrival data — but a
 * guest already checked in is silently skipped rather than re-inserted.
 */
async function checkInParty(eventId, partyId, { method, checkedInBy = null } = {}) {
  const { data: guests, error: guestsErr } = await supabase
    .from('guests').select('id, full_name').eq('party_id', partyId).eq('event_id', eventId);
  if (guestsErr) throw guestsErr;
  if (!guests || guests.length === 0) return { success: false, error: 'GUEST_NOT_FOUND' };

  const { data: existing, error: existingErr } = await supabase
    .from('check_ins').select('guest_id, checked_in_at').eq('event_id', eventId).in('guest_id', guests.map((g) => g.id));
  if (existingErr) throw existingErr;
  const alreadyIn = new Set((existing || []).map((e) => e.guest_id));

  if (alreadyIn.size === guests.length) {
    return { success: false, error: 'ALREADY_CHECKED_IN', checkedInAt: existing[0]?.checked_in_at, totalGuests: guests.length };
  }

  const toInsert = guests
    .filter((g) => !alreadyIn.has(g.id))
    .map((g) => ({ event_id: eventId, guest_id: g.id, party_id: partyId, method, checked_in_by: checkedInBy }));

  let inserted;
  try {
    const { data, error } = await supabase.from('check_ins').insert(toInsert).select('id, guest_id, checked_in_at');
    if (error) throw error;
    inserted = data;
  } catch (err) {
    // A concurrent check-in (double-tap on a flaky venue connection, or a
    // client-side retry after a lost response) can race the read-then-insert
    // above: both calls see "not yet checked in" before either commits, and
    // the loser's INSERT then hits check_ins' UNIQUE(event_id, guest_id) and
    // previously surfaced as a raw unhandled 500 instead of the same friendly
    // ALREADY_CHECKED_IN this function already returns for the non-racy case.
    if (err.code === '23505' || /duplicate key/i.test(err.message || '')) {
      const { data: recheck, error: recheckErr } = await supabase
        .from('check_ins').select('guest_id, checked_in_at').eq('event_id', eventId).in('guest_id', guests.map((g) => g.id));
      if (recheckErr) throw recheckErr;
      const nowIn = new Set((recheck || []).map((e) => e.guest_id));
      if (nowIn.size === guests.length) {
        return { success: false, error: 'ALREADY_CHECKED_IN', checkedInAt: recheck[0]?.checked_in_at, totalGuests: guests.length };
      }
      // A mix of newly-checked-in (by the winning concurrent call) and still-
      // outstanding guests — retry with only what's actually still missing.
      const retryInsert = guests
        .filter((g) => !nowIn.has(g.id))
        .map((g) => ({ event_id: eventId, guest_id: g.id, party_id: partyId, method, checked_in_by: checkedInBy }));
      const { data: retryData, error: retryErr } = await supabase.from('check_ins').insert(retryInsert).select('id, guest_id, checked_in_at');
      if (retryErr) throw retryErr;
      inserted = retryData;
    } else {
      throw err;
    }
  }

  return {
    success: true,
    checkedInCount: inserted.length,
    totalGuests: guests.length,
    alreadyCheckedIn: guests.length - inserted.length,
    checkedInAt: inserted[0]?.checked_in_at,
  };
}

/** Reverses every check-in for a party (the staff "undo" action). */
async function undoPartyCheckIn(eventId, partyId) {
  const { data, error } = await supabase
    .from('check_ins').delete().eq('event_id', eventId).eq('party_id', partyId).select();
  if (error) throw error;
  return data?.length || 0;
}

/** Autocomplete search for the check-in desk: name, party size, table, arrival status, meals. */
async function searchGuestsForCheckin(eventId, term, limit = 10) {
  const { data, error } = await supabase
    .from('rsvp_parties')
    .select(`
      id, label, response,
      guests(id, full_name, meal_selection, dietary_notes),
      seating_assignments(tables(table_name)),
      check_ins(id, checked_in_at, guest_id)
    `)
    .eq('event_id', eventId)
    .ilike('label', `%${escapeLikePattern(term)}%`)
    .limit(limit);
  if (error) throw error;

  return (data || []).map((p) => {
    const totalGuests = (p.guests || []).length || 1;
    const checkedInGuestIds = new Set((p.check_ins || []).map((c) => c.guest_id));
    const checkedInCount = (p.guests || []).filter((g) => checkedInGuestIds.has(g.id)).length;
    const seating = Array.isArray(p.seating_assignments) ? p.seating_assignments[0] : p.seating_assignments;
    return {
      id: p.id,
      guestName: p.label,
      partySize: totalGuests,
      response: p.response,
      tableName: seating?.tables?.table_name || 'Unassigned',
      isCheckedIn: checkedInCount > 0,
      checkedInCount,
      totalGuests,
      checkedInAt: (p.check_ins || [])[0]?.checked_in_at || null,
      meals: (p.guests || []).map((g) => ({ fullName: g.full_name, mealSelection: g.meal_selection, dietaryNotes: g.dietary_notes })),
    };
  });
}

/** Resolves a party by id + name match (the mandatory second factor for self-check-in). */
async function getPartyForSelfCheckIn(eventId, partyId, guestName) {
  const { data: party, error } = await supabase
    .from('rsvp_parties')
    .select('id, label, guests(id), seating_assignments(tables(table_name))')
    .eq('id', partyId).eq('event_id', eventId).single();
  if (error || !party) return null;
  if (party.label.trim().toLowerCase() !== String(guestName).trim().toLowerCase()) return { nameMismatch: true };
  const seating = Array.isArray(party.seating_assignments) ? party.seating_assignments[0] : party.seating_assignments;
  return {
    id: party.id, label: party.label, partySize: (party.guests || []).length || 1,
    tableName: seating?.tables?.table_name || 'Unassigned',
  };
}

module.exports = {
  MAX_ADDITIONAL_GUESTS,
  MAX_CUSTOM_ANSWERS,
  isSeatingRevealed,
  seatingRevealAtISO,
  submitPublicRsvp,
  respondToInvite,
  addGuest,
  getPartyForPublicResolve,
  searchPartiesPublic,
  verifyGuestSeating,
  getPartySeatingMap,
  listParties,
  updateParty,
  deleteParty,
  getStats,
  importGuests,
  exportParties,
  checkInParty,
  undoPartyCheckIn,
  searchGuestsForCheckin,
  getPartyForSelfCheckIn,
};
