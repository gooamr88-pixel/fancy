/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Fancy RSVP — Premium transactional email templates.
 *
 * Every email the platform sends is built here from ONE shared, email-safe shell
 * so the brand identity stays consistent and rendering is reliable across Gmail,
 * Apple Mail and Outlook:
 *   • Table-based layout, fully inline critical CSS (a small <style> block adds
 *     responsive + hover as progressive enhancement only).
 *   • Brand palette: Gold #B8944F · Champagne #D7BE80 · Charcoal #191B1E · Ivory #F8F4EC.
 *   • Text wordmark header ("Fancy RSVP" in gold) — no image, never blocked.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Escapes HTML entities to prevent XSS / markup injection in email templates.
 */
const escapeHtml = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

// Shared bulletproof resolver (splits commas, repairs typos, first valid https origin).
const { getPublicBaseUrl } = require('./publicUrl');

/**
 * Builds a guest's personal event link. When a partyId is supplied it is appended as
 * the per-guest invitation token (`?party_id=...`), which unlocks private events and
 * pre-fills that party's RSVP form. Route is `/{slug}` (no `/e/` prefix).
 */
const buildGuestEventUrl = (slug, partyId) => {
  const base = `${getPublicBaseUrl()}/${slug || ''}`;
  return partyId ? `${base}?party_id=${encodeURIComponent(partyId)}` : base;
};

/**
 * Builds a guest's DIRECT RSVP-form link: `/{slug}/rsvp?g={partyId}` (INV-3).
 *
 * Used for SMS so a tap lands straight on the form — no landing-page detour and no
 * `/events/rsvp/{id}` resolver redirect (that resolver remains only as a fallback for
 * any links already in the wild). The form treats `g` as the per-guest unlock token,
 * so this opens private events too (see the public RSVP page's event fetch).
 */
const buildGuestRsvpUrl = (slug, partyId) => {
  const base = `${getPublicBaseUrl()}/${slug || ''}/rsvp`;
  return partyId ? `${base}?g=${encodeURIComponent(partyId)}` : base;
};

/* ═══ Brand tokens ═══ */
const BRAND = {
  gold: '#B8944F',
  goldDark: '#9A7B3F',
  champagne: '#D7BE80',
  charcoal: '#191B1E',
  ivory: '#F8F4EC',
  white: '#FFFFFF',
  border: '#E8E2D6',
  softBg: '#FAF8F3',
  ink: '#4A4742',     // body copy
  stone: '#77736A',   // labels
  muted: '#A09A91',   // footnotes
  success: '#3B9B6D',
  successBg: '#ECF6F0',
  successBorder: '#BFE3CF',
  danger: '#C45E5E',
  dangerBg: '#FBF0F0',
  dangerBorder: '#EBC9C9',
};

const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, Helvetica, sans-serif";
const SERIF = "Georgia, 'Times New Roman', serif";

/** Long, friendly event-date string, or null when no/invalid date. */
const formatEventDate = (d) => {
  if (!d) return null;
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
};

const money = (cents) => `$${((Number(cents) || 0) / 100).toFixed(2)} USD`;

/* ═══ Reusable, email-safe components ═══ */

const para = (html, opts = {}) =>
  `<p style="margin:0 0 ${opts.mb != null ? opts.mb : 16}px; font-family:${SANS}; font-size:${opts.size || 15}px; line-height:1.65; color:${opts.color || BRAND.ink};${opts.align ? ` text-align:${opts.align};` : ''}">${html}</p>`;

const greeting = (name) =>
  para(`Dear <strong style="color:${BRAND.charcoal};">${escapeHtml(name || 'there')}</strong>,`);

/** Centered pill button (bulletproof: bgcolor on the td for Outlook). */
const button = (href, label, opts = {}) => {
  const bg = opts.bg || BRAND.gold;
  const color = opts.color || BRAND.white;
  const border = opts.border || bg;
  return `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:6px auto 12px;">
    <tr><td align="center" bgcolor="${bg}" style="border-radius:10px; background-color:${bg};">
      <a class="fr-btn" href="${href}" target="_blank" rel="noopener" style="display:inline-block; font-family:${SANS}; font-size:14px; font-weight:bold; letter-spacing:0.4px; color:${color}; text-decoration:none; padding:14px 34px; border-radius:10px; border:1px solid ${border};">${label}</a>
    </td></tr>
  </table>`;
};

/** Two-column label/value card. rows: [label, valueHtml, valueColor?][] */
const dataTable = (rows) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.softBg}; border:1px solid ${BRAND.border}; border-radius:14px; margin:24px 0;">
  <tr><td style="padding:4px 22px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${rows.map(([label, value, color], i) => {
        const line = i < rows.length - 1 ? `border-bottom:1px solid ${BRAND.border};` : '';
        return `<tr>
          <td style="padding:13px 0; ${line} font-family:${SANS}; font-size:11px; font-weight:bold; letter-spacing:1.2px; text-transform:uppercase; color:${BRAND.stone}; vertical-align:middle;">${escapeHtml(label)}</td>
          <td style="padding:13px 0; ${line} font-family:${SANS}; font-size:15px; font-weight:600; color:${color || BRAND.charcoal}; text-align:right; vertical-align:middle;">${value}</td>
        </tr>`;
      }).join('')}
    </table>
  </td></tr>
