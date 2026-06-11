import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const ALLOWED_ORIGIN = Deno.env.get('FRONTEND_URL') || 'https://fancyrsvp.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS OPTIONS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization header is required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { eventId, to, message } = await req.json()

    if (!eventId || !to || !message) {
      return new Response(JSON.stringify({ error: 'eventId, to (phone), and message are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // 1. Verify user token and validate permission on the event using RLS
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Query event table. If the user doesn't own the event, RLS will block it.
    const { data: event, error: eventError } = await userClient
      .from('events')
      .select('id')
      .eq('id', eventId)
      .single()

    if (eventError || !event) {
      return new Response(JSON.stringify({ error: 'Forbidden: You do not have permission for this event' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Initialize Supabase Client with Service Role client to bypass RLS for ledger updates
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 2. Prepare message body (Append platform branding)
    let brandedMessage = message;
    const branding = " — Fancy RSVP";
    if (!brandedMessage.endsWith(branding)) {
      brandedMessage = `${brandedMessage}${branding}`;
    }

    // 3. Atomically verify and deduct credit using RPC
    const { data: deductResult, error: rpcError } = await supabase.rpc('deduct_sms_credit_atomic', {
      p_event_id: eventId,
      p_phone: to
    })

    if (rpcError || !deductResult) {
      console.error('RPC deduct_sms_credit_atomic error:', rpcError);
      throw new Error(rpcError?.message || 'Database deduction call failed');
    }

    if (!deductResult.success) {
      const statusCode = deductResult.error === 'INSUFFICIENT_CREDITS' ? 402 : 400;
      return new Response(JSON.stringify({ 
        success: false, 
        error: deductResult.error,
        message: deductResult.error === 'INSUFFICIENT_CREDITS' 
          ? 'Insufficient credits in event wallet.' 
          : 'SMS credit wallet not found.'
      }), {
        status: statusCode,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { wallet_id, ledger_id } = deductResult;

    // 4. Load Twilio settings
    const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID')
    const twilioToken = Deno.env.get('TWILIO_AUTH_TOKEN')
    const twilioPhone = Deno.env.get('TWILIO_PHONE_NUMBER')

    // Handle Mocking in local development if credentials are missing
    if (!twilioSid || !twilioToken || !twilioPhone) {
      console.log(`[MOCK SMS SEND] To: ${to} | Body: ${brandedMessage}`);
      
      // Update ledger to complete mock send
      await supabase
        .from('sms_credit_ledger')
        .update({ sms_sid: `mock-sid-${Date.now()}` })
        .eq('id', ledger_id);

      return new Response(JSON.stringify({ 
        success: true, 
        mocked: true, 
        message: 'Mock SMS dispatched, credit deducted.' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })
    }

    // 5. Dispatch Twilio SMS via Deno fetch API
    try {
      const basicAuth = btoa(`${twilioSid}:${twilioToken}`)
      const twilioRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          From: twilioPhone,
          To: to,
          Body: brandedMessage
        }).toString()
      })

      const twilioData = await twilioRes.json()

      if (!twilioRes.ok) {
        throw new Error(twilioData.message || 'Twilio REST dispatch failed');
      }

      // Update ledger with Twilio message SID
      const { error: ledgerUpdateError } = await supabase
        .from('sms_credit_ledger')
        .update({ sms_sid: twilioData.sid })
        .eq('id', ledger_id);

      if (ledgerUpdateError) {
        console.error(`Ledger update failed for sid: ${twilioData.sid}`, ledgerUpdateError);
      }

      return new Response(JSON.stringify({ 
        success: true, 
        messageSid: twilioData.sid 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })

    } catch (smsError) {
      console.error(`Twilio SMS API error, executing atomic credit refund loop: ${smsError.message}`);

      // 6. Refund credit atomically if Twilio API fails to dispatch
      const { error: refundError } = await supabase.rpc('refund_sms_credit_atomic', {
        p_wallet_id: wallet_id,
        p_event_id: eventId,
        p_ledger_id: ledger_id
      })

      if (refundError) {
        console.error('CRITICAL: Failed to refund credit for ledger transaction:', ledger_id, refundError);
      }

      return new Response(JSON.stringify({ 
        success: false, 
        error: 'DISPATCH_ERROR', 
        message: `Twilio send failure: ${smsError.message}. Credit has been refunded.` 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

  } catch (err) {
    console.error(`Unhandled edge function error: ${err.message}`);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
