"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

/* ═══════════════════════════════════════════════════════════════════════════
   InvitationReveal — embeds the organizer-supplied Tilda "opening envelope"
   export verbatim (public/reveal-tilda/) instead of a React recreation, per
   explicit request: same code, same images, same animation as the reference
   file. Confirmed trade-off: unlike the previous generated-SVG reveal, this
   one does NOT personalise with the guest's name, does NOT switch with the
   site's EN/AR toggle, and does NOT play the event's own uploaded background
   music (musicRef) — it's the one fixed Tilda experience for every event,
   including its own internal audio track and its own floating music toggle.

   Mounted via a blob: URL rather than a plain <iframe src="/reveal-tilda/...">
   because this app sends `X-Frame-Options: DENY` for every route
   (next.config.mjs, mirrored in deployment/nginx.conf) — that header blocks
   ANY iframing of the file, including same-origin. Fetching the HTML and
   handing the browser a blob: URL never goes through that response header at
   all, so the reference file's markup/CSS/JS ships completely unmodified
   without having to carve a site-wide security header down for one page.
   A `<base href="/reveal-tilda/">` tag is injected into the fetched markup
   (the only alteration) purely so its relative css/js/images/ references
   still resolve — the blob URL itself has no path for the browser to resolve
   them against otherwise.

   The reference file's own script (opening-envelope-section.html, bottom)
   posts window.postMessage('fancy:envelope-opened') the moment the guest
   taps the seal — a small addition to that file for exactly this purpose,
   the only way a same-origin-policy-respecting iframe can tell this
   component "the guest opened it, dismiss the overlay."

   CONTRACT (kept stable for callers + tests):
     • data-testid="guest-envelope-reveal" on the root
     • data-testid="guest-envelope-skip" on the always-available skip control
     • calls onComplete() exactly once when finished or skipped
   ═══════════════════════════════════════════════════════════════════════════ */

const TILDA_REVEAL_URL = "/reveal-tilda/opening-envelope-section.html";
const TILDA_REVEAL_BASE = "/reveal-tilda/";
const OPENED_MESSAGE = "fancy:envelope-opened";

export default function InvitationReveal({
  event: _event, // eslint-disable-line no-unused-vars -- kept for API compatibility, the Tilda embed doesn't personalise
  mode: _mode = "invitation", // eslint-disable-line no-unused-vars
  guestName: _guestName = "", // eslint-disable-line no-unused-vars
  musicRef: _musicRef, // eslint-disable-line no-unused-vars -- the embed plays its own internal audio instead
  sessionKey = null,
  lang: _langProp = null, // eslint-disable-line no-unused-vars
  onComplete,
}) {
  const finishedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  /* Per-session "seen" memory (rsvp mode) — unchanged from before. */
  const seenKey = sessionKey ? `fancy_envelope_seen_${sessionKey}` : null;
  const markSeen = useCallback(() => {
    if (!seenKey || typeof window === "undefined") return;
    try { window.sessionStorage.setItem(seenKey, "1"); } catch { /* unavailable */ }
  }, [seenKey]);
  const [alreadySeen] = useState(
    () => !!(seenKey && typeof window !== "undefined" && (() => { try { return window.sessionStorage.getItem(seenKey) === "1"; } catch { return false; } })())
  );

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    markSeen();
    onCompleteRef.current && onCompleteRef.current();
  }, [markSeen]);

  useEffect(() => {
    if (alreadySeen) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [blobUrl, setBlobUrl] = useState(null);
  useEffect(() => {
    if (alreadySeen) return undefined;
    let cancelled = false;
    let createdUrl = null;
    fetch(TILDA_REVEAL_URL)
      .then((res) => res.text())
      .then((html) => {
        if (cancelled) return;
        const withBase = html.replace("<head>", `<head>\n<base href="${TILDA_REVEAL_BASE}">`);
        createdUrl = URL.createObjectURL(new Blob([withBase], { type: "text/html" }));
        setBlobUrl(createdUrl);
      })
      .catch((err) => {
        console.error("Failed to load invitation reveal:", err);
        if (!cancelled) finish(); // never trap a guest behind a reveal that failed to load
      });
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [alreadySeen, finish]);

  // The embedded file's own bridge script (see opening-envelope-section.html)
  // posts exactly this message when the guest taps the seal.
  useEffect(() => {
    if (alreadySeen) return undefined;
    const onMessage = (e) => { if (e.data === OPENED_MESSAGE) finish(); };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [alreadySeen, finish]);

  if (alreadySeen) return null;

  return (
    <motion.div
      data-testid="guest-envelope-reveal" role="dialog" aria-label="Open your invitation"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.5 } }}
      transition={{ duration: 0.4 }}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "#fdfaf3", overflow: "hidden" }}
    >
      {blobUrl && (
        <iframe
          src={blobUrl}
          title="Open your invitation"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
        />
      )}

      <button
        type="button"
        data-testid="guest-envelope-skip"
        onClick={finish}
        aria-label="Skip invitation animation"
        style={{
          position: "absolute", top: "max(16px, env(safe-area-inset-top))", insetInlineStart: 20, zIndex: 20,
          display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", minHeight: 44, borderRadius: 999,
          border: "1px solid rgba(184,148,79,0.4)", background: "rgba(255,255,255,.75)",
          backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
          color: "#3a3226", fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", cursor: "pointer",
          fontFamily: "var(--font-sans)",
        }}
      >
        Skip <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>›</span>
      </button>
    </motion.div>
  );
}