</table>`;

/** Large, beautifully highlighted one-time code. */
const codeBox = (code) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:10px 0 18px;">
  <tr><td align="center" style="background-color:${BRAND.ivory}; border:1px dashed ${BRAND.gold}; border-radius:16px; padding:24px 16px;">
    <div style="font-family:${SANS}; font-size:10px; font-weight:bold; letter-spacing:2px; text-transform:uppercase; color:${BRAND.stone}; margin-bottom:10px;">Your Verification Code</div>
    <div class="fr-code" style="font-family:'Courier New', Courier, monospace; font-size:40px; font-weight:bold; letter-spacing:14px; color:${BRAND.charcoal}; text-indent:14px;">${escapeHtml(String(code))}</div>
  </td></tr>
</table>`;

/** Tinted callout box. tone: neutral | success | warn | danger */
const noticeBox = (html, tone = 'neutral') => {
  const map = {
    neutral: { bg: BRAND.softBg, br: BRAND.border, fg: BRAND.stone },
    success: { bg: BRAND.successBg, br: BRAND.successBorder, fg: BRAND.success },
    warn: { bg: '#FBF6EC', br: 'rgba(184,148,79,0.4)', fg: BRAND.goldDark },
    danger: { bg: BRAND.dangerBg, br: BRAND.dangerBorder, fg: BRAND.danger },
  };
  const c = map[tone] || map.neutral;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;">
    <tr><td style="background-color:${c.bg}; border:1px solid ${c.br}; border-radius:12px; padding:14px 18px; font-family:${SANS}; font-size:13px; line-height:1.6; color:${c.fg};">${html}</td></tr>
  </table>`;
};

/** A row of headline number cards for organizer reports. items: {label,value,color?}[] */
const statGrid = (items) => {
  const cells = (items || []).map((it) => `<td align="center" valign="top" style="padding:6px;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:${BRAND.softBg}; border:1px solid ${BRAND.border}; border-radius:12px;">
      <tr><td align="center" style="padding:16px 6px;">
        <div style="font-family:${SERIF}; font-size:26px; font-weight:bold; line-height:1; color:${it.color || BRAND.charcoal};">${it.value}</div>
        <div style="font-family:${SANS}; font-size:10px; font-weight:bold; letter-spacing:1px; text-transform:uppercase; color:${BRAND.stone}; margin-top:6px;">${escapeHtml(it.label)}</div>
      </td></tr>
    </table>
  </td>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;"><tr>${cells}</tr></table>`;
};

