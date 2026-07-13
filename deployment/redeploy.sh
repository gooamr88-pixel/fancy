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

echo "→ Building frontend (required — see comment above)..."
npm run build --workspace=frontend

echo "→ Restarting both processes..."
pm2 restart ecosystem.config.js

echo "→ Done. Verify with: pm2 status && pm2 logs --lines 30"
