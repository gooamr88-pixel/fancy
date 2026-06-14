"use client";

import React from "react";

/* ═══════════════════════════════════════════════════════════════
   RSVPFlowSection — Fancy RSVP (Page 10 Brand Guide)
   
   Displays the 4-step Guest RSVP Flow in phone mockup cards:
   01 Invitation Landing → 02 Guest Count →
   03 Preferences & Details → 04 Confirmation
   ═══════════════════════════════════════════════════════════════ */

/* ─── Brand tokens ─── */
const GOLD = "#B8944F";
const CHARCOAL = "#191B1E";
const IVORY = "#F8F4EC";
const SOFT_GOLD = "#D7BE80";
const STONE = "#77736A";
const WHITE = "#FFFFFF";
const BORDER = "#E8E2D6";

/* ─── Shared tiny helpers ─── */
const PhoneNotch = () => (
  <div
    style={{
      position: "absolute",
      top: 0,
      left: "50%",
      transform: "translateX(-50%)",
      width: "120px",
      height: "28px",
      background: CHARCOAL,
      borderRadius: "0 0 18px 18px",
      zIndex: 10,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "6px",
    }}
  >
    <span
      style={{
        width: "6px",
        height: "6px",
        borderRadius: "50%",
        background: "#333840",
      }}
    />
    <span
      style={{
        width: "36px",
        height: "4px",
        borderRadius: "4px",
        background: "#2A2D32",
      }}
    />
  </div>
);

const StatusBar = () => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "6px 6px 0",
      marginBottom: "4px",
    }}
  >
    <span
      style={{
        fontFamily: "var(--font-sans)",
        fontSize: "10px",
        fontWeight: 600,
        color: STONE,
      }}
    >
      9:41
    </span>
    <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
      <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
        <rect x="0" y="6" width="3" height="4" rx="0.5" fill={STONE} />
        <rect x="4" y="4" width="3" height="6" rx="0.5" fill={STONE} />
        <rect x="8" y="2" width="3" height="8" rx="0.5" fill={STONE} />
        <rect x="12" y="0" width="2" height="10" rx="0.5" fill={STONE} opacity="0.3" />
      </svg>
      <svg width="16" height="10" viewBox="0 0 16 10" fill="none">
        <rect x="0.5" y="0.5" width="15" height="9" rx="2" stroke={STONE} strokeWidth="0.8" fill="none" />
        <rect x="2" y="2" width="10" height="6" rx="1" fill={STONE} />
      </svg>
    </div>
  </div>
);

const HomeIndicator = () => (
  <div
    style={{
      width: "48px",
      height: "4px",
      borderRadius: "4px",
      background: "#D0CBC2",
      margin: "8px auto 0",
    }}
  />
);

const GoldButton = ({ children, small }) => (
  <div
    style={{
      background: GOLD,
      color: WHITE,
      fontFamily: "var(--font-sans)",
      fontSize: small ? "9px" : "10px",
      fontWeight: 700,
      textAlign: "center",
      padding: small ? "7px 12px" : "10px 16px",
      borderRadius: "6px",
      letterSpacing: "0.5px",
      cursor: "default",
      width: "100%",
      boxSizing: "border-box",
    }}
  >
    {children}
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   Phone Screen Contents
   ═══════════════════════════════════════════════════════════════ */

const Screen1_InvitationLanding = () => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      flex: 1,
      padding: "10px 0 0",
      textAlign: "center",
      gap: "6px",
    }}
  >
    {/* Decorative flourish */}
    <svg width="40" height="20" viewBox="0 0 40 20" fill="none">
      <path d="M5 15 Q20 0 35 15" stroke={SOFT_GOLD} strokeWidth="1" fill="none" />
      <path d="M10 12 Q20 2 30 12" stroke={GOLD} strokeWidth="0.8" fill="none" />
    </svg>

    <h3
      style={{
        fontFamily: "var(--font-serif)",
        fontSize: "18px",
        fontWeight: 700,
        color: CHARCOAL,
        lineHeight: 1.2,
        margin: 0,
      }}
    >
      Olivia &amp; James
    </h3>
    <p
      style={{
        fontFamily: "var(--font-serif)",
        fontSize: "11px",
        fontWeight: 400,
        fontStyle: "italic",
        color: STONE,
        margin: 0,
      }}
    >
      are getting married!
    </p>

    {/* Divider */}
    <div
      style={{
        width: "32px",
        height: "1px",
        background: SOFT_GOLD,
        margin: "6px 0",
      }}
    />

    {/* Event details */}
    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
      <span
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "10px",
          fontWeight: 600,
          color: GOLD,
          letterSpacing: "1.5px",
          textTransform: "uppercase",
        }}
      >
        June 21, 2025
      </span>
      <span
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "9px",
          fontWeight: 400,
          color: STONE,
          lineHeight: 1.5,
        }}
      >
        The Grand Willow
        <br />
        Austin, Texas
      </span>
    </div>

    <div style={{ marginTop: "10px", width: "100%", padding: "0 12px", boxSizing: "border-box" }}>
      <GoldButton>View Details &amp; RSVP</GoldButton>
    </div>

    <p
      style={{
        fontFamily: "var(--font-serif)",
        fontSize: "8px",
        fontStyle: "italic",
        color: SOFT_GOLD,
        margin: "8px 0 0",
      }}
    >
      We can&apos;t wait to celebrate with you!
    </p>
  </div>
);

