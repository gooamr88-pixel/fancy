# Hostinger VPS Production Deployment Guide

This guide details the step-by-step process to deploy the **Fancy RSVP** platform on your Hostinger Linux VPS (Ubuntu server) with domain `fancyrsvp.com`.

---

## 🛠️ Step 1: Install Server Prerequisites

Connect to your Hostinger VPS via SSH and run the following commands to install Node.js, PM2, Nginx, and Certbot:

```bash
# 1. Update system package index
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js (Version 20 LTS recommended)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Verify installations
node -v  # Should show v20.x.x
npm -v   # Should show v10.x.x

# 4. Install PM2 globally (Process Manager)
sudo npm install pm2 -g

# 5. Install Nginx (Web Server)
sudo apt install nginx -y

# 6. Install Certbot for free SSL certificates (Let's Encrypt)
sudo apt install certbot python3-certbot-nginx -y
```

---

## 💾 Step 2: Set Up Production Supabase Database

1. Go to your **Supabase Dashboard** and create a new project.
2. **Do NOT run `schema.sql` directly** — the migrations contain the complete schema with hardened RLS policies.
3. Apply the migration files (found in `supabase/migrations/` folder) by copy-pasting their SQL code into the SQL Editor, in chronological order, to ensure the production schema is fully up to date:
   - `20260607000000_init_schema.sql`
   - `20260607100000_schema_completion.sql`
   - `20260607100001_rls_hardening.sql`
   - `20260607100002_qa_stress_test_fixes.sql`
   - `20260609000000_sms_ledger_idempotency.sql`
   - `20260610000000_auth_otp.sql`
   - `20260610100000_security_hardening.sql`
   - `20260610200000_performance_indexes.sql`
   - `20260610300000_cleanup_stored_functions.sql`
   - `20260611000000_rls_security_fix.sql`
   - `20260611000001_missing_rpc_functions.sql`
   - `20260611100000_search_path_hardening.sql`
   - `20260611200000_audit_fixes.sql`
   - `20260611300000_registration_otp.sql`
   - `20260612_add_template_data.sql`

---

## 📂 Step 3: Deploy Project Files & Environment Configurations

1. Copy or clone your repository to the server, for example in `/var/www/fancy-rsvp`.
2. Configure your Express backend environment variables:
   - Create the file `/var/www/fancy-rsvp/backend/.env`:
     ```env
     PORT=5000
     NODE_ENV=production
     FRONTEND_URL=https://fancyrsvp.com
     JWT_SECRET=your_strong_jwt_signing_key_here
     QR_JWT_SECRET=your_strong_qr_signing_key_here

     # Remote Supabase Credentials
     SUPABASE_URL=https://your-supabase-project.supabase.co
     SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

     # Stripe Credentials (Live or Test)
     STRIPE_SECRET_KEY=sk_live_...
     STRIPE_WEBHOOK_SECRET=whsec_...

     # Twilio Credentials (SMS)
     TWILIO_ACCOUNT_SID=AC...
     TWILIO_AUTH_TOKEN=...
     TWILIO_PHONE_NUMBER=...

     # Email Credentials (Brevo)
     BREVO_API_KEY=xkeysib-...
     BREVO_FROM_EMAIL=noreply@fancyrsvp.com
     BREVO_FROM_NAME="Fancy RSVP"
     ```
3. Configure your Next.js frontend environment variables:
   - Create the file `/var/www/fancy-rsvp/frontend/.env.production`:
     ```env
     NEXT_PUBLIC_API_URL=https://fancyrsvp.com/api/v1
     ```

---

## 🏗️ Step 4: Install Dependencies & Build Frontend

From the root project folder `/var/www/fancy-rsvp`, execute:

```bash
# 1. Install all backend and frontend node modules
npm install

# 2. Build the Next.js optimized production package
npm run build --workspace=frontend
```

---

## 🚀 Step 5: Start Applications with PM2 Process Manager

Use the root `ecosystem.config.js` to spawn and manage frontend and backend processes daemonized in the background:

```bash
# 1. Start both servers
pm2 start ecosystem.config.js

# 2. Verify both processes are online
pm2 status

# 3. Set up PM2 to automatically restart processes on server reboots
pm2 startup
# (Copy and paste the command output by PM2 startup to finalize system integration)

# 4. Save current PM2 configuration list
pm2 save
```

*To check logs in real-time, you can run:*
```bash
pm2 logs
```

---

## 🌐 Step 6: Configure Nginx & Let's Encrypt SSL

1. Create a server configuration file for Nginx:
   ```bash
   sudo nano /etc/nginx/sites-available/fancy-rsvp
   ```
2. Paste the configuration from the local file `deployment/nginx.conf` (replacing `fancyrsvp.com` with your active domain details). Save and exit.
3. Enable the configuration by symlinking:
   ```bash
   sudo ln -s /etc/nginx/sites-available/fancy-rsvp /etc/nginx/sites-enabled/
   ```
4. Test and reload Nginx:
   ```bash
   sudo nginx -t # Ensure configuration syntax is ok
   sudo systemctl restart nginx
   ```
5. Install SSL certificates via Certbot:
   ```bash
   sudo certbot --nginx -d fancyrsvp.com -d www.fancyrsvp.com
   ```
   *Certbot will automatically verify ownership, generate the SSL certificate, set up auto-renewal cron tasks, and modify your Nginx file to handle HTTP -> HTTPS redirects.*

---

## 🔒 Step 7: Configure Stripe Webhook Endpoint

Now that your production server is live on `https://fancyrsvp.com`, configure the Stripe Webhook:
1. Go to your **Stripe Dashboard** -> **Developers** -> **Webhooks**.
2. Click **Add endpoint** and enter:
   `https://fancyrsvp.com/api/v1/payments/webhook`
3. Listen for events: `checkout.session.completed`, `payment_intent.succeeded`, and `charge.refunded`.
4. Copy the webhook secret (`whsec_...`) and update the `STRIPE_WEBHOOK_SECRET` variable in `/var/www/fancy-rsvp/backend/.env`.
5. Restart your backend PM2 process to apply the new secret:
   ```bash
   pm2 restart fancy-rsvp-backend
   ```
