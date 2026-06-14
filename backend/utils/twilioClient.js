let twilioClient = null;

function getTwilioClient() {
  if (twilioClient) return twilioClient;
  
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  
  if (!accountSid || !authToken) {
    console.warn('Twilio credentials not set. SMS will be logged to console (mock mode).');
    return null;
  }
  
  try {
    const twilio = require('twilio');
    twilioClient = twilio(accountSid, authToken);
    return twilioClient;
  } catch (err) {
    console.error('Failed to initialize Twilio client:', err.message);
    return null;
  }
}

function getTwilioFromNumber() {
  const num = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM_NUMBER || '+15005550006';
  return num.trim();
}

module.exports = { getTwilioClient, getTwilioFromNumber };
