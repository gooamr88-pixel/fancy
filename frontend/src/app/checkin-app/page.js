"use client";

import React from "react";
import Link from "next/link";
import Navbar from "../components/landing/Navbar";
import FooterSection from "../components/landing/FooterSection";
import GoldDivider from "../components/GoldDivider";
import Icon from "../components/icons/Icon";
import { usePublicPricing } from "../utils/usePublicPricing";

/**
 * Fancy Check-in — the product page for the door app.
 *
 * The app is the most differentiated thing in the product and had no customer-
 * facing page at all: one bullet on /features, nothing on /pricing, and a
 * dashboard that handed out a pairing code for software with no download link.
 *
 * Two rules this page holds itself to:
 *
 *  1. Every claim maps to behaviour that exists. The offline bundle, the
 *     integrity check, the per-staff PIN, the four result states, the undo —
 *     all shipped and covered by tests. Nothing here is aspirational.
 *  2. It never names a plan. Which tiers include the app is admin config and
 *     can change in a click, so the plan section reads it live from
 *     /payments/public-pricing. A hardcoded "Enterprise and above" is a
 *     sentence that goes on being wrong after somebody moves the feature.
 */

const C = {
  gold: "#B8944F", goldSoft: "rgba(184,148,79,0.08)", charcoal: "#191B1E",
  ivory: "#F8F4EC", stone: "#77736A", border: "#E8E2D6", white: "#FFFFFF",
};

// The registry label as the public pricing endpoint renders it. Feature KEYS
// never reach the browser — paymentController maps them to labels — so this is
// the only string that can identify the feature on a tier.
const FEATURE_LABEL = "Fancy Check-in app (offline door scanner)";

const PAIN = [
  {
    icon: "hourglass",
    title: "A queue before the first song",
    body: "One person with a printed list, three hundred guests, and every family stopping to be found. The bottleneck is never the venue — it is the search.",
  },
  {
    icon: "noSignal",
    title: "A ballroom with no signal",
    body: "Thick walls, a basement suite, four hundred phones on one hotel access point. The one moment you need the guest list is the one moment the network is gone.",
  },
  {
    icon: "clipboard",
    title: "Nobody agrees who arrived",
    body: "Two people at two doors with two copies of the list. By dessert, the count in the kitchen and the count at the door are different numbers.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Pair the tablet",
    body: "Create a pairing code in your dashboard and type it into the app once. The tablet is now bound to this event and nothing else.",
  },
  {
    n: "02",
    title: "Load the guest list",
    body: "The whole list downloads onto the device and is checked against a hash before it is accepted. A half-finished download is never used.",
  },
  {
    n: "03",
    title: "Scan at the door",
    body: "Point the camera at the guest's QR pass. The answer comes from the tablet itself, so it is instant, and it is the same answer with or without wifi.",
  },
];

const RESULTS = [
  { label: "Welcome", tone: "#2E7D5B", body: "Valid pass, first arrival. The name and party size fill the screen so the person on the door can greet them properly." },
  { label: "Already inside", tone: "#C8871B", body: "This pass has been scanned. Shows who admitted them and when, so nobody is accused of anything." },
  { label: "Not on the list", tone: "#B03A2E", body: "No match. Search by name instead — the whole list is on the device." },
  { label: "Wrong event", tone: "#77736A", body: "A valid Fancy pass, but for a different night. Says so, instead of a flat refusal." },
];

const TRUST = [
  { title: "Passes are signed, not guessed", body: "Every ticket is a signed token. A screenshot of somebody else's QR is still their ticket, and a hand-made one is refused." },
  { title: "A PIN per person on the door", body: "Each staff member unlocks with their own PIN, verified on the device. Every admission carries the name of who let them in." },
  { title: "The tablet is bound to the event", body: "A device is paired to one event. Lose it and it opens nothing else; revoke it from the dashboard and it opens nothing at all." },
  { title: "The list is verified before use", body: "The downloaded guest list is checked against a record count and a content hash. A partial or tampered bundle is rejected, not quietly trusted." },
];

const FAQ = [
  {
    q: "Do my guests need to install anything?",
    a: "No. Guests never install anything. They get a QR pass by email when they RSVP and show it at the door — on their phone or printed. The app is only for the people working the door.",
  },
  {
    q: "What happens if the venue has no internet at all?",
    a: "Nothing changes. The guest list lives on the tablet, so scanning, searching and admitting all work with the network off. Arrivals queue up on the device and sync by themselves the moment a connection returns.",
  },
  {
    q: "Can two doors run at the same time?",
    a: "Yes. Pair as many tablets as you have doors. If the same guest is scanned at two of them, both are recorded and the duplicate is flagged for you to review rather than silently dropped.",
  },
  {
    q: "What if somebody is admitted by mistake?",
    a: "Any admission can be undone from the tablet with a reason. The original is kept as evidence and marked reversed — the record never just disappears.",
  },
  {
    q: "What do I need to run it?",
    a: "An Android tablet or phone with a camera. You install it from your dashboard, pair it, and load the list — all on wifi at the office, before the event.",
  },
];

export default function CheckinAppPage() {
  const { tiers } = usePublicPricing();
  const includedIn = (tiers || [])
    .filter((t) => (t.features || []).includes(FEATURE_LABEL))
    .map((t) => t.name);

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: "78px" }}>

        {/* ═══ HERO ═══ */}
        <section className="fx-section fx-section--tight-bottom" style={{
          background: "linear-gradient(180deg, #F8F4EC 0%, #FFFFFF 100%)",
          textAlign: "center", position: "relative", overflow: "hidden",
        }}>
          <div aria-hidden style={{ position: "absolute", top: "-70px", left: "-70px", width: "220px", height: "220px", borderRadius: "50%", border: "1px solid rgba(184,148,79,0.08)" }} />
          <div aria-hidden style={{ position: "absolute", bottom: "-50px", right: "-50px", width: "180px", height: "180px", borderRadius: "50%", border: "1px solid rgba(184,148,79,0.06)" }} />

          <div className="fx-container fx-container--lg" style={{ position: "relative", zIndex: 1 }}>
            <div style={{
              display: "inline-block", padding: "8px 24px", borderRadius: "100px",
              background: C.goldSoft, border: "1px solid rgba(184,148,79,0.15)", marginBottom: "28px",
            }}>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "13px", fontWeight: 600, color: C.gold, letterSpacing: "1.5px", textTransform: "uppercase" }}>
                The door app
              </span>
            </div>

            <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(34px, 6vw, 60px)", fontWeight: 400, lineHeight: 1.15, color: C.charcoal, margin: 0 }}>
              Your guest list,<br />in your hand, offline.
            </h1>

            <p style={{ maxWidth: "660px", margin: "24px auto 0", fontSize: "18px", lineHeight: 1.75, color: C.stone }}>
              Fancy Check-in turns any Android tablet into a door scanner that holds the entire
              guest list on the device. It admits guests in a second, with no internet at the
              venue, and syncs the moment it finds a connection.
            </p>

            <div style={{ display: "flex", gap: "14px", justifyContent: "center", flexWrap: "wrap", marginTop: "36px" }}>
              <Link href="/register" className="cka-btn cka-btn-primary">Start your event</Link>
              <Link href="/pricing" className="cka-btn cka-btn-ghost">See plans</Link>
            </div>

            <p style={{ marginTop: "22px", fontSize: "14px", color: C.stone }}>
              Guests install nothing. Their pass arrives by email.
            </p>
          </div>
        </section>

        <GoldDivider />

        {/* ═══ THE PROBLEM ═══ */}
        <section className="fx-section">
          <div className="fx-container fx-container--lg">
            <SectionHead
              kicker="Why a dedicated app"
              title="The door is where a good event goes wrong"
              sub="Everything else is planned for months. The first ninety seconds of a guest's night is usually left to a printout."
            />
            <div className="fx-grid fx-grid--3" style={{ marginTop: "48px" }}>
              {PAIN.map((p) => (
                <article key={p.title} style={cardStyle}>
                  <span style={iconBadge}><Icon name={p.icon} size={22} strokeWidth={1.6} color={C.gold} /></span>
                  <h3 style={cardTitle}>{p.title}</h3>
                  <p style={cardBody}>{p.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ HOW IT WORKS ═══ */}
        <section className="fx-section" style={{ background: "#FAFAF8" }}>
          <div className="fx-container fx-container--lg">
            <SectionHead kicker="How it works" title="Three steps, done at the office" sub="All of this happens on wifi, days before. At the venue the app needs nothing." />
            <div className="fx-grid fx-grid--3" style={{ marginTop: "48px" }}>
              {STEPS.map((s) => (
                <article key={s.n} style={{ ...cardStyle, background: C.white }}>
                  <span style={{ fontFamily: "var(--font-serif)", fontSize: "34px", color: C.gold, lineHeight: 1 }}>{s.n}</span>
                  <h3 style={{ ...cardTitle, marginTop: "14px" }}>{s.title}</h3>
                  <p style={cardBody}>{s.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ OFFLINE — the actual differentiator ═══ */}
        <section className="fx-section" style={{ background: C.charcoal, color: C.ivory }}>
          <div className="fx-container fx-container--lg" style={{ textAlign: "center" }}>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "13px", fontWeight: 600, color: C.gold, letterSpacing: "1.5px", textTransform: "uppercase" }}>
              Offline is the whole point
            </span>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 400, lineHeight: 1.25, margin: "18px 0 0", color: C.ivory }}>
              The door never waits for a network
            </h2>
            <p style={{ maxWidth: "720px", margin: "22px auto 0", fontSize: "17px", lineHeight: 1.8, color: "rgba(248,244,236,0.72)" }}>
              Most check-in tools call a server for every scan, so a weak signal becomes a queue and
              a dead one becomes a paper list. Fancy Check-in answers from the tablet. The guest
              list is downloaded and verified before the event, admissions are written locally, and
              the sync catches up on its own — including a device that was offline all night.
            </p>
            <div className="fx-grid fx-grid--3" style={{ marginTop: "44px", textAlign: "left" }}>
              {[
                ["Instant", "The answer comes from the device, not a round trip. No spinner between a guest and their table."],
                ["Uninterruptible", "Wifi drops mid-event and nobody at the door notices. Nothing to fail over to, because nothing failed."],
                ["Self-healing", "Arrivals queue on the tablet and sync themselves. Two doors reconcile into one truthful count."],
              ].map(([t, b]) => (
                <div key={t} style={{ border: "1px solid rgba(248,244,236,0.14)", borderRadius: "14px", padding: "24px" }}>
                  <h3 style={{ margin: 0, fontFamily: "var(--font-serif)", fontSize: "20px", fontWeight: 600, color: C.ivory }}>{t}</h3>
                  <p style={{ margin: "8px 0 0", fontSize: "15px", lineHeight: 1.7, color: "rgba(248,244,236,0.68)" }}>{b}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ WHAT THE DOOR TEAM SEES ═══ */}
        <section className="fx-section">
          <div className="fx-container fx-container--lg">
            <SectionHead
              kicker="At the door"
              title="Four answers, and only four"
              sub="Whoever works your door may have met the software ten minutes earlier. Every scan resolves to one unmistakable screen."
            />
            <div className="fx-grid fx-grid--2" style={{ marginTop: "48px" }}>
              {RESULTS.map((r) => (
                <article key={r.label} style={{ ...cardStyle, borderLeft: `4px solid ${r.tone}` }}>
                  <h3 style={{ ...cardTitle, color: r.tone }}>{r.label}</h3>
                  <p style={cardBody}>{r.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ TRUST ═══ */}
        <section className="fx-section" style={{ background: "#FAFAF8" }}>
          <div className="fx-container fx-container--lg">
            <SectionHead kicker="Built to be trusted" title="A door is a security boundary" sub="It decides who comes into a room full of people you care about." />
            <div className="fx-grid fx-grid--2" style={{ marginTop: "48px" }}>
              {TRUST.map((t) => (
                <article key={t.title} style={{ ...cardStyle, background: C.white }}>
                  <h3 style={cardTitle}>{t.title}</h3>
                  <p style={cardBody}>{t.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ PLANS — always read live ═══ */}
        <section className="fx-section">
          <div className="fx-container fx-container--md" style={{ textAlign: "center" }}>
            <SectionHead kicker="Getting it" title="Included with your plan" sub={null} />
            <p style={{ margin: "20px auto 0", maxWidth: "620px", fontSize: "17px", lineHeight: 1.8, color: C.stone }}>
              {includedIn.length > 0 ? (
                <>Fancy Check-in comes with <strong style={{ color: C.charcoal }}>{includedIn.join(", ")}</strong>. You download and install it from your dashboard once your event is on a plan that includes it.</>
              ) : (
                <>Fancy Check-in is available on selected plans. Open the pricing page for what each one includes.</>
              )}
            </p>
            <div style={{ display: "flex", gap: "14px", justifyContent: "center", flexWrap: "wrap", marginTop: "32px" }}>
              <Link href="/pricing" className="cka-btn cka-btn-primary">Compare plans</Link>
              <Link href="/contact" className="cka-btn cka-btn-ghost">Talk to us</Link>
            </div>
          </div>
        </section>

        <GoldDivider />

        {/* ═══ FAQ ═══ */}
        <section className="fx-section fx-section--tight-bottom">
          <div className="fx-container fx-container--md">
            <SectionHead kicker="Questions" title="Before you ask" sub={null} />
            <div style={{ marginTop: "40px", display: "flex", flexDirection: "column", gap: "14px" }}>
              {FAQ.map((f) => (
                <details key={f.q} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: "14px", padding: "20px 24px" }}>
                  <summary style={{ cursor: "pointer", fontSize: "17px", fontWeight: 600, color: C.charcoal, fontFamily: "var(--font-sans)" }}>{f.q}</summary>
                  <p style={{ margin: "12px 0 0", fontSize: "15.5px", lineHeight: 1.75, color: C.stone }}>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ CTA ═══ */}
        <section className="fx-section" style={{ background: C.charcoal, textAlign: "center" }}>
          <div className="fx-container fx-container--md">
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 400, color: C.ivory, margin: 0 }}>
              Let the door be the easy part
            </h2>
            <p style={{ margin: "18px auto 0", maxWidth: "560px", fontSize: "17px", lineHeight: 1.75, color: "rgba(248,244,236,0.7)" }}>
              Set up your event, invite your guests, and hand a tablet to whoever is on the door.
            </p>
            <div style={{ marginTop: "32px" }}>
              <Link href="/register" className="cka-btn cka-btn-gold">Create your event</Link>
            </div>
          </div>
        </section>
      </main>
      <FooterSection />

      {/* Rules live here rather than on the elements because these classes sit
          on next/link <Link> components, which never receive styled-jsx's
          hash class — a scoped rule would compile and match nothing. Same
          failure that made every alert on the platform invisible. */}
      <style jsx>{`
        :global(.cka-btn) {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 48px;
          padding: 14px 30px;
          border-radius: 10px;
          font-family: var(--font-sans);
          font-size: 15px;
          font-weight: 600;
          text-decoration: none;
          transition: transform 0.18s, box-shadow 0.18s, background 0.18s;
        }
        :global(.cka-btn):hover { transform: translateY(-1px); }
        :global(.cka-btn-primary) {
          background: #191b1e;
          color: #f8f4ec;
          border: 1px solid #191b1e;
        }
        :global(.cka-btn-ghost) {
          background: transparent;
          color: #191b1e;
          border: 1px solid #e8e2d6;
        }
        :global(.cka-btn-gold) {
          background: linear-gradient(135deg, #d7be80, #b8944f);
          color: #191b1e;
          border: 1px solid #b8944f;
          box-shadow: 0 10px 30px rgba(184, 148, 79, 0.28);
        }
      `}</style>
    </>
  );
}

function SectionHead({ kicker, title, sub }) {
  return (
    <div style={{ textAlign: "center" }}>
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "13px", fontWeight: 600, color: C.gold, letterSpacing: "1.5px", textTransform: "uppercase" }}>
        {kicker}
      </span>
      <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(27px, 4vw, 40px)", fontWeight: 400, lineHeight: 1.25, color: C.charcoal, margin: "16px 0 0" }}>
        {title}
      </h2>
      {sub && (
        <p style={{ maxWidth: "660px", margin: "16px auto 0", fontSize: "17px", lineHeight: 1.75, color: C.stone }}>{sub}</p>
      )}
    </div>
  );
}

const cardStyle = {
  background: "#FFFFFF",
  border: `1px solid ${C.border}`,
  borderRadius: "16px",
  padding: "28px 26px",
};

const cardTitle = {
  margin: "0 0 10px",
  fontFamily: "var(--font-serif)",
  fontSize: "20px",
  fontWeight: 600,
  color: C.charcoal,
  lineHeight: 1.3,
};

const cardBody = {
  margin: 0,
  fontSize: "15.5px",
  lineHeight: 1.75,
  color: C.stone,
};

const iconBadge = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "48px",
  height: "48px",
  borderRadius: "12px",
  background: C.goldSoft,
  marginBottom: "16px",
};
