const logger = require('./logger');

/**
 * Fire-and-forget realtime broadcast over Supabase's REST broadcast endpoint.
 *
 * Why not supabase.channel(...).send(...)?
 * The JS client's channel().send() stands up a *websocket* realtime connection,
 * sends one message, then tears it down — on EVERY request. Under load that
 * socket churn dominates the latency of writes (RSVP submit, check-in, seating).
 *
 * The REST endpoint (`POST /realtime/v1/api/broadcast`) delivers the same message
 * to subscribers of the topic with a single stateless HTTP call and no socket
 * lifecycle. We never await it on the request's critical path and never throw —
 * a dropped broadcast must never fail the underlying write.
 *
 * @param {string} eventId  the event whose topic (`event-<id>`) to publish on
 * @param {string} event    the broadcast event name (e.g. 'rsvp_submitted')
 * @param {object} payload  the message body
 * @returns {Promise<void>} resolves regardless of delivery success
 */
async function broadcast(eventId, event, payload) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return; // not configured (e.g. tests) — silently skip

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000); // never hang a request
    const res = await fetch(`${url.replace(/\/$/, '')}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        messages: [{ topic: `event-${eventId}`, event, payload }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      logger.warn({ status: res.status, eventId, event }, 'realtime broadcast non-OK');
    }
  } catch (err) {
    // AbortError / network blip — broadcasts are best-effort.
    logger.warn({ err: err.message, eventId, event }, 'realtime broadcast failed');
  }
}

module.exports = { broadcast };
