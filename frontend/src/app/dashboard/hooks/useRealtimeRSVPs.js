import { useEffect, useRef } from 'react';
import { supabase } from '../../utils/supabaseClient';

const MOCK_GUESTS_POOL = [
  { guest_name: "Jonathan Harker", party_size: 2, response: "yes", email: "harker@transylvania.com", meal: "Filet Mignon", phone: "555-0987" },
  { guest_name: "Lucy Westenra", party_size: 1, response: "yes", email: "lucy@westenra.org", meal: "Truffle Risotto", phone: "555-4567" },
  { guest_name: "Arthur Holmwood", party_size: 3, response: "yes", email: "arthur@lord.co.uk", meal: "Herb Crusted Salmon", phone: "555-3210" },
  { guest_name: "Mina Murray", party_size: 2, response: "yes", email: "mina@murray.edu", meal: "Herb Crusted Salmon", phone: "555-8888" },
  { guest_name: "Dr. John Seward", party_size: 1, response: "no", email: "seward@asylum.com", meal: "None", phone: "555-6666" }
];

export function useRealtimeRSVPs(eventId, onNewRsvp) {
  const callbackRef = useRef(onNewRsvp);

  // Sync callback reference on every render
  useEffect(() => {
    callbackRef.current = onNewRsvp;
  }, [onNewRsvp]);

  useEffect(() => {
    if (!eventId) return;

    // Case 1: Supabase client is connected
    if (supabase) {

      
      const channel = supabase
        .channel(`rsvps-changes-${eventId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'rsvps',
            filter: `event_id=eq.${eventId}`
          },
          (payload) => {

            if (callbackRef.current) {
              callbackRef.current(payload);
            }
          }
        )
        .subscribe((status) => {

        });

      return () => {
        supabase.removeChannel(channel);
      };
    } 
    
    // Case 2: Local fallback mode (no Supabase env vars configured)
    // We start a mock simulation interval to showcase dashboard real-time capabilities
    else {
      if (process.env.NODE_ENV !== 'development') return;

      let iterationCount = 0;
      const MAX_MOCK_ITERATIONS = 10;
      
      const interval = setInterval(() => {
        if (iterationCount >= MAX_MOCK_ITERATIONS) { clearInterval(interval); return; }
        iterationCount++;

        if (!callbackRef.current) return;
        
        // Randomly pick a guest from pool
        const template = MOCK_GUESTS_POOL[Math.floor(Math.random() * MOCK_GUESTS_POOL.length)];
        
        // Add random id and current timestamp
        const mockPayload = {
          eventType: 'INSERT',
          new: {
            id: 'mock-' + Math.random().toString(36).substring(2, 9),
            event_id: eventId,
            guest_name: template.guest_name,
            party_size: template.party_size,
            response: template.response,
            email: template.email,
            phone: template.phone,
            meal: template.meal,
            created_at: new Date().toISOString()
          }
        };


        callbackRef.current(mockPayload);
      }, 35000); // Trigger mock RSVP every 35 seconds

      return () => {
        clearInterval(interval);
      };
    }
  }, [eventId]);
}
