const QRCode = require('qrcode');
const logger = require('./logger');

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
  generateQRCodeBuffer
};
