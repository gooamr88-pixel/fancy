'use client';

import React, { useMemo } from 'react';
import Icon from '../icons/Icon';

/* ═══════════════════════════════════════════════════════════════
   BRAND TOKENS
   ═══════════════════════════════════════════════════════════════ */
const COLORS = {
  gold: '#B8944F',
  charcoal: '#191B1E',
  ivory: '#F8F4EC',
  champagne: '#D7BE80',
  stone: '#77736A',
  white: '#FFFFFF',
};

/* ───────────────────────────────────────────────
   Donut Chart (SVG)
   ─────────────────────────────────────────────── */
const DonutChart = ({ percent = 79, size = 120, stroke = 10 }) => {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#E8E2D6"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={COLORS.gold}
        strokeWidth={stroke}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 1s ease' }}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        style={{
          fontSize: size * 0.22,
          fontFamily: 'var(--font-serif)',
          fill: COLORS.charcoal,
          fontWeight: 600,
        }}
      >
        {percent}%
      </text>
    </svg>
  );
};

/* ───────────────────────────────────────────────
   Trend Chart Placeholder (SVG)
   ─────────────────────────────────────────────── */
const TrendChart = () => {
  const points = '0,40 30,35 60,28 90,30 120,18 150,22 180,10 210,14 240,8';
  return (
    <svg
      width="100%"
      height="80"
      viewBox="0 0 260 50"
      preserveAspectRatio="none"
      style={{ display: 'block' }}
    >
      <defs>
        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={COLORS.gold} stopOpacity="0.18" />
          <stop offset="100%" stopColor={COLORS.gold} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,50 ${points} 260,50`}
        fill="url(#trendFill)"
      />
      <polyline
        points={points}
        fill="none"
        stroke={COLORS.gold}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

/* ───────────────────────────────────────────────
   Browser Chrome Frame
   ─────────────────────────────────────────────── */
const BrowserFrame = ({ children }) => (
  <div style={{
    borderRadius: 12,
    overflow: 'hidden',
    border: '1px solid #E0DAD0',
    boxShadow: '0 30px 80px rgba(25,27,30,0.12), 0 8px 24px rgba(184,148,79,0.08)',
    background: COLORS.white,
  }}>
    {/* Title bar */}
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      padding: '10px 16px',
      background: '#F3F0EA',
      borderBottom: '1px solid #E0DAD0',
    }}>
      <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#FF5F57', display: 'inline-block' }} />
      <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#FEBC2E', display: 'inline-block' }} />
      <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#28C840', display: 'inline-block' }} />
      <div style={{
        marginLeft: 12,
        flex: 1,
        height: 24,
        borderRadius: 6,
        background: COLORS.white,
        border: '1px solid #E0DAD0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        color: COLORS.stone,
        fontFamily: 'var(--font-sans)',
        letterSpacing: 0.3,
      }}>
        app.fancyrsvp.com/dashboard
      </div>
    </div>
    {children}
  </div>
);

/* ───────────────────────────────────────────────
   Sidebar Nav Item
   ─────────────────────────────────────────────── */
const SidebarItem = ({ label, active = false, icon }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 14px',
    borderRadius: 6,
    fontSize: 11.5,
    fontFamily: 'var(--font-sans)',
    fontWeight: active ? 700 : 400,
    color: active ? COLORS.gold : COLORS.stone,
    background: active ? 'rgba(184,148,79,0.08)' : 'transparent',
    cursor: 'pointer',
    letterSpacing: 0.2,
    whiteSpace: 'nowrap',
  }}>
    <span style={{ fontSize: 14, width: 16, display: 'inline-flex', justifyContent: 'center' }}>{icon}</span>
    <span className="sidebar-label">{label}</span>
  </div>
);

/* ───────────────────────────────────────────────
   Stat Card
   ─────────────────────────────────────────────── */
const StatCard = ({ label, value, sub }) => (
  <div style={{
    flex: 1,
    minWidth: 0,
    padding: '12px 14px',
    background: COLORS.white,
    border: '1px solid #E8E2D6',
    borderRadius: 8,
    textAlign: 'center',
  }}>
    <div style={{
      fontSize: 10,
      color: COLORS.stone,
      fontFamily: 'var(--font-sans)',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 4,
    }}>{label}</div>
    <div style={{
      fontSize: 20,
      fontFamily: 'var(--font-serif)',
      fontWeight: 700,
      color: COLORS.charcoal,
      lineHeight: 1.1,
    }}>{value}</div>
    {sub && (
      <div style={{
        fontSize: 9,
        color: COLORS.stone,
        fontFamily: 'var(--font-sans)',
        marginTop: 3,
      }}>{sub}</div>
    )}
  </div>
);

/* ───────────────────────────────────────────────
   Event Card Mini
   ─────────────────────────────────────────────── */
const EventCard = ({ title, date, guests, color }) => (
  <div style={{
    background: COLORS.white,
    border: '1px solid #E8E2D6',
    borderRadius: 8,
    padding: '12px 14px',
    borderLeft: `3px solid ${color}`,
    flex: 1,
    minWidth: 0,
  }}>
    <div style={{
      fontSize: 11.5,
      fontWeight: 700,
      fontFamily: 'var(--font-sans)',
      color: COLORS.charcoal,
      marginBottom: 4,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }}>{title}</div>
    <div style={{ fontSize: 10, color: COLORS.stone, fontFamily: 'var(--font-sans)' }}>{date}</div>
    <div style={{
      fontSize: 10,
      color: COLORS.gold,
      fontFamily: 'var(--font-sans)',
      fontWeight: 600,
      marginTop: 4,
    }}>{guests} guests</div>
  </div>
);

/* ───────────────────────────────────────────────
   Activity Item
   ─────────────────────────────────────────────── */
const ActivityItem = ({ text, time }) => (
  <div style={{
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    padding: '6px 0',
    borderBottom: '1px solid #F0ECE4',
  }}>
    <div style={{
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: COLORS.gold,
      marginTop: 5,
      flexShrink: 0,
    }} />
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 10.5, color: COLORS.charcoal, fontFamily: 'var(--font-sans)', lineHeight: 1.4 }}>{text}</div>
      <div style={{ fontSize: 9, color: COLORS.stone, fontFamily: 'var(--font-sans)', marginTop: 1 }}>{time}</div>
    </div>
  </div>
);

/* ───────────────────────────────────────────────
   Feature Callout Card
   ─────────────────────────────────────────────── */
const FeatureCallout = ({ icon, title, desc }) => (
  <div style={{
    flex: 1,
    minWidth: 220,
    textAlign: 'center',
    padding: '28px 20px',
  }}>
    <div style={{
      width: 52,
      height: 52,
      borderRadius: '50%',
      background: 'rgba(184,148,79,0.07)',
      border: '1px solid rgba(184,148,79,0.15)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: '0 auto 16px',
      fontSize: 22,
    }}>{icon}</div>
    <div style={{
      fontSize: 16,
      fontFamily: 'var(--font-serif)',
      fontWeight: 600,
      color: COLORS.charcoal,
      marginBottom: 8,
    }}>{title}</div>
    <div style={{
      fontSize: 13.5,
      fontFamily: 'var(--font-sans)',
      color: COLORS.stone,
      lineHeight: 1.6,
      fontWeight: 300,
    }}>{desc}</div>
  </div>
);

/* ───────────────────────────────────────────────
   Seating Chart SVG
   ─────────────────────────────────────────────── */
const SeatingChart = () => {
  const tables = useMemo(() => [
    { type: 'round', x: 100, y: 90, r: 34, label: 'Table 1', seats: 8 },
    { type: 'round', x: 220, y: 80, r: 30, label: 'Table 2', seats: 6 },
    { type: 'round', x: 340, y: 100, r: 34, label: 'Table 3', seats: 8 },
    { type: 'rect', x: 70, y: 210, w: 90, h: 40, label: 'Table 4', seats: 10 },
    { type: 'round', x: 260, y: 230, r: 28, label: 'Table 5', seats: 6 },
    { type: 'rect', x: 340, y: 215, w: 80, h: 36, label: 'Table 6', seats: 8 },
    { type: 'round', x: 150, y: 310, r: 32, label: 'VIP', seats: 10 },
    { type: 'rect', x: 270, y: 300, w: 100, h: 36, label: 'Head Table', seats: 12 },
  ], []);

  return (
    <svg width="100%" height="100%" viewBox="0 0 460 380" preserveAspectRatio="xMidYMid meet">
      {/* Floor grid */}
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#F0ECE4" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="460" height="380" fill="#FDFBF7" rx="4" />
      <rect width="460" height="380" fill="url(#grid)" rx="4" />

      {/* Stage area */}
      <rect x="160" y="14" width="140" height="28" rx="4" fill="rgba(184,148,79,0.10)" stroke={COLORS.champagne} strokeWidth="1" />
      <text x="230" y="32" textAnchor="middle" style={{ fontSize: 10, fill: COLORS.stone, fontFamily: 'var(--font-sans)' }}>STAGE</text>

      {tables.map((t, i) => (
        <g key={i}>
          {t.type === 'round' ? (
            <>
              <circle cx={t.x} cy={t.y} r={t.r} fill={COLORS.white} stroke={COLORS.champagne} strokeWidth="1.5" />
              {/* Seat dots */}
              {Array.from({ length: t.seats }).map((_, si) => {
                const angle = (si / t.seats) * 2 * Math.PI - Math.PI / 2;
                const sx = t.x + (t.r + 10) * Math.cos(angle);
                const sy = t.y + (t.r + 10) * Math.sin(angle);
                return <circle key={si} cx={sx} cy={sy} r={4} fill={si < t.seats * 0.7 ? COLORS.gold : '#E0DAD0'} opacity={si < t.seats * 0.7 ? 0.85 : 0.5} />;
              })}
            </>
          ) : (
            <>
              <rect x={t.x} y={t.y} width={t.w} height={t.h} rx={4} fill={COLORS.white} stroke={COLORS.champagne} strokeWidth="1.5" />
              {/* Seat dots top */}
              {Array.from({ length: Math.ceil(t.seats / 2) }).map((_, si) => {
                const sx = t.x + 10 + si * ((t.w - 20) / (Math.ceil(t.seats / 2) - 1 || 1));
                return <circle key={`t${si}`} cx={sx} cy={t.y - 8} r={4} fill={si < Math.ceil(t.seats * 0.7 / 2) ? COLORS.gold : '#E0DAD0'} opacity={si < Math.ceil(t.seats * 0.7 / 2) ? 0.85 : 0.5} />;
              })}
              {/* Seat dots bottom */}
              {Array.from({ length: Math.floor(t.seats / 2) }).map((_, si) => {
                const sx = t.x + 10 + si * ((t.w - 20) / (Math.floor(t.seats / 2) - 1 || 1));
                return <circle key={`b${si}`} cx={sx} cy={t.y + t.h + 8} r={4} fill={COLORS.gold} opacity={0.85} />;
              })}
            </>
          )}
          <text
            x={t.type === 'round' ? t.x : t.x + t.w / 2}
            y={t.type === 'round' ? t.y + 1 : t.y + t.h / 2 + 1}
            textAnchor="middle"
            dominantBaseline="central"
            style={{ fontSize: 9, fill: COLORS.charcoal, fontFamily: 'var(--font-sans)', fontWeight: 600 }}
          >
            {t.label}
          </text>
          <text
            x={t.type === 'round' ? t.x : t.x + t.w / 2}
            y={t.type === 'round' ? t.y + 12 : t.y + t.h / 2 + 12}
            textAnchor="middle"
            dominantBaseline="central"
            style={{ fontSize: 8, fill: COLORS.stone, fontFamily: 'var(--font-sans)' }}
          >
            {t.seats} seats
          </text>
        </g>
      ))}
    </svg>
  );
};

/* ───────────────────────────────────────────────
   Guest Panel (side panel in seating mockup)
   ─────────────────────────────────────────────── */
const GuestPanelItem = ({ name, assigned }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '7px 0',
    borderBottom: '1px solid #F0ECE4',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: 24,
        height: 24,
        borderRadius: '50%',
        background: assigned ? 'rgba(184,148,79,0.12)' : '#F0ECE4',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 10,
        color: assigned ? COLORS.gold : COLORS.stone,
        fontFamily: 'var(--font-sans)',
        fontWeight: 600,
      }}>{name.charAt(0)}</div>
      <span style={{
        fontSize: 11,
        fontFamily: 'var(--font-sans)',
        color: COLORS.charcoal,
      }}>{name}</span>
    </div>
    {!assigned && (
      <span style={{
        fontSize: 9,
        fontFamily: 'var(--font-sans)',
        color: COLORS.gold,
        background: 'rgba(184,148,79,0.08)',
        padding: '2px 8px',
        borderRadius: 4,
        fontWeight: 600,
      }}>Unassigned</span>
    )}
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
const DashboardPreviewSection = () => {
  return (
    <>
      {/* ══════════════════════════════════════════
          PART 1 — ORGANIZER DASHBOARD PREVIEW
          ══════════════════════════════════════════ */}
      <section style={{
        background: COLORS.ivory,
        padding: '100px 24px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Subtle decorative dots */}
        <div style={{
          position: 'absolute',
          top: 40,
          right: 60,
          width: 120,
          height: 120,
          background: `radial-gradient(circle, ${COLORS.champagne}15 1px, transparent 1px)`,
          backgroundSize: '16px 16px',
          opacity: 0.5,
        }} />

        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{
              fontSize: 12,
              fontFamily: 'var(--font-sans)',
              fontWeight: 700,
              letterSpacing: 3,
              textTransform: 'uppercase',
              color: COLORS.gold,
              marginBottom: 14,
            }}>
              Your Command Center
            </div>
            <h2 style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 36,
              fontWeight: 400,
              color: COLORS.charcoal,
              lineHeight: 1.25,
              maxWidth: 600,
              margin: '0 auto',
            }}>
              Manage everything from one elegant dashboard.
            </h2>
            <div style={{
              width: 48,
              height: 2,
              background: COLORS.gold,
              margin: '20px auto 0',
              borderRadius: 1,
            }} />
          </div>

          {/* Browser Mockup */}
          <BrowserFrame>
            <div className="dashboard-body" style={{
              display: 'flex',
              minHeight: 480,
            }}>
              {/* Sidebar */}
              <div className="dashboard-sidebar" style={{
                width: 190,
                background: COLORS.ivory,
                borderRight: '1px solid #E0DAD0',
                padding: '20px 10px',
                display: 'flex',
                flexDirection: 'column',
                flexShrink: 0,
              }}>
                {/* Logo */}
                <div style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: 18,
                  fontWeight: 700,
                  color: COLORS.charcoal,
                  padding: '0 14px 18px',
                  borderBottom: '1px solid #E0DAD0',
                  marginBottom: 14,
                  letterSpacing: 0.5,
                }}>
                  <span style={{ color: COLORS.gold, fontFamily: 'var(--font-script)', fontWeight: 400 }}>Fancy</span> RSVP
                </div>
                <SidebarItem icon="◫" label="Dashboard" active />
                <SidebarItem icon="◉" label="Events" />
                <SidebarItem icon="✉" label="RSVPs" />
                <SidebarItem icon="♟" label="Guests" />
                <SidebarItem icon="⊞" label="Seating" />
                <SidebarItem icon="✦" label="Messages" />
                <SidebarItem icon="⚙" label="Settings" />
                <div style={{ flex: 1 }} />
                <SidebarItem icon="⎋" label="Log Out" />
              </div>

              {/* Main Content */}
              <div style={{
                flex: 1,
                padding: '22px 26px',
                background: '#FDFBF7',
                overflowX: 'hidden',
                minWidth: 0,
              }}>
                {/* Page Title */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 20,
                }}>
                  <div>
                    <div style={{
                      fontSize: 18,
                      fontFamily: 'var(--font-serif)',
                      fontWeight: 600,
                      color: COLORS.charcoal,
                    }}>Dashboard</div>
                    <div style={{
                      fontSize: 11,
                      fontFamily: 'var(--font-sans)',
                      color: COLORS.stone,
                      marginTop: 2,
                    }}>Welcome back, Sarah ✦</div>
                  </div>
                  <div style={{
                    padding: '6px 16px',
                    fontSize: 11,
                    fontFamily: 'var(--font-sans)',
                    fontWeight: 600,
                    background: COLORS.gold,
                    color: COLORS.white,
                    borderRadius: 6,
                    letterSpacing: 0.3,
                  }}>+ New Event</div>
                </div>

                {/* Stats Row */}
                <div className="stats-row" style={{
                  display: 'flex',
                  gap: 10,
                  marginBottom: 20,
                  flexWrap: 'wrap',
                }}>
                  <StatCard label="Total Events" value="3" />
                  <StatCard label="Total Guests" value="250" />
                  <StatCard label="RSVP Rate" value="79%" sub="198 accepted · 32 declined · 20 pending" />
                  <StatCard label="Checked In" value="128" />
                  <StatCard label="Not Arrived" value="70" />
                </div>

                {/* Charts Row */}
                <div className="charts-row" style={{
                  display: 'flex',
                  gap: 16,
                  marginBottom: 20,
                }}>
                  {/* Donut */}
                  <div style={{
                    flex: '0 0 auto',
                    background: COLORS.white,
                    border: '1px solid #E8E2D6',
                    borderRadius: 8,
                    padding: 18,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                  }}>
                    <div style={{
                      fontSize: 10,
                      fontFamily: 'var(--font-sans)',
                      color: COLORS.stone,
                      textTransform: 'uppercase',
                      letterSpacing: 0.8,
                      marginBottom: 10,
                    }}>RSVP Progress</div>
                    <DonutChart percent={79} size={110} stroke={10} />
                    <div style={{
                      display: 'flex',
                      gap: 12,
                      marginTop: 12,
                      fontSize: 9,
                      fontFamily: 'var(--font-sans)',
                      color: COLORS.stone,
                    }}>
                      <span><span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: COLORS.gold, marginRight: 4 }} />Accepted</span>
                      <span><span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#E8E2D6', marginRight: 4 }} />Remaining</span>
                    </div>
                  </div>

                  {/* Trend */}
                  <div style={{
                    flex: 1,
                    background: COLORS.white,
                    border: '1px solid #E8E2D6',
                    borderRadius: 8,
                    padding: 18,
                    minWidth: 0,
                  }}>
                    <div style={{
                      fontSize: 10,
                      fontFamily: 'var(--font-sans)',
                      color: COLORS.stone,
                      textTransform: 'uppercase',
                      letterSpacing: 0.8,
                      marginBottom: 10,
                    }}>RSVP Trend</div>
                    <TrendChart />
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 8,
                      fontFamily: 'var(--font-sans)',
                      color: '#C0BAB0',
                      marginTop: 4,
                      padding: '0 2px',
                    }}>
                      <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
                    </div>
                  </div>
                </div>

                {/* Upcoming Events & Activity */}
                <div className="bottom-row" style={{
                  display: 'flex',
                  gap: 16,
                }}>
                  {/* Events */}
                  <div style={{ flex: 1.5, minWidth: 0 }}>
                    <div style={{
                      fontSize: 11,
                      fontFamily: 'var(--font-sans)',
                      fontWeight: 700,
                      color: COLORS.charcoal,
                      marginBottom: 10,
                      textTransform: 'uppercase',
                      letterSpacing: 0.8,
                    }}>Upcoming Events</div>
                    <div className="events-list" style={{
                      display: 'flex',
                      gap: 10,
                    }}>
                      <EventCard title="Sarah & Adam's Wedding" date="Oct 14, 2026" guests={120} color={COLORS.gold} />
                      <EventCard title="Annual Gala Dinner" date="Nov 3, 2026" guests={80} color={COLORS.champagne} />
                      <EventCard title="Holiday Fundraiser" date="Dec 20, 2026" guests={50} color={COLORS.stone} />
                    </div>
                  </div>

                  {/* Activity */}
                  <div className="activity-panel" style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 11,
                      fontFamily: 'var(--font-sans)',
                      fontWeight: 700,
                      color: COLORS.charcoal,
                      marginBottom: 10,
                      textTransform: 'uppercase',
                      letterSpacing: 0.8,
                    }}>Recent Activity</div>
                    <div style={{
                      background: COLORS.white,
                      border: '1px solid #E8E2D6',
                      borderRadius: 8,
                      padding: '10px 14px',
                    }}>
                      <ActivityItem text="Emma Johnson accepted the invitation" time="2 min ago" />
                      <ActivityItem text="Michael Chen declined (conflict)" time="18 min ago" />
                      <ActivityItem text="Olivia Park submitted dietary info" time="1 hr ago" />
                      <ActivityItem text="Reminder sent to 12 guests" time="3 hr ago" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </BrowserFrame>

          {/* Feature Callouts */}
          <div className="callouts-row" style={{
            display: 'flex',
            gap: 16,
            marginTop: 56,
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}>
            <FeatureCallout
              icon="◎"
              title="Clear at a Glance"
              desc="Key metrics and charts provide real-time insight into every event detail."
            />
            <FeatureCallout
              icon="✦"
              title="Organized & Intuitive"
              desc="Easy navigation and smart filters keep everything orderly and accessible."
            />
            <FeatureCallout
              icon="✓"
              title="Instant Check-in"
              desc="Scan guest QR codes or lookup names to manage check-ins instantly."
            />
            <FeatureCallout
              icon="◈"
              title="Premium Usability"
              desc="A refined interface designed for seamless event planning from start to finish."
            />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          PART 2 — SEATING CHART & CHECK-IN
          ══════════════════════════════════════════ */}
      <section style={{
        background: COLORS.white,
        padding: '100px 24px',
        position: 'relative',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{
              fontSize: 12,
              fontFamily: 'var(--font-sans)',
              fontWeight: 700,
              letterSpacing: 3,
              textTransform: 'uppercase',
              color: COLORS.gold,
              marginBottom: 14,
            }}>
              Seamless Event Operations
            </div>
            <h2 style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 36,
              fontWeight: 400,
              color: COLORS.charcoal,
              lineHeight: 1.25,
              maxWidth: 640,
              margin: '0 auto',
            }}>
              Interactive seating charts and event check-in tools.
            </h2>
            <div style={{
              width: 48,
              height: 2,
              background: COLORS.gold,
              margin: '20px auto 0',
              borderRadius: 1,
            }} />
          </div>

          {/* Browser Mockup — Seating */}
          <BrowserFrame>
            <div className="seating-body" style={{
              display: 'flex',
              minHeight: 420,
            }}>
              {/* Chart Area */}
              <div style={{
                flex: 1,
                padding: 20,
                background: '#FDFBF7',
                minWidth: 0,
              }}>
                {/* Toolbar */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 14,
                }}>
                  <div style={{
                    fontSize: 14,
                    fontFamily: 'var(--font-serif)',
                    fontWeight: 600,
                    color: COLORS.charcoal,
                    flex: 1,
                  }}>Seating Chart — Sarah & Adam&apos;s Wedding</div>
                  <div style={{
                    padding: '4px 12px',
                    fontSize: 10,
                    fontFamily: 'var(--font-sans)',
                    fontWeight: 600,
                    border: `1px solid ${COLORS.champagne}`,
                    borderRadius: 5,
                    color: COLORS.gold,
                    cursor: 'pointer',
                  }}>+ Add Table</div>
                  <div style={{
                    padding: '4px 12px',
                    fontSize: 10,
                    fontFamily: 'var(--font-sans)',
                    fontWeight: 600,
                    background: COLORS.gold,
                    borderRadius: 5,
                    color: COLORS.white,
                    cursor: 'pointer',
                  }}>Save Layout</div>
                </div>
                <div style={{
                  border: '1px solid #E8E2D6',
                  borderRadius: 8,
                  overflow: 'hidden',
                  background: '#FDFBF7',
                }}>
                  <SeatingChart />
                </div>
                {/* Legend */}
                <div style={{
                  display: 'flex',
                  gap: 18,
                  marginTop: 10,
                  fontSize: 9,
                  fontFamily: 'var(--font-sans)',
                  color: COLORS.stone,
                  justifyContent: 'center',
                }}>
                  <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: COLORS.gold, marginRight: 5, opacity: 0.85 }} />Assigned</span>
                  <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#E0DAD0', marginRight: 5, opacity: 0.5 }} />Empty Seat</span>
                  <span><span style={{ display: 'inline-block', width: 8, height: 4, borderRadius: 2, background: COLORS.champagne, marginRight: 5 }} />Round Table</span>
                  <span><span style={{ display: 'inline-block', width: 10, height: 4, borderRadius: 1, background: COLORS.champagne, marginRight: 5 }} />Rectangular</span>
                </div>
              </div>

              {/* Guest Panel */}
              <div className="guest-panel" style={{
                width: 220,
                background: COLORS.white,
                borderLeft: '1px solid #E0DAD0',
                padding: '16px 14px',
                flexShrink: 0,
                overflowY: 'auto',
              }}>
                <div style={{
                  fontSize: 11,
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: 0.8,
                  color: COLORS.charcoal,
                  marginBottom: 6,
                }}>Guests</div>
                <div style={{
                  fontSize: 9,
                  fontFamily: 'var(--font-sans)',
                  color: COLORS.stone,
                  marginBottom: 14,
                }}>5 unassigned of 120</div>
                {/* Search */}
                <div style={{
                  width: '100%',
                  padding: '6px 10px',
                  fontSize: 10,
                  fontFamily: 'var(--font-sans)',
                  border: '1px solid #E0DAD0',
                  borderRadius: 5,
                  background: '#FDFBF7',
                  color: COLORS.stone,
                  marginBottom: 12,
                  boxSizing: 'border-box',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}><Icon name="search" size={10} strokeWidth={1.8} /> Search guests…</div>

                <GuestPanelItem name="Alexander Wright" assigned={false} />
                <GuestPanelItem name="Sophia Martinez" assigned={false} />
                <GuestPanelItem name="James Chen" assigned={false} />
                <GuestPanelItem name="Isabella Park" assigned={false} />
                <GuestPanelItem name="Daniel Lee" assigned={false} />

                <div style={{
                  fontSize: 10,
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 700,
                  color: COLORS.stone,
                  textTransform: 'uppercase',
                  letterSpacing: 0.8,
                  marginTop: 18,
                  marginBottom: 8,
                }}>Assigned</div>
                <GuestPanelItem name="Emma Johnson" assigned />
                <GuestPanelItem name="Michael Brown" assigned />
                <GuestPanelItem name="Olivia Taylor" assigned />
              </div>
            </div>
          </BrowserFrame>

          {/* Feature Callouts */}
          <div className="callouts-row" style={{
            display: 'flex',
            gap: 16,
            marginTop: 56,
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}>
            <FeatureCallout
              icon="⊚"
              title="Auto Seat Counts"
              desc="Seat totals update automatically as guests are assigned or removed."
            />
            <FeatureCallout
              icon="⊞"
              title="Drag-and-Drop Setup"
              desc="Effortlessly add, move, and resize tables on an interactive floor plan."
            />
            <FeatureCallout
              icon="◉"
              title="Live Check-In Status"
              desc="Scan QR codes or search guests to check in instantly at the door."
            />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          RESPONSIVE STYLES (styled-jsx)
          ══════════════════════════════════════════ */}
      <style jsx>{`
        /* ── Large tablets / small laptops ── */
        @media (max-width: 1024px) {
          .dashboard-body {
            flex-direction: column !important;
          }
          .dashboard-sidebar {
            width: 100% !important;
            flex-direction: row !important;
            overflow-x: auto !important;
            padding: 10px 14px !important;
            gap: 4px;
            border-right: none !important;
            border-bottom: 1px solid #E0DAD0 !important;
          }
          .charts-row {
            flex-direction: column !important;
          }
          .bottom-row {
            flex-direction: column !important;
          }
          .events-list {
            flex-direction: column !important;
          }
          .seating-body {
            flex-direction: column !important;
          }
          .guest-panel {
            width: 100% !important;
            border-left: none !important;
            border-top: 1px solid #E0DAD0 !important;
          }
        }

        /* ── Tablets ── */
        @media (max-width: 768px) {
          .stats-row {
            flex-wrap: wrap !important;
          }
          .stats-row > :global(div) {
            min-width: calc(50% - 8px) !important;
          }
          .callouts-row {
            flex-direction: column !important;
            align-items: center !important;
          }
          .activity-panel {
            margin-top: 8px;
          }
        }

        /* ── Mobile ── */
        @media (max-width: 560px) {
          .dashboard-sidebar {
            flex-wrap: nowrap !important;
          }
          .sidebar-label {
            display: none;
          }
          .stats-row > :global(div) {
            min-width: 100% !important;
          }
          section {
            padding-left: 12px !important;
            padding-right: 12px !important;
            padding-top: 64px !important;
            padding-bottom: 64px !important;
          }
          h2 {
            font-size: 28px !important;
          }
        }
      `}</style>
    </>
  );
};

export default DashboardPreviewSection;
