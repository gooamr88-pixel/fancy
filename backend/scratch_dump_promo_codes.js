require('dotenv').config();
const { supabase } = require('./config/supabase');

function deriveStatus(row) {
  if (!row.is_active) return 'inactive';
  if (row.expires_at && new Date(row.expires_at) < new Date()) return 'expired';
  if (row.max_redemptions != null && row.redemption_count >= row.max_redemptions) return 'exhausted';
  return 'active';
}

async function dumpPromoCodes() {
  try {
    console.log("Querying promo_codes...");
    const { data, error, count } = await supabase
      .from('promo_codes')
      .select('*', { count: 'exact' });
    
    if (error) {
      console.error("Supabase Error:", error);
      return;
    }

    console.log(`Found ${count} rows.`);
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      try {
        const status = deriveStatus(row);
        console.log(`Row ${i}: ID=${row.id}, Code=${row.code}, Status=${status}`);
      } catch (err) {
        console.error(`Error deriving status for row ${i} (ID=${row?.id}):`, err);
      }
    }
  } catch (err) {
    console.error("Unexpected error:", err);
  }
}

dumpPromoCodes();
