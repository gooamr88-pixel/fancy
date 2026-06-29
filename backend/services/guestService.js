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
  primaryMeal, additionalGuests, customAnswers, declineReason, maybeConfirmBy,
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
  });
  if (error) throw error;
  return data;
}

/** One-click email-button response (the token flow). */
async function respondToInvite({ eventId, partyId, response, partySize, actor = 'guest', source = 'email' }) {
  const { data, error } = await supabase.rpc('update_party_response', {
    p_event_id: eventId,
    p_party_id: partyId,
    p_response: response,
    p_party_size: partySize ?? null,
    p_actor: actor,
    p_source: source,
  });
  if (error) throw error;
  return data;
}

/**
 * Organizer manually adds a guest — a new party (primary contact) or a companion
 * to an existing one. When partySize > 1 on a fresh party, the extra companions
 * are inserted directly (same reconciliation pattern as updateParty) since
 * add_guest_to_party only ever creates one person per call.
 */
async function addGuest({
  eventId, actorUserId, fullName, phone, partyId = null, email = null, response = 'pending',
  partySize = 1, notes = null,
}) {
  const { data, error } = await supabase.rpc('add_guest_to_party', {
    p_event_id: eventId,
    p_actor: actorUserId,
    p_full_name: fullName,
    p_party_id: partyId,
    p_phone: phone || null,
    p_email: email || null,
    p_response: response,
  });
  if (error) throw error;
  if (!data || data.success === false) return data;

  const isNewParty = !partyId;
  if (isNewParty && (notes || partySize > 1)) {
    const updates = {};
    if (notes) updates.notes = notes;
    if (Object.keys(updates).length > 0) {
      await supabase.from('rsvp_parties').update(updates).eq('id', data.party_id);
    }
    const extraCount = Math.min(Math.max(partySize, 1), MAX_ADDITIONAL_GUESTS) - 1;
    if (extraCount > 0) {
      const companions = Array.from({ length: extraCount }, (_, i) => ({
        party_id: data.party_id, event_id: eventId, full_name: `Guest ${i + 2}`, is_primary_contact: false,
      }));
      await supabase.from('guests').insert(companions);
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
      id, label, response,
      events!inner(slug, is_paid, status, event_date),
      seating_assignments(tables(table_name)),
      guests(id)
    `)
    .eq('id', partyId)
    .single();

  if (error || !party) return null;

  const partySize = (party.guests || []).length || 1;
  const seatingRevealed = isSeatingRevealed(party.events.event_date);
  const tableName = seatingRevealed ? (party.seating_assignments?.[0]?.tables?.table_name || null) : null;

  return {
    id: party.id,
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
  const { data, error } = await supabase
    .from('rsvp_parties')
    .select('id, label, response, guests(id, full_name, is_primary_contact, email, phone, meal_selection, dietary_notes, age_group, relationship, gender)')
    .eq('event_id', eventId)
    .ilike('label', `%${escapeLikePattern(term)}%`)
    .limit(limit);

  if (error) throw error;

  return (data || []).map((item) => {
    const allGuests = item.guests || [];
    const hasEmail = allGuests.some((g) => g.is_primary_contact && g.email);
    return {
      // Only expose the partyId when the primary contact has an email — updating
      // such a record still requires a matching email, so the id is safe to
      // surface. Email-less (host-imported) parties withhold the id: their only
      // authorized entry point is the host's private invitation link.
      id: hasEmail ? item.id : null,
      guestName: item.label,
      response: item.response,
      partySize: allGuests.length || 1,
      // Companions already on file — only meaningful when claimable (id is set);
      // an unclaimable result never reaches the form that would consume this.
      additionalGuests: hasEmail
        ? allGuests.filter((g) => !g.is_primary_contact).map((g) => ({
            id: g.id,
            fullName: g.full_name || '',
            mealSelection: g.meal_selection || '',
            dietaryNotes: g.dietary_notes || '',
            phone: g.phone || '',
            ageGroup: g.age_group || '',
            relationship: g.relationship || '',
            gender: g.gender || '',
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
 * Public seating response shape — host first, then companions, with the new
 * detail fields (age, relationship, gender, dietary notes) so the result panel
 * can distinguish the inviter from their guests. Phone is deliberately omitted
 * — the panel never needs it and we don't want to echo PII back over a guest-
 * facing endpoint.
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
      ageGroup: g.age_group || null,
      relationship: g.relationship || null,
      gender: g.gender || null,
      dietaryNotes: g.dietary_notes || null,
    }))
    .filter((g) => g.name);

  return {
    party: { id: partyRow.id, label: partyRow.label, response: partyRow.response, partySize: members.length || 1 },
    myTableId: assignment?.table_id || null,
    myTableName: assignment?.tables?.table_name || null,
    companions: members,
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
      id, label, response,
      seating_assignments(table_id, tables(table_name)),
      guests(full_name, is_primary_contact, meal_selection, phone, age_group, relationship, gender, dietary_notes)
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
      id, label, response,
      seating_assignments(table_id, tables(table_name)),
      guests(full_name, is_primary_contact, meal_selection, age_group, relationship, gender, dietary_notes)
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
 * The seated/meal/custom-answer filters live on related tables, so we
 * resolve them to a set of allowed party ids BEFORE paging — filtering
 * the already-paged result (the pre-rebuild approach) produced short or
 * empty pages and a misleading total.
 */
async function listParties(eventId, {
  response, search, seated, sort, meal, customFieldId, customFieldValue, page = 1, limit = 50,
} = {}) {
  const safeLimit = Math.min(limit, 100);
  const from = (page - 1) * safeLimit;
  const to = from + safeLimit - 1;

  const hasPostFilter = seated === 'true' || seated === 'false' || !!(meal && meal.trim()) || !!customFieldId;
  const POST_FILTER_FETCH_CAP = 5000;

  const idSets = [];
  let excludeSeatedIds = null;

  if (seated === 'true' || seated === 'false') {
    const { data: seatRows, error: seatErr } = await supabase
      .from('seating_assignments').select('party_id').eq('event_id', eventId);
    if (seatErr) throw seatErr;
    const seatedIds = new Set((seatRows || []).map((r) => r.party_id));
    if (seated === 'true') idSets.push(seatedIds);
    else excludeSeatedIds = seatedIds;
  }

  if (meal && meal.trim()) {
    const { data: mealRows, error: mealErr } = await supabase
      .from('guests').select('party_id, rsvp_parties!inner(event_id)')
      .eq('rsvp_parties.event_id', eventId).eq('meal_selection', meal.trim());
    if (mealErr) throw mealErr;
    idSets.push(new Set((mealRows || []).map((r) => r.party_id)));
  }

  if (customFieldId) {
    const { data: caRows, error: caErr } = await supabase
      .from('custom_answers').select('party_id, answer_value, rsvp_parties!inner(event_id)')
      .eq('rsvp_parties.event_id', eventId).eq('field_id', customFieldId);
    if (caErr) throw caErr;
    let matching = caRows || [];
    if (customFieldValue) {
      const want = String(customFieldValue).trim().toLowerCase();
      matching = matching.filter((a) => String(a.answer_value).trim().toLowerCase() === want);
    }
    idSets.push(new Set(matching.map((r) => r.party_id)));
  }

  let allowedIds = null;
  if (idSets.length > 0) {
    allowedIds = idSets.reduce((acc, s) => (acc === null ? s : new Set([...acc].filter((x) => s.has(x)))), null);
  }
  if (excludeSeatedIds && allowedIds) {
    allowedIds = new Set([...allowedIds].filter((x) => !excludeSeatedIds.has(x)));
  }

  if (allowedIds && allowedIds.size === 0) {
    return { parties: [], pagination: { page, limit: safeLimit, count: 0, total: 0 } };
  }

  const applyIdConstraints = (q) => {
    if (allowedIds) return q.in('id', [...allowedIds]);
    if (excludeSeatedIds && excludeSeatedIds.size > 0) {
      return q.not('id', 'in', `(${[...excludeSeatedIds].join(',')})`);
    }
    return q;
  };

  const select = '*, guests(*), custom_answers(*), seating_assignments(id, table_id, tables(table_name)), invitations(channel, status)';
  let query = supabase.from('rsvp_parties').select(select, { count: 'exact' }).eq('event_id', eventId);

  if (response && ['yes', 'no', 'maybe', 'pending', 'waitlist'].includes(response)) {
    query = query.eq('response', response);
  }
  if (search && search.trim()) {
    query = query.ilike('label', `%${escapeLikePattern(search.trim())}%`);
  }
  query = applyIdConstraints(query);

  switch (sort) {
    case 'name_asc': query = query.order('label', { ascending: true }); break;
    case 'name_desc': query = query.order('label', { ascending: false }); break;
    case 'date_asc': query = query.order('created_at', { ascending: true }); break;
    default: query = query.order('created_at', { ascending: false });
  }

  query = hasPostFilter ? query.limit(POST_FILTER_FETCH_CAP) : query.range(from, to);
  const { data: parties, error, count: totalCount } = await query;
  if (error) throw error;

  let filtered = parties || [];
  if (seated === 'true') filtered = filtered.filter((p) => p.seating_assignments && p.seating_assignments.length > 0);
  else if (seated === 'false') filtered = filtered.filter((p) => !p.seating_assignments || p.seating_assignments.length === 0);
  if (meal && meal.trim()) {
    filtered = filtered.filter((p) => (p.guests || []).some((g) => g.meal_selection === meal.trim()));
  }
  if (customFieldId) {
    filtered = filtered.filter((p) => (p.custom_answers || []).some((a) =>
      a.field_id === customFieldId &&
      (!customFieldValue || String(a.answer_value).trim().toLowerCase() === String(customFieldValue).trim().toLowerCase())
    ));
  }

  let pageItems, total;
  if (hasPostFilter) {
    total = filtered.length;
    pageItems = filtered.slice(from, to + 1);
  } else {
    pageItems = filtered;
    total = totalCount;
  }

  return { parties: pageItems, pagination: { page, limit: safeLimit, count: pageItems.length, total } };
}

/** Organizer edit of a party + its guests (full reconciliation of the headcount). */
async function updateParty(eventId, partyId, {
  guestName, email, phone, response, partySize, notes, primaryMeal, additionalGuests,
}) {
  const updates = {};
  if (guestName !== undefined) updates.label = guestName.trim();
  if (response !== undefined) updates.response = response;
  if (notes !== undefined) updates.notes = notes;

  const { data: party, error } = await supabase
    .from('rsvp_parties')
    .update(updates)
    .eq('id', partyId)
    .eq('event_id', eventId)
    .select('*, guests(*), seating_assignments(id, table_id, tables(table_name))')
    .single();

  if (error) throw error;
  if (!party) return null;

  // Reconcile guests whenever party_size, name/contact, or guest detail changed.
  const effectiveResponse = updates.response !== undefined ? updates.response : party.response;
  const guestDetailProvided = additionalGuests !== undefined || primaryMeal !== undefined
    || guestName !== undefined || email !== undefined || phone !== undefined;
  const partySizeProvided = partySize !== undefined;

  if (effectiveResponse === 'yes' && (guestDetailProvided || partySizeProvided)) {
    const existing = party.guests || [];
    const existingPrimary = existing.find((g) => g.is_primary_contact);
    const existingAdditional = existing.filter((g) => !g.is_primary_contact);
    const effectivePartySize = partySize !== undefined
      ? Math.min(Math.max(parseInt(partySize) || 1, 1), 20)
      : Math.max(existing.length, 1);
    const provided = Array.isArray(additionalGuests) ? additionalGuests : null;

    const guestRows = [{
      party_id: partyId,
      event_id: eventId,
      full_name: guestName !== undefined ? guestName.trim() : (existingPrimary?.full_name || party.label),
      email: email !== undefined ? normalizeEmail(email) : (existingPrimary?.email || null),
      phone: phone !== undefined ? (phone ? normalizeToE164(phone) : null) : (existingPrimary?.phone || null),
      is_primary_contact: true,
      meal_selection: primaryMeal !== undefined ? (primaryMeal || null) : (existingPrimary?.meal_selection || null),
    }];

    for (let i = 0; i < Math.max(0, effectivePartySize - 1); i++) {
      const fromBody = provided ? provided[i] : null;
      const prev = existingAdditional[i];
      guestRows.push({
        party_id: partyId,
        event_id: eventId,
        full_name: (fromBody?.fullName && fromBody.fullName.trim()) || prev?.full_name || `Guest ${i + 2}`,
        is_primary_contact: false,
        meal_selection: fromBody ? (fromBody.mealSelection || null) : (prev?.meal_selection || null),
        dietary_notes: fromBody ? (fromBody.dietaryNotes || null) : (prev?.dietary_notes || null),
      });
    }

    await supabase.from('guests').delete().eq('party_id', partyId);
    await supabase.from('guests').insert(guestRows);
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
    })));

    results.forEach((r, idx) => {
      const row = batch[idx];
      if (r.status === 'fulfilled' && r.value?.success) {
        imported.push({ id: r.value.guest_id, guest_name: row.guest_name });
      } else if (r.status === 'fulfilled' && r.value?.error === 'DUPLICATE_GUEST') {
        skippedExisting++;
      } else {
        errors.push({ guest_name: row.guest_name, error: r.status === 'fulfilled' ? r.value?.message : String(r.reason) });
      }
    });
  }

  return { imported, skippedExisting, errors };
}

/** Export dataset for CSV/Excel. */
async function exportParties(eventId, { attendingOnly, sort } = {}) {
  const { data: parties, error } = await supabase
    .from('rsvp_parties')
    .select(`
      id, label, response, notes,
      guests(full_name, email, phone, is_primary_contact, meal_selection),
      seating_assignments(table_id, tables(table_name)),
      check_ins(checked_in_at, method)
    `)
    .eq('event_id', eventId)
    .limit(10000);
  if (error) throw error;

  let rows = parties || [];
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

  return rows.map((p) => {
    const primary = (p.guests || []).find((g) => g.is_primary_contact) || {};
    const partySize = (p.guests || []).length || 1;
    const meals = (p.guests || []).map((g) => g.meal_selection).filter(Boolean).join('; ');
    const tableName = tableNameOf(p);
    const checkIns = p.check_ins || [];
    return {
      guest_name: p.label,
      email: primary.email || '',
      phone: primary.phone || '',
      response: p.response,
      party_size: partySize,
      table_name: tableName,
      meal_selections: meals,
      checked_in: checkIns.length > 0 ? 'Yes' : 'No',
      checked_in_at: checkIns[0]?.checked_in_at || '',
      check_in_method: checkIns[0]?.method || '',
      notes: p.notes || '',
      guests: p.guests || [],
    };
  });
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

  const { data: inserted, error } = await supabase.from('check_ins').insert(toInsert).select('id, guest_id, checked_in_at');
  if (error) throw error;

  return {
    success: true,
    checkedInCount: inserted.length,
    totalGuests: guests.length,
    alreadyCheckedIn: alreadyIn.size,
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
