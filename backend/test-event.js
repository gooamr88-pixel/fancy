require('dotenv').config();
const { supabase } = require('./config/supabase');

const eventId = 'd56423da-ac63-43ff-875e-ff00bf88b20d';

async function runTest() {
  console.log('--- TESTING verifyEventOwner QUERY ---');
  try {
    const { data: event, error } = await supabase
      .from('events')
      .select('org_id, organizations(owner_user_id)')
      .eq('id', eventId)
      .single();
    
    console.log('verifyEventOwner Result event:', JSON.stringify(event, null, 2));
    console.log('verifyEventOwner Error:', error);
  } catch (err) {
    console.error('verifyEventOwner Threw Exception:', err);
  }

  console.log('\n--- TESTING getEvent QUERY ---');
  try {
    const { data: event, error } = await supabase
      .from('events')
      .select('*, rsvp_form_fields(*)')
      .eq('id', eventId)
      .single();
    
    console.log('getEvent Result event:', event ? JSON.stringify({ ...event, cover_image_url: '...' }, null, 2) : null);
    console.log('getEvent Error:', error);
  } catch (err) {
    console.error('getEvent Threw Exception:', err);
  }

  process.exit(0);
}

runTest();
