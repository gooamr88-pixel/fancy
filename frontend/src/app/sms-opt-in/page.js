import Link from "next/link";
import Navbar from "../components/landing/Navbar";
import FooterSection from "../components/landing/FooterSection";
import OptInForm from "./OptInForm";

/* ═══════════════════════════════════════════════════════════
   SMS Opt-In & Consent — public opt-in page
   ═══════════════════════════════════════════════════════════
   This is the opt-in URL submitted with the Twilio Toll-Free
   Verification. It must stay:
   • public (no login, no CAPTCHA, no reveal animation),
   • server-rendered (full content in the initial HTML),
   • a LIVE opt-in flow (OptInForm posts to /public/sms-opt-in
     and persists a timestamped consent record — reviewers must
     see a working form, not a demonstration), and
   • an exact mirror of the consent language guests see inside
     every event RSVP form (SmsConsentText is the same component
     the live forms render — never fork the wording).
   ═══════════════════════════════════════════════════════════ */

export const metadata = {
  title: "SMS Opt-In & Consent — Fancy RSVP",
  description:
    "How Fancy RSVP collects SMS consent from event guests: opt-in flow, message types, frequency, rates, and STOP/HELP opt-out instructions. Operated by 16941460 Canada Corp. o/a Via Marketing.",
  alternates: { canonical: "https://fancyrsvp.com/sms-opt-in" },
};

const SERIF = "var(--font-serif)";
const SANS = "var(--font-sans)";
const GOLD = "#B8944F";
const INK = "#191B1E";
const BODY = "#5E5A52";
const LINE = "#E8E2D6";

function SectionTitle({ children }) {
  return (
    <h2
      style={{
        fontFamily: SERIF,
        fontSize: "22px",
        fontWeight: 700,
        color: INK,
        margin: "0 0 16px",
        paddingLeft: "14px",
        borderLeft: `3px solid ${GOLD}`,
      }}
    >
      {children}
    </h2>
  );
}

function P({ children, style }) {
  return (
    <p style={{ fontFamily: SANS, fontSize: "15px", color: BODY, lineHeight: 1.8, margin: "0 0 14px", ...style }}>
      {children}
    </p>
  );
}

