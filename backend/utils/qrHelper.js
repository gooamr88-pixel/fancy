const QRCode = require('qrcode');
const jwt = require('jsonwebtoken');
const logger = require('./logger');

const QR_SECRET = process.env.QR_JWT_SECRET;

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
    logger.error({ err }, 'Error generating QR code data URL');
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
    logger.error({ err }, 'Error generating QR code buffer');
    throw err;
  }
};

/**
 * Signs a JWT ticket token containing the given payload fields.
 */
const generateTicketToken = (payload) => {
  return jwt.sign({ ...payload }, QR_SECRET, { algorithm: 'HS256' });
};

/**
 * Verifies a JWT ticket token. Returns the decoded payload on success.
 * Throws an error matching /INVALID_QR_TICKET/ on any failure.
 */
const verifyTicketToken = (token) => {
  try {
    return jwt.verify(token, QR_SECRET, { algorithms: ['HS256'] });
  } catch (_err) {
    throw new Error('INVALID_QR_TICKET');
  }
};

module.exports = {
  generateQRCodeDataURL,
  generateQRCodeBuffer,
  generateTicketToken,
  verifyTicketToken
};
