/**
 * Escapes HTML entities to prevent XSS in email templates.
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

/**
 * Generates an inline-styled premium HTML email body for RSVP Confirmation.
 */
const getRSVPConfirmationTemplate = (rsvp, event) => {
  const formattedDate = new Date(event.event_date).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const responseText = rsvp.response === 'yes'
    ? 'Yes, Attending'
    : rsvp.response === 'no'
      ? 'No, Regretfully Declined'
      : 'Pending';

  const responseColor = rsvp.response === 'yes'
    ? '#10b981'
    : rsvp.response === 'no'
      ? '#ef4444'
      : '#64748b';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>RSVP Confirmed</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 40px 0;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <!-- Header Banner -->
          <tr>
            <td align="center" style="background-color: #0f172a; padding: 40px 20px;">
              <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.25em; color: #fbbf24; font-weight: bold; display: block; margin-bottom: 8px;">RSVP CONFIRMED</span>
              <h1 style="color: #ffffff; font-size: 24px; font-weight: 300; margin: 0; letter-spacing: 0.05em;">${escapeHtml(event.title)}</h1>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="font-size: 16px; color: #334155; margin-top: 0; line-height: 1.6;">Dear <strong>${escapeHtml(rsvp.guest_name)}</strong>,</p>
              <p style="font-size: 15px; color: #475569; line-height: 1.6;">Your RSVP response has been successfully registered for this upcoming event. We have cataloged your details below:</p>
              
              <!-- Details Box -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; border-radius: 8px; margin: 25px 0; padding: 20px;">
                <tr>
                  <td style="padding-bottom: 10px; font-size: 13px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; width: 120px;">Response</td>
                  <td style="padding-bottom: 10px; font-size: 15px; color: ${responseColor}; font-weight: 600;">${responseText}</td>
                </tr>
                <tr>
                  <td style="padding-bottom: 10px; font-size: 13px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Party Size</td>
                  <td style="padding-bottom: 10px; font-size: 15px; color: #0f172a;">${rsvp.party_size} ${rsvp.party_size === 1 ? 'person' : 'people'}</td>
                </tr>
                <tr>
                  <td style="font-size: 13px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Date</td>
                  <td style="font-size: 15px; color: #0f172a;">${formattedDate}</td>
                </tr>
              </table>

              <p style="font-size: 14px; color: #64748b; line-height: 1.6; margin-bottom: 0;">
                * Note: Your table placement is currently being coordinated. You will receive a separate notification containing your QR code check-in pass once your table assignment is finalized.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="background-color: #f8fafc; border-top: 1px solid #f1f5f9; padding: 25px 20px; font-size: 12px; color: #94a3b8;">
              Thank you for choosing Fancy RSVP. System notification sent automatically.
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
};

/**
 * Generates an inline-styled premium HTML email body for Table Assignment & QR Ticket.
 */
const getQRTicketTemplate = (rsvp, event, tableName, qrDataURL) => {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Your Entry Pass & Seating Card</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 40px 0;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);">
          <!-- Header Banner -->
          <tr>
            <td align="center" style="background-color: #0f172a; padding: 40px 20px;">
              <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.25em; color: #fbbf24; font-weight: bold; display: block; margin-bottom: 8px;">ENTRY PASS & SEATING CARD</span>
              <h1 style="color: #ffffff; font-size: 24px; font-weight: 300; margin: 0; letter-spacing: 0.05em;">${escapeHtml(event.title)}</h1>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td align="center" style="padding: 40px 30px;">
              <p style="font-size: 15px; color: #475569; line-height: 1.6; margin-top: 0; margin-bottom: 25px;">
                Hello <strong>${escapeHtml(rsvp.guest_name)}</strong>, your table assignment is finalized. Please present this card at the entrance check-in desk.
              </p>
              
              <!-- Seating Badge -->
              <div style="background-color: #f8fafc; border: 1px solid #f1f5f9; border-radius: 12px; display: inline-block; padding: 20px 40px; margin-bottom: 30px; text-align: center;">
                <span style="font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; display: block; margin-bottom: 6px;">Your Assigned Seating</span>
                <span style="font-size: 32px; font-weight: bold; color: #0f172a; letter-spacing: -0.02em;">${escapeHtml(tableName)}</span>
                <span style="font-size: 13px; color: #64748b; display: block; margin-top: 6px;">Party Size: ${rsvp.party_size}</span>
              </div>

              <!-- QR Code -->
              <div style="margin-bottom: 30px;">
                <img src="${qrDataURL}" alt="Check-in QR Code" width="220" height="220" style="display: block; margin: auto; border: 1px solid #f1f5f9; border-radius: 8px;" />
              </div>

              <p style="font-size: 13px; color: #94a3b8; line-height: 1.6; max-width: 440px; margin: 0 auto;">
                Show this digital card on your mobile device to our staff at the venue entrance. They will scan the QR code to confirm your party details and direct you to your table.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="background-color: #f8fafc; border-top: 1px solid #f1f5f9; padding: 25px 20px; font-size: 12px; color: #94a3b8;">
              Thank you for choosing Fancy RSVP. System notification sent automatically.
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
};

