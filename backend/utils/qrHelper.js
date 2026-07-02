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

module.exports = {
  generateQRCodeDataURL,
  generateQRCodeBuffer,
};
