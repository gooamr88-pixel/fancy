-- ════════════════════════════════════════════════════════════════════════
-- DATA CLEANUP: the Heritage Arch guest RSVP form ("Song request for the
-- party") never had its own database column — it was concatenated into the
-- generic rsvp_parties.notes text as a "🎵 Song request: <value>" block
-- (joined with the guest's free-text message via a blank line), then
-- regex-parsed back out client-side. That UI field has been removed
-- (frontend/src/app/components/templates/heritageArch/sections/RsvpSection.js),
-- so no new submissions will add this text — but existing rows that already
-- captured a song request still carry the embedded "🎵 Song request: ..."
-- block in their `notes`, and would otherwise keep showing it forever in
-- the organizer dashboard, guest exports, etc.
--
-- This scrubs that legacy block from `notes`, mirroring exactly what the
-- old frontend parser did: split on blank lines, drop any block that starts
-- with the song-request prefix, rejoin the rest. A party whose entire notes
-- was just the song request ends up with notes = NULL, matching what an
-- organizer would see today if that guest had never typed a message.
-- ════════════════════════════════════════════════════════════════════════

UPDATE public.rsvp_parties
SET notes = NULLIF(
  (
    SELECT string_agg(part, E'\n\n')
    FROM unnest(regexp_split_to_array(notes, E'\n\n')) AS part
    WHERE part !~ '^🎵 Song request:'
  ),
  ''
)
WHERE notes ~ '(^|\n\n)🎵 Song request:';