const Screen2_GuestCount = () => {


  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        padding: "8px 0 0",
      }}
    >
      <h3
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "15px",
          fontWeight: 600,
          color: CHARCOAL,
          margin: "0 0 4px",
          textAlign: "center",
        }}
      >
        How many guests are attending?
      </h3>
      <p
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "9px",
          color: STONE,
          textAlign: "center",
          margin: "0 0 14px",
        }}
      >
        Please let us know by May 15, 2025
      </p>

      <div
        style={{
          background: WHITE,
          borderRadius: "10px",
          border: `1px solid ${BORDER}`,
          padding: "6px 14px",
          marginBottom: "12px",
        }}
      >
        <CounterRow label="Adults" value={2} />
        <CounterRow label="Children" value={0} />
      </div>

      {/* Total */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 14px",
          background: `${IVORY}`,
          borderRadius: "8px",
          marginBottom: "14px",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "10px",
            fontWeight: 600,
            color: STONE,
            textTransform: "uppercase",
            letterSpacing: "1px",
          }}
        >
          Total Guests
        </span>
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "18px",
            fontWeight: 800,
            color: GOLD,
          }}
        >
          2
        </span>
      </div>

      <div style={{ marginTop: "auto" }}>
        <GoldButton>Continue</GoldButton>
      </div>
    </div>
  );
};

const Screen3_Preferences = () => {


  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        padding: "8px 0 0",
      }}
    >
      <h3
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "15px",
          fontWeight: 600,
          color: CHARCOAL,
          margin: "0 0 4px",
          textAlign: "center",
        }}
      >
        Tell us more
      </h3>
      <p
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "9px",
          color: STONE,
          textAlign: "center",
          margin: "0 0 14px",
          lineHeight: 1.5,
        }}
      >
        Meal preferences help us create
        <br />
        the perfect experience.
      </p>

      <SelectRow label="Guest 1 — Meal Preference" value="Herb-Crusted Salmon" />
      <SelectRow label="Guest 2 — Meal Preference" value="Filet Mignon" />

      {/* Additional Notes */}
      <div style={{ marginBottom: "12px" }}>
        <label
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "8px",
            fontWeight: 700,
            color: STONE,
            textTransform: "uppercase",
            letterSpacing: "1px",
            display: "block",
            marginBottom: "4px",
          }}
        >
          Additional Notes
        </label>
        <div
          style={{
            border: `1px solid ${BORDER}`,
            borderRadius: "8px",
            background: WHITE,
            padding: "8px 10px",
            minHeight: "40px",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "9px",
              color: "#B5B0A7",
              fontStyle: "italic",
            }}
          >
            Any allergies or special requests...
          </span>
        </div>
      </div>

      <div style={{ marginTop: "auto" }}>
        <GoldButton>Continue</GoldButton>
      </div>
    </div>
  );
};

