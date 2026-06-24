const { supabase } = require('../config/supabase');
const logger = require('../utils/logger');
const notificationService = require('../utils/notificationService');
const { parseCSV, generateCSV } = require('../utils/csvHelper');
const { escapeHtml, getDeclineConfirmationTemplate, getNewRsvpOrganizerTemplate } = require('../utils/emailTemplates');
const { verifyRsvpToken, mapIntentToResponse } = require('../utils/rsvpToken');
const { broadcast } = require('../utils/realtime');

/** Escape special characters in user input before using it in a LIKE / ILIKE pattern. */
function escapeLikePattern(str) {
  return str.replace(/[%_\\]/g, '\\$&');
}

/** Maps a submit_rsvp() failure code to its HTTP status. */
const RSVP_ERROR_STATUS = {
  EVENT_NOT_FOUND: 404,
  PAYMENT_REQUIRED: 402,
  EVENT_UNDER_REVIEW: 403,
  DEADLINE_PASSED: 400,
  RSVP_NOT_FOUND: 404,
  RSVP_OWNERSHIP_FAILED: 403,
  DUPLICATE_RSVP: 409,
  VALIDATION_ERROR: 400,
  MEAL_REQUIRED: 400,
  MEAL_INVALID: 400,
};

/** Guest-facing seating becomes visible only within this window before event start. */
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

/**
 * Sort RSVP rows for export.
 *  - 'name'  → alphabetical by guest name (A→Z / أ→ي)
 *  - 'table' → grouped/sequenced by table name (unassigned last; A→Z within a table)
 */
function sortRsvpsForExport(rows, sort) {
  const tableNameOf = (r) => {
    const sa = r.seating_assignments;
    const first = Array.isArray(sa) ? sa[0] : sa;
    return first?.tables?.table_name || '';
  };
  const list = [...(rows || [])];
  if (sort === 'table') {
    list.sort((a, b) => {
      const ta = tableNameOf(a), tb = tableNameOf(b);
      if (!ta && tb) return 1;   // unassigned sinks to the bottom
      if (ta && !tb) return -1;
      const cmp = naturalCompare(ta, tb);
      return cmp !== 0 ? cmp : naturalCompare(a.guest_name, b.guest_name);
    });
  } else {
    list.sort((a, b) => naturalCompare(a.guest_name, b.guest_name));
  }
  return list;
}

/**
 * Handles guest RSVP form submissions (supports both inserts and updates).
 *
 * The entire DB write — event gating (payment/review/deadline), meal validation,
 * duplicate-email guard, insert/update, child guest rows, custom answers, seating
 * cleanup and the activity log — now happens in a SINGLE atomic `submit_rsvp()`
 * RPC instead of ~8–12 sequential PostgREST round-trips. The RPC also returns the
 * event/org context this handler needs to fire emails + the realtime broadcast,
 * so the success path makes no further reads. Concurrency safety (no duplicate
 * accepted RSVPs) is proven in test/integration/rsvpSubmitConcurrency.test.js.
 * POST /api/v1/public/events/:slug/rsvp
 */