/* ═══ The shared shell every email is wrapped in ═══ */
const emailShell = ({ preheader = '', eyebrow = '', accent = BRAND.gold, heading = '', contentHtml = '', footerNote = '' }) => `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Fancy RSVP</title>
  <!--[if mso]><style>* { font-family: Arial, Helvetica, sans-serif !important; }</style><![endif]-->
  <style>
    body { margin:0 !important; padding:0 !important; width:100% !important; background-color:${BRAND.ivory}; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table { border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt; }
    img { border:0; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
    a { text-decoration:none; }
    .fr-btn:hover { opacity:0.92 !important; }
    @media only screen and (max-width:620px) {
      .fr-container { width:100% !important; }
      .fr-px { padding-left:24px !important; padding-right:24px !important; }
      .fr-h1 { font-size:23px !important; }
      .fr-code { font-size:31px !important; letter-spacing:9px !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:${BRAND.ivory};">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.ivory};">
    <tr>
      <td align="center" style="padding:32px 16px 44px;">
        <table role="presentation" class="fr-container" width="600" cellpadding="0" cellspacing="0" style="width:600px; max-width:600px;">
          <!-- Wordmark -->
          <tr>
            <td align="center" style="padding:6px 0 24px;">
              <div style="font-family:${SERIF}; color:${BRAND.gold}; line-height:1;">
                <span style="font-size:28px; font-style:italic; letter-spacing:0.5px;">Fancy</span>&nbsp;<span style="font-size:21px; font-weight:bold; letter-spacing:6px; text-transform:uppercase;">RSVP</span>
              </div>
              <div style="margin:13px auto 0; width:46px; height:2px; background-color:${BRAND.champagne}; line-height:2px; font-size:0;">&nbsp;</div>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background-color:${BRAND.white}; border:1px solid ${BRAND.border}; border-radius:18px; overflow:hidden;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="height:4px; background-color:${accent}; line-height:4px; font-size:0;">&nbsp;</td></tr>
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td class="fr-px" style="padding:40px 40px 6px;">
                    ${eyebrow ? `<p style="margin:0 0 10px; font-family:${SANS}; font-size:11px; font-weight:bold; letter-spacing:2.5px; text-transform:uppercase; color:${accent};">${escapeHtml(eyebrow)}</p>` : ''}
                    ${heading ? `<h1 class="fr-h1" style="margin:0; font-family:${SERIF}; font-size:27px; font-weight:normal; line-height:1.28; color:${BRAND.charcoal};">${heading}</h1>` : ''}
                  </td>
                </tr>
                <tr>
                  <td class="fr-px" style="padding:18px 40px 40px;">
                    ${contentHtml}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding:26px 24px 6px;">
              <p style="margin:0 0 6px; font-family:${SERIF}; font-size:16px; font-style:italic; color:${BRAND.gold};">Fancy RSVP</p>
              <p style="margin:0; font-family:${SANS}; font-size:11px; line-height:1.7; color:${BRAND.muted};">
                ${footerNote || 'Elegant RSVPs. Effortless planning.'}<br>
                This is an automated message — please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const responseMeta = (response) => {
  if (response === 'yes' || response === 'accepted') return { label: 'Attending', color: BRAND.success };
  if (response === 'maybe') return { label: 'Maybe', color: BRAND.goldDark };
  if (response === 'no' || response === 'declined') return { label: 'Declined', color: BRAND.danger };
  return { label: 'Pending', color: BRAND.stone };
};

/* ═══════════════════════════════════════════════════════════════════════════
   AUTHENTICATION & ACCOUNT
   ═══════════════════════════════════════════════════════════════════════════ */

/** Email-verification OTP sent on registration. */
const getEmailVerificationTemplate = (name, otp) => emailShell({
  preheader: 'Your Fancy RSVP verification code',
  eyebrow: 'Verify your email',
  heading: 'Welcome to Fancy RSVP',
  contentHtml: `
    ${greeting(name)}
    ${para('Thank you for creating your account. Enter the verification code below to confirm your email and activate your account.')}
    ${codeBox(otp)}
    ${noticeBox('⏳ This code expires in <strong>15 minutes</strong>.', 'warn')}
    ${para("If you didn't create a Fancy RSVP account, you can safely ignore this email.", { size: 13, color: BRAND.stone, mb: 0 })}
  `,
});

/** Password-reset OTP sent on forgot-password. */
const getPasswordResetTemplate = (name, otp) => emailShell({
  preheader: 'Your Fancy RSVP password reset code',
  eyebrow: 'Password recovery',
  heading: 'Reset your password',
  contentHtml: `
    ${greeting(name || 'Organizer')}
    ${para('We received a request to reset your password. Use the one-time code below to continue — it is valid for 15 minutes.')}
    ${codeBox(otp)}
    ${noticeBox('🔒 Never share this code with anyone. Our team will never ask you for it.', 'warn')}
    ${para("If you didn't request a password reset, your password is unchanged and you can safely ignore this email.", { size: 13, color: BRAND.stone, mb: 0 })}
  `,
});

/* ═══════════════════════════════════════════════════════════════════════════
   RSVP LIFECYCLE (guest-facing)
   ═══════════════════════════════════════════════════════════════════════════ */

/** Guest INVITATION with one-click Accept / Maybe / Decline (signed per-guest links). */
const getInvitationTemplate = (rsvp, event, links) => {
  const formattedDate = formatEventDate(event.event_date);
  const where = event.location_name || event.location_address || null;
  const rows = [['Event', escapeHtml(event.title)]];
  if (formattedDate) rows.push(['Date', escapeHtml(formattedDate)]);
  if (where) rows.push(['Where', escapeHtml(where)]);

  return emailShell({
    preheader: `You're invited to ${event.title}`,
    eyebrow: "You're invited",
    heading: escapeHtml(event.title),
    contentHtml: `
      ${greeting(rsvp.guest_name)}
      ${para("You're warmly invited to join us. Open your invitation below to see the full details and let us know if you'll be able to attend.")}
      ${dataTable(rows)}
      ${button(links.view, 'View Invitation')}
      ${para(`If the button doesn't work, paste this link into your browser:<br><a href="${links.view}" style="color:${BRAND.gold}; word-break:break-all;">${links.view}</a>`, { size: 12, color: BRAND.muted, align: 'center', mb: 0 })}
    `,
    footerNote: 'Sent via Fancy RSVP on behalf of the event organizer.',
  });
};

/** RSVP confirmation (response recorded). */
const getRSVPConfirmationTemplate = (rsvp, event) => {
  const formattedDate = formatEventDate(event.event_date);
  const r = responseMeta(rsvp.response);
  const partySize = rsvp.party_size || 1;
  const rows = [
    ['Response', `<span style="color:${r.color};">${r.label}</span>`, r.color],
    ['Party Size', `${partySize} ${partySize === 1 ? 'Guest' : 'Guests'}`],
  ];
  if (formattedDate) rows.push(['Date', escapeHtml(formattedDate)]);

  return emailShell({
    preheader: `Your RSVP for ${event.title} is confirmed`,
    eyebrow: 'RSVP confirmed',
    heading: escapeHtml(event.title),
    contentHtml: `
      ${greeting(rsvp.guest_name)}
      ${para('Your RSVP has been successfully recorded. Here are the details we have on file:')}
      ${dataTable(rows)}
      ${noticeBox('🎟️ Your table placement is being coordinated. You\'ll receive a separate email with your QR check-in pass once seating is finalized.', 'neutral')}
      ${para('We look forward to celebrating with you.', { mb: 0 })}
    `,
  });
};

/** Thank-you for a declined RSVP, with a one-click "change my RSVP" link. */
const getDeclineConfirmationTemplate = (rsvp, event) => {
  const formattedDate = formatEventDate(event.event_date);
  const eventPageUrl = buildGuestEventUrl(event.slug, rsvp.id);
  const rows = [['Response', '<span style="color:' + BRAND.danger + ';">Regretfully Declined</span>', BRAND.danger]];
  if (formattedDate) rows.push(['Date', escapeHtml(formattedDate)]);

  return emailShell({
    preheader: `Thank you for letting us know — ${event.title}`,
    eyebrow: 'Thank you for letting us know',
    heading: escapeHtml(event.title),
    contentHtml: `
      ${greeting(rsvp.guest_name)}
      ${para(`We're sorry you won't be able to join us${formattedDate ? ` on <strong>${escapeHtml(formattedDate)}</strong>` : ''}. We completely understand, and we truly appreciate you taking the time to let us know.`)}
      ${dataTable(rows)}
      ${para('If your plans change, we would love to have you. You can update your RSVP any time before the deadline:')}
      ${button(eventPageUrl, 'Change My RSVP')}
      ${para('Wishing you all the best — we hope to see you at a future celebration.', { size: 13, color: BRAND.stone, mb: 0 })}
    `,
  });
};

/** Email sent to a companion guest confirming they are attending with the primary guest. */
const getCompanionRSVPConfirmationTemplate = (companionName, mainGuestName, event, eventUrl) => {
  const formattedDate = formatEventDate(event.event_date);
  const where = event.location_name || event.location_address || null;
  const rows = [
    ['Main Guest', escapeHtml(mainGuestName)],
    ['Status', '<span style="color:' + BRAND.success + ';">Registered as Guest</span>', BRAND.success],
  ];
  if (formattedDate) rows.push(['Date', escapeHtml(formattedDate)]);
  if (where) rows.push(['Where', escapeHtml(where)]);

  return emailShell({
    preheader: `You're registered for ${event.title}`,
    eyebrow: 'Companion RSVP Confirmed',
    heading: escapeHtml(event.title),
    contentHtml: `
      ${greeting(companionName)}
      ${para(`<strong style="color:${BRAND.charcoal};">${escapeHtml(mainGuestName)}</strong> has confirmed their attendance and registered you as their guest for the event.`)}
      ${dataTable(rows)}
      ${para('We look forward to celebrating with you.', { mb: 16 })}
      ${eventUrl ? button(eventUrl, 'View Event Details') : ''}
    `,
  });
};