/**
 * Generates an inline-styled premium HTML email body for guests who declined.
 */
const getDeclineConfirmationTemplate = (rsvp, event) => {
  const formattedDate = new Date(event.event_date).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const eventPageUrl = `${process.env.FRONTEND_URL || 'https://fancyrsvp.com'}/e/${event.slug || ''}`;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Thank You for Letting Us Know</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 40px 0;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <!-- Header Banner -->
          <tr>
            <td align="center" style="background-color: #0f172a; padding: 40px 20px;">
              <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.25em; color: #fbbf24; font-weight: bold; display: block; margin-bottom: 8px;">THANK YOU FOR LETTING US KNOW</span>
              <h1 style="color: #ffffff; font-size: 24px; font-weight: 300; margin: 0; letter-spacing: 0.05em;">${escapeHtml(event.title)}</h1>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="font-size: 16px; color: #334155; margin-top: 0; line-height: 1.6;">Dear <strong>${escapeHtml(rsvp.guest_name)}</strong>,</p>
              <p style="font-size: 15px; color: #475569; line-height: 1.6;">We're sorry you won't be able to join us for <strong>${escapeHtml(event.title)}</strong> on <strong>${formattedDate}</strong>. We completely understand and truly appreciate you taking the time to let us know.</p>
              
              <!-- Status Box -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; border-radius: 8px; margin: 25px 0; padding: 20px;">
                <tr>
                  <td style="padding-bottom: 10px; font-size: 13px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; width: 120px;">Response</td>
                  <td style="padding-bottom: 10px; font-size: 15px; color: #ef4444; font-weight: 600;">Regretfully Declined</td>
                </tr>
                <tr>
                  <td style="font-size: 13px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Date</td>
                  <td style="font-size: 15px; color: #0f172a;">${formattedDate}</td>
                </tr>
              </table>

              <p style="font-size: 15px; color: #475569; line-height: 1.6;">If your plans change, we'd love to have you. You can update your RSVP at any time before the deadline:</p>

              <!-- CTA Button -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 25px 0;">
                <tr>
                  <td align="center">
                    <a href="${eventPageUrl}" target="_blank" style="display: inline-block; background-color: #0f172a; color: #fbbf24; font-size: 14px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px; letter-spacing: 0.05em; text-transform: uppercase;">Change My RSVP</a>
                  </td>
                </tr>
              </table>

              <p style="font-size: 14px; color: #64748b; line-height: 1.6; margin-bottom: 0;">
                We hope to see you at a future event. Wishing you all the best!
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="background-color: #f8fafc; border-top: 1px solid #f1f5f9; padding: 25px 20px; font-size: 12px; color: #94a3b8;">
              Thank you for choosing Fancy RSVP. System notification sent automatically.
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
};

module.exports = {
  escapeHtml,
  getRSVPConfirmationTemplate,
  getQRTicketTemplate,
  getDeclineConfirmationTemplate
};