function Card({ children, style }) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: `1px solid ${LINE}`,
        borderRadius: "16px",
        padding: "28px",
        boxShadow: "0 2px 12px rgba(0,0,0,0.03)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export default function SmsOptInPage() {
  return (
    <>
      <Navbar />
      <main style={{ paddingTop: "78px", background: "#FFFFFF" }}>
        {/* ── Hero ── */}
        <section
          style={{
            background: "linear-gradient(180deg, #FAF7F0 0%, #FFFFFF 100%)",
            padding: "72px 24px 56px",
            textAlign: "center",
          }}
        >
          <span
            style={{
              fontFamily: SANS,
              fontSize: "13px",
              fontWeight: 700,
              letterSpacing: "3px",
              textTransform: "uppercase",
              color: GOLD,
              display: "block",
              marginBottom: "16px",
            }}
          >
            SMS Program
          </span>
          <h1
            style={{
              fontFamily: SERIF,
              fontSize: "clamp(1.8rem, 5.5vw, 2.75rem)",
              fontWeight: 700,
              color: INK,
              marginBottom: "16px",
              lineHeight: 1.2,
            }}
          >
            SMS Opt-In &amp; Consent
          </h1>
          <p
            style={{
              fontFamily: SANS,
              fontSize: "16px",
              color: BODY,
              lineHeight: 1.6,
              maxWidth: "620px",
              margin: "0 auto",
            }}
          >
            This page explains exactly how Fancy RSVP collects consent before sending any text message, what
            guests agree to, and how to opt out at any time.
          </p>
        </section>

        <section style={{ maxWidth: "780px", margin: "0 auto", padding: "48px 24px 80px" }}>
          {/* ── Who operates this program ── */}
          <div style={{ marginBottom: "44px" }}>
            <SectionTitle>Who Operates This Program</SectionTitle>
            <Card>
              <P style={{ marginBottom: "10px" }}>
                <strong style={{ color: INK }}>Fancy RSVP</strong> (fancyrsvp.com) is an event invitation and
                RSVP platform owned and operated by{" "}
                <strong style={{ color: INK }}>16941460 Canada Corp., operating as Via Marketing</strong>.
              </P>
              <ul style={{ fontFamily: SANS, fontSize: "15px", color: BODY, lineHeight: 1.9, margin: 0, paddingLeft: "20px" }}>
                <li>Registered office: 2488 Selord Court, Mississauga, Ontario L5J 1P7, Canada</li>
                <li>
                  Corporate website:{" "}
                  <a href="https://viamarketing.ca" target="_blank" rel="noopener noreferrer" style={{ color: GOLD, fontWeight: 600 }}>
                    viamarketing.ca
                  </a>
                </li>
                <li>
                  Product support:{" "}
                  <a href="mailto:info@fancyrsvp.com" style={{ color: GOLD, fontWeight: 600 }}>
                    info@fancyrsvp.com
                  </a>
                  {" "}· Corporate contact:{" "}
                  <a href="mailto:info@viamarketing.ca" style={{ color: GOLD, fontWeight: 600 }}>
                    info@viamarketing.ca
                  </a>
                </li>
              </ul>
            </Card>
          </div>

          {/* ── What messages we send ── */}
          <div style={{ marginBottom: "44px" }}>
            <SectionTitle>What Messages We Send</SectionTitle>
            <P>
              Fancy RSVP sends <strong style={{ color: INK }}>transactional and informational</strong> text
              messages only, on behalf of the host of an event the recipient was personally invited to. The
              program covers exactly four message types:
            </P>
            <ul style={{ fontFamily: SANS, fontSize: "15px", color: BODY, lineHeight: 2, margin: "0 0 14px", paddingLeft: "20px" }}>
              <li><strong style={{ color: INK }}>Event invitations</strong> — a personal invitation with the guest’s RSVP link</li>
              <li><strong style={{ color: INK }}>RSVP updates</strong> — confirmations and changes to the guest’s own response</li>
              <li><strong style={{ color: INK }}>Reminders</strong> — RSVP deadline and event-date reminders</li>
              <li><strong style={{ color: INK }}>Event updates</strong> — date, time, or venue changes and day-of logistics</li>
            </ul>
            <P style={{ marginBottom: 0 }}>
              This is not a marketing service. We never send promotional or advertising messages through this
              program, and we never sell, rent, or share mobile numbers or consent records with any third party
              for marketing purposes.
            </P>
          </div>

          {/* ── How opt-in works ── */}
          <div style={{ marginBottom: "44px" }}>
            <SectionTitle>How a Guest Opts In</SectionTitle>
            <ol style={{ fontFamily: SANS, fontSize: "15px", color: BODY, lineHeight: 2, margin: "0 0 14px", paddingLeft: "20px" }}>
              <li>A guest opens their event’s public RSVP form (no account or login required).</li>
              <li>When responding, the guest enters their own phone number.</li>
              <li>
                An <strong style={{ color: INK }}>unchecked</strong> consent checkbox appears with the exact
                language shown below. It is never pre-checked.
              </li>
              <li>
                The form cannot be submitted with a phone number unless the guest affirmatively checks the box —
                this is enforced on the server as well.
              </li>
              <li>Consent is stored as a timestamped record tied to the guest’s response.</li>
            </ol>
            <P style={{ marginBottom: 0 }}>
              Guests who decline to provide a phone number, or who do not check the box, never receive text
              messages from us.
            </P>
          </div>

          {/* ── The live opt-in form ── */}
          <div style={{ marginBottom: "44px" }}>
            <SectionTitle>Opt In to Fancy RSVP Texts</SectionTitle>
            <P>
              This is a live opt-in form. It uses the exact same consent language every guest agrees to inside
              their event&rsquo;s RSVP form, and submitting it records your consent with a timestamp:
            </P>
            <Card style={{ background: "#FCFAF5" }}>
              <OptInForm />
            </Card>
          </div>

          {/* ── Frequency, rates ── */}
          <div style={{ marginBottom: "44px" }}>
            <SectionTitle>Message Frequency &amp; Rates</SectionTitle>
            <P style={{ marginBottom: 0 }}>
              Message frequency varies by event; a typical guest receives approximately 1–5 messages per event
              (for example, one invitation, one or two reminders, and a day-of update).{" "}
              <strong style={{ color: INK }}>Message and data rates may apply</strong> depending on your mobile
              carrier plan. Every message identifies Fancy RSVP as the sender.
            </P>
          </div>

          {/* ── Opt out ── */}
          <div style={{ marginBottom: "44px" }}>
            <SectionTitle>How to Opt Out or Get Help</SectionTitle>
            <ul style={{ fontFamily: SANS, fontSize: "15px", color: BODY, lineHeight: 2, margin: "0 0 14px", paddingLeft: "20px" }}>
              <li>
                Reply <strong style={{ color: INK }}>STOP</strong> (or UNSUBSCRIBE, CANCEL, END, or QUIT) to any
                message to stop receiving texts. You’ll receive one final confirmation, then no further messages.
              </li>
              <li>
                Reply <strong style={{ color: INK }}>HELP</strong> to any message for assistance.
              </li>
              <li>
                Or email{" "}
                <a href="mailto:info@fancyrsvp.com" style={{ color: GOLD, fontWeight: 600 }}>
                  info@fancyrsvp.com
                </a>{" "}
                and we’ll process the request for you.
              </li>
            </ul>
            <P style={{ marginBottom: 0 }}>
              Opting out never affects a guest’s RSVP or their ability to attend an event — hosts can still reach
              them by email or other contact methods they’ve shared.
            </P>
          </div>

          {/* ── Policies ── */}
          <div>
            <SectionTitle>Full Terms &amp; Privacy</SectionTitle>
            <P>
              Complete SMS terms are in{" "}
              <Link href="/terms" style={{ color: GOLD, fontWeight: 600 }}>
                Terms of Service — Section 5 (SMS Messaging Terms &amp; Conditions)
              </Link>
              , and full details on phone-number data handling, consent records, and your rights are in our{" "}
              <Link href="/privacy" style={{ color: GOLD, fontWeight: 600 }}>
                Privacy Policy — Section 3 (SMS/Text Messaging Communications &amp; Consent)
              </Link>
              .
            </P>
          </div>
        </section>
      </main>
      <FooterSection />
    </>
  );
}
