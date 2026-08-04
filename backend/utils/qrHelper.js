const QRCode = require('qrcode');
const logger = require('./logger');

/**
 * QR image rendering only. Signing/verifying QR check-in tickets lives in
 * services/tokenService.js, which signs AND verifies an explicit `purpose`
 * discriminator so a token minted for one purpose can never be replayed as
 * another. The old generateTicketToken/verifyTicketToken helpers were removed
 * because verifyTicketToken accepted ANY token signed with QR_JWT_SECRET,
 * regardless of purpose — the exact cross-token replay gap tokenService closes.
 */

/**
 * Shared render settings. `errorCorrectionLevel: 'Q'` (25% recovery) rather
 * than the library default 'M': a check-in QR is scanned off a phone screen
 * under venue lighting, often from a printed or screenshotted copy with a
 * fingerprint or a fold across it. The extra redundancy costs a slightly
 * denser code and buys a code that still reads when partly obscured.
 */
const BASE_OPTIONS = {
  color: {
    dark: '#1e293b',  // Dark slate (premium palette)
    light: '#ffffff'  // White background
  },
  errorCorrectionLevel: 'Q',
  width: 400,
  margin: 2,
};

/**
 * Generates a QR Code as a Data URL (base64 encoded image string).
 */
const generateQRCodeDataURL = async (text, options = {}) => {
  try {
    return await QRCode.toDataURL(text, { ...BASE_OPTIONS, ...options });
  } catch (err) {
    logger.error({ err }, 'Error generating QR code data URL');
    throw err;
  }
};

/**
 * Generates a QR Code as a Buffer (useful for file uploads).
 */
const generateQRCodeBuffer = async (text, options = {}) => {
  try {
    return await QRCode.toBuffer(text, { type: 'png', ...BASE_OPTIONS, ...options });
  } catch (err) {
    logger.error({ err }, 'Error generating QR code buffer');
    throw err;
  }
};

module.exports = {
  generateQRCodeDataURL,
  generateQRCodeBuffer,
};