const Screen4_Confirmation = () => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      flex: 1,
      padding: "6px 0 0",
      textAlign: "center",
      gap: "4px",
    }}
  >
    {/* Checkmark circle */}
    <div
      style={{
        width: "36px",
        height: "36px",
        borderRadius: "50%",
        background: `${GOLD}15`,
        border: `1.5px solid ${GOLD}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: "4px",
      }}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M4 9L7.5 12.5L14 5.5" stroke={GOLD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>

    <h3
      style={{
        fontFamily: "var(--font-serif)",
        fontSize: "18px",
        fontWeight: 700,
        color: CHARCOAL,
        margin: 0,
      }}
    >
      Thank you!
    </h3>
    <p
      style={{
        fontFamily: "var(--font-sans)",
        fontSize: "9px",
        color: STONE,
        lineHeight: 1.6,
        margin: "2px 0 0",
      }}
    >
      Your response has been
      <br />
      successfully received.
    </p>
    <p
      style={{
        fontFamily: "var(--font-serif)",
        fontSize: "9px",
        fontStyle: "italic",
        color: SOFT_GOLD,
        margin: "2px 0 6px",
      }}
    >
      We look forward to celebrating with you.
    </p>

    {/* QR Code Placeholder */}
    <div
      style={{
        width: "72px",
        height: "72px",
        borderRadius: "8px",
        border: `1px solid ${BORDER}`,
        background: WHITE,
        display: "grid",
        gridTemplateColumns: "repeat(7, 1fr)",
        gridTemplateRows: "repeat(7, 1fr)",
        gap: "1px",
        padding: "6px",
        boxSizing: "border-box",
        margin: "0 auto",
      }}
    >
      {Array.from({ length: 49 }).map((_, i) => {
        const row = Math.floor(i / 7);
        const col = i % 7;
        const isCorner =
          (row < 3 && col < 3) ||
          (row < 3 && col > 3) ||
          (row > 3 && col < 3);
        const isDark =
          isCorner ||
          (row === 3 && col % 2 === 0) ||
          (col === 3 && row % 2 === 1) ||
          ((row + col) % 3 === 0 && row > 3 && col > 3);
        return (
          <div
            key={i}
            style={{
              borderRadius: "1px",
              background: isDark ? CHARCOAL : "#F0ECE3",
            }}
          />
        );
      })}
    </div>
    <p
      style={{
        fontFamily: "var(--font-sans)",
        fontSize: "7px",
        color: STONE,
        margin: "4px 0 8px",
      }}
    >
      Scan to view event details anytime.
    </p>

    <div style={{ width: "100%", padding: "0 8px", boxSizing: "border-box" }}>
      <GoldButton small>View My RSVP</GoldButton>
    </div>
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   Phone Frame Wrapper
   ═══════════════════════════════════════════════════════════════ */
const PhoneFrame = ({ children }) => (
  <div
    className="rsvp-phone-frame"
    style={{
      width: "100%",
      maxWidth: "260px",
      minHeight: "460px",
      borderRadius: "32px",
      border: `6px solid ${CHARCOAL}`,
      background: IVORY,
      boxShadow:
        "0 20px 50px rgba(0,0,0,0.08), 0 8px 20px rgba(0,0,0,0.04), inset 0 0 0 1px rgba(255,255,255,0.1)",
      position: "relative",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    }}
  >
    <PhoneNotch />
    <div
      style={{
        padding: "34px 18px 12px",
        display: "flex",
        flexDirection: "column",
        flex: 1,
      }}
    >
      <StatusBar />
      {children}
      <HomeIndicator />
    </div>
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   Step Label Data
   ═══════════════════════════════════════════════════════════════ */
const steps = [
  {
    num: "01",
    title: "Invitation Landing",
    desc: "Guests receive a beautiful, personalized invitation page with all event details.",
  },
  {
    num: "02",
    title: "Guest Count",
    desc: "A simple, intuitive interface to select the number of adults and children attending.",
  },
  {
    num: "03",
    title: "Preferences & Details",
    desc: "Collect meal selections, dietary needs, and special requests from each guest.",
  },
  {
    num: "04",
    title: "Confirmation",
    desc: "Instant confirmation with a QR code for easy access to event details anytime.",
  },
];

/* ═══════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════ */
export default function RSVPFlowSection() {
  return (
    <>
      <section
        id="rsvp-flow"
        style={{
          width: "100%",
          background: WHITE,
          padding: "100px 0 80px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            maxWidth: "1280px",
            margin: "0 auto",
            padding: "0 48px",
          }}
        >
          {/* ─── Section Header ─── */}
          <div
            style={{
              textAlign: "center",
              maxWidth: "640px",
              margin: "0 auto 64px",
            }}
          >
            {/* Eyebrow */}
            <span
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "3px",
                textTransform: "uppercase",
                color: GOLD,
                display: "block",
                marginBottom: "14px",
              }}
            >
              Seamless Guest Experience
            </span>

            {/* Title */}
            <h2
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "36px",
                fontWeight: 500,
                color: CHARCOAL,
                lineHeight: 1.25,
                letterSpacing: "-0.3px",
                margin: 0,
              }}
              className="rsvp-flow-title"
            >
              A smooth guest journey from
              <br />
              invitation to confirmation.
            </h2>

            {/* Subtle gold line */}
            <div
              style={{
                width: "48px",
                height: "2px",
                background: `linear-gradient(90deg, ${SOFT_GOLD}, ${GOLD})`,
                borderRadius: "2px",
                margin: "20px auto 0",
              }}
            />
          </div>

          {/* ─── Phone Mockups Row ─── */}
          <div
            className="rsvp-phones-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "28px",
              justifyItems: "center",
              alignItems: "start",
              marginBottom: "56px",
            }}
          >
            <PhoneFrame>
              <Screen1_InvitationLanding />
            </PhoneFrame>
            <PhoneFrame>
              <Screen2_GuestCount />
            </PhoneFrame>
            <PhoneFrame>
              <Screen3_Preferences />
            </PhoneFrame>
            <PhoneFrame>
              <Screen4_Confirmation />
            </PhoneFrame>
          </div>

          {/* ─── Step Labels Row ─── */}
          <div
            className="rsvp-steps-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "28px",
            }}
          >
            {steps.map((step) => (
              <div
                key={step.num}
                style={{
                  textAlign: "center",
                  padding: "0 8px",
                }}
              >
                {/* Step number */}
                <span
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "28px",
                    fontWeight: 800,
                    color: `${SOFT_GOLD}55`,
                    display: "block",
                    lineHeight: 1,
                    marginBottom: "6px",
                  }}
                >
                  {step.num}
                </span>
                {/* Step title */}
                <h4
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: "16px",
                    fontWeight: 600,
                    color: CHARCOAL,
                    margin: "0 0 6px",
                  }}
                >
                  {step.title}
                </h4>
                {/* Step description */}
                <p
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "12px",
                    fontWeight: 300,
                    color: STONE,
                    lineHeight: 1.6,
                    margin: 0,
                  }}
                >
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Responsive Styles ─── */}
      <style jsx>{`
        @media (max-width: 1100px) {
          .rsvp-phones-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 32px 24px !important;
            max-width: 600px !important;
            margin-left: auto !important;
            margin-right: auto !important;
          }
          .rsvp-steps-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 28px 24px !important;
            max-width: 600px !important;
            margin-left: auto !important;
            margin-right: auto !important;
          }
        }
        @media (max-width: 640px) {
          .rsvp-phones-grid {
            grid-template-columns: 1fr !important;
            max-width: 280px !important;
            gap: 36px !important;
          }
          .rsvp-steps-grid {
            grid-template-columns: 1fr !important;
            max-width: 300px !important;
            gap: 24px !important;
          }
          .rsvp-flow-title {
            font-size: 28px !important;
          }
        }
      `}</style>
    </>
  );
}

const CounterRow = ({ label, value }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "8px 0",
      borderBottom: `1px solid ${BORDER}`,
    }}
  >
    <span
      style={{
        fontFamily: "var(--font-sans)",
        fontSize: "10px",
        fontWeight: 500,
        color: CHARCOAL,
      }}
    >
      {label}
    </span>
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      <div
        style={{
          width: "22px",
          height: "22px",
          borderRadius: "50%",
          border: `1px solid ${BORDER}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-sans)",
          fontSize: "12px",
          color: STONE,
          cursor: "default",
          background: WHITE,
        }}
      >
        −
      </div>
      <span
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "14px",
          fontWeight: 700,
          color: CHARCOAL,
          minWidth: "16px",
          textAlign: "center",
        }}
      >
        {value}
      </span>
      <div
        style={{
          width: "22px",
          height: "22px",
          borderRadius: "50%",
          border: `1px solid ${GOLD}`,
          background: `${GOLD}12`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-sans)",
          fontSize: "12px",
          color: GOLD,
          cursor: "default",
        }}
      >
        +
      </div>
    </div>
  </div>
);

const SelectRow = ({ label, value }) => (
  <div style={{ marginBottom: "10px" }}>
    <label
      style={{
        fontFamily: "var(--font-sans)",
        fontSize: "8px",
        fontWeight: 700,
        color: STONE,
        textTransform: "uppercase",
        letterSpacing: "1px",
        display: "block",
        marginBottom: "4px",
      }}
    >
      {label}
    </label>
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 10px",
        border: `1px solid ${BORDER}`,
        borderRadius: "8px",
        background: WHITE,
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "10px",
          fontWeight: 500,
          color: CHARCOAL,
        }}
      >
        {value}
      </span>
      <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
        <path d="M1 1L5 5L9 1" stroke={STONE} strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    </div>
  </div>
);
