// Shared by the two surfaces that upload a hero background video — the create
// wizard (Stage2 → create-event/page.js) and EventSettings' Design tab. They
// are separate components with separate handlers, so anything only fixed in one
// of them drifts; the parts that must stay identical live here.

// Client-side cap. Note this is only half the story: Supabase enforces its own
// global upload limit per project (50MB on the default configuration) and the
// `event-assets` bucket may carry a smaller per-bucket limit or a MIME
// allowlist of its own. When the project cap is lower than this number the
// picker accepts a file the storage API then rejects — which is why the catch
// below reports the server's own wording instead of guessing.
export const HERO_VIDEO_MAX_MB = 100;
export const HERO_VIDEO_MAX_BYTES = HERO_VIDEO_MAX_MB * 1024 * 1024;

// The single source of the number the organizer is shown. Four separate places
// used to spell "100MB" as a literal next to a guard that read the constant, so
// changing the cap would have left three of them lying.
export const HERO_VIDEO_MAX_LABEL = `${HERO_VIDEO_MAX_MB}MB`;
export const HERO_VIDEO_TOO_LARGE = `Video exceeds ${HERO_VIDEO_MAX_LABEL}. Please use a shorter or more compressed clip.`;

// Unlike the image/audio uploads, there is no base64 fallback: at video file
// sizes an inflated base64 payload would blow past the API's body-size limit,
// so a failed upload has to fail out loud.
export function heroVideoErrorMessage(err) {
  const raw = String(err?.message || err?.error || '');

  if (/exceeded|too large|payload|413|maximum allowed size/i.test(raw)) {
    return `The storage service rejected this video as too large. Try a shorter or more compressed clip — the server's limit is lower than ${HERO_VIDEO_MAX_LABEL}.`;
  }
  if (/mime|content type|not allowed|invalid_mime/i.test(raw)) {
    return "The storage bucket won't accept video files. An administrator needs to allow video/mp4 and video/webm on the event-assets bucket.";
  }
  if (/not found|bucket/i.test(raw)) {
    return "The event-assets storage bucket isn't reachable. An administrator needs to check it exists and is public.";
  }
  if (/not configured|not initialized/i.test(raw)) {
    return 'Storage is not configured for this site, so videos cannot be uploaded.';
  }
  return raw
    ? `Couldn't upload the video: ${raw}`
    : "Couldn't upload the video. Please check your connection and try again.";
}
