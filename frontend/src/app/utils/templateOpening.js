import { getCinematicTemplate } from '../components/templates/cinematic/cinematicThemes';

/* ═══════════════════════════════════════════════════════════════════════════
   What a guest actually opens.

   Three templates, three different arrivals — and only one of them is an
   envelope:

     Velvet Ring   a velvet box on a dark stage; the guest touches it
     Door of Joy   a carved door; the guest knocks three times
     everything    a wax-sealed envelope (InvitationReveal)

   The organizer's Design tab used to describe all of them as the third. It
   offered a "Seal Name / Monogram" field and a "Wax & paper tone" picker —
   both read ONLY by InvitationReveal, so both were dead on two of the three
   templates — under the heading "Invitation Seal & Stationery", with a button
   labelled "Preview the envelope" that mounted an envelope no Velvet Ring or
   Door of Joy guest will ever see. An organizer designing a wax seal for a
   template that opens on a velvet box is being confidently misinformed by the
   product about its own behaviour.

   `reveal_enabled` and `reveal_replay` are the two settings that genuinely
   apply to all three (see EventPageClient's showReveal / revealSessionKey —
   the same gate mounts whichever opening the template owns), which is exactly
   why their labels have to name the right thing.

   One resolver, so the settings screen, the preview modal and anything added
   later cannot disagree about which arrival an event has.
   ═══════════════════════════════════════════════════════════════════════════ */

const ENVELOPE = {
  key: 'envelope',
  /** Section heading in the Design tab. */
  title: 'Invitation Envelope',
  /** What the guest does, for the enable toggle. */
  toggleLabel: 'Open with the sealed envelope',
  toggleHint: 'On by default. Turn this off and guests land straight on the invitation, with no envelope to unseal.',
  replayLabel: 'Show the envelope again on every visit',
  previewLabel: 'Preview the envelope',
  intro: 'Guests arrive at a wax-sealed envelope addressed to them, and break the seal to open the invitation.',
  /** Whether seal_text and reveal_tone reach anything. Only here. */
  hasSeal: true,
};

const CINEMATIC_COPY = {
  velvetBox: {
    key: 'velvetBox',
    title: 'Invitation Opening',
    toggleLabel: 'Open with the velvet box',
    toggleHint: 'On by default. Turn this off and guests land straight on the invitation, with no box to open.',
    replayLabel: 'Play the opening again on every visit',
    previewLabel: 'Preview the opening',
    intro: 'Guests arrive at a velvet ring box on a darkened stage. They touch it, the lid opens on film, and your invitation dissolves out of the light.',
    hasSeal: false,
  },
  knockDoor: {
    key: 'knockDoor',
    title: 'Invitation Opening',
    toggleLabel: 'Open with the carved door',
    toggleHint: 'On by default. Turn this off and guests land straight on the invitation, with no door to knock on.',
    replayLabel: 'Play the opening again on every visit',
    previewLabel: 'Preview the opening',
    intro: 'Guests arrive at a carved door and knock three times. It answers, swings open on the light beyond, and doves lift from the garden gate behind your names.',
    hasSeal: false,
  },
};

/**
 * The arrival this template gives a guest.
 *
 * @param {string} templateType
 * @returns {{key: string, title: string, toggleLabel: string, toggleHint: string,
 *            replayLabel: string, previewLabel: string, intro: string,
 *            hasSeal: boolean, cinematic: object|null}}
 */
export function getTemplateOpening(templateType) {
  const cinematic = getCinematicTemplate(templateType);
  if (!cinematic) return { ...ENVELOPE, cinematic: null };
  return { ...CINEMATIC_COPY[cinematic.opening], cinematic };
}
