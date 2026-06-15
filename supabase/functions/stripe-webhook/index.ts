import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"
import Stripe from "https://esm.sh/stripe@12.18.0?target=deno"

const responseHeaders = {
  'Content-Type': 'application/json',
}

serve(async (req) => {
  // Reject preflight CORS / OPTIONS since Stripe webhooks are server-to-server only
  if (req.method === 'OPTIONS') {
    return new Response('Method Not Allowed', { status: 405, headers: responseHeaders })
  }

  try {
    const signature = req.headers.get('stripe-signature')
    if (!signature) {
      return new Response(JSON.stringify({ error: 'Missing stripe-signature header' }), { 
        status: 400,
        headers: responseHeaders
      })
    }

    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
    
    if (!stripeSecret || !webhookSecret) {
      console.error('Missing required server secrets: STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), { 
        status: 500,
        headers: responseHeaders
      })
    }

    // Initialize Stripe client using Deno's native fetch client wrapper
    const stripe = new Stripe(stripeSecret, {
      apiVersion: '2022-11-15',
      httpClient: Stripe.createFetchHttpClient(),
    })

    const body = await req.text()
    let event;
    
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
      console.error(`Webhook signature verification failed: ${err.message}`);
      return new Response(JSON.stringify({ error: `Webhook Error: ${err.message}` }), { 
        status: 400,
        headers: responseHeaders
      })
    }

    // Initialize Supabase Client with service role key to bypass RLS for administrative updates
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      const { event_id, type } = session.metadata || {}

      if (!event_id || !type) {
        console.error('Checkout session completed but missing metadata parameters (event_id, type).');
        return new Response(JSON.stringify({ error: 'Metadata parameters missing' }), { 
          status: 400,
          headers: responseHeaders
        })
      }

      if (type === 'event_fee') {
        console.log(`Processing event_fee activation payment for Event ID: ${event_id}`);
        
        // Idempotency check: see if payment was already recorded
        const { data: existingPayment, error: queryError } = await supabase
          .from('event_payments')
          .select('id')
          .eq('stripe_checkout_session_id', session.id)
          .limit(1);

        if (queryError) throw queryError;

        if (existingPayment && existingPayment.length > 0) {
          console.log(`[Webhook] Event fee checkout session already processed: ${session.id}`);
          return new Response(JSON.stringify({ received: true, message: 'Already processed' }), {
            headers: responseHeaders,
            status: 200
          })
        }

        // 1. Activate Event Status
        const { error: eventError } = await supabase
          .from('events')
          .update({ is_paid: true, status: 'active', updated_at: new Date().toISOString() })
          .eq('id', event_id)

        if (eventError) throw eventError;

        // 2. Record Completed Transaction Log
        const { error: paymentError } = await supabase
          .from('event_payments')
          .insert({
            event_id,
            stripe_checkout_session_id: session.id,
            stripe_payment_intent_id: session.payment_intent,
            amount_cents: session.amount_total,
            currency: session.currency,
            status: 'completed',
            payment_method: 'stripe',
            completed_at: new Date().toISOString()
          })

        if (paymentError) throw paymentError;

      } else if (type === 'sms_credits') {
        const creditCount = parseInt(session.metadata.credit_count)
        console.log(`Processing sms_credits allocation: ${creditCount} credits for Event ID: ${event_id}`);

        if (isNaN(creditCount) || creditCount <= 0) {
          throw new Error(`Invalid credit_count value: ${session.metadata.credit_count}`);
        }

        // Idempotency check: see if payment intent already registered in ledger
        if (session.payment_intent) {
          const { data: existingLedger, error: queryError } = await supabase
            .from('sms_credit_ledger')
            .select('id')
            .eq('stripe_payment_intent_id', session.payment_intent)
            .limit(1);

          if (queryError) throw queryError;

          if (existingLedger && existingLedger.length > 0) {
            console.log(`[Webhook] SMS credits already credited for payment intent: ${session.payment_intent}`);
            return new Response(JSON.stringify({ received: true, message: 'Already processed' }), {
              headers: responseHeaders,
              status: 200
            })
          }
        }

        // Resolve (or create) the wallet WITHOUT yet crediting it.
        const { data: wallet, error: walletError } = await supabase
          .from('sms_credit_wallets')
          .select('id')
          .eq('event_id', event_id)
          .maybeSingle();

        if (walletError) throw walletError;

        let walletId;
        let walletAlreadyExisted = false;
        if (wallet) {
          walletId = wallet.id;
          walletAlreadyExisted = true;
        } else {
          // Create the wallet with ZERO credits — the increment happens only after
          // the ledger row is committed, so a retry can never double-credit.
          const { data: newWallet, error: insertError } = await supabase
            .from('sms_credit_wallets')
            .insert({
              event_id,
              credits_purchased: 0,
              credits_used: 0
            })
            .select()
            .single();

          if (insertError) throw insertError;
          walletId = newWallet.id;
        }

        // 1. Insert the ledger row FIRST. The unique index on (stripe_payment_intent_id,
        //    transaction_type='purchase') is the idempotency guard: if Stripe retries
        //    after a partial failure, this insert fails with a duplicate-key error and
        //    we bail out BEFORE incrementing the wallet a second time.
        const { error: ledgerError } = await supabase
          .from('sms_credit_ledger')
          .insert({
            wallet_id: walletId,
            event_id,
            transaction_type: 'purchase',
            credits: creditCount,
            stripe_payment_intent_id: session.payment_intent
          });

        if (ledgerError) {
          if (ledgerError.code === '23505' || (ledgerError.message || '').includes('duplicate key')) {
            console.log(`[Webhook] Duplicate SMS ledger insert caught for payment intent: ${session.payment_intent}`);
            return new Response(JSON.stringify({ received: true, message: 'Already processed' }), {
              headers: responseHeaders,
              status: 200
            })
          }
          throw ledgerError;
        }

        // 2. Now that the ledger row is committed, atomically credit the wallet.
        const { error: rpcError } = await supabase.rpc('increment_sms_credits', {
          p_event_id: event_id,
          p_credit_amount: creditCount
        });
        if (rpcError) throw rpcError;
      }
    } else if (event.type === 'charge.refunded') {
      const charge = event.data.object
      const paymentIntentId = charge.payment_intent

      if (!paymentIntentId) {
        console.error('charge.refunded event received but missing payment_intent.');
        return new Response(JSON.stringify({ error: 'Missing payment_intent' }), { 
          status: 400,
          headers: responseHeaders
        })
      }

      console.log(`[Webhook] Processing refund for Payment Intent: ${paymentIntentId}`);

      // 1. Check if there's a matching event payment
      const { data: payment, error: paymentQueryError } = await supabase
        .from('event_payments')
        .select('id, event_id')
        .eq('stripe_payment_intent_id', paymentIntentId)
        .maybeSingle();

      if (paymentQueryError) throw paymentQueryError;

      if (payment) {
        // Mark payment as refunded
        const { error: updatePaymentError } = await supabase
          .from('event_payments')
          .update({ status: 'refunded' })
          .eq('id', payment.id);

        if (updatePaymentError) throw updatePaymentError;

        // Revert is_paid to false and pause the event status
        const { error: updateEventError } = await supabase
          .from('events')
          .update({ is_paid: false, status: 'paused', updated_at: new Date().toISOString() })
          .eq('id', payment.event_id);

        if (updateEventError) throw updateEventError;

        console.log(`[Webhook] Successfully refunded and paused Event ID: ${payment.event_id}`);
      } else {
        // 2. Check if there's a matching SMS credit ledger purchase entry
        const { data: ledgerEntry, error: ledgerQueryError } = await supabase
          .from('sms_credit_ledger')
          .select('id, wallet_id, event_id, credits')
          .eq('stripe_payment_intent_id', paymentIntentId)
          .eq('transaction_type', 'purchase')
          .maybeSingle();

        if (ledgerQueryError) throw ledgerQueryError;

        if (ledgerEntry) {
          const refundCredits = Math.abs(ledgerEntry.credits);

          // Get current wallet details
          const { data: wallet, error: walletQueryError } = await supabase
            .from('sms_credit_wallets')
            .select('id, credits_purchased')
            .eq('id', ledgerEntry.wallet_id)
            .single();

          if (walletQueryError) throw walletQueryError;

          // Deduct credits from wallet
          const { error: updateWalletError } = await supabase
            .from('sms_credit_wallets')
            .update({
              credits_purchased: Math.max(0, (wallet.credits_purchased || 0) - refundCredits),
              updated_at: new Date().toISOString()
            })
            .eq('id', wallet.id);

          if (updateWalletError) throw updateWalletError;

          // Record SMS refund transaction record in ledger
          const { error: refundLedgerError } = await supabase
            .from('sms_credit_ledger')
            .insert({
              wallet_id: wallet.id,
              event_id: ledgerEntry.event_id,
              transaction_type: 'refund',
              credits: -refundCredits,
              stripe_payment_intent_id: paymentIntentId
            });

          if (refundLedgerError) throw refundLedgerError;

          console.log(`[Webhook] Successfully processed SMS refund of ${refundCredits} credits for Event ID: ${ledgerEntry.event_id}`);
        } else {
          console.warn(`[Webhook] No matching event payment or SMS purchase found for Payment Intent ID: ${paymentIntentId}`);
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: responseHeaders,
      status: 200
    })

  } catch (err) {
    console.error(`Unhandled webhook execution exception: ${err.message}`);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: responseHeaders,
      status: 500,
    })
  }
})
