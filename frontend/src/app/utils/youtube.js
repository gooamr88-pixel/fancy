const YT_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

// Extracts the 11-character video ID from any common YouTube URL shape
// (watch?v=, youtu.be/, /embed/, /shorts/, /live/, music.youtube.com, no
// protocol). Returns null for anything else (including a direct-hosted audio
// file URL), which callers use to decide whether to render a YouTube iframe
// player or a plain <audio> element.
//
// Parses with the URL API (host + searchParams) rather than one fragile
// regex, so it doesn't depend on `v` being the first query param — a real
// gap the old single regex had: some share flows put other params (e.g. a
// tracking `pp`/`si` prefix from an in-app browser redirect) before `v`, and
// "watch?v=" as a literal substring wouldn't be there for those to match.
export function extractYouTubeId(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const u = new URL(withScheme);
    const host = u.hostname.replace(/^www\./i, '').replace(/^m\./i, '');

    if (host === 'youtu.be') {
      const id = u.pathname.split('/').filter(Boolean)[0];
      return YT_ID_RE.test(id) ? id : null;
    }
    if (host === 'youtube.com' || host === 'music.youtube.com') {
      const v = u.searchParams.get('v');
      if (YT_ID_RE.test(v)) return v;
      const segments = u.pathname.split('/').filter(Boolean);
      if (segments.length >= 2 && ['embed', 'shorts', 'live'].includes(segments[0]) && YT_ID_RE.test(segments[1])) {
        return segments[1];
      }
    }
  } catch {
    // Not a parseable URL at all — fall through to null.
  }
  return null;
}

// Lazy-loads the YouTube IFrame Player API script exactly once and resolves
// with `window.YT` once it's ready. Shared by every place that mounts a
// player (guest page playback, dashboard embeddability checks) so the
// script-tag bookkeeping/callback-chaining lives in one place.
let iframeApiPromise = null;
export function loadYouTubeIframeApi() {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (iframeApiPromise) return iframeApiPromise;
  iframeApiPromise = new Promise((resolve) => {
    const previousCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { previousCallback?.(); resolve(window.YT); };
    if (!document.getElementById('youtube-iframe-api')) {
      const tag = document.createElement('script');
      tag.id = 'youtube-iframe-api';
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }
  });
  return iframeApiPromise;
}

// Mounts a hidden, temporary player for `videoId` and resolves whether it
// actually comes up playable. This is the ONLY way to know a video won't
// play embedded elsewhere — a very common restriction on official/label
// music videos (exactly what people paste here for wedding/event songs) —
// the URL alone never reveals it, only the IFrame Player's onError event
// (codes 101/150 = "embedding disabled by the video owner", 100 = removed/
// private) does, at mount time. Resolves true on a bounded timeout with no
// error, and true if the API itself fails to load — never blocks the
// organizer's workflow on a network hiccup, only warns on a definitive
// "this exact video can't be embedded" signal.
export function checkYouTubeEmbeddable(videoId, { timeoutMs = 6000 } = {}) {
  if (!videoId) return Promise.resolve(false);
  return loadYouTubeIframeApi()
    .then((YT) => new Promise((resolve) => {
      const host = document.createElement('div');
      host.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;';
      document.body.appendChild(host);
      let settled = false;
      let player = null;
      const finish = (ok) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { player?.destroy?.(); } catch { /* already torn down */ }
        host.remove();
        resolve(ok);
      };
      const timer = setTimeout(() => finish(true), timeoutMs);
      player = new YT.Player(host, {
        videoId,
        playerVars: { autoplay: 0, controls: 0 },
        events: {
          onReady: () => finish(true),
          onError: () => finish(false),
        },
      });
    }))
    .catch(() => true);
}
