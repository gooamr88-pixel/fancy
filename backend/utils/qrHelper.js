const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');

const QR_JWT_SECRET = process.env.QR_JWT_SECRET;
if (!QR_JWT_SECRET) throw new Error('FATAL: QR_JWT_SECRET environment variable is required');

/**
 * Generates a signed JWT payload representing the guest's ticket.
 */
const generateTicketToken = (payload) => {
  // Compute expiry based on event date (if provided) + 1 day buffer, otherwise fallback to 30 days
  let expiresIn = '30d';
  if (payload.event_date) {
    const eventDateMs = new Date(payload.event_date).getTime();
    const bufferMs = 24 * 60 * 60 * 1000; // 1 day after event
    const expiryMs = (eventDateMs + bufferMs) - Date.now();
    if (expiryMs > 0) {
      expiresIn = Math.ceil(expiryMs / 1000); // seconds until event_date + 1 day
    }
  }
  return jwt.sign(payload, QR_JWT_SECRET, { expiresIn });
};

/**
 * Verifies a signed QR ticket token.
 */
const verifyTicketToken = (token) => {
  try {
    return jwt.verify(token, QR_JWT_SECRET, { algorithms: ['HS256'] });
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
