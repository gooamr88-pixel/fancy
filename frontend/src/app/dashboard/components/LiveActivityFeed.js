import React from "react";
import { isAccepted } from '../../utils/responseHelpers';

export default function LiveActivityFeed({ rsvps }) {
  const recentRsvps = [...rsvps].slice(0, 8);

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E8E2D6",
        padding: "24px",
        borderRadius: "12px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid #F0ECE3",
          paddingBottom: "12px",
        }}
      >
        <div>
          <h3
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "18px",
              fontWeight: 500,
              color: "#191B1E",
              letterSpacing: "0.3px",
            }}
          >
            Live RSVP Activity
          </h3>
          <p
            style={{
              fontSize: "10px",
              color: "#77736A",
              fontFamily: "var(--font-sans)",
              marginTop: "2px",
            }}
          >
            Real-time update streams for guest responses
          </p>
        </div>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            padding: "3px 10px",
            borderRadius: "20px",
            background: "rgba(184,148,79,0.1)",
            color: "#B8944F",
            fontSize: "10px",
            fontWeight: 700,
            border: "1px solid rgba(184,148,79,0.2)",
            fontFamily: "var(--font-sans)",
          }}
        >
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: "#B8944F",
              animation: "pulse 2s infinite",
            }}
          />
          Live
        </span>
      </div>

      <div
        style={{
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          maxHeight: "280px",
        }}
      >
        {recentRsvps.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "32px 0",
              fontSize: "12px",
              color: "#77736A",
              fontStyle: "italic",
              fontFamily: "var(--font-sans)",
            }}
          >
            Waiting for RSVP records...
          </div>
        ) : (
          recentRsvps.map((guest, idx) => {
            const initials = guest.guest_name
              ? guest.guest_name
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()
              : "?";

            const isYes = isAccepted(guest.response);

            return (
              <div
                key={guest.id || idx}
                style={{
                  padding: "12px",
                  border: "1px solid #F0ECE3",
                  background: "#FAFAF8",
                  borderRadius: "10px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "12px",
                  transition: "all 0.3s ease",
                  fontFamily: "var(--font-sans)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "rgba(184,148,79,0.3)";
                  e.currentTarget.style.background = "#FDFCF9";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#F0ECE3";
                  e.currentTarget.style.background = "#FAFAF8";
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      fontSize: "11px",
                      background: isYes ? "rgba(184,148,79,0.12)" : "rgba(196,94,94,0.1)",
                      color: isYes ? "#B8944F" : "#C45E5E",
                    }}
                  >
                    {initials}
                  </div>
                  <div>
                    <span
                      style={{
                        fontWeight: 700,
                        color: "#191B1E",
                        display: "block",
                      }}
                    >
                      {guest.guest_name}
                    </span>
                    <span
                      style={{
                        fontSize: "10px",
                        color: "#77736A",
                        display: "block",
                        lineHeight: 1,
                        marginTop: "3px",
                      }}
                    >
                      {isYes
                        ? `Party: ${guest.party_size} | Meal: ${guest.meal || "-"}`
                        : "Declined invitation"}
                    </span>
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: "6px",
                      fontSize: "9px",
                      fontWeight: 700,
                      background: isYes ? "rgba(184,148,79,0.1)" : "rgba(196,94,94,0.08)",
                      color: isYes ? "#B8944F" : "#C45E5E",
                    }}
                  >
                    {isYes ? "ACCEPT" : "DECLINE"}
                  </span>
                  <span
                    style={{
                      fontSize: "9px",
                      color: "#A09A91",
                      display: "block",
                      marginTop: "4px",
                      lineHeight: 1,
                    }}
                  >
                    {guest.timestamp || "Just now"}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
