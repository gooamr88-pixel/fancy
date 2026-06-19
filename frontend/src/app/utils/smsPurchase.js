/**
 * Shared SMS-credit purchase initiator.
 *
 * Used by BOTH the create-event wizard and the campaigns page so the two SMS
 * top-up entry points behave identically:
 *   • A checkout tab is opened synchronously (before any await) so popup blockers
 *     don't kill it, and the initiating page is preserved (the wizard keeps its
 *     in-memory state; the campaigns composer keeps the user's draft).
 *   • Stripe returns the user to /dashboard/campaigns?purchase=success&session_id=…
 *     where the purchase is verified and the wallet refreshed (see campaigns page).
 *
 * Resolves to { ok: true } on success. Throws on failure with a user-facing
 * message; the opened tab is closed so the user isn't left on a blank page.
 */
export async function startSmsCreditPurchase({ apiUrl, eventId, creditCount }) {
  if (!eventId) throw new Error('No event selected for this purchase.');
  const count = parseInt(creditCount, 10);
  if (!Number.isInteger(count) || count < 50) throw new Error('Minimum purchase is 50 credits.');

  const tab = typeof window !== 'undefined' ? window.open('', '_blank') : null;
  try {
    const res = await fetch(`${apiUrl}/payments/events/${eventId}/sms-credits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ creditCount: count }),
    });
    const data = await res.json();
    if (!res.ok || !data.checkoutUrl) throw new Error(data.message || 'Could not start credit purchase.');
    if (tab) tab.location.href = data.checkoutUrl;
    else window.open(data.checkoutUrl, '_blank');
    return { ok: true };
  } catch (err) {
    if (tab) { try { tab.close(); } catch { /* already closed */ } }
    throw err;
  }
}
