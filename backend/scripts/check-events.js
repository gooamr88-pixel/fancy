require('dotenv').config();
const { supabase } = require('../config/supabase');

(async () => {
  const orgId = '40bcbfc9-10d2-49c3-8993-c50f9d85540e';
  const { data: events, error } = await supabase.from('events').select('*').eq('org_id', orgId);
  console.log(`--- events for org ${orgId} ---`);
  if (error) console.error(error);
  else console.log(events);
  
  process.exit(0);
})();