const { createClient } = require('@supabase/supabase-js');
// dotenv is loaded in server.js at startup — no duplicate require needed

// Polyfill WebSocket for Node.js < 22 to support Supabase Realtime
if (typeof global.WebSocket === 'undefined') {
  global.WebSocket = require('ws');
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('CRITICAL ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured in environment variables.');
}

console.log('🔌 Connecting to remote Supabase instance...');
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: {
    webSocket: global.WebSocket,
    transport: global.WebSocket
  }
});

module.exports = { supabase };
