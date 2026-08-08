# Choosing and setting up an SMS carrier

Fancy RSVP can send through **Twilio** or **Vonage**. One environment variable
decides which. Everything above the transport — guest consent, STOP suppression,
the seven message types, message balances, refunds when a message fails — is
identical either way, so switching carrier is a config change and a restart, not
a migration.

```bash
SMS_PROVIDER=twilio     # or: vonage
```

Leave it unset and you get Twilio, which is the behaviour that predates Vonage.

---

## Which one am I on?

**Admin → System Health** reports whether SMS is configured, and the API logs the
active carrier at boot. If the carrier you selected is missing a credential, SMS
reports as **disabled** rather than half-working — a partly-configured account can
never silently accept sends it cannot deliver.

---

# Vonage setup

Fancy uses Vonage's **SMS API**. That means two credentials and nothing else — no
Application, no JWT, and no private key stored on the server.

### 1. Confirm the number can send SMS

Dashboard → **Numbers → Your numbers**. The number must list the **SMS**
capability. A voice-only number will accept configuration and never deliver.

### 2. Copy the API key and secret

Dashboard home, or **Settings → API settings**.

```bash
VONAGE_API_KEY=abcd1234
VONAGE_API_SECRET=••••••••
VONAGE_FROM=+1XXXXXXXXXX      # the number from step 1
```

`VONAGE_FROM` is written in full `+E.164` here; the leading `+` is stripped
automatically when sending, because Vonage wants bare digits.

### 3. Point both webhooks at Fancy

**Settings → SMS**. Both must be **POST**:

| Webhook | URL |
|---|---|
| Inbound messages | `https://fancyrsvp.com/api/v1/public/sms/inbound` |
| Delivery receipts | `https://fancyrsvp.com/api/v1/public/sms/status` |

The inbound one is what records **STOP**. Without it, opt-outs are never captured
— which is a compliance failure, not a missing feature.

### 4. Turn on signed webhooks — this one is not optional

**Settings → SMS → signed webhooks.** Copy the **signature secret** and set the
hash to match your config:

```bash
VONAGE_SIGNATURE_SECRET=••••••••
VONAGE_SIGNATURE_METHOD=sha256    # md5hash | md5 | sha1 | sha256 | sha512
```

> **Why this is required.** The delivery-receipt endpoint triggers **automatic
> refunds**: a receipt saying "failed" credits the event's balance back. Left
> unsigned, anyone who learns the URL can POST forged failures and mint messages
> for free. That is a financial hole, so Fancy **refuses every delivery receipt**
> until the secret is set.
>
> Inbound STOP behaves the opposite way on purpose — it is accepted unsigned, with
> a warning in the logs. A forged inbound can only *suppress* a number, and
> recording an unwanted opt-out is a nuisance while dropping a genuine STOP is a
> TCPA violation. So receipts **fail closed** and STOP **fails safe**.

### 5. Decide who answers HELP

STOP needs nothing from you: on US toll-free it is enforced by the networks, and the
carrier sends its own confirmation. Fancy records the opt-out and stays silent, on
both carriers.

**HELP is the open question.** Vonage's keyword service (*Opt-Out Assist*) is
documented for 10DLC and short codes, is opt-in, and does not list toll-free. Fancy
therefore answers HELP itself on Vonage:

```
Fancy RSVP: help with event texts? Email info@fancyrsvp.com.
Msg&data rates may apply. Reply STOP to opt out.
```

Ask Vonage whether your toll-free number answers HELP automatically. **If it does**,
set `VONAGE_CARRIER_HELP=true` so guests do not get two replies. If you are unsure,
leave it unset — one duplicate message is a nuisance, an unanswered HELP is a
compliance failure.

This reply is never billed to the organizer and is sent even on a zero balance.

### 6. Keep the account on the SMS API

**Settings → API settings → default SMS setting** must stay on the **SMS API**,
not the Messages API. Switched to Messages, inbound arrives in a completely
different JSON shape and the parser will not recognise it.

### 7. Switch over

```bash
SMS_ENABLED=true
SMS_PROVIDER=vonage
```

Restart, then confirm **Admin → System Health** shows SMS configured **and names
vonage**. The API also logs the live carrier at boot:

```
📱 SMS carrier: vonage (configured)
```

Leave the Twilio variables in place. They are what keeps Twilio's late delivery
reports and STOP replies verifiable after the switch, and they make rolling back
a one-line change.

---

# Twilio setup

Unchanged. See `.env.example`; the relevant variables are
`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, plus
`SMS_STATUS_CALLBACK_URL` and `SMS_INBOUND_WEBHOOK_URL`, which must be set
explicitly — behind nginx the auto-derived URL is `http://` and Twilio's signature
check will fail against it.

---

## What differs between the two

Both carriers are equal above the transport. These are the real differences, and
Fancy already accounts for all of them:

| | Twilio | Vonage |
|---|---|---|
| Arabic messages | detected automatically | **must be flagged** — Fancy derives the flag from the same check that bills the message, so the two can never disagree |
| A rejected send | raises an error | returns HTTP **200** with the refusal inside — Fancy inspects every entry, so a refused message is never billed as sent |
| Long messages | one id | **one id per part**, and one delivery receipt per part. Correlation rides on our own reference, and repeat receipts are harmless no-ops |
| Cost reporting | not reported at send | **reports the real price**, so the admin profit screen is measured rather than estimated on Vonage |
| Webhook signing | always on | **opt-in** — see step 4 |
| WhatsApp organizer alert | supported | **not available** — see below |

### The one thing that does not move with the switch

The organizer's optional *"new RSVP"* **WhatsApp** notification is a Twilio
product and is not part of the SMS provider abstraction. It keeps reading
`TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_WHATSAPP_FROM` no matter what
`SMS_PROVIDER` says. So on a Vonage-only account, organizers whose notification
preference is WhatsApp silently get nothing (it is logged as skipped, and no guest
messaging is affected). If you are running Vonage without Twilio credentials at
all, steer organizers to the email or SMS preference instead.

---

## After going live, check these four things

1. **Send one message** to a guest who has consented → the message log shows
   *Delivered*, and the balance drops by the right number.
2. **Reply STOP** from that handset → `sms_opt_outs` gains the number, and a
   second send to them is skipped with *"They replied STOP"*.
3. **Send to an invalid number** → the message shows as not delivered and the
   balance is **refunded** automatically. If it is not, the signature secret is
   almost certainly missing (step 4).
4. **Send one Arabic message** → it arrives readable, not as question marks.

## If something is wrong

| Symptom | Cause |
|---|---|
| Nothing sends, logs say transport unavailable | A credential for the **selected** carrier is missing. Nothing is charged in this state. |
| Messages send but failures never refund | Delivery receipts are being refused — set `VONAGE_SIGNATURE_SECRET`, or the hash does not match `VONAGE_SIGNATURE_METHOD`. |
| STOP replies are ignored | The inbound webhook is not configured, or is set to GET instead of POST. |
| Arabic arrives as `???` | The account was switched to the Messages API (step 5), so the parser is reading a shape it does not know. |
| Inbound arrives in an unexpected shape | Same cause as above. |

Full system reference: [`SMS-System-Reference.md`](./SMS-System-Reference.md).