/** Entry pass: QR ticket + table assignment. */
const getQRTicketTemplate = (rsvp, event, tableName, qrImageUrl, zoneName) => {
  const partySize = rsvp.party_size || 1;
  const formattedDate = formatEventDate(event.event_date);
  const hasLocation = event.location_name || event.location_address;

  const dateHtml = formattedDate ? `
    <div style="font-family:${SANS}; font-size:13px; color:${BRAND.stone}; margin-top:12px;">
      📅 <strong>Date:</strong> ${escapeHtml(formattedDate)}
    </div>
  ` : '';

  const locationHtml = hasLocation ? `
    <div style="font-family:${SANS}; font-size:13px; color:${BRAND.stone}; margin-top:8px;">
      📍 <strong>Venue:</strong> ${escapeHtml(event.location_name || '')}
      ${event.location_address ? `<br/><span style="font-size:12px; color:${BRAND.stone}; opacity:0.85;">${escapeHtml(event.location_address)}</span>` : ''}
    </div>
  ` : '';

  return emailShell({
    preheader: `Your entry pass & table for ${event.title}`,
    eyebrow: 'Entry pass & seating',
    heading: escapeHtml(event.title),
    contentHtml: `
      ${greeting(rsvp.guest_name)}
      ${para('Your table assignment is finalized. Please present this pass at the entrance check-in desk.')}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
        <tr><td align="center" style="background-color:${BRAND.ivory}; border:1px solid ${BRAND.border}; border-radius:16px; padding:26px 20px;">
          <div style="font-family:${SANS}; font-size:10px; font-weight:bold; letter-spacing:2px; text-transform:uppercase; color:${BRAND.stone}; margin-bottom:8px;">Your Assigned Seating</div>
          ${zoneName ? `<div style="font-family:${SANS}; font-size:11px; font-weight:600; letter-spacing:1px; text-transform:uppercase; color:${BRAND.gold}; margin-bottom:4px;">Zone: ${escapeHtml(zoneName)}</div>` : ''}
          <div style="font-family:${SERIF}; font-size:34px; font-weight:bold; color:${BRAND.charcoal};">${escapeHtml(tableName)}</div>
          <div style="font-family:${SANS}; font-size:13px; color:${BRAND.stone}; margin-top:8px;">Party of ${partySize}</div>
          
          ${dateHtml}
          ${locationHtml}
          
          <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:22px auto 0;">
            <tr><td style="background-color:${BRAND.white}; border:1px solid ${BRAND.border}; border-radius:14px; padding:14px;">
              <img src="${qrImageUrl}" alt="Check-in QR code" width="200" height="200" style="display:block; width:200px; height:200px;" />
            </td></tr>
          </table>
        </td></tr>
      </table>
      ${para('Show this pass on your phone at the venue entrance — our team will scan the QR code to confirm your party and direct you to your table.', { size: 13, color: BRAND.stone, align: 'center', mb: 0 })}
    `,
  });
};

