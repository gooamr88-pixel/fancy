#!/bin/bash
# Redeploy script — run this on the production server after every `git pull`.
#
# WHY THIS EXISTS: the frontend runs via `next start` (ecosystem.config.js),
# which serves a pre-compiled `.next/` build — it does NOT compile source on
# the fly. `pm2 restart` only restarts the Node process against whatever
# `.next/` already exists; it does not rebuild it. So `git pull` followed
# directly by `pm2 restart` (skipping `npm run build`) silently keeps serving
# the OLD frontend code forever, no matter how many times you redeploy — the
# backend (plain `node server.js`, no build step) is unaffected by this and
# updates correctly with just a restart, which is what made this easy to miss.
#
# Usage: run from the project root (e.g. /var/www/fancy-rsvp)
#   ./deployment/redeploy.sh

set -e

echo "→ Pulling latest code..."
git pull

echo "→ Installing dependencies..."
npm install

# STALE-TAB SAFETY: `next build` writes a new buildId and replaces .next/static,
# so every chunk filename changes. Any client still holding the PREVIOUS document
# — an open tab, a bfcache entry, an in-app browser (WhatsApp/Gmail) resurrecting
# a backgrounded page — then requests chunks that no longer exist and silently
# fails to hydrate: the guest sees a page that never finishes loading. nginx
# caches /_next/static as `immutable` for a year, which makes those requests
# especially likely to be re-issued. Keeping ONE generation of old chunks on disk
# costs a few MB and makes a redeploy invisible to anyone mid-session.
echo "→ Preserving the previous build's static chunks (stale-tab safety)..."
rm -rf frontend/.next-prev-static
if [ -d frontend/.next/static ]; then
  cp -r frontend/.next/static frontend/.next-prev-static
fi

echo "→ Building frontend (required — see comment above)..."
npm run build --workspace=frontend

if [ -d frontend/.next-prev-static ]; then
  echo "→ Restoring previous-generation chunks alongside the new build..."
  # -n: never overwrite anything the new build produced.
  cp -rn frontend/.next-prev-static/. frontend/.next/static/ || true
  rm -rf frontend/.next-prev-static
fi

echo "→ Restarting both processes..."
pm2 restart ecosystem.config.js

echo "→ Done. Verify with: pm2 status && pm2 logs --lines 30"
