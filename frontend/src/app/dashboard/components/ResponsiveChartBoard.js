import React from "react";

export default function ResponsiveChartBoard({ stats }) {
  const attending = stats.attendingGuests || 0;
  const declined = stats.declinedGuests || 0;
  const pending = stats.pendingGuests || 0;
  const total = attending + declined + pending || 1;

  function roundPercentages(values) {
    const sum = values.reduce((a, b) => a + b, 0);
    if (sum === 0) return values.map(() => 0);
    const raw = values.map(v => (v / sum) * 100);
    const floored = raw.map(v => Math.floor(v));
    let remainder = 100 - floored.reduce((a, b) => a + b, 0);
    const remainders = raw.map((v, i) => ({ i, r: v - floored[i] })).sort((a, b) => b.r - a.r);
    for (let j = 0; j < remainder; j++) floored[remainders[j].i]++;
    return floored;
  }
  const [yesPercent, noPercent, pendingPercent] = roundPercentages([attending, declined, pending]);

  const radius = 50;
  const circumference = 2 * Math.PI * radius;

  const yesDash = (attending / total) * circumference;
  const noDash = (declined / total) * circumference;
  const pendingDash = (pending / total) * circumference;

  const meals = stats.mealSummary || {};
  const mealKeys = Object.keys(meals);
  const mealTotal = Object.values(meals).reduce((acc, curr) => acc + curr, 0) || 1;

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E8E2D6",
        padding: "24px",
        borderRadius: "12px",
        display: "flex",
        flexDirection: "column",
        gap: "24px",
      }}
    >
      <div>
        <h3
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "18px",
            fontWeight: 500,
            color: "#191B1E",
          }}
        >
          Analytics Overview
        </h3>
        <p
          style={{
            fontSize: "10px",
            color: "#77736A",
            fontFamily: "var(--font-sans)",
            marginTop: "2px",
          }}
        >
          Real-time attendance rates and meal options
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "32px",
          alignItems: "center",
        }}
      >
        {/* SVG Donut Chart */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "24px",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              position: "relative",
              width: "144px",
              height: "144px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              style={{
                width: "100%",
                height: "100%",
                transform: "rotate(-90deg)",
              }}
              viewBox="0 0 120 120"
            >
              {/* Background circle */}
              <circle
                cx="60"
                cy="60"
                r={radius}
                fill="transparent"
                stroke="#E8E2D6"
                strokeWidth="10"
              />
              {/* Accepted - Champagne Gold */}
              {attending > 0 && (
                <circle
                  cx="60"
                  cy="60"
                  r={radius}
                  fill="transparent"
                  stroke="#B8944F"
                  strokeWidth="10"
                  strokeDasharray={`${yesDash} ${circumference}`}
                  strokeDashoffset="0"
                  strokeLinecap="round"
                  style={{ transition: "all 1s ease" }}
                />
              )}
              {/* Declined - Muted Rose */}
              {declined > 0 && (
                <circle
                  cx="60"
                  cy="60"
                  r={radius}
                  fill="transparent"
                  stroke="#77736A"
                  strokeWidth="10"
                  strokeDasharray={`${noDash} ${circumference}`}
                  strokeDashoffset={-yesDash}
                  strokeLinecap="round"
                  style={{ transition: "all 1s ease" }}
                />
              )}
              {/* Pending - Soft Champagne */}
              {pending > 0 && (
                <circle
                  cx="60"
                  cy="60"
                  r={radius}
                  fill="transparent"
                  stroke="#D7BE80"
                  strokeWidth="10"
                  strokeDasharray={`${pendingDash} ${circumference}`}
                  strokeDashoffset={-(yesDash + noDash)}
                  strokeLinecap="round"
                  style={{ transition: "all 1s ease" }}
                />
              )}
            </svg>

            {/* Center Text */}
            <div
              style={{
                position: "absolute",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span
                style={{
                  fontSize: "24px",
                  fontWeight: 900,
                  color: "#191B1E",
                  fontFamily: "var(--font-sans)",
                }}
              >
                {yesPercent}%
              </span>
              <span
                style={{
                  fontSize: "9px",
                  fontWeight: 700,
                  color: "#B8944F",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  fontFamily: "var(--font-sans)",
                }}
              >
                Acceptance
              </span>
            </div>
          </div>

          {/* Legends */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[
              { label: "Attending", value: attending, pct: yesPercent, color: "#B8944F" },
              { label: "Declined", value: declined, pct: noPercent, color: "#77736A" },
              { label: "Pending", value: pending, pct: pendingPercent, color: "#D7BE80" },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "12px",
                  fontFamily: "var(--font-sans)",
                }}
              >
                <span
                  style={{
                    width: "12px",
                    height: "12px",
                    borderRadius: "3px",
                    background: item.color,
                    display: "block",
                  }}
                />
                <span style={{ fontWeight: 600, color: "#191B1E" }}>
                  {item.label}: {item.value}{" "}
                  <span style={{ color: "#77736A", fontWeight: 400 }}>({item.pct}%)</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Meal Breakdown */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <h4
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "#77736A",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              borderBottom: "1px solid #F0ECE3",
              paddingBottom: "6px",
              fontFamily: "var(--font-sans)",
            }}
          >
            Meal Preferences
          </h4>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {mealKeys.length === 0 ? (
              <div
                style={{
                  fontSize: "12px",
                  color: "#77736A",
                  fontStyle: "italic",
                  padding: "16px 0",
                  fontFamily: "var(--font-sans)",
                }}
              >
                No meal data submitted yet.
              </div>
            ) : (
              mealKeys.map((meal) => {
                const count = meals[meal] || 0;
                const percentage = Math.round((count / mealTotal) * 100);
                return (
                  <div
                    key={meal}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                      fontSize: "12px",
                      fontFamily: "var(--font-sans)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontWeight: 500,
                        color: "#191B1E",
                      }}
                    >
                      <span>{meal}</span>
                      <span style={{ fontWeight: 700 }}>
                        {count}{" "}
                        <span
                          style={{
                            fontSize: "10px",
                            color: "#77736A",
                            fontWeight: 400,
                          }}
                        >
                          ({percentage}%)
                        </span>
                      </span>
                    </div>
                    <div
                      style={{
                        width: "100%",
                        height: "8px",
                        background: "#F8F4EC",
                        borderRadius: "9999px",
                        overflow: "hidden",
                        border: "1px solid #F0ECE3",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          background: "#B8944F",
                          borderRadius: "9999px",
                          transition: "width 0.7s ease",
                          width: `${percentage}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