/* ═══════════════════════════════════════════════════════════════════════════
   ORGANIZER NOTIFICATIONS
   ═══════════════════════════════════════════════════════════════════════════ */

/** "Groom's/Bride's Side" for weddings, "Partner 1/2's Side" otherwise — null if unset/invalid. */
const sideLabel = (side, eventType) => {
  if (side !== 'partner1' && side !== 'partner2') return null;
  const isWedding = eventType === 'wedding';
  if (side === 'partner1') return isWedding ? "Groom's Side" : "Partner 1's Side";
  return isWedding ? "Bride's Side" : "Partner 2's Side";
};

/** Alerts the organizer that a guest just submitted an RSVP. */
const getNewRsvpOrganizerTemplate = ({ eventTitle, guestName, response, partySize, email, side, eventType }) => {
  const r = responseMeta(response);
  const verb = response === 'yes' || response === 'accepted'
    ? 'accepted'
    : (response === 'no' || response === 'declined') ? 'declined' : 'responded to';
  const size = partySize || 1;
  const rows = [
    ['Response', `<span style="color:${r.color};">${r.label}</span>`, r.color],
    ['Party Size', `${size} ${size === 1 ? 'Guest' : 'Guests'}`],
  ];
  if (email) rows.push(['Email', escapeHtml(email)]);
  const sLabel = sideLabel(side, eventType);
  if (sLabel) rows.push(['Side', escapeHtml(sLabel)]);

  return emailShell({
    preheader: `${guestName} ${verb} — ${eventTitle}`,
    eyebrow: 'New RSVP received',
    heading: escapeHtml(eventTitle),
    contentHtml: `
      ${para(`<strong style="color:${BRAND.charcoal};">${escapeHtml(guestName)}</strong> has ${verb} your invitation.`)}
      ${dataTable(rows)}
      ${button(`${getPublicBaseUrl()}/dashboard`, 'View in Dashboard')}
      ${para('Manage your guest list, seating and check-ins from your organizer dashboard.', { size: 13, color: BRAND.stone, align: 'center', mb: 0 })}
    `,
    footerNote: 'You receive this because RSVP email alerts are enabled for this event.',
  });
};

/* ═══════════════════════════════════════════════════════════════════════════
   PAYMENT & BILLING
   ═══════════════════════════════════════════════════════════════════════════ */

/** Receipt for an offline / cash payment that a Super Admin approved (event activated). */
const getCashPaymentApprovedTemplate = (orgName, eventTitle, refNumber, amountCents, tierName = null) => {
  // Mirrors getStripePaymentReceiptTemplate below — the cash-payment receipt
  // previously omitted the Plan row entirely, so a cash-paying organizer's
  // receipt email never showed which tier they'd bought (the equivalent card
  // receipt did).
  const rows = [['Event', escapeHtml(eventTitle)]];
  if (tierName) rows.push(['Plan', escapeHtml(tierName)]);
  rows.push(['Reference', `<span style="font-family:'Courier New', monospace;">${escapeHtml(refNumber)}</span>`]);
  rows.push(['Amount Paid', money(amountCents), BRAND.gold]);
  rows.push(['Status', 'Active · Online', BRAND.success]);

  return emailShell({
    preheader: `Payment approved — ${eventTitle} is now active`,
    eyebrow: 'Payment approved',
    accent: BRAND.success,
    heading: 'Your event is active',
    contentHtml: `
      ${greeting(orgName)}
      ${para('Your offline payment has been verified and approved. Your event page is now live and online.')}
      ${dataTable(rows)}
      ${button(`${getPublicBaseUrl()}/dashboard`, 'Go to Dashboard')}
      ${para('You can now manage guests, customize your form, set up tables and distribute invitation links.', { size: 13, color: BRAND.stone, align: 'center', mb: 0 })}
    `,
  });
};