const submitPublicRSVP = async (req, res, next) => {
  const { slug } = req.params;
  const { rsvpId, guestName, email, phone, response, partySize, notes, additionalGuests, primaryGuestMeal, customAnswers, decline_reason, maybe_confirm_by } = req.body;

  // Normalize email once so duplicate detection, ownership checks, and the stored
  // value all agree (matches updateRSVP / addGuestManually and the partial unique
  // index). Without this, "John@x.com" and "john@x.com" slip past the dup guard.
  const normalizedEmail = email && email.trim() ? email.trim().toLowerCase() : null;

  if (!guestName || !response) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'guestName and response are required.'
    });
  }

  // Cheap, DB-free shape checks for early 400s. Meal-option validation needs the
  // form field and is performed atomically inside submit_rsvp().
  if (response === 'yes') {
    const size = partySize || 1;
    if (size > 1) {
      if (!Array.isArray(additionalGuests) || additionalGuests.length < size - 1) {
        return res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: `Please provide details for all ${size - 1} additional guests.`
        });
      }
      for (let idx = 0; idx < size - 1; idx++) {
        const g = additionalGuests[idx];
        if (!g || !g.fullName || !g.fullName.trim()) {
          return res.status(400).json({
            success: false,
            error: 'VALIDATION_ERROR',
            message: `Guest #${idx + 2} must have a valid full name.`
          });
        }
      }
    }
  }

  try {
    // ── Single atomic round-trip ──
    const { data: result, error } = await supabase.rpc('submit_rsvp', {
      p_slug: slug,
      p_rsvp_id: rsvpId || null,
      p_guest_name: guestName,
      p_email: email || null,
      p_phone: phone || null,
      p_response: response,
      p_party_size: partySize || 1,
      p_notes: notes || null,
      p_primary_meal: primaryGuestMeal || null,
      p_additional_guests: Array.isArray(additionalGuests) ? additionalGuests : [],
      p_custom_answers: Array.isArray(customAnswers) ? customAnswers : [],
      p_decline_reason: decline_reason || null,
      p_maybe_confirm_by: maybe_confirm_by || null,
    });

    if (error) throw error;

    if (!result || result.success === false) {
      const code = result?.code || 'VALIDATION_ERROR';
      return res.status(RSVP_ERROR_STATUS[code] || 400).json({
        success: false,
        error: code,
        message: result?.message || 'Could not submit RSVP.',
      });
    }

    const eventId = result.event_id;
    const computedPartySize = result.party_size;

    // Broadcast (fire-and-forget REST broadcast — no per-request socket).
    broadcast(eventId, 'rsvp_submitted', {
      rsvpId: result.rsvp_id,
      guestName,
      response: result.response,
      partySize: computedPartySize,
    });

    // Confirmation / decline email (best-effort), using the context the RPC
    // returned so the hot path makes no extra reads.
    if (result.guest_email) {
      if (result.response === 'yes') {
        notificationService.sendConfirmationEmail(eventId, result.rsvp_id)
          .catch((err) => logger.error({ err }, 'Confirmation email error'));
      } else if (result.response === 'no') {
        const declineHtml = getDeclineConfirmationTemplate(
          { guest_name: guestName },
          { title: result.event_title, event_date: result.event_date, slug: result.event_slug },
        );
        notificationService.sendEmailViaBrevo(result.guest_email, `Thank You – ${escapeHtml(result.event_title)}`, declineHtml)
          .catch((err) => logger.error({ err }, 'Decline email error'));
      }
    }

    // Notify organizer of the new RSVP (best-effort) from the RPC-returned
    // org contact + notification preferences.
    try {
      const prefs = result.notification_preferences;
      const isEmailPref = !prefs || prefs.email !== false;
      const isWhatsappPref = !!prefs?.whatsapp;

      // Human label + accent colour for the response. 'maybe' is its own state —
      // previously anything that wasn't 'yes' was rendered as "Declined" (red),
      // mislabelling tentative guests in the organizer's email and WhatsApp pings.
      const respLabel = result.response === 'yes' ? 'Attending' : result.response === 'maybe' ? 'Maybe' : 'Declined';
      const respColor = result.response === 'yes' ? '#10b981' : result.response === 'maybe' ? '#f59e0b' : '#ef4444';

      if (isEmailPref && result.org_email) {
        const { sendEmailViaBrevo } = require('../utils/notificationService');
        const orgEmailHtml = getNewRsvpOrganizerTemplate({
          eventTitle: result.event_title,
          guestName,
          response: result.response,
          partySize: computedPartySize,
          email,
        });
        sendEmailViaBrevo(result.org_email, `New RSVP: ${escapeHtml(guestName)} - ${escapeHtml(result.event_title)}`, orgEmailHtml)
          .catch(err => logger.error({ err }, 'Failed to notify organizer via email'));
      }

      if (isWhatsappPref && result.org_phone) {
        const { getTwilioClient } = require('../utils/twilioClient');
        const twilio = getTwilioClient();
        const messageText = `New RSVP Received for ${result.event_title}: ${guestName} has replied ${result.response === 'yes' ? 'Attending (Party of ' + computedPartySize + ')' : respLabel}. — Fancy RSVP`;

        if (twilio) {
          twilio.messages.create({
            body: messageText,
            from: 'whatsapp:+14155238886',
            to: `whatsapp:${result.org_phone}`
          }).catch(err => logger.error({ err }, 'Failed to notify organizer via WhatsApp'));
        } else {
          logger.info(`[MOCK WHATSAPP NOTIFICATION] To: ${result.org_phone} | Content: ${messageText}`);
        }
      }
    } catch (orgNotifyErr) {
      logger.error({ err: orgNotifyErr }, 'Organizer notification error');
    }

    return res.status(201).json({
      success: true,
      message: result.is_update ? 'RSVP updated successfully.' : 'RSVP submitted successfully.',
      rsvpId: result.rsvp_id
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Resolves a single guest invitation by its RSVP id (public endpoint).
 * Powers the personalized invitation link (`/events/rsvp/:guestId`) and the
 * token-prefill branch of the public RSVP page (`/:slug?g=:guestId`).
 * GET /api/v1/public/rsvp/guest/:guestId
 */
const getGuestById = async (req, res, next) => {
  const { guestId } = req.params;

  try {
    // SECURITY (H1): never select or return contact PII (email/phone) or free-text
    // notes from this PUBLIC resolver. The guestId is an enumerable capability that
    // travels in shared invitation/SMS links, so exposing email/phone here let
    // anyone holding (or guessing the discovery of) an id harvest the guest list's
    // contact details. We return only the minimal fields needed to render the
    // invitation and prefill the form's non-sensitive parts. A returning guest
    // re-enters their own email (used by the ownership/duplicate checks on submit).
    const { data: rsvp, error } = await supabase
      .from('rsvps')
      .select(`
        id, guest_name, party_size, response,
        events!inner(slug, is_paid, status, event_date),
        seating_assignments(tables(table_name))
      `)
      .eq('id', guestId)
      .single();

    if (error || !rsvp) {
      return res.status(404).json({ success: false, error: 'GUEST_NOT_FOUND' });
    }

    // Only expose invitations for live (paid + active) event pages.
    if (!rsvp.events.is_paid || rsvp.events.status !== 'active') {
      return res.status(404).json({ success: false, error: 'EVENT_INACTIVE' });
    }

    // Withhold the table assignment until 24h before the event (seating reveal window).
    const seatingRevealed = isSeatingRevealed(rsvp.events.event_date);
    const tableName = seatingRevealed ? (rsvp.seating_assignments?.[0]?.tables?.table_name || null) : null;

    return res.json({
      success: true,
      slug: rsvp.events.slug,
      seatingLocked: !seatingRevealed,
      revealAt: seatingRevealed ? null : seatingRevealAtISO(rsvp.events.event_date),
      guest: {
        id: rsvp.id,
        guest_name: rsvp.guest_name,
        party_size: rsvp.party_size,
        response: rsvp.response,
        table_name: tableName
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Searches pre-registered guest invitations by name (public endpoint).
 * GET /api/v1/public/events/:slug/rsvp/search
 */
const searchPublicGuests = async (req, res, next) => {
  const { slug } = req.params;
  const { query } = req.query;

  // SECURITY (H1): require a real search term. A 1-char query would let anyone
  // walk the entire guest list of an event a letter at a time; demand >= 2 chars
  // so a guest must already know who they're looking for. Never returns contact
  // PII (only name + response + the id used to load that guest's own seating).
  const term = (query || '').trim();
  if (term.length < 2) {
    return res.json({ success: true, results: [] });
  }

  try {
    // 1. Resolve event from slug — and only expose guests for LIVE (paid + active)
    //    events, mirroring getGuestById. Inactive/draft events return no results
    //    rather than leaking their existence or guest list.
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, is_paid, status')
      .eq('slug', slug)
      .single();

    if (eventError || !event) {
      return res.status(404).json({ success: false, error: 'EVENT_NOT_FOUND' });
    }
    if (!event.is_paid || event.status !== 'active') {
      return res.status(404).json({ success: false, error: 'EVENT_INACTIVE' });
    }

    // 2. Search guests matching query substring (no email/phone in the response).
    const { data, error } = await supabase
      .from('rsvps')
      .select('id, guest_name, response, email')
      .eq('event_id', event.id)
      .ilike('guest_name', `%${escapeLikePattern(term)}%`)
      .limit(10);

    if (error) throw error;

    return res.json({
      success: true,
      results: data.map(item => ({
        // Only expose the rsvpId when the record has an email — updating such a record
        // still requires a matching email, so the id is safe to surface. For null-email
        // (host-imported) guests we withhold the id: their only authorized entry point
        // is the host's private invitation link (which carries the id directly).
        id: item.email ? item.id : null,
        guestName: item.guest_name,
        response: item.response
      }))
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Lists RSVPs for an event (Organizer dashboard endpoint).
 * Supports server-side filtering by response, search, seated status, and sorting.
 * GET /api/v1/events/:eventId/rsvps
 */
const getRSVPs = async (req, res, next) => {
  const { eventId } = req.params;
  const { response, search, seated, sort, meal, customFieldId, customFieldValue } = req.query;

  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  // The seated/meal/custom-answer filters run against embedded relations that we
  // can't paginate server-side here. When any is active we fetch a bounded superset
  // and do the filtering + pagination in JS — otherwise the filter would only see
  // the current page and return incomplete, inconsistently-counted results.
  const hasPostFilter =
    seated === 'true' || seated === 'false' ||
    !!(meal && meal.trim()) ||
    !!customFieldId;
  const POST_FILTER_FETCH_CAP = 5000;

  try {
    // ── Resolve cross-table filters to a set of allowed rsvp ids BEFORE paging ──
    // The seated / meal / custom-answer filters live on RELATED tables. Filtering
    // them in JS after the page was fetched (the previous approach) produced short
    // or empty pages and a misleading `total`, because pagination ran on the
    // UNfiltered set. Instead we resolve each filter to the set of matching rsvp
    // ids and constrain the main query, which stays paged and exactly counted — so
    // both the page contents and the total are correct.
    // (Scale note: this constrains via `.in(...)`/`.not.in(...)`, sized to the
    // event's matching guests — fine for normal events; a dedicated RPC would be
    // the move if a single event ever has many thousands of matching guests.)
    const idSets = [];           // rsvp.id must be IN the intersection of these sets
    let excludeSeatedIds = null; // seated=false: rsvp.id must NOT be in this set

    if (seated === 'true' || seated === 'false') {
      const { data: seatRows, error: seatErr } = await supabase
        .from('seating_assignments')
        .select('rsvp_id')
        .eq('event_id', eventId);
      if (seatErr) throw seatErr;
      const seatedIds = new Set((seatRows || []).map(r => r.rsvp_id));
      if (seated === 'true') idSets.push(seatedIds);
      else excludeSeatedIds = seatedIds;
    }

    if (meal && meal.trim()) {
      const { data: mealRows, error: mealErr } = await supabase
        .from('rsvp_guests')
        .select('rsvp_id, rsvps!inner(event_id)')
        .eq('rsvps.event_id', eventId)
        .eq('meal_selection', meal.trim());
      if (mealErr) throw mealErr;
      idSets.push(new Set((mealRows || []).map(r => r.rsvp_id)));
    }

    if (customFieldId) {
      const { data: caRows, error: caErr } = await supabase
        .from('custom_answers')
        .select('rsvp_id, answer_value, rsvps!inner(event_id)')
        .eq('rsvps.event_id', eventId)
        .eq('field_id', customFieldId);
      if (caErr) throw caErr;
      let matching = caRows || [];
      if (customFieldValue) {
        const want = String(customFieldValue).trim().toLowerCase();
        matching = matching.filter(a => String(a.answer_value).trim().toLowerCase() === want);
      }
      idSets.push(new Set(matching.map(r => r.rsvp_id)));
    }

    // Intersect the positive constraints, then subtract the seated-exclusion set.
    let allowedIds = null;
    if (idSets.length > 0) {
      allowedIds = idSets.reduce((acc, s) => (acc === null ? s : new Set([...acc].filter(x => s.has(x)))), null);
    }
    if (excludeSeatedIds && allowedIds) {
      allowedIds = new Set([...allowedIds].filter(x => !excludeSeatedIds.has(x)));
    }

    // A positive filter that matched nothing → empty page (total 0), no further reads.
    if (allowedIds && allowedIds.size === 0) {
      return res.json({ success: true, rsvps: [], pagination: { page, limit, count: 0, total: 0 } });
    }

    const applyIdConstraints = (query) => {
      if (allowedIds) return query.in('id', [...allowedIds]);
      if (excludeSeatedIds && excludeSeatedIds.size > 0) {
        return query.not('id', 'in', `(${[...excludeSeatedIds].join(',')})`);
      }
      return query;
    };

    // Build fallback chain: try full select + submitted_at, then full + created_at, then simple + created_at
    const fullSelect = '*, rsvp_guests(*), custom_answers(*), seating_assignments(id, table_id, tables(table_name))';
    const simpleSelect = '*, rsvp_guests(*), custom_answers(*)';
    const fallbacks = [
      { sel: fullSelect, sortCol: 'submitted_at' },
      { sel: fullSelect, sortCol: 'created_at' },
      { sel: simpleSelect, sortCol: 'created_at' },
    ];

    let rsvps, queryError, totalCount;

    for (const { sel, sortCol } of fallbacks) {
      let query = supabase
        .from('rsvps')
        .select(sel, { count: 'exact' })
        .eq('event_id', eventId);

      // Apply filters
      if (response && ['yes', 'no', 'maybe', 'pending'].includes(response)) {
        query = query.eq('response', response);
      }
      if (search && search.trim()) {
        query = query.ilike('guest_name', `%${escapeLikePattern(search.trim())}%`);
      }
      query = applyIdConstraints(query);

      // Apply sorting
      switch (sort) {
        case 'name_asc':
          query = query.order('guest_name', { ascending: true });
          break;
        case 'name_desc':
          query = query.order('guest_name', { ascending: false });
          break;
        case 'date_asc':
          query = query.order(sortCol, { ascending: true });
          break;
        default:
          query = query.order(sortCol, { ascending: false });
      }

      query = hasPostFilter ? query.limit(POST_FILTER_FETCH_CAP) : query.range(from, to);
      const result = await query;

      if (!result.error) {
        rsvps = result.data;
        totalCount = result.count;
        queryError = null;
        break;
      }

      queryError = result.error;
      // If it's a column/relation error, try next fallback
      const msg = result.error.message || '';
      const code = result.error.code || '';
      if (code === '42703' || code === 'PGRST200' || msg.includes('column') || msg.includes('relation')) {
        continue;
      }
      // Other errors — throw immediately
      throw result.error;
    }

    if (queryError) throw queryError;

    // Apply post-filters. When hasPostFilter is set, `rsvps` is the bounded
    // superset (not a single page), so filtering here covers the whole dataset.
    let filtered = rsvps || [];

    if (seated === 'true') {
      filtered = filtered.filter(r => r.seating_assignments && r.seating_assignments.length > 0);
    } else if (seated === 'false') {
      filtered = filtered.filter(r => !r.seating_assignments || r.seating_assignments.length === 0);
    }

    if (meal && meal.trim()) {
      filtered = filtered.filter(r =>
        r.rsvp_guests && r.rsvp_guests.some(g => g.meal_selection === meal.trim())
      );
    }

    if (customFieldId) {
      filtered = filtered.filter(r =>
        r.custom_answers && r.custom_answers.some(ans =>
          ans.field_id === customFieldId &&
          (!customFieldValue || String(ans.answer_value).trim().toLowerCase() === String(customFieldValue).trim().toLowerCase())
        )
      );
    }

    let pageItems, total;
    if (hasPostFilter) {
      // `filtered` is the full matching set → its length is the real total, and we
      // paginate it in JS so the returned page and count are consistent.
      total = filtered.length;
      pageItems = filtered.slice(from, to + 1);
    } else {
      // No post-filter: the DB already applied range pagination and an exact count.
      pageItems = filtered;
      total = totalCount;
    }

    return res.json({
      success: true,
      rsvps: pageItems,
      pagination: { page, limit, count: pageItems.length, total }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Imports guest records in bulk from a CSV text string.
 * POST /api/v1/events/:eventId/rsvps/import
 */
const importGuestsCSV = async (req, res, next) => {
  const { eventId } = req.params;
  const { csvData, fileData, fileName } = req.body;

  if (!csvData && !fileData) {
    return res.status(400).json({ success: false, error: 'csvData or fileData string is required.' });
  }

  try {
    let parsedRows = [];

    if (fileData) {
      const buffer = Buffer.from(fileData, 'base64');
      const isExcel = fileName && fileName.toLowerCase().endsWith('.xlsx');

      if (isExcel) {
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        const worksheet = workbook.getWorksheet(1);

        const headers = [];
        worksheet.getRow(1).eachCell((cell, colNumber) => {
          headers[colNumber] = cell.text ? cell.text.trim().toLowerCase().replace(/\s+/g, '_') : '';
        });

        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;
          const rowObj = {};
          row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            const header = headers[colNumber];
            if (header) {
              rowObj[header] = cell.text ? cell.text.trim() : '';
            }
          });

          // support flexible field headers
          const mappedRow = {
            guest_name: rowObj.guest_name || rowObj.name || rowObj.guest || '',
            email: rowObj.email || '',
            phone: rowObj.phone || '',
            party_size: parseInt(rowObj.party_size || rowObj.size || rowObj.count || '1') || 1,
            notes: rowObj.notes || rowObj.note || ''
          };

          if (mappedRow.guest_name) {
            parsedRows.push(mappedRow);
          }
        });
      } else {
        const csvText = buffer.toString('utf-8');
        parsedRows = parseCSV(csvText);
      }
    } else {
      parsedRows = parseCSV(csvData);
    }

    if (parsedRows.length === 0) {
      return res.status(400).json({ success: false, error: 'NO_VALID_ROWS', message: 'No valid data rows found.' });
    }

    if (parsedRows.length > 500) {
      return res.status(400).json({ success: false, error: 'FILE_TOO_LARGE', message: 'Import limited to 500 rows per batch. Please split your file.' });
    }

    // Dedup within the file by email (case-insensitive). Rows without an email are
    // always kept — the partial unique index only collides on non-null emails.
    const seenEmails = new Set();
    let skippedInFile = 0;
    const dedupedRows = [];
    for (const row of parsedRows) {
      const emailKey = (row.email || '').trim().toLowerCase();
      if (emailKey) {
        if (seenEmails.has(emailKey)) { skippedInFile++; continue; }
        seenEmails.add(emailKey);
      }
      dedupedRows.push(row);
    }

    const toInsertRow = (row) => ({
      event_id: eventId,
      guest_name: row.guest_name || 'Unnamed Guest',
      // Lowercase on write so stored emails agree with the in-file dedup key, the
      // RSVP duplicate-detection lookups, and the partial unique index (which is
      // case-sensitive). Without this, "John@x.com" and "john@x.com" both slip in.
      email: row.email ? row.email.trim().toLowerCase() : null,
      phone: row.phone || null,
      response: 'pending',
      party_size: parseInt(row.party_size) || 1,
      notes: row.notes || null
    });

    // Insert in chunks. Any chunk-level error (a duplicate-key 23505 against an
    // already-imported/already-RSVP'd email, or any other constraint violation)
    // aborts the whole chunk, so we retry that chunk row-by-row: good rows still
    // import, duplicates are skipped, and only genuinely bad rows are collected
    // as errors. This keeps a single malformed row from failing the whole batch.
    const CHUNK = 100;
    const imported = [];
    let skippedExisting = 0;
    const errors = [];

    for (let i = 0; i < dedupedRows.length; i += CHUNK) {
      const chunk = dedupedRows.slice(i, i + CHUNK).map(toInsertRow);
      const { data, error } = await supabase
        .from('rsvps')
        .insert(chunk)
        .select('id, guest_name');

      if (!error) {
        imported.push(...data);
        continue;
      }

      // Chunk failed — retry each row individually to isolate the offenders.
      for (const single of chunk) {
        const { data: one, error: oneErr } = await supabase
          .from('rsvps')
          .insert(single)
          .select('id, guest_name')
          .single();
        if (!oneErr) imported.push(one);
        else if (oneErr.code === '23505') skippedExisting++;
        else errors.push({ guest_name: single.guest_name, error: oneErr.message });
      }
    }

    const skippedCount = skippedInFile + skippedExisting;

    return res.status(201).json({
      success: true,
      message: `Imported ${imported.length} guest record(s) in pending state`
        + (skippedCount ? `; skipped ${skippedCount} duplicate(s)` : '')
        + (errors.length ? `; ${errors.length} failed` : '')
        + '.',
      importedCount: imported.length,
      skippedCount,
      errorCount: errors.length,
      errors,
      guests: imported
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Exports RSVPs dataset to a downloadable CSV stream.
 * GET /api/v1/events/:eventId/rsvps/export
 */
const exportGuestsCSV = async (req, res, next) => {
  const { eventId } = req.params;
  // Optional export controls (used by the "attending guest list" export):
  //   ?attending=true  → only guests who responded 'yes'
  //   ?sort=name|table → alphabetical by name, or grouped/sequenced by table
  const attendingOnly = req.query.attending === 'true';
  const sort = ['name', 'table'].includes(req.query.sort) ? req.query.sort : null;

  try {
    // Try full query with check_ins, fall back without
    const fullSelect = `
      guest_name, email, phone, response, party_size, notes,
      rsvp_guests(meal_selection),
      seating_assignments(table_id, tables(table_name)),
      check_ins(checked_in_at, method)
    `;
    const simpleSelect = `
      guest_name, email, phone, response, party_size, notes,
      rsvp_guests(meal_selection)
    `;

    let rsvps;
    for (const selectStr of [fullSelect, simpleSelect]) {
      const { data, error } = await supabase
        .from('rsvps')
        .select(selectStr)
        .eq('event_id', eventId)
        .limit(10000);

      if (!error) {
        rsvps = data || [];
        break;
      }
      // If it's a relation/column error, try simpler query
      if (error.code === '42703' || error.code === 'PGRST200'
          || (error.message && (error.message.includes('column') || error.message.includes('relation')))) {
        continue;
      }
      throw error;
    }

    if (!rsvps) rsvps = [];

    // Apply the attending filter and chosen ordering before serializing.
    if (attendingOnly) rsvps = rsvps.filter(r => r.response === 'yes');
    if (sort) rsvps = sortRsvpsForExport(rsvps, sort);

    const headers = ['guest_name', 'email', 'phone', 'response', 'party_size', 'table_name', 'meal_selections', 'checked_in', 'checked_in_at', 'check_in_method', 'notes'];
    const csvContent = generateCSV(
      headers,
      rsvps,
      (item) => {
        const meals = (item.rsvp_guests || [])
          .map(g => g.meal_selection)
          .filter(Boolean)
          .join('; ');

        const tableName = item.seating_assignments && item.seating_assignments.length > 0
          ? item.seating_assignments[0].tables?.table_name || ''
          : '';

        const checkedIn = item.check_ins && item.check_ins.length > 0 ? 'Yes' : 'No';
        const checkedInAt = item.check_ins && item.check_ins.length > 0
          ? item.check_ins[0].checked_in_at
          : '';
        const checkInMethod = item.check_ins && item.check_ins.length > 0
          ? item.check_ins[0].method
          : '';

        return [
          item.guest_name,
          item.email,
          item.phone,
          item.response,
          item.party_size,
          tableName,
          meals,
          checkedIn,
          checkedInAt,
          checkInMethod,
          item.notes
        ];
      }
    );

    const csvName = `event-${eventId}-${attendingOnly ? 'attending' : 'rsvps'}${sort ? '-by-' + sort : ''}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${csvName}`);
    return res.send(csvContent);
  } catch (err) {
    next(err);
  }
};

/**
 * Exports RSVPs dataset to a downloadable Excel (.xlsx) file.
 * GET /api/v1/events/:eventId/rsvps/export-excel
 */
const exportGuestsExcel = async (req, res, next) => {
  const { eventId } = req.params;
  // Same export controls as the CSV export (attending filter + name/table sort).
  const attendingOnly = req.query.attending === 'true';
  const sort = ['name', 'table'].includes(req.query.sort) ? req.query.sort : null;

  try {
    // 1. Fetch RSVPs
    const { data: rsvps, error: rsvpsError } = await supabase
      .from('rsvps')
      .select(`
        id, guest_name, email, phone, response, party_size, notes,
        rsvp_guests(meal_selection, is_primary),
        seating_assignments(table_id, tables(table_name))
      `)
      .eq('event_id', eventId);

    if (rsvpsError) throw rsvpsError;

    // 2. Fetch tables
    const { data: tables, error: tablesError } = await supabase
      .from('tables')
      .select('*')
      .eq('event_id', eventId);

    if (tablesError) throw tablesError;

    // 3. Fetch checkins
    const { data: checkins, error: checkinsError } = await supabase
      .from('check_ins')
      .select(`
        *,
        rsvps(guest_name)
      `)
      .eq('event_id', eventId);

    if (checkinsError) throw checkinsError;

    // Filter/sort the Guest List sheet rows (the Seating & Meal sheets stay complete).
    let guestRows = rsvps || [];
    if (attendingOnly) guestRows = guestRows.filter(r => r.response === 'yes');
    if (sort) guestRows = sortRsvpsForExport(guestRows, sort);

    const { generateExcelExport } = require('../utils/excelHelper');
    const excelBuffer = await generateExcelExport(guestRows, tables || [], checkins || []);

    const xlsxName = `event-${eventId}-${attendingOnly ? 'attending' : 'rsvps'}${sort ? '-by-' + sort : ''}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${xlsxName}`);
    return res.send(excelBuffer);
  } catch (err) {
    next(err);
  }
};

/**
 * Deletes a single RSVP and its related data.
 * DELETE /api/v1/events/:eventId/rsvps/:rsvpId
 */
const deleteRSVP = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const { rsvpId } = req.params;

    // First unassign seat if any
    await supabase
      .from('seating_assignments')
      .delete()
      .eq('event_id', eventId)
      .eq('rsvp_id', rsvpId);

    // Delete RSVP (cascades to rsvp_guests, custom_answers)
    const { error } = await supabase
      .from('rsvps')
      .delete()
      .eq('id', rsvpId)
      .eq('event_id', eventId);

    if (error) throw error;

    res.json({ success: true, message: 'RSVP deleted successfully' });
  } catch (err) {
    next(err);
  }
};

/**
 * Updates a single RSVP record (organizer edit).
 * PATCH /api/v1/events/:eventId/rsvps/:rsvpId
 */
const updateRSVP = async (req, res, next) => {
  const { eventId, rsvpId } = req.params;
  const { guestName, email, phone, response, partySize, notes, primaryGuestMeal, additionalGuests } = req.body;

  try {
    // Build update payload
    const updates = {};
    if (guestName !== undefined) updates.guest_name = guestName.trim();
    // Normalize email on write so it matches the duplicate-detection lookups
    // (which compare trimmed/lowercased) and the partial unique index.
    if (email !== undefined) updates.email = email ? email.trim().toLowerCase() : null;
    if (phone !== undefined) updates.phone = phone;
    if (response !== undefined) {
      if (!['yes', 'no', 'maybe', 'pending'].includes(response)) {
        return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'response must be yes, no, maybe, or pending.' });
      }
      updates.response = response;
    }
    if (partySize !== undefined) {
      const size = parseInt(partySize);
      if (isNaN(size) || size < 1 || size > 20) {
        return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'partySize must be between 1 and 20.' });
      }
      updates.party_size = size;
    }
    if (notes !== undefined) updates.notes = notes;
    updates.updated_at = new Date();

    // Update RSVP
    const { data: rsvp, error } = await supabase
      .from('rsvps')
      .update(updates)
      .eq('id', rsvpId)
      .eq('event_id', eventId)
      .select('*, rsvp_guests(*), seating_assignments(id, table_id, tables(table_name))')
      .single();

    if (error) throw error;
    if (!rsvp) return res.status(404).json({ success: false, error: 'RSVP_NOT_FOUND' });

    // Only attending ('yes') guests are seatable. If the response moved to
    // anything else (no / maybe / pending), drop any existing seat assignment.
    if (updates.response !== undefined && updates.response !== 'yes') {
      await supabase.from('seating_assignments').delete().eq('rsvp_id', rsvpId).eq('event_id', eventId);
    }

    // Keep rsvp_guests in lockstep with party_size for ATTENDING guests. Previously
    // we only rebuilt when explicit guest detail was sent, so bumping party_size on
    // its own (or sending an additionalGuests array of the wrong length) left the
    // per-guest rows out of sync with the headcount — inflating/deflating meal
    // tallies, exports and the seating panel. We now reconcile to exactly one
    // primary + (party_size − 1) additional rows whenever the headcount changes or
    // guest detail is supplied, PRESERVING existing names/meals we weren't asked to
    // change and padding/trimming the rest.
    // NB: `rsvp` is the POST-update row, so we can't diff old vs new party_size
    // here — we reconcile whenever party_size was *supplied* in this request (a
    // no-op rebuild if it didn't actually change) or any guest detail was sent.
    const effectiveResponse = updates.response !== undefined ? updates.response : rsvp.response;
    const guestDetailProvided = additionalGuests !== undefined || primaryGuestMeal !== undefined;
    const partySizeProvided = updates.party_size !== undefined;

    if (effectiveResponse === 'yes' && (guestDetailProvided || partySizeProvided)) {
      const effectivePartySize = updates.party_size !== undefined ? updates.party_size : (rsvp.party_size || 1);
      const existing = rsvp.rsvp_guests || [];
      const existingPrimary = existing.find(g => g.is_primary);
      const existingAdditional = existing.filter(g => !g.is_primary);
      const provided = additionalGuests !== undefined && Array.isArray(additionalGuests) ? additionalGuests : null;

      const guestRows = [{
        rsvp_id: rsvpId,
        full_name: rsvp.guest_name,
        is_primary: true,
        // Use the new primary meal if sent, else keep what was already on file.
        meal_selection: primaryGuestMeal !== undefined ? (primaryGuestMeal || null) : (existingPrimary?.meal_selection || null),
      }];

      for (let i = 0; i < Math.max(0, effectivePartySize - 1); i++) {
        const fromBody = provided ? provided[i] : null;
        const prev = existingAdditional[i];
        guestRows.push({
          rsvp_id: rsvpId,
          full_name: (fromBody?.fullName && fromBody.fullName.trim()) || prev?.full_name || `Guest ${i + 2}`,
          is_primary: false,
          meal_selection: fromBody ? (fromBody.mealSelection || null) : (prev?.meal_selection || null),
          dietary_notes: fromBody ? (fromBody.dietaryNotes || null) : (prev?.dietary_notes || null),
        });
      }

      await supabase.from('rsvp_guests').delete().eq('rsvp_id', rsvpId);
      await supabase.from('rsvp_guests').insert(guestRows);
    }

    // Broadcast update (fire-and-forget REST broadcast — no per-request socket).
    broadcast(eventId, 'rsvp_updated', { rsvpId, guestName: rsvp.guest_name, response: rsvp.response });

    return res.json({ success: true, message: 'RSVP updated successfully.', rsvp });
  } catch (err) {
    next(err);
  }
};

/**
 * Manually adds a guest record from the organizer dashboard.
 * POST /api/v1/events/:eventId/rsvps
 */
const addGuestManually = async (req, res, next) => {
  const { eventId } = req.params;
  const { guestName, email, phone, partySize, notes, response } = req.body;

  if (!guestName || !guestName.trim()) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'guestName is required.'
    });
  }

  const guestResponse = response && ['yes', 'no', 'maybe', 'pending'].includes(response) ? response : 'pending';
  const computedPartySize = parseInt(partySize) || 1;

  if (computedPartySize < 1 || computedPartySize > 20) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'partySize must be between 1 and 20.'
    });
  }

  try {
    // 1. Verify event exists
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, org_id, title')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return res.status(404).json({ success: false, error: 'EVENT_NOT_FOUND' });
    }

    // 2. Insert RSVP record
    const { data: rsvp, error: rsvpError } = await supabase
      .from('rsvps')
      .insert({
        event_id: eventId,
        guest_name: guestName.trim(),
        email: email ? email.trim().toLowerCase() : null,
        phone: phone || null,
        response: guestResponse,
        party_size: computedPartySize,
        notes: notes || null
      })
      .select()
      .single();

    if (rsvpError) throw rsvpError;

    // 2.2 Insert primary guest into rsvp_guests if response is yes
    if (guestResponse === 'yes') {
      const { error: guestInsertError } = await supabase
        .from('rsvp_guests')
        .insert({
          rsvp_id: rsvp.id,
          full_name: guestName.trim(),
          is_primary: true,
          meal_selection: null
        });
      if (guestInsertError) throw guestInsertError;
    }

    // 3. Log activity
    await supabase
      .from('activity_logs')
      .insert({
        event_id: eventId,
        action: 'guest_added_manually',
        metadata: {
          description: `Organizer manually added guest: ${guestName.trim()} (response: ${guestResponse}, party size: ${computedPartySize})`
        }
      })
      .then(() => {})
      .catch(err => logger.error({ err }, 'Activity log insert error'));

    // 4. Broadcast RSVP update (fire-and-forget REST broadcast — no per-request socket).
    broadcast(eventId, 'rsvp_submitted', {
      rsvpId: rsvp.id,
      guestName: rsvp.guest_name,
      response: rsvp.response,
      partySize: computedPartySize,
    });

    return res.status(201).json({
      success: true,
      message: 'Guest added successfully.',
      rsvp
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Searches guest seating assignment by name (public endpoint).
 * GET /api/v1/public/events/:slug/seating/search
 */
const searchPublicSeating = async (req, res, next) => {
  const { slug } = req.params;
  const { query } = req.query;

  if (!query || !query.trim()) {
    return res.json({ success: true, results: [] });
  }

  try {
    // 1. Resolve event from slug. Restrict the "find your table" lookup to live
    // (paid + active) events so the guest/seating roster of a draft/unpaid/private
    // event can't be enumerated by anyone who guesses the slug.
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, is_paid, status, event_date')
      .eq('slug', slug)
      .single();

    if (eventError || !event) {
      return res.status(404).json({ success: false, error: 'EVENT_NOT_FOUND' });
    }
    if (!event.is_paid || event.status !== 'active') {
      return res.status(404).json({ success: false, error: 'EVENT_INACTIVE' });
    }
    // Seating is hidden from guests until 24h before the event begins.
    if (!isSeatingRevealed(event.event_date)) {
      return res.json({ success: true, locked: true, revealAt: seatingRevealAtISO(event.event_date), results: [] });
    }

    // 2. Search guests matching query substring, join with seating_assignments and tables
    const { data, error } = await supabase
      .from('rsvps')
      .select(`
        id,
        guest_name,
        response,
        party_size,
        seating_assignments (
          table_id,
          tables (
            table_name
          )
        )
      `)
      .eq('event_id', event.id)
      .eq('response', 'yes') // only attending guests can check seating
      .ilike('guest_name', `%${escapeLikePattern(query.trim())}%`)
      .limit(10);

    if (error) throw error;

    return res.json({
      success: true,
      results: data.map(item => {
        const seating = item.seating_assignments?.[0] || item.seating_assignments;
        // Handle if it is an array or object due to postgrest format
        const resolvedSeating = Array.isArray(seating) ? seating[0] : seating;
        const tableName = resolvedSeating?.tables?.table_name || 'Unassigned';
        return {
          // Deliberately NOT exposing the rsvp id here. This endpoint is unauthenticated
          // and would otherwise let anyone enumerate EVERY attending guest's id (the
          // per-guest capability token), which unlocks that guest's contact PII via the
          // invitation-token paths. Guests still see their own table by name; the visual
          // map (which needs the id) is reachable from their own post-RSVP confirmation.
          guestName: item.guest_name,
          partySize: item.party_size,
          tableName,
          hasTable: !!resolvedSeating?.table_id
        };
      })
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Returns a single guest's personal seating view: the full venue LAYOUT (table
 * geometry only) plus which table is theirs and the names of their OWN party.
 * Deliberately never exposes who else is seated at any table — a guest sees the
 * room and their spot, and the companions they brought, but not other parties.
 * GET /api/v1/public/events/:slug/seating/guest/:guestId
 */
const getGuestSeatingMap = async (req, res, next) => {
  const { slug, guestId } = req.params;

  try {
    // 1. Resolve event and ensure it is live (paid + active).
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, is_paid, status, event_date')
      .eq('slug', slug)
      .single();

    if (eventError || !event) {
      return res.status(404).json({ success: false, error: 'EVENT_NOT_FOUND' });
    }
    if (!event.is_paid || event.status !== 'active') {
      return res.status(404).json({ success: false, error: 'EVENT_INACTIVE' });
    }
    // The seating chart stays hidden from guests until 24h before the event begins,
    // regardless of when the organizer built it. (Organizer dashboard uses the
    // authenticated /events/:eventId/* endpoints and is unaffected.)
    if (!isSeatingRevealed(event.event_date)) {
      return res.json({
        success: true, locked: true, revealAt: seatingRevealAtISO(event.event_date),
        myTableId: null, myTableName: null, party: [], tables: [],
      });
    }

    // 2. Resolve the guest's RSVP (must belong to this event) + their own party.
    const { data: rsvp, error: rsvpError } = await supabase
      .from('rsvps')
      .select(`
        id, guest_name, party_size, response,
        seating_assignments(table_id, tables(table_name)),
        rsvp_guests(full_name, is_primary, meal_selection)
      `)
      .eq('id', guestId)
      .eq('event_id', event.id)
      .single();

    if (rsvpError || !rsvp) {
      return res.status(404).json({ success: false, error: 'GUEST_NOT_FOUND' });
    }

    const assignment = Array.isArray(rsvp.seating_assignments)
      ? rsvp.seating_assignments[0]
      : rsvp.seating_assignments;
    const myTableId = assignment?.table_id || null;
    const myTableName = assignment?.tables?.table_name || null;

    // 3. Venue layout — geometry only, no occupant identities.
    const { data: tables, error: tablesError } = await supabase
      .from('tables')
      .select('id, table_name, element_type, shape, position_x, position_y, width, height, rotation, color, max_capacity')
      .eq('event_id', event.id)
      .order('sort_order', { ascending: true });

    if (tablesError) throw tablesError;

    // 4. The guest's own companions (the people THEY brought) — never other parties.
    const party = (rsvp.rsvp_guests || [])
      .slice()
      .sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0))
      .map(g => ({ name: g.full_name, meal: g.meal_selection || null, isPrimary: !!g.is_primary }))
      .filter(g => g.name);

    return res.json({
      success: true,
      guest: {
        id: rsvp.id,
        guest_name: rsvp.guest_name,
        party_size: rsvp.party_size,
        response: rsvp.response,
      },
      myTableId,
      myTableName,
      party,
      tables: tables || [],
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Bulk-sends email invitations (with Accept/Decline/Maybe buttons) to guests.
 * By default targets every guest who has an email and has NOT been invited yet;
 * pass { resend: true } to re-send to everyone with an email, or { rsvpIds: [] }
 * to target specific guests.
 * POST /api/v1/events/:eventId/rsvps/send-invitations
 */
const sendEmailInvitations = async (req, res, next) => {
  const { eventId } = req.params;
  const { resend = false, rsvpIds } = req.body || {};

  try {
    // Confirm the event is live before doing any work — invitation links only
    // resolve for paid + active events.
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, is_paid, status')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return res.status(404).json({ success: false, error: 'EVENT_NOT_FOUND' });
    }
    if (!event.is_paid || event.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: 'EVENT_NOT_LIVE',
        message: 'Invitations can only be sent once the event page is paid and active.'
      });
    }

    // Build the recipient set.
    let query = supabase
      .from('rsvps')
      .select('id, email, invitation_sent')
      .eq('event_id', eventId)
      .not('email', 'is', null);

    if (Array.isArray(rsvpIds) && rsvpIds.length > 0) {
      query = query.in('id', rsvpIds);
    } else if (!resend) {
      query = query.eq('invitation_sent', false);
    }

    const { data: guests, error: guestError } = await query.limit(2000);
    if (guestError) throw guestError;

    if (!guests || guests.length === 0) {
      return res.json({
        success: true,
        message: 'No guests with an email address were eligible for an invitation.',
        sentCount: 0, skippedCount: 0, failedCount: 0
      });
    }

    let sentCount = 0, skippedCount = 0, failedCount = 0;
    const failures = [];

    // Send in small concurrent batches to stay friendly to the email provider.
    const BATCH = 10;
    for (let i = 0; i < guests.length; i += BATCH) {
      const batch = guests.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        batch.map(g => notificationService.sendInvitationEmail(eventId, g.id))
      );
      results.forEach((r, idx) => {
        if (r.status === 'fulfilled' && r.value && r.value.sent) {
          sentCount++;
        } else if (r.status === 'fulfilled' && r.value && r.value.reason === 'NO_EMAIL') {
          skippedCount++;
        } else {
          failedCount++;
          failures.push({ rsvpId: batch[idx].id, reason: r.status === 'fulfilled' ? r.value.reason : String(r.reason) });
        }
      });
    }

    await supabase.from('activity_logs').insert({
      event_id: eventId,
      action: 'invitation_campaign_sent',
      entity_type: 'campaign',
      metadata: { total: guests.length, sent: sentCount, skipped: skippedCount, failed: failedCount }
    }).then(() => {}).catch(() => {});

    return res.json({
      success: true,
      message: `Invitations sent: ${sentCount}` + (skippedCount ? `, skipped ${skippedCount}` : '') + (failedCount ? `, failed ${failedCount}` : '') + '.',
      sentCount, skippedCount, failedCount,
      failures
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Resolves a signed invitation token into the guest + event context that powers
 * the public RSVP confirmation page. Read-only: does NOT record a response, so
 * email link pre-fetching by security scanners is harmless.
 * GET /api/v1/public/rsvp/invite?token=...
 */
const getRsvpInvite = async (req, res, next) => {
  const { token } = req.query;
  if (!token) {
    return res.status(400).json({ success: false, error: 'TOKEN_REQUIRED' });
  }

  let payload;
  try {
    payload = verifyRsvpToken(token);
  } catch {
    return res.status(401).json({ success: false, error: 'INVALID_TOKEN', message: 'This invitation link is invalid or has expired.' });
  }

  try {
    const { data: rsvp, error } = await supabase
      .from('rsvps')
      .select('id, guest_name, email, party_size, response, events!inner(id, title, event_date, slug, location_name, location_address, is_paid, status, rsvp_deadline)')
      .eq('id', payload.rsvpId)
      .eq('event_id', payload.eventId)
      .single();

    if (error || !rsvp) {
      return res.status(404).json({ success: false, error: 'GUEST_NOT_FOUND' });
    }

    const event = rsvp.events;
    if (!event.is_paid || event.status !== 'active') {
      return res.status(404).json({ success: false, error: 'EVENT_INACTIVE' });
    }

    const deadlinePassed = !!event.rsvp_deadline && new Date() > new Date(event.rsvp_deadline);

    return res.json({
      success: true,
      intendedResponse: payload.response ? mapIntentToResponse(payload.response) : null,
      deadlinePassed,
      guest: {
        id: rsvp.id,
        guest_name: rsvp.guest_name,
        party_size: rsvp.party_size,
        response: rsvp.response,
      },
      event: {
        title: event.title,
        event_date: event.event_date,
        slug: event.slug,
        location: event.location_name || event.location_address || null,
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Records a guest's RSVP response from a signed invitation token (the one-click
 * email flow, confirmed on the landing page). The response comes from the token
 * or an explicit `response` in the body (used by the "Maybe → change my mind"
 * controls on the landing page).
 * POST /api/v1/public/rsvp/respond
 */
const respondViaToken = async (req, res, next) => {
  const { token, response: bodyResponse, partySize } = req.body || {};
  if (!token) {
    return res.status(400).json({ success: false, error: 'TOKEN_REQUIRED' });
  }

  let payload;
  try {
    payload = verifyRsvpToken(token);
  } catch {
    return res.status(401).json({ success: false, error: 'INVALID_TOKEN', message: 'This invitation link is invalid or has expired.' });
  }

  // Body response (explicit choice on the page) wins over the token's embedded
  // response (the button that was clicked).
  const mapped = mapIntentToResponse(bodyResponse || payload.response);
  if (!mapped) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'A valid response (accepted, declined, or maybe) is required.' });
  }

  try {
    const { data: rsvp, error: rsvpFetchError } = await supabase
      .from('rsvps')
      .select('id, guest_name, email, party_size, response, events!inner(id, title, event_date, slug, is_paid, status, rsvp_deadline, notification_preferences)')
      .eq('id', payload.rsvpId)
      .eq('event_id', payload.eventId)
      .single();

    if (rsvpFetchError || !rsvp) {
      return res.status(404).json({ success: false, error: 'GUEST_NOT_FOUND' });
    }

    const event = rsvp.events;
    if (!event.is_paid || event.status !== 'active') {
      return res.status(404).json({ success: false, error: 'EVENT_INACTIVE' });
    }

    // Strict, state-aware lock: once a guest has answered (yes / no / maybe) the
    // record is closed to further public responses — they must contact the
    // organizer to change it. Mirrors the submit_rsvp() RPC guard so every public
    // entry point (web form + one-click email) enforces the same rule. First
    // responses for un-answered ('pending' / NULL) invitations still go through.
    if (['yes', 'no', 'maybe'].includes(rsvp.response)) {
      return res.status(409).json({
        success: false,
        error: 'ALREADY_RESPONDED',
        response: rsvp.response,
        guestName: rsvp.guest_name,
        message: 'You have already responded to this invitation.',
      });
    }

    if (event.rsvp_deadline && new Date() > new Date(event.rsvp_deadline)) {
      return res.status(400).json({ success: false, error: 'DEADLINE_PASSED', message: 'The RSVP deadline for this event has passed.' });
    }

    // Party size only applies when attending; otherwise normalize to 1.
    let computedPartySize = rsvp.party_size || 1;
    if (mapped === 'yes') {
      const size = parseInt(partySize);
      if (!isNaN(size) && size >= 1 && size <= 20) computedPartySize = size;
    } else {
      computedPartySize = 1;
    }

    const { data: updated, error: updateError } = await supabase
      .from('rsvps')
      .update({
        response: mapped,
        party_size: computedPartySize,
        rsvp_at: new Date(),
        response_source: 'email',
        updated_at: new Date(),
      })
      .eq('id', rsvp.id)
      .eq('event_id', event.id)
      .select()
      .single();

    if (updateError) throw updateError;

    if (mapped === 'yes') {
      // Ensure a primary guest row exists so meal/seating views render.
      const { data: existingPrimary } = await supabase
        .from('rsvp_guests')
        .select('id')
        .eq('rsvp_id', rsvp.id)
        .eq('is_primary', true)
        .maybeSingle();
      if (!existingPrimary) {
        await supabase.from('rsvp_guests').insert({
          rsvp_id: rsvp.id, full_name: rsvp.guest_name, is_primary: true, meal_selection: null
        });
      }
    } else {
      // No longer attending — release any seat and clear stale companion rows.
      await supabase.from('seating_assignments').delete().eq('rsvp_id', rsvp.id).eq('event_id', event.id);
    }

    // Real-time dashboard update (fire-and-forget REST broadcast — no per-request socket).
    broadcast(event.id, 'rsvp_updated', { rsvpId: rsvp.id, guestName: rsvp.guest_name, response: mapped, partySize: computedPartySize });

    await supabase.from('activity_logs').insert({
      event_id: event.id,
      action: 'rsvp_submitted',
      entity_type: 'rsvp',
      entity_id: rsvp.id,
      metadata: { guest_name: rsvp.guest_name, response: mapped, party_size: computedPartySize, source: 'email' }
    }).then(() => {}).catch(() => {});

    // Confirmation / decline acknowledgement email (best-effort).
    if (rsvp.email) {
      if (mapped === 'yes') {
        notificationService.sendConfirmationEmail(event.id, rsvp.id).catch(err => logger.error({ err }, 'Confirmation email error'));
      } else if (mapped === 'no') {
        const declineHtml = getDeclineConfirmationTemplate(updated, event);
        notificationService.sendEmailViaBrevo(rsvp.email, `Thank You – ${escapeHtml(event.title)}`, declineHtml)
          .catch(err => logger.error({ err }, 'Decline email error'));
      }
    }

    return res.json({
      success: true,
      message: 'Your response has been recorded.',
      response: mapped,
      guestName: rsvp.guest_name,
      eventSlug: event.slug,
      rsvpId: rsvp.id,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Returns aggregated RSVP statistics for the organizer dashboard cards:
 * total guests/parties, invitations sent, and accepted/declined/maybe/pending.
 * GET /api/v1/events/:eventId/rsvps/stats
 */
const getRsvpStats = async (req, res, next) => {
  const { eventId } = req.params;
  const { isAcceptedResponse, isDeclinedResponse, isMaybeResponse } = require('../utils/responseHelpers');

  try {
    const { data: rsvps, error } = await supabase
      .from('rsvps')
      .select('response, party_size, invitation_sent')
      .eq('event_id', eventId);

    if (error) throw error;

    const stats = {
      totalParties: rsvps.length,
      totalGuests: 0,
      invitationsSent: 0,
      acceptedParties: 0, acceptedGuests: 0,
      declinedParties: 0,
      maybeParties: 0,
      pendingParties: 0,
    };

    rsvps.forEach(r => {
      const size = r.party_size || 1;
      stats.totalGuests += size;
      if (r.invitation_sent) stats.invitationsSent++;
      if (isAcceptedResponse(r.response)) { stats.acceptedParties++; stats.acceptedGuests += size; }
      else if (isDeclinedResponse(r.response)) { stats.declinedParties++; }
      else if (isMaybeResponse(r.response)) { stats.maybeParties++; }
      else { stats.pendingParties++; }
    });

    return res.json({ success: true, stats });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  submitPublicRSVP,
  getRSVPs,
  importGuestsCSV,
  sendEmailInvitations,
  getRsvpInvite,
  respondViaToken,
  getRsvpStats,
  exportGuestsCSV,
  exportGuestsExcel,
  searchPublicGuests,
  getGuestById,
  deleteRSVP,
  updateRSVP,
  addGuestManually,
  searchPublicSeating,
  getGuestSeatingMap,
  // Exported for unit testing of the ILIKE-injection escaping.
  escapeLikePattern
};
