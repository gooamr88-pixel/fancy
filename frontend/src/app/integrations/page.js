"use client";
import React, { useState } from "react";
import Link from "next/link";
import Navbar from "../components/landing/Navbar";
import FooterSection from "../components/landing/FooterSection";
import GoldDivider from "../components/GoldDivider";

const integrations = [
  {
    name: "Google Calendar",
    description: "Automatically sync event dates, send reminders, and manage scheduling conflicts with Google Calendar integration.",
    color: "#4285F4",
    bgLight: "rgba(66,133,244,0.06)",
    icon: (
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
        <rect x="4" y="8" width="28" height="24" rx="3" stroke="#4285F4" strokeWidth="1.5" />
        <path d="M4 14h28" stroke="#4285F4" strokeWidth="1.5" />
        <path d="M12 4v8" stroke="#4285F4" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M24 4v8" stroke="#4285F4" strokeWidth="1.5" strokeLinecap="round" />
        <rect x="10" y="18" width="4" height="4" rx="0.5" fill="#4285F4" opacity="0.4" />
        <rect x="16" y="18" width="4" height="4" rx="0.5" fill="#EA4335" opacity="0.4" />
        <rect x="22" y="18" width="4" height="4" rx="0.5" fill="#FBBC04" opacity="0.4" />
        <rect x="10" y="24" width="4" height="4" rx="0.5" fill="#34A853" opacity="0.4" />
        <rect x="16" y="24" width="4" height="4" rx="0.5" fill="#4285F4" opacity="0.3" />
      </svg>
    ),
  },
  {
    name: "Stripe",
    description: "Accept payments for ticketed events with secure, PCI-compliant payment processing through Stripe.",
    color: "#635BFF",
    bgLight: "rgba(99,91,255,0.06)",
    icon: (
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
        <rect x="4" y="8" width="28" height="20" rx="3" stroke="#635BFF" strokeWidth="1.5" />
        <path d="M4 14h28" stroke="#635BFF" strokeWidth="1.5" />
        <path d="M8 20h6" stroke="#635BFF" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M8 24h10" stroke="#635BFF" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
        <circle cx="27" cy="22" r="4" stroke="#635BFF" strokeWidth="1" opacity="0.4" />
        <path d="M25.5 22s0.5-1.5 1.5-1.5 1.5 1 1.5 1.5-0.5 1.5-1.5 1.5-1.5-1.5-1.5-1.5z" fill="#635BFF" opacity="0.5" />
      </svg>
    ),
  },
  {
    name: "Mailchimp",
    description: "Sync your guest lists and send beautiful email campaigns, save-the-dates, and follow-up messages.",
    color: "#FFE01B",
    bgLight: "rgba(255,224,27,0.08)",
    icon: (
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
        <rect x="4" y="10" width="28" height="20" rx="2" stroke="#E6A100" strokeWidth="1.5" />
        <path d="M4 12l14 10 14-10" stroke="#E6A100" strokeWidth="1.5" strokeLinejoin="round" />
        <circle cx="18" cy="8" r="4" stroke="#E6A100" strokeWidth="1.2" />
        <path d="M16 7.5c0.5-0.5 1-0.8 2-0.8s1.5 0.3 2 0.8" stroke="#E6A100" strokeWidth="1" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    name: "Zapier",
    description: "Connect Fancy RSVP to 5,000+ apps. Automate workflows, trigger actions, and streamline your event operations.",
    color: "#FF4F00",
    bgLight: "rgba(255,79,0,0.06)",
    icon: (
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
        <path d="M18 4v28" stroke="#FF4F00" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M4 18h28" stroke="#FF4F00" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M8 8l20 20" stroke="#FF4F00" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M28 8L8 28" stroke="#FF4F00" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="18" cy="18" r="5" stroke="#FF4F00" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    name: "Slack",
    description: "Get instant RSVP notifications in your team channels. Coordinate event planning with real-time updates.",
    color: "#4A154B",
    bgLight: "rgba(74,21,75,0.06)",
    icon: (
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
        <rect x="14" y="4" width="4" height="12" rx="2" fill="#E01E5A" opacity="0.7" />
        <rect x="4" y="14" width="12" height="4" rx="2" fill="#36C5F0" opacity="0.7" />
        <rect x="18" y="20" width="4" height="12" rx="2" fill="#2EB67D" opacity="0.7" />
        <rect x="20" y="18" width="12" height="4" rx="2" fill="#ECB22E" opacity="0.7" />
        <circle cx="10" cy="10" r="2" fill="#E01E5A" opacity="0.5" />
        <circle cx="26" cy="10" r="2" fill="#36C5F0" opacity="0.5" />
        <circle cx="10" cy="26" r="2" fill="#2EB67D" opacity="0.5" />
        <circle cx="26" cy="26" r="2" fill="#ECB22E" opacity="0.5" />
      </svg>
    ),
  },
  {
    name: "WhatsApp",
    description: "Send RSVP links, event reminders, and updates directly to guests through WhatsApp messaging.",
    color: "#25D366",
    bgLight: "rgba(37,211,102,0.06)",
    icon: (
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
        <path d="M18 4C10.268 4 4 10.268 4 18c0 2.47.644 4.79 1.772 6.8L4 32l7.42-1.68A13.9 13.9 0 0018 32c7.732 0 14-6.268 14-14S25.732 4 18 4z" stroke="#25D366" strokeWidth="1.5" />
        <path d="M13 15c0-1 .5-2.5 2-2.5s1.5 1 2 2l.5 1.5c.3.7 1.3.5 2-.2l1-1c.7-.7 2-.3 2.5.5s.5 2-.5 3l-2 2c-1 1-3 1.5-5 .5s-3.5-3-4-4.5l-.5-1.3z" fill="#25D366" opacity="0.3" />
      </svg>
    ),
  },
  {
    name: "Google Sheets",
    description: "Export guest data, RSVP responses, and analytics directly to Google Sheets for custom reporting.",
    color: "#0F9D58",
    bgLight: "rgba(15,157,88,0.06)",
    icon: (
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
        <rect x="6" y="4" width="24" height="28" rx="2" stroke="#0F9D58" strokeWidth="1.5" />
        <path d="M6 12h24" stroke="#0F9D58" strokeWidth="1" />
        <path d="M6 18h24" stroke="#0F9D58" strokeWidth="1" opacity="0.5" />
        <path d="M6 24h24" stroke="#0F9D58" strokeWidth="1" opacity="0.5" />
        <path d="M18 12v20" stroke="#0F9D58" strokeWidth="1" opacity="0.5" />
        <rect x="8" y="6" width="8" height="4" rx="1" fill="#0F9D58" opacity="0.2" />
      </svg>
    ),
  },
  {
    name: "Eventbrite",
    description: "Import events from Eventbrite and sync attendee data for a unified guest management experience.",
    color: "#F05537",
    bgLight: "rgba(240,85,55,0.06)",
    icon: (
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
        <rect x="6" y="6" width="24" height="24" rx="4" stroke="#F05537" strokeWidth="1.5" />
        <path d="M12 14h12" stroke="#F05537" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M12 18h8" stroke="#F05537" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
        <path d="M12 22h10" stroke="#F05537" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
        <circle cx="26" cy="22" r="3" fill="#F05537" opacity="0.15" stroke="#F05537" strokeWidth="1" />
        <path d="M25 22l1 1 2-2" stroke="#F05537" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

function IntegrationCard({ integration }) {
  return (
    <div
      className="integration-card"
      style={{
        "--accent": integration.color,
        background: "#FFFFFF",
        borderRadius: "16px",
        padding: "36px 32px",
        cursor: "default",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Top accent line on hover */}
      <div
        className="integration-accent-line"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "3px",
          background: integration.color,
        }}
      />

      <div
        className="integration-icon-box"
        style={{
          width: "64px",
          height: "64px",
          borderRadius: "14px",
          background: integration.bgLight,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "20px",
        }}
      >
        {integration.icon}
      </div>

      <h3
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "20px",
          fontWeight: 600,
          color: "#191B1E",
          marginBottom: "10px",
        }}
      >
        {integration.name}
      </h3>

      <p
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "14px",
          color: "#5E5A52",
          lineHeight: 1.7,
          flex: 1,
          marginBottom: "24px",
        }}
      >
        {integration.description}
      </p>

      <Link
        href="/register"
        className="integration-connect-link"
        style={{
          display: "inline-block",
          padding: "10px 24px",
          borderRadius: "8px",
          fontFamily: "var(--font-sans)",
          fontSize: "13px",
          fontWeight: 700,
          cursor: "pointer",
          alignSelf: "flex-start",
          letterSpacing: "0.3px",
          textDecoration: "none",
        }}
      >
        Connect →
      </Link>

      <style jsx>{`
        .integration-card {
          border: 1px solid #E8E2D6;
          transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
          transform: translateY(0);
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.03);
        }
        .integration-card:hover,
        .integration-card:focus-within {
          border-color: var(--accent);
          transform: translateY(-6px);
          box-shadow: 0 20px 60px color-mix(in srgb, var(--accent) 9.4%, transparent), 0 8px 24px rgba(0, 0, 0, 0.04);
        }
        .integration-accent-line {
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        .integration-card:hover .integration-accent-line,
        .integration-card:focus-within .integration-accent-line {
          opacity: 1;
        }
        .integration-icon-box {
          transition: transform 0.3s ease;
          transform: scale(1);
        }
        .integration-card:hover .integration-icon-box,
        .integration-card:focus-within .integration-icon-box {
          transform: scale(1.05);
        }
        .integration-connect-link {
          border: 1.5px solid #E8E2D6;
          background: transparent;
          color: #5E5A52;
          transition: all 0.3s ease;
        }
        .integration-connect-link:hover,
        .integration-connect-link:focus-visible {
          border-color: var(--accent);
          background: color-mix(in srgb, var(--accent) 3.1%, transparent);
          color: var(--accent);
        }
      `}</style>
    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <>
      <Navbar />
      <main style={{ paddingTop: "78px" }}>
        {/* ════════════════════ HERO ════════════════════ */}
        <section
          style={{
            background: "linear-gradient(180deg, #F8F4EC 0%, #FFFFFF 100%)",
            padding: "100px 48px 80px",
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "180px", height: "180px", borderRadius: "50%", border: "1px solid rgba(184,148,79,0.08)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: "20px", left: "5%", width: "120px", height: "120px", borderRadius: "50%", border: "1px solid rgba(184,148,79,0.06)", pointerEvents: "none" }} />

          <div style={{ maxWidth: "700px", margin: "0 auto", position: "relative", zIndex: 1 }}>
            <div
              style={{
                display: "inline-block",
                padding: "8px 24px",
                borderRadius: "100px",
                background: "rgba(184, 148, 79, 0.08)",
                border: "1px solid rgba(184, 148, 79, 0.15)",
                marginBottom: "28px",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#B8944F",
                  letterSpacing: "1.5px",
                  textTransform: "uppercase",
                }}
              >
                Connect Your Tools
              </span>
            </div>

            <h1
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "clamp(2.4rem, 5vw, 3.8rem)",
                fontWeight: 700,
                color: "#191B1E",
                lineHeight: 1.15,
                marginBottom: "24px",
                letterSpacing: "-1px",
              }}
            >
              Seamless{" "}
              <span style={{ color: "#B8944F" }}>Integrations</span>
            </h1>

            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "19px",
                lineHeight: 1.7,
                color: "#5E5A52",
                maxWidth: "560px",
                margin: "0 auto",
              }}
            >
              Connect Fancy RSVP with the tools you already love. Automate your workflows, sync data effortlessly, and supercharge your event planning.
            </p>
          </div>
        </section>

        {/* ════════════════════ INTEGRATIONS GRID ════════════════════ */}
        <section style={{ maxWidth: "1200px", margin: "0 auto", padding: "60px 48px 100px" }}>
          <GoldDivider variant="wide" />

          <h2 className="sr-only">Available Integrations</h2>
          <div
            className="integrations-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "24px",
              marginTop: "56px",
            }}
          >
            {integrations.map((integration) => (
              <IntegrationCard key={integration.name} integration={integration} />
            ))}
          </div>
        </section>

        {/* ════════════════════ HOW IT WORKS ════════════════════ */}
        <section style={{ background: "#F8F4EC", padding: "100px 48px" }}>
          <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: "64px" }}>
              <h2
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: "40px",
                  fontWeight: 700,
                  color: "#191B1E",
                  marginBottom: "16px",
                }}
              >
                How It{" "}
                <span style={{ color: "#B8944F" }}>Works</span>
              </h2>
              <p
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "17px",
                  color: "#5E5A52",
                  lineHeight: 1.7,
                  maxWidth: "500px",
                  margin: "0 auto",
                }}
              >
                Setting up integrations is effortless. Connect your favorite tools in three simple steps.
              </p>
            </div>

            <div
              className="steps-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "48px",
                position: "relative",
              }}
            >
              {/* Connecting line */}
              <div
                className="steps-line"
                style={{
                  position: "absolute",
                  top: "56px",
                  left: "20%",
                  right: "20%",
                  height: "1px",
                  background: "linear-gradient(90deg, transparent, #D7BE80, #B8944F, #D7BE80, transparent)",
                  zIndex: 0,
                }}
              />

              {[
                {
                  step: "1",
                  title: "Choose Integration",
                  desc: "Browse our marketplace of integrations and select the tools you want to connect.",
                  icon: (
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                      <circle cx="16" cy="16" r="12" stroke="#B8944F" strokeWidth="1.5" />
                      <path d="M12 16h8M16 12v8" stroke="#B8944F" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  ),
                },
                {
                  step: "2",
                  title: "Authorize Access",
                  desc: "Securely connect your account with a single click. We use OAuth for maximum security.",
                  icon: (
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                      <rect x="8" y="14" width="16" height="12" rx="2" stroke="#B8944F" strokeWidth="1.5" />
                      <path d="M12 14v-4a4 4 0 018 0v4" stroke="#B8944F" strokeWidth="1.5" strokeLinecap="round" />
                      <circle cx="16" cy="20" r="2" fill="#B8944F" opacity="0.5" />
                    </svg>
                  ),
                },
                {
                  step: "3",
                  title: "Automate & Enjoy",
                  desc: "Your tools are now connected. Data flows automatically and your workflow is supercharged.",
                  icon: (
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                      <path d="M6 16h4l3-8 4 16 3-8h6" stroke="#B8944F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="26" cy="16" r="3" stroke="#B8944F" strokeWidth="1" fill="none" />
                    </svg>
                  ),
                },
              ].map((item) => (
                <div
                  key={item.step}
                  style={{
                    textAlign: "center",
                    position: "relative",
                    zIndex: 1,
                  }}
                >
                  <div
                    style={{
                      width: "80px",
                      height: "80px",
                      borderRadius: "50%",
                      background: "#FFFFFF",
                      border: "2px solid #E8E2D6",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "0 auto 24px",
                      boxShadow: "0 4px 16px rgba(0,0,0,0.04)",
                    }}
                  >
                    {item.icon}
                  </div>

                  <div
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "12px",
                      fontWeight: 700,
                      color: "#B8944F",
                      letterSpacing: "2px",
                      textTransform: "uppercase",
                      marginBottom: "8px",
                    }}
                  >
                    Step {item.step}
                  </div>

                  <h3
                    style={{
                      fontFamily: "var(--font-serif)",
                      fontSize: "22px",
                      fontWeight: 600,
                      color: "#191B1E",
                      marginBottom: "12px",
                    }}
                  >
                    {item.title}
                  </h3>

                  <p
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "15px",
                      color: "#5E5A52",
                      lineHeight: 1.7,
                    }}
                  >
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════ STATS ════════════════════ */}
        <section style={{ background: "#191B1E", padding: "64px 48px" }}>
          <div
            className="stats-grid"
            style={{
              maxWidth: "1000px",
              margin: "0 auto",
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "40px",
              textAlign: "center",
            }}
          >
            {[
              { value: "5,000+", label: "Apps via Zapier" },
              { value: "99.9%", label: "Integration Uptime" },
              { value: "< 2 min", label: "Average Setup Time" },
            ].map((stat) => (
              <div key={stat.label}>
                <div
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: "42px",
                    fontWeight: 700,
                    color: "#B8944F",
                    marginBottom: "8px",
                  }}
                >
                  {stat.value}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "14px",
                    color: "rgba(255,255,255,0.5)",
                    letterSpacing: "1px",
                    textTransform: "uppercase",
                  }}
                >
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ════════════════════ CTA ════════════════════ */}
        <section
          style={{
            background: "linear-gradient(135deg, #191B1E 0%, #2A2D32 100%)",
            padding: "100px 48px",
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "500px",
              height: "500px",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(184,148,79,0.08) 0%, transparent 70%)",
              pointerEvents: "none",
            }}
          />

          <div style={{ position: "relative", zIndex: 1, maxWidth: "600px", margin: "0 auto" }}>
            <h2
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "44px",
                fontWeight: 700,
                color: "#FFFFFF",
                marginBottom: "20px",
                lineHeight: 1.2,
              }}
            >
              Ready to{" "}
              <span style={{ color: "#B8944F" }}>Connect</span>?
            </h2>
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "18px",
                color: "rgba(255,255,255,0.6)",
                marginBottom: "40px",
                lineHeight: 1.7,
              }}
            >
              Start automating your event workflows today. Connect your tools and let Fancy RSVP handle the rest.
            </p>
            <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
              <Link
                href="/register"
                className="btn-gold"
                style={{
                  padding: "16px 48px",
                  fontSize: "16px",
                  fontWeight: 700,
                  borderRadius: "8px",
                }}
              >
                Get Started Free
              </Link>
              <Link href="/features" className="btn-ghost-gold">
                Explore Features
              </Link>
            </div>
          </div>
        </section>
      </main>
      <FooterSection />

      <style jsx>{`
        @media (max-width: 1024px) {
          .integrations-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 768px) {
          .integrations-grid {
            grid-template-columns: 1fr !important;
            max-width: 480px !important;
            margin-left: auto !important;
            margin-right: auto !important;
          }
          .steps-grid {
            grid-template-columns: 1fr !important;
            gap: 36px !important;
          }
          .steps-line {
            display: none !important;
          }
          .stats-grid {
            grid-template-columns: 1fr !important;
            gap: 32px !important;
          }
        }
        @media (max-width: 640px) {
          section {
            padding-left: 20px !important;
            padding-right: 20px !important;
          }
        }
      `}</style>
    </>
  );
}