/** Receipt for a successful Stripe (card) payment — event then enters review. */
const getStripePaymentReceiptTemplate = ({ orgName, eventTitle, amountCents, tierName, referenceNumber }) => {
  const rows = [['Event', escapeHtml(eventTitle)]];
  if (tierName) rows.push(['Plan', escapeHtml(tierName)]);
  rows.push(['Amount Paid', money(amountCents), BRAND.gold]);
  if (referenceNumber) rows.push(['Reference', `<span style="font-family:'Courier New', monospace; font-size:13px;">${escapeHtml(referenceNumber)}</span>`]);
  rows.push(['Status', 'Under Review', BRAND.goldDark]);

  return emailShell({
    preheader: `Payment received for ${eventTitle}`,
    eyebrow: 'Payment receipt',
    heading: 'Payment received — thank you',
    contentHtml: `
      ${greeting(orgName)}
      ${para('Thank you! Your card payment was processed successfully. Your event is now under review and will go live to guests as soon as it\'s approved — you can keep setting it up in the meantime.')}
      ${dataTable(rows)}
      ${button(`${getPublicBaseUrl()}/dashboard`, 'Go to Dashboard')}
      ${para('Please keep this email as your receipt.', { size: 13, color: BRAND.stone, align: 'center', mb: 0 })}
    `,
  });
};

/** Notifies the organizer that their event has been approved and is now live. */
const getEventLiveTemplate = ({ orgName, eventTitle, eventUrl }) => emailShell({
  preheader: `${eventTitle} is now live`,
  eyebrow: 'Your event is live',
  accent: BRAND.success,
  heading: "You're all set — it's live!",
  contentHtml: `
    ${greeting(orgName)}
    ${para(`Great news — <strong style="color:${BRAND.charcoal};">${escapeHtml(eventTitle)}</strong> has been approved and is now live. Guests can view the page and RSVP at your link below.`)}
    ${button(eventUrl, 'View Your Event', { bg: BRAND.success, border: BRAND.success })}
    ${noticeBox(`Share your event link:<br><a href="${eventUrl}" style="color:${BRAND.gold}; word-break:break-all;">${escapeHtml(eventUrl)}</a>`, 'neutral')}
    ${para('Open your dashboard to send invitations, manage seating and track responses in real time.', { size: 13, color: BRAND.stone, mb: 0 })}
  `,
});

/* ═══════════════════════════════════════════════════════════════════════════
   GUEST LIFECYCLE — reminders & post-event
   ═══════════════════════════════════════════════════════════════════════════ */

/** "You haven't responded yet" nudge as the RSVP deadline approaches. */
const getRsvpReminderTemplate = (rsvp, event, links) => {
  const formattedDate = formatEventDate(event.event_date);
  const deadline = formatEventDate(event.rsvp_deadline);
  const choice = (href, label, bg, color, border) =>
    `<td align="center" style="padding:5px 5px;"><a class="fr-btn" href="${href}" target="_blank" rel="noopener" style="display:inline-block; font-family:${SANS}; font-size:14px; font-weight:bold; color:${color}; background-color:${bg}; text-decoration:none; padding:13px 22px; border-radius:10px; border:1px solid ${border};">${label}</a></td>`;
  return emailShell({
    preheader: `Reminder: please RSVP for ${event.title}`,
    eyebrow: 'A gentle reminder',
    heading: escapeHtml(event.title),
    contentHtml: `
      ${greeting(rsvp.guest_name)}
      ${para(`We'd love to know if you can join us${formattedDate ? ` on <strong>${escapeHtml(formattedDate)}</strong>` : ''}. We haven't received your response yet${deadline ? ` — RSVPs close on <strong>${escapeHtml(deadline)}</strong>` : ''}.`)}
      <p style="margin:8px 0 14px; font-family:${SANS}; font-size:11px; font-weight:bold; letter-spacing:1.5px; text-transform:uppercase; color:${BRAND.stone}; text-align:center;">Will you attend?</p>
      <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 6px;"><tr>
        ${choice(links.accept, '✓ Accept', BRAND.success, BRAND.white, BRAND.success)}
        ${choice(links.maybe, 'Maybe', BRAND.white, BRAND.charcoal, BRAND.border)}
        ${choice(links.decline, '✕ Decline', BRAND.danger, BRAND.white, BRAND.danger)}
      </tr></table>
      ${para('It only takes a moment — thank you!', { size: 13, color: BRAND.stone, align: 'center', mb: 0 })}
    `,
    footerNote: 'Sent via Fancy RSVP on behalf of the event organizer.',
  });
};

/** "See you soon" sent to confirmed guests as the event nears (with table if revealed). */
const getEventReminderTemplate = (rsvp, event, opts = {}) => {
  const formattedDate = formatEventDate(event.event_date);
  const where = event.location_name || event.location_address || null;
  const rows = [];
  if (formattedDate) rows.push(['When', escapeHtml(formattedDate)]);
  if (where) rows.push(['Where', escapeHtml(where)]);
  if (opts.tableName) rows.push(['Your Table', escapeHtml(opts.tableName), BRAND.gold]);
  return emailShell({
    preheader: `See you soon at ${event.title}`,
    eyebrow: 'See you soon',
    heading: escapeHtml(event.title),
    contentHtml: `
      ${greeting(rsvp.guest_name)}
      ${para("Your event is almost here — we can't wait to celebrate with you. Here is everything you need:")}
      ${rows.length ? dataTable(rows) : ''}
      ${opts.tableName ? '' : noticeBox('🎟️ Your table assignment and QR check-in pass will arrive in a separate email closer to the day.', 'neutral')}
      ${para('See you there!', { mb: 0 })}
    `,
  });
};

