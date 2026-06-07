const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');

const QR_JWT_SECRET = process.env.QR_JWT_SECRET || 'qr_ticket_jwt_signing_key_placeholder';

/**
 * Generates a signed JWT payload representing the guest's ticket.
 */
const generateTicketToken = (payload) => {
  // Signs standard details: guest_id (rsvp_id), event_id, table_id, etc.
  return jwt.sign(payload, QR_JWT_SECRET, { expiresIn: '30d' }); // Valid for 30 days
};

/**
 * Verifies a signed QR ticket token.
 */
const verifyTicketToken = (token) => {
  try {
    return jwt.verify(token, QR_JWT_SECRET);
  } catch (err) {
    throw new Error('INVALID_QR_TICKET');
  }
};

/**
 * Generates a QR Code as a Data URL (base64 encoded image string).
 */
const generateQRCodeDataURL = async (text) => {
  try {
    return await QRCode.toDataURL(text, {
      color: {
        dark: '#1e293b',  // Dark slate (premium palette)
        light: '#ffffff'  // White background
      },
      width: 400,
      margin: 2
    });
  } catch (err) {
    console.error('Error generating QR code data URL:', err);
    throw err;
  }
};

/**
 * Generates a QR Code as a Buffer (useful for file uploads).
 */
const generateQRCodeBuffer = async (text) => {
  try {
    return await QRCode.toBuffer(text, {
      type: 'png',
      color: {
        dark: '#1e293b',
        light: '#ffffff'
      },
      width: 400,
      margin: 2
    });
  } catch (err) {
    console.error('Error generating QR code buffer:', err);
    throw err;
  }
};

module.exports = {
  generateTicketToken,
  verifyTicketToken,
  generateQRCodeDataURL,
  generateQRCodeBuffer
};
