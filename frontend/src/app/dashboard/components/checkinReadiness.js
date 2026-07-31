/**
 * "Is the door ready?" — computed in one place.
 *
 * ── Why this is shared ──
 *
 * The answer is shown twice: as a one-line verdict at the top of the check-in
 * setup page, and as an itemised list inside the Devices tab. Those must never
 * disagree. A banner saying "ready for the night" above a tab listing two
 * blockers is worse than showing nothing, because it is the banner people act
 * on and the list they never open.
 *
 * So both read from here. The page renders `verdict`; the tab renders `items`.
 *
 * ── The rule for what goes in ──
 *
 * Problems only. A list that also reports everything working buries the one
 * thing that is not, and this exists specifically to stop somebody leaving for
 * a venue with an unprepared tablet (§21.7).
 */

/** Nothing can proceed until these are fixed. */
export const BLOCK = 'block';
/** The event can run, but somebody is taking a risk. */
export const WARN = 'warn';

/**
 * @param {object}  input
 * @param {Array}   input.gates          Entrances on the seating map.
 * @param {Array}   input.devices        All devices; inactive ones are ignored.
 * @param {Array}   [input.staff]        Door team; inactive ones are ignored.
 * @param {boolean} [input.staffLoaded]  False while the roster is still loading,
 *                                       so "nobody on the team" is not reported
 *                                       before we know. Silence is better than a
 *                                       blocker that disappears a second later.
 */
export function buildCheckinReadiness({ gates = [], devices = [], staff = [], staffLoaded = true }) {
  const items = [];
  const activeDevices = devices.filter((d) => d.isActive);
  const prepared = activeDevices.filter((d) => d.isPrepared);
  const activeStaff = staff.filter((s) => s.isActive);

  if (gates.length === 0) {
    items.push({
      level: BLOCK,
      text: 'No entrance on the seating map, so no device can be paired.',
    });
  }

  if (activeDevices.length === 0) {
    items.push({ level: BLOCK, text: 'No tablet is paired for this event.' });
  } else if (prepared.length === 0) {
    items.push({
      level: BLOCK,
      text: 'No tablet has downloaded the guest list yet. A tablet without it cannot check anyone in at a venue with no internet.',
    });
  } else if (activeDevices.length === 1) {
    // §21.7: "every event runs with at least one prepared spare", and an
    // unprepared spare is worthless.
    items.push({
      level: WARN,
      text: 'Only one tablet is paired. If it is dropped or its battery dies, the door stops — pair a spare and download the guest list onto it too.',
    });
  } else if (prepared.length < 2) {
    items.push({
      level: WARN,
      text: 'Only one tablet has the guest list. A spare is only a spare once it has downloaded it.',
    });
  }

  // A blocker, not a warning: the tablet's login screen lists the roster, so
  // with nobody on it there is no one to sign in as and the app cannot be used
  // at all — however well the hardware is prepared.
  if (staffLoaded && activeStaff.length === 0) {
    items.push({
      level: BLOCK,
      text: 'Nobody is on the door team. Staff sign in on the tablet by picking their name, so it cannot be used until at least one person is added.',
    });
  }

  activeDevices.forEach((d) => {
    if (d.batteryLevel != null && d.batteryLevel <= 20) {
      items.push({ level: WARN, text: `${d.label} is at ${d.batteryLevel}% battery.` });
    }
    if (d.storageFreeMb != null && d.storageFreeMb < 500) {
      items.push({ level: WARN, text: `${d.label} is low on storage (${d.storageFreeMb} MB free).` });
    }
    if (d.queueDepth) {
      items.push({ level: WARN, text: `${d.label} has ${d.queueDepth} check-ins still to send.` });
    }
    if (d.gateMissing) {
      items.push({ level: WARN, text: `${d.label}'s gate is no longer on the seating map.` });
    }
  });

  return items;
}

/**
 * The one-line answer, for the top of the page.
 *
 * Deliberately three states rather than a percentage. "68% ready" is not a
 * thing anyone can act on; "one tablet has no guest list" is.
 */
export function readinessVerdict(items) {
  const blockers = items.filter((i) => i.level === BLOCK);
  const warnings = items.filter((i) => i.level === WARN);

  if (blockers.length) {
    return {
      tone: BLOCK,
      headline: 'Not ready for the night',
      detail: blockers[0].text,
      more: blockers.length + warnings.length - 1,
    };
  }
  if (warnings.length) {
    return {
      tone: WARN,
      headline: 'Ready, with one thing worth fixing',
      detail: warnings[0].text,
      more: warnings.length - 1,
    };
  }
  return {
    tone: 'ok',
    headline: 'Ready for the night',
    detail: 'Tablets paired, guest list downloaded, a spare standing by, and the door team set up.',
    more: 0,
  };
}