/** Post-event thank-you to guests who attended. */
const getPostEventThankYouTemplate = (rsvp, event) => emailShell({
  preheader: `Thank you for celebrating ${event.title}`,
  eyebrow: 'Thank you',
  heading: 'Thank you for joining us',
  contentHtml: `
    ${greeting(rsvp.guest_name)}
    ${para(`Thank you for being part of <strong style="color:${BRAND.charcoal};">${escapeHtml(event.title)}</strong>. It truly wouldn't have been the same without you.`)}
    ${para('We hope you had a wonderful time, and we look forward to seeing you again at a future celebration.')}
    ${para('With gratitude,<br>The host &amp; the Fancy RSVP team', { color: BRAND.stone, mb: 0 })}
  `,
});

/** Sent to attending guests when an organizer changes the date/time/venue. */
const getEventUpdatedTemplate = (rsvp, event, changes, eventUrl) => {
  const rows = (changes || []).map((c) => [c.label, escapeHtml(c.value)]);
  return emailShell({
    preheader: `Update to ${event.title}`,
    eyebrow: 'Event details updated',
    accent: BRAND.goldDark,
    heading: escapeHtml(event.title),
    contentHtml: `
      ${greeting(rsvp.guest_name)}
      ${para("There's been an update to an event you're attending. Please review the latest details:")}
      ${rows.length ? dataTable(rows) : ''}
      ${button(eventUrl, 'View Event Details')}
      ${para("We're sharing this so your plans stay accurate. See you there!", { size: 13, color: BRAND.stone, align: 'center', mb: 0 })}
    `,
  });
};

/* ═══════════════════════════════════════════════════════════════════════════
   ORGANIZER LIFECYCLE & REPORTS
   ═══════════════════════════════════════════════════════════════════════════ */

/** Onboarding welcome after the organizer verifies their email. */
const getOrganizerWelcomeTemplate = (name) => emailShell({
  preheader: 'Welcome to Fancy RSVP',
  eyebrow: 'Welcome aboard',
  heading: 'Welcome to Fancy RSVP',
  contentHtml: `
    ${greeting(name)}
    ${para('Your account is verified and ready. Fancy RSVP gives you everything to host beautifully — elegant invitations, real-time RSVP tracking, seating and QR check-in.')}
    ${dataTable([
      ['1 · Create', 'Design your event &amp; invitation'],
      ['2 · Invite', 'Send links by email, QR or SMS'],
      ['3 · Manage', 'Track RSVPs, seating &amp; check-ins live'],
    ])}
    ${button(`${getPublicBaseUrl()}/dashboard`, 'Create Your First Event')}
    ${para("We're thrilled to have you. If you ever need a hand, our team is here to help.", { size: 13, color: BRAND.stone, align: 'center', mb: 0 })}
  `,
});

/** Near-final headcount report the day before the event. */
const getFinalHeadcountReportTemplate = ({ orgName, event, stats }) => {
  const formattedDate = formatEventDate(event.event_date);
  return emailShell({
    preheader: `Final headcount for ${event.title}`,
    eyebrow: 'Final headcount',
    heading: escapeHtml(event.title),
    contentHtml: `
      ${greeting(orgName)}
      ${para(`Your event is coming up${formattedDate ? ` on <strong>${escapeHtml(formattedDate)}</strong>` : ''}. Here is your near-final headcount to confirm catering and seating:`)}
      ${statGrid([
        { label: 'Attending', value: stats.attending, color: BRAND.success },
        { label: 'Guests', value: stats.headcount, color: BRAND.gold },
        { label: 'Maybe', value: stats.maybe, color: BRAND.goldDark },
        { label: 'Pending', value: stats.pending, color: BRAND.stone },
      ])}
      ${dataTable([
        ['Confirmed Headcount', `${stats.headcount}`, BRAND.gold],
        ['Declined', `${stats.declined}`],
        ['Response Rate', `${stats.responseRate}%`],
      ])}
      ${button(`${getPublicBaseUrl()}/dashboard`, 'Open Dashboard')}
      ${para("Tip: you can still nudge guests who haven't responded from your dashboard.", { size: 13, color: BRAND.stone, align: 'center', mb: 0 })}
    `,
  });
};

/** Post-event recap report for the organizer. */
const getPostEventRecapTemplate = ({ orgName, event, stats }) => emailShell({
  preheader: `Recap for ${event.title}`,
  eyebrow: 'Event recap',
  accent: BRAND.success,
  heading: escapeHtml(event.title),
  contentHtml: `
    ${greeting(orgName)}
    ${para("Congratulations on a successful event! Here's a quick recap of how it went:")}
    ${statGrid([
      { label: 'Confirmed', value: stats.attending, color: BRAND.success },
      { label: 'Guests', value: stats.headcount, color: BRAND.gold },
      { label: 'Checked In', value: stats.checkedIn, color: BRAND.charcoal },
    ])}
    ${dataTable([
      ['Total RSVPs', `${stats.total}`],
      ['Attended (checked in)', `${stats.checkedIn}`, BRAND.success],
      ['Response Rate', `${stats.responseRate}%`],
    ])}
    ${para("Thank you for hosting with Fancy RSVP — we'd love to help you plan the next one.", { mb: 0 })}
  `,
});

/** Nudge to complete the platform fee for an unpaid draft event. */
const getPendingPaymentReminderTemplate = ({ orgName, event }) => emailShell({
  preheader: `Activate ${event.title}`,
  eyebrow: 'Almost there',
  accent: BRAND.goldDark,
  heading: 'Your event is ready to go live',
  contentHtml: `
    ${greeting(orgName)}
    ${para(`You created <strong style="color:${BRAND.charcoal};">${escapeHtml(event.title)}</strong> but haven't completed the platform fee yet. Your event stays a private draft until it's activated — finish in a minute to start collecting RSVPs.`)}
    ${button(`${getPublicBaseUrl()}/dashboard`, 'Activate My Event')}
    ${para('You can pay by card or arrange an offline transfer from your dashboard.', { size: 13, color: BRAND.stone, align: 'center', mb: 0 })}
  `,
});

/** Operational alert when an organizer's SMS balance is running low. */
const getLowCreditsWarningTemplate = ({ orgName, event, remaining }) => emailShell({
  preheader: 'Your SMS credits are running low',
  eyebrow: 'Heads up',
  accent: BRAND.goldDark,
  heading: 'Your SMS credits are running low',
  contentHtml: `
    ${greeting(orgName)}
    ${para(`Your SMS balance${event && event.title ? ` for <strong style="color:${BRAND.charcoal};">${escapeHtml(event.title)}</strong>` : ''} is down to <strong style="color:${BRAND.goldDark};">${Number(remaining) || 0}</strong> credits. Top up so your invitations and reminders keep going out.`)}
    ${button(`${getPublicBaseUrl()}/dashboard/campaigns`, 'Top Up Credits')}
    ${para("You'll only receive this once per low-balance period.", { size: 13, color: BRAND.stone, align: 'center', mb: 0 })}
  `,
});

/* ═══════════════════════════════════════════════════════════════════════════
   SECURITY
   ═══════════════════════════════════════════════════════════════════════════ */

/** Confirmation that the account password was changed. */
const getPasswordChangedTemplate = (name) => emailShell({
  preheader: 'Your password was changed',
  eyebrow: 'Security',
  heading: 'Your password was changed',
  contentHtml: `
    ${greeting(name)}
    ${para('This confirms the password on your Fancy RSVP account was just changed. For your security, all other active sessions have been signed out.')}
    ${noticeBox('🔒 If you did <strong>not</strong> make this change, reset your password immediately and contact support — your account may be at risk.', 'danger')}
    ${para('If this was you, no further action is needed.', { size: 13, color: BRAND.stone, mb: 0 })}
  `,
});

/** Alert on a sign-in from a new device / location. */
const getNewSignInTemplate = (name, info = {}) => {
  const rows = [];
  if (info.device) rows.push(['Device', escapeHtml(info.device)]);
  if (info.ip) rows.push(['IP Address', escapeHtml(info.ip)]);
  if (info.when) rows.push(['When', escapeHtml(info.when)]);
  return emailShell({
    preheader: 'New sign-in to your Fancy RSVP account',
    eyebrow: 'Security',
    heading: 'New sign-in detected',
    contentHtml: `
      ${greeting(name)}
      ${para('We noticed a sign-in to your Fancy RSVP account from a new device or location:')}
      ${rows.length ? dataTable(rows) : ''}
      ${noticeBox('🔒 If this was you, you can ignore this email. If not, reset your password right away and review your active sessions.', 'warn')}
      ${para('We send these alerts to help keep your account secure.', { size: 13, color: BRAND.stone, mb: 0 })}
    `,
  });
};

module.exports = {
  escapeHtml,
  getPublicBaseUrl,
  buildGuestEventUrl,
  buildGuestRsvpUrl,
  formatEventDate,
  // RSVP lifecycle
  getInvitationTemplate,
  getRSVPConfirmationTemplate,
  getCompanionRSVPConfirmationTemplate,
  getDeclineConfirmationTemplate,
  getQRTicketTemplate,
  getRsvpReminderTemplate,
  getEventReminderTemplate,
  getPostEventThankYouTemplate,
  getEventUpdatedTemplate,
  // Organizer
  getNewRsvpOrganizerTemplate,
  getOrganizerWelcomeTemplate,
  getFinalHeadcountReportTemplate,
  getPostEventRecapTemplate,
  getPendingPaymentReminderTemplate,
  getLowCreditsWarningTemplate,
  // Auth & security
  getEmailVerificationTemplate,
  getPasswordResetTemplate,
  getPasswordChangedTemplate,
  getNewSignInTemplate,
  // Payment & billing
  getCashPaymentApprovedTemplate,
  getStripePaymentReceiptTemplate,
  getEventLiveTemplate,
};
