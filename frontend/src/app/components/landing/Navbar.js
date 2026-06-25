"use client";

import React, { useState, useEffect } from "react";
import LogoutModal from '../LogoutModal';
import Link from "next/link";
import { useAuth } from "../../hooks/useAuth";

/* ═══════════════════════════════════════════════════════════
   Navbar — Fancy RSVP (Page 09 Brand Guide)
   
   Layout from mockup:
   ┌──────────────────────────────────────────────────────────┐
   │  [Logo: Envelope + "Fancy RSVP"]   Features  Pricing    │
   │                                    About  Log In  [Get]  │
   └──────────────────────────────────────────────────────────┘
   
   - White background, very subtle bottom border
   - Logo on left: envelope icon + "Fancy" in script + "RSVP" in serif
   - Nav links centered-right: Home, Features, Templates, Pricing, About, Contact, Log In
   - CTA button "Get Started" in Champagne Gold with rounded corners
   ═══════════════════════════════════════════════════════════ */

/* Primary navigation links — shared by desktop nav + mobile menu.
   "Home" links back to the landing page; the rest are the key
   marketing pages that live under /src/app. */
const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Features", href: "/features" },
  { label: "Templates", href: "/templates" },
  { label: "Pricing", href: "/pricing" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isLoggedIn, loading, logout } = useAuth();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  return (
    <>
      <header
        id="main-navbar"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          background: scrolled ? "rgba(255, 255, 255, 0.97)" : "#FFFFFF",
          backdropFilter: scrolled ? "blur(12px)" : "none",
          borderBottom: scrolled ? "1px solid #E8E2D6" : "1px solid transparent",
          transition: "all 0.35s ease",
          boxShadow: scrolled ? "0 1px 20px rgba(0,0,0,0.04)" : "none",
        }}
      >
        <div
          style={{
            maxWidth: "1280px",
            margin: "0 auto",
            padding: "0 48px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: "78px",
          }}
        >
          {/* ─── Logo ─── */}
          <Link
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              textDecoration: "none",
              cursor: "pointer",
            }}
            id="navbar-logo"
          >
            {/* Envelope Icon */}
            <div
              style={{
                width: "42px",
                height: "42px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="38"
                height="32"
                viewBox="0 0 38 32"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Envelope body */}
                <rect
                  x="2"
                  y="8"
                  width="34"
                  height="22"
                  rx="2"
                  stroke="#B8944F"
                  strokeWidth="1.5"
                  fill="none"
                />
                {/* Envelope flap */}
                <path
                  d="M2 10L19 22L36 10"
                  stroke="#B8944F"
                  strokeWidth="1.5"
                  fill="none"
                  strokeLinejoin="round"
                />
                {/* Flap top triangle */}
                <path
                  d="M4 8L19 0L34 8"
                  stroke="#B8944F"
                  strokeWidth="1.2"
                  fill="none"
                  strokeLinejoin="round"
                />
                {/* RSVP text inside */}
                <text
                  x="19"
                  y="21"
                  textAnchor="middle"
                  fill="#B8944F"
                  fontSize="6.5"
                  fontFamily="serif"
                  fontWeight="600"
                  letterSpacing="1"
                >
                  RSVP
                </text>
                {/* Small decorative diamond on flap */}
                <path
                  d="M19 3L20.5 5L19 7L17.5 5Z"
                  fill="#D7BE80"
                  opacity="0.7"
                />
              </svg>
            </div>

            {/* Brand Name */}
            <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
              <span
                style={{
                  fontFamily: "var(--font-script)",
                  fontSize: "28px",
                  fontWeight: 400,
                  color: "#B8944F",
                  lineHeight: 1,
                  letterSpacing: "-0.5px",
                }}
              >
                Fancy
              </span>
              <span
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: "22px",
                  fontWeight: 600,
                  color: "#191B1E",
                  letterSpacing: "3px",
                  textTransform: "uppercase",
                  lineHeight: 1,
                }}
              >
                RSVP
              </span>
            </div>
          </Link>

          {/* ─── Desktop Navigation ─── */}
          <nav
            style={{
              display: "flex",
              alignItems: "center",
              gap: "28px",
            }}
            className="desktop-nav"
          >
            {NAV_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "15px",
                  fontWeight: 400,
                  color: "#191B1E",
                  textDecoration: "none",
                  cursor: "pointer",
                  padding: "4px 0",
                  transition: "color 0.25s ease",
                  letterSpacing: "0.2px",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => (e.target.style.color = "#B8944F")}
                onMouseLeave={(e) => (e.target.style.color = "#191B1E")}
                id={`nav-link-${item.href === "/" ? "home" : item.href.slice(1)}`}
              >
                {item.label}
              </Link>
            ))}

            {!loading && !isLoggedIn && (
              <Link
                href="/login"
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "15px",
                  fontWeight: 400,
                  color: "#191B1E",
                  textDecoration: "none",
                  cursor: "pointer",
                  transition: "color 0.25s ease",
                }}
                onMouseEnter={(e) => (e.target.style.color = "#B8944F")}
                onMouseLeave={(e) => (e.target.style.color = "#191B1E")}
                id="nav-link-login"
              >
                Log In
              </Link>
            )}
            {!loading && isLoggedIn && (
              <button
                onClick={() => setShowLogoutModal(true)}
                style={{
                  background: "none",
                  border: "none",
                  fontFamily: "var(--font-sans)",
                  fontSize: "15px",
                  fontWeight: 400,
                  color: "#191B1E",
                  textDecoration: "none",
                  cursor: "pointer",
                  transition: "color 0.25s ease",
                }}
                onMouseEnter={(e) => (e.target.style.color = "#B8944F")}
                onMouseLeave={(e) => (e.target.style.color = "#191B1E")}
                id="nav-link-logout"
              >
                Log Out
              </button>
            )}

            {!loading && !isLoggedIn && (
              <Link
                href="/register"
                className="btn-gold"
                style={{
                  padding: "11px 28px",
                  fontSize: "14px",
                  fontWeight: 700,
                  borderRadius: "6px",
                  letterSpacing: "0.3px",
                }}
                id="nav-cta-get-started"
              >
                Get Started
              </Link>
            )}
            {!loading && isLoggedIn && (
              <Link
                href="/dashboard"
                className="btn-gold"
                style={{
                  padding: "11px 28px",
                  fontSize: "14px",
                  fontWeight: 700,
                  borderRadius: "6px",
                  letterSpacing: "0.3px",
                }}
                id="nav-cta-dashboard"
              >
                Dashboard
              </Link>
            )}
          </nav>

          {/* ─── Mobile Hamburger ─── */}
          <button
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{
              display: "none",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "8px",
              zIndex: 1001,
            }}
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
            id="mobile-menu-toggle"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#191B1E"
              strokeWidth="2"
              strokeLinecap="round"
            >
              {mobileMenuOpen ? (
                <>
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="6" y1="18" x2="18" y2="6" />
                </>
              ) : (
                <>
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>
        </div>
      </header>

      {/* ─── Mobile Menu Overlay ─── */}
      {mobileMenuOpen && (
        <div
          className="mobile-menu-overlay"
          style={{
            position: "fixed",
            top: "78px",
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(255,255,255,0.98)",
            zIndex: 999,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            paddingTop: "48px",
            gap: "28px",
            animation: "fadeIn 0.25s ease",
          }}
        >
          {NAV_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => { setMobileMenuOpen(false); document.body.style.overflow = ''; }}
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "24px",
                fontWeight: 500,
                color: "#191B1E",
                textDecoration: "none",
                cursor: "pointer",
                letterSpacing: "1px",
              }}
            >
              {item.label}
            </Link>
          ))}
          {!loading && !isLoggedIn && (
            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "16px",
                fontWeight: 400,
                color: "#77736A",
                textDecoration: "none",
              }}
            >
              Log In
            </Link>
          )}
          {!loading && isLoggedIn && (
            <button
              onClick={() => { setMobileMenuOpen(false); setShowLogoutModal(true); }}
              style={{
                background: "none",
                border: "none",
                fontFamily: "var(--font-sans)",
                fontSize: "16px",
                fontWeight: 400,
                color: "#77736A",
                cursor: "pointer",
              }}
            >
              Log Out
            </button>
          )}
          {!loading && !isLoggedIn && (
            <Link
              href="/register"
              className="btn-gold"
              style={{ padding: "14px 48px", fontSize: "15px" }}
              onClick={() => setMobileMenuOpen(false)}
            >
              Get Started
            </Link>
          )}
          {!loading && isLoggedIn && (
            <Link
              href="/dashboard"
              className="btn-gold"
              style={{ padding: "14px 48px", fontSize: "15px" }}
              onClick={() => setMobileMenuOpen(false)}
            >
              Dashboard
            </Link>
          )}
        </div>
      )}

      {/* ─── Spacer for fixed header ─── */}
      <div style={{ height: "78px" }} />

      <style jsx>{`
        @media (max-width: 768px) {
          .desktop-nav {
            display: none !important;
          }
          .mobile-menu-btn {
            display: block !important;
          }
        }
      `}</style>
      <LogoutModal isOpen={showLogoutModal} onClose={() => setShowLogoutModal(false)} onConfirm={logout} />
    </>
  );
}
