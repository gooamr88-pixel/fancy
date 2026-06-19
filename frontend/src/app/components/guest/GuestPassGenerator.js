'use client';

import React, { useRef, useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';

/* ═══════════════════════════════════════════════════════════════
   FANCY RSVP — Premium Guest Pass / Ticket Generator
   Generates a visual event ticket with QR code
   ═══════════════════════════════════════════════════════════════ */

export default function GuestPassCard({
  guestName, eventTitle, eventDate, eventLocation,
  tableName, response = 'yes', qrData, themeColor = '#B8944F',
  isRTL = false, onDownload,
}) {
  const canvasRef = useRef(null);
  const [qrImageUrl, setQrImageUrl] = useState(null);

  // Generate QR code client-side
  useEffect(() => {
    if (!qrData) return;
    import('qrcode').then(QRCode => {
      QRCode.toDataURL(qrData, {
        width: 160, margin: 1,
        color: { dark: '#191B1E', light: '#FFFFFF' },
      }).then(url => setQrImageUrl(url)).catch(() => {});
    }).catch(() => {});
  }, [qrData]);

  const dateFormatted = eventDate
    ? new Date(eventDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : '';

  const timeFormatted = eventDate
    ? new Date(eventDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : '';

  const handleDownload = useCallback(async () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const w = 800;
    const h = 480;
    canvas.width = w;
    canvas.height = h;

    // Background
    ctx.fillStyle = '#191B1E';
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 24);
    ctx.fill();

    // Gold accent line
    ctx.fillStyle = themeColor;
    ctx.fillRect(0, 0, w, 5);

    // Left section
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 11px sans-serif';
    ctx.letterSpacing = '3px';
    ctx.fillText('GUEST PASS', 40, 48);

    ctx.fillStyle = themeColor;
    ctx.font = '700 28px serif';
    ctx.fillText(eventTitle || '', 40, 90);

    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '400 14px sans-serif';
    ctx.fillText(dateFormatted, 40, 125);
    ctx.fillText(timeFormatted, 40, 148);
    if (eventLocation) ctx.fillText(eventLocation, 40, 175);

    // Divider
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(40, 210);
    ctx.lineTo(w - 220, 210);
    ctx.stroke();
    ctx.setLineDash([]);

    // Guest info
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '700 10px sans-serif';
    ctx.fillText('GUEST', 40, 245);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '600 22px serif';
    ctx.fillText(guestName || '', 40, 275);

    if (tableName) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '700 10px sans-serif';
      ctx.fillText('TABLE', 40, 315);

      ctx.fillStyle = themeColor;
      ctx.font = '700 20px sans-serif';
      ctx.fillText(tableName, 40, 345);
    }

    // Status badge
    const statusText = response === 'yes' ? 'CONFIRMED' : response === 'maybe' ? 'TENTATIVE' : 'REGISTERED';
    ctx.fillStyle = themeColor;
    ctx.font = '700 10px sans-serif';
    const statusWidth = ctx.measureText(statusText).width + 24;
    ctx.beginPath();
    ctx.roundRect(40, 375, statusWidth, 28, 6);
    ctx.fill();
    ctx.fillStyle = '#191B1E';
    ctx.fillText(statusText, 52, 394);

    // Fancy branding
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = '400 10px sans-serif';
    ctx.fillText('Powered by Fancy RSVP', 40, h - 24);

    // QR Section (right side)
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(w - 200, 30);
    ctx.lineTo(w - 200, h - 30);
    ctx.stroke();

    if (qrImageUrl) {
      const qrImg = new Image();
      qrImg.crossOrigin = 'anonymous';
      qrImg.onload = () => {
        ctx.drawImage(qrImg, w - 180, (h - 160) / 2, 160, 160);

        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '500 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Scan to check in', w - 100, (h + 160) / 2 + 24);
        ctx.textAlign = 'start';

        downloadCanvas(canvas, guestName);
      };
      qrImg.src = qrImageUrl;
    } else {
      // No QR — download without it
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.font = '500 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('QR code will be', w - 100, h / 2 - 10);
      ctx.fillText('emailed separately', w - 100, h / 2 + 10);
      ctx.textAlign = 'start';
      downloadCanvas(canvas, guestName);
    }

    if (onDownload) onDownload();
  }, [eventTitle, dateFormatted, timeFormatted, eventLocation, guestName, tableName, response, themeColor, qrImageUrl, onDownload]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.3 }}
      style={{
        background: '#191B1E', borderRadius: '20px', overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)', maxWidth: '440px',
        width: '100%', margin: '0 auto',
      }}
    >
      {/* Gold accent */}
      <div style={{ height: '4px', background: `linear-gradient(90deg, ${themeColor}, #D7BE80, ${themeColor})` }} />

      <div style={{ padding: '28px 28px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <span style={{
              fontSize: '10px', textTransform: 'uppercase', letterSpacing: '3px',
              color: 'rgba(255,255,255,0.4)', fontWeight: 700, fontFamily: 'var(--font-sans)',
            }}>
              {isRTL ? 'بطاقة الضيف' : 'Guest Pass'}
            </span>
            <h3 style={{
              fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 600,
              color: themeColor, marginTop: '4px', lineHeight: 1.2,
            }}>
              {eventTitle}
            </h3>
          </div>
          <div style={{
            padding: '5px 12px', borderRadius: '6px',
            background: response === 'yes' ? 'rgba(16,185,129,0.15)' : response === 'maybe' ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.08)',
            color: response === 'yes' ? '#10b981' : response === 'maybe' ? '#6366f1' : '#77736A',
            fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px',
          }}>
            {response === 'yes' ? (isRTL ? 'مؤكد' : 'Confirmed') : response === 'maybe' ? (isRTL ? 'مبدئي' : 'Tentative') : (isRTL ? 'مسجل' : 'Registered')}
          </div>
        </div>

        {/* Event details */}
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          <div>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 700, display: 'block', marginBottom: '2px' }}>
              {isRTL ? 'التاريخ' : 'Date'}
            </span>
            <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>{dateFormatted}</span>
          </div>
          <div>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 700, display: 'block', marginBottom: '2px' }}>
              {isRTL ? 'الوقت' : 'Time'}
            </span>
            <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>{timeFormatted}</span>
          </div>
        </div>

        {/* Dashed divider */}
        <div style={{ borderTop: '1px dashed rgba(255,255,255,0.1)', margin: '0 -28px', padding: '0 28px' }} />

        {/* Guest info row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
              {isRTL ? 'الضيف' : 'Guest'}
            </span>
            <span style={{
              fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 600, color: '#FFFFFF',
            }}>
              {guestName}
            </span>
          </div>
          {tableName && (
            <div style={{ textAlign: isRTL ? 'left' : 'right' }}>
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                {isRTL ? 'الطاولة' : 'Table'}
              </span>
              <span style={{ fontSize: '18px', fontWeight: 800, color: themeColor, fontFamily: 'var(--font-sans)' }}>
                {tableName}
              </span>
            </div>
          )}
        </div>

        {/* QR Code area */}
        {qrImageUrl && (
          <div style={{ textAlign: 'center', padding: '16px 0 8px' }}>
            <div style={{
              display: 'inline-block', padding: '12px', background: '#FFFFFF',
              borderRadius: '12px',
            }}>
              <img src={qrImageUrl} alt="Check-in QR" style={{ width: '120px', height: '120px', display: 'block' }} />
            </div>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '8px' }}>
              {isRTL ? 'امسح للتسجيل عند الوصول' : 'Scan to check in at the venue'}
            </p>
          </div>
        )}

        {/* Download button */}
        <button
          onClick={handleDownload}
          style={{
            width: '100%', padding: '12px', borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)',
            color: 'rgba(255,255,255,0.7)', fontSize: '13px', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'var(--font-sans)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#FFFFFF'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
        >
          📥 {isRTL ? 'تحميل بطاقة الدخول' : 'Download Guest Pass'}
        </button>

        {/* Fancy branding */}
        <p style={{
          textAlign: 'center', fontSize: '10px', color: 'rgba(255,255,255,0.2)',
          fontFamily: 'var(--font-sans)', letterSpacing: '1px',
        }}>
          Powered by Fancy RSVP
        </p>
      </div>
    </motion.div>
  );
}

function downloadCanvas(canvas, guestName) {
  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = `guest-pass-${(guestName || 'ticket').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}.png`;
  a.click();
}
