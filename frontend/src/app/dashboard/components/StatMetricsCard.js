import React from "react";

export default function StatMetricsCard({ label, value, subtext, icon, accentColor }) {
  const accentColors = {
    green: "#B8944F",
    rose: "#C45E5E",
    amber: "#D7BE80",
    blue: "#6B8EAE",
    slate: "#77736A",
  };

  const borderColor = accentColors[accentColor] || accentColors.slate;

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E8E2D6",
        borderLeft: `4px solid ${borderColor}`,
        padding: "20px 24px",
        borderRadius: "12px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        transition: "all 0.3s ease",
        cursor: "default",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.06)";
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <div style={{ flex: 1 }}>
        <span
          style={{
            fontSize: "10px",
            fontWeight: 700,
            color: "#77736A",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            display: "block",
            fontFamily: "var(--font-sans)",
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontSize: "28px",
            fontWeight: 700,
            color: "#191B1E",
            display: "block",
            marginTop: "8px",
            fontFamily: "var(--font-sans)",
            letterSpacing: "-0.5px",
          }}
        >
          {value}
        </span>
        {subtext && (
          <span
            style={{
              fontSize: "11px",
              color: "#A09A91",
              display: "block",
              marginTop: "4px",
              fontWeight: 300,
              fontFamily: "var(--font-sans)",
            }}
          >
            {subtext}
          </span>
        )}
      </div>
      {icon && (
        <div
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            background: "#F8F4EC",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#B8944F",
          }}
        >
          {icon}
        </div>
      )}
    </div>
  );
}
