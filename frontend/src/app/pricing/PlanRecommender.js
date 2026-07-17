"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { formatTierPrice, tierCta, tierHref, tierGuestLine } from "../utils/usePublicPricing";

/**
 * "Which Plan Do You Need?" — an interactive plan finder driven entirely by
 * the live pricing tiers (same data the cards below render, same data
 * checkout actually charges against). Tell it your guest count and the
 * features you need; it recommends the cheapest real tier that satisfies
 * both. Deliberately NOT a fake-urgency/scarcity widget ("Only 3 left!") —
 * the persuasion here is just removing the "which plan is right for me?"
 * friction with an honest, data-backed answer.
 */
export default function PlanRecommender({ tiers }) {
  const [guestCount, setGuestCount] = useState(100);
  const [mustHave, setMustHave] = useState(new Set());

  const allFeatures = useMemo(() => {
    const set = new Set();
    for (const t of tiers || []) {
      for (const f of t.features || []) set.add(f);
    }
    return [...set];
  }, [tiers]);

  // The slider's ceiling is the largest FIXED (non-custom) plan's real guest
  // cap — never a hardcoded number that could silently drift from what an
  // admin actually configures at /admin/config. Once dragged to the top, the
  // recommendation naturally falls to the custom/contact-sales tier (or the
  // honest "closest match" fallback below if none is configured), so the
  // slider never implies a hard ceiling on how many guests the platform
  // supports — only where fixed pricing stops and a custom quote begins.
  const largestFixedCap = useMemo(() => {
    const caps = (tiers || [])
      .filter((t) => !t.is_custom && t.max_guests > 0)
      .map((t) => t.max_guests);
    return caps.length ? Math.max(...caps) : 1000;
  }, [tiers]);

  // Deep-link into the contact form with the subject and guest count already
  // filled in, so someone who just told us their event is too big for a fixed
  // plan doesn't have to repeat themselves in the message box.
  const contactHref = useMemo(
    () => `/contact?subject=enterprise&guests=${encodeURIComponent(guestCount)}`,
    [guestCount]
  );

  const toggleFeature = (f) => {
    setMustHave((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });
  };

  const { recommended, qualifyingCount, fallback } = useMemo(() => {
    const list = tiers || [];
    const required = [...mustHave];
    const qualifies = (t) => {
      const capOk = !(t.max_guests > 0) || t.max_guests >= guestCount;
      const featOk = required.every((f) => (t.features || []).includes(f));
      return capOk && featOk;
    };
    const qualifying = list.filter(qualifies);
    const cheapestFixed = qualifying
      .filter((t) => !t.is_custom)
      .sort((a, b) => (a.price_cents || 0) - (b.price_cents || 0))[0];
    if (cheapestFixed) return { recommended: cheapestFixed, qualifyingCount: qualifying.length, fallback: false };
    const customTier = qualifying.find((t) => t.is_custom);
    if (customTier) return { recommended: customTier, qualifyingCount: qualifying.length, fallback: false };
    // Nothing qualifies outright (guest count/feature combo exceeds every fixed
    // tier and there's no custom tier configured) — fall back to the tier with
    // the highest guest cap as the closest real option, flagged so the copy
    // can be honest about it being an approximation, not a guaranteed fit.
    const closest = [...list].sort((a, b) => (b.max_guests || Infinity) - (a.max_guests || Infinity))[0] || null;
    return { recommended: closest, qualifyingCount: 0, fallback: true };
  }, [tiers, guestCount, mustHave]);

  if (!tiers || tiers.length === 0) return null;

  return (
    <div
      className="pr-card"
      style={{
        background: "#FFFFFF",
        border: "1px solid #E8E2D6",
        borderRadius: "20px",
        padding: "40px 36px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.04)",
        marginBottom: "64px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: "32px" }}>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "12px", fontWeight: 700, color: "#B8944F", letterSpacing: "1.5px", textTransform: "uppercase", display: "block", marginBottom: "10px" }}>
          Plan Finder
        </span>
        <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "28px", fontWeight: 700, color: "#191B1E", marginBottom: "8px" }}>
          Not sure which plan fits?
        </h2>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: "14.5px", color: "#5E5A52" }}>
          Tell us your guest count and must-haves — we&apos;ll point to the cheapest plan that actually covers it.
        </p>
      </div>

      <div className="pr-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "36px" }}>
        {/* ── Inputs ── */}
        <div>
          <label htmlFor="pr-guest-count" style={{ fontFamily: "var(--font-sans)", fontSize: "13px", fontWeight: 700, color: "#191B1E", display: "block", marginBottom: "10px" }}>
            Expected guest count: <span style={{ color: "#B8944F" }}>{guestCount.toLocaleString()}</span>
          </label>
          <input
            id="pr-guest-count"
            type="range"
            min="10"
            max={largestFixedCap}
            step="10"
            value={Math.min(guestCount, largestFixedCap)}
            onChange={(e) => setGuestCount(Number(e.target.value))}
            style={{ width: "100%", accentColor: "#B8944F", marginBottom: "4px" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "11px", color: "#9E9A92" }}>10</span>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "11px", color: "#9E9A92" }}>{largestFixedCap.toLocaleString()}+</span>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="number"
              min="1"
              value={guestCount}
              onChange={(e) => setGuestCount(Math.max(1, Number(e.target.value) || 1))}
              style={{
                width: "100px", flexShrink: 0, boxSizing: "border-box", padding: "8px 12px", borderRadius: "8px",
                border: "1.5px solid #E8E2D6", fontFamily: "var(--font-sans)", fontSize: "14px",
                color: "#191B1E", outline: "none",
              }}
            />
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "#77736A", minWidth: 0 }}>
              guests — type an exact number above {largestFixedCap.toLocaleString()} if the slider can&apos;t reach it
            </span>
          </div>

          {allFeatures.length > 0 && (
            <div style={{ marginTop: "28px" }}>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "13px", fontWeight: 700, color: "#191B1E", display: "block", marginBottom: "10px" }}>
                Must-have features (optional)
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {allFeatures.map((f) => {
                  const active = mustHave.has(f);
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => toggleFeature(f)}
                      aria-pressed={active}
                      style={{
                        padding: "7px 14px", borderRadius: "100px",
                        border: active ? "1.5px solid #B8944F" : "1px solid #E8E2D6",
                        background: active ? "rgba(184,148,79,0.1)" : "#FFFFFF",
                        color: active ? "#B8944F" : "#5E5A52",
                        fontFamily: "var(--font-sans)", fontSize: "12.5px", fontWeight: 600,
                        cursor: "pointer", transition: "all 0.2s ease",
                      }}
                    >
                      {f}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Recommendation ── */}
        <div
          style={{
            background: "#F8F4EC",
            borderRadius: "16px",
            border: "1px solid #E8E2D6",
            padding: "28px 26px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {recommended ? (
            <>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "11px", fontWeight: 700, color: "#B8944F", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: "10px" }}>
                {fallback ? "Closest Match" : "Recommended For You"}
              </span>
              <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "24px", fontWeight: 700, color: "#191B1E", marginBottom: "4px" }}>
                {recommended.name}
              </h3>
              <div style={{ display: "flex", alignItems: "baseline", gap: "4px", marginBottom: "14px" }}>
                <span style={{ fontFamily: "var(--font-serif)", fontSize: "30px", fontWeight: 700, color: "#191B1E" }}>
                  {formatTierPrice(recommended).price}
                </span>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "#5E5A52" }}>
                  {formatTierPrice(recommended).period}
                </span>
              </div>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: "13.5px", color: "#5E5A52", marginBottom: "18px", lineHeight: 1.6 }}>
                {tierGuestLine(recommended)}
                {fallback && " — our largest fixed plan."}
              </p>
              <Link
                href={(fallback || recommended.is_custom) ? contactHref : tierHref(recommended)}
                className="btn-gold"
                style={{ padding: "12px 28px", fontSize: "14px", fontWeight: 700, borderRadius: "8px", textAlign: "center", textDecoration: "none" }}
              >
                {fallback ? "Contact Sales" : tierCta(recommended)}
              </Link>

              {/* The one place this ambiguity actually shows up live: make it
                  unambiguous, in plain language, right where it happens —
                  never a silent/automatic charge either way. */}
              {fallback ? (
                <p style={{ fontFamily: "var(--font-sans)", fontSize: "12.5px", color: "#77736A", marginTop: "14px", marginBottom: 0, lineHeight: 1.6 }}>
                  Your guest count is above every plan shown here. There&apos;s no automatic overage fee — <Link href={contactHref} style={{ color: "#B8944F", fontWeight: 700 }}>contact us</Link> and we&apos;ll quote a plan sized to your event before anything is charged.
                </p>
              ) : recommended.is_custom ? (
                <p style={{ fontFamily: "var(--font-sans)", fontSize: "12.5px", color: "#77736A", marginTop: "14px", marginBottom: 0, lineHeight: 1.6 }}>
                  Custom-priced for your guest count — you&apos;ll get a clear quote from our team before anything is charged, never an automatic fee.
                </p>
              ) : qualifyingCount > 1 && (
                <p style={{ fontFamily: "var(--font-sans)", fontSize: "12px", color: "#77736A", marginTop: "14px", marginBottom: 0 }}>
                  {qualifyingCount - 1} other plan{qualifyingCount - 1 === 1 ? "" : "s"} also cover{qualifyingCount - 1 === 1 ? "s" : ""} this — see the full comparison below.
                </p>
              )}
            </>
          ) : (
            <p style={{ fontFamily: "var(--font-sans)", fontSize: "14px", color: "#5E5A52" }}>
              Pricing is temporarily unavailable — see the plans below or{" "}
              <Link href="/contact" style={{ color: "#B8944F" }}>contact us</Link>.
            </p>
          )}
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 760px) {
          .pr-grid { grid-template-columns: 1fr !important; gap: 28px !important; }
        }
        @media (max-width: 480px) {
          .pr-card { padding: 28px 22px !important; }
        }
      `}</style>
    </div>
  );
}
