#!/usr/bin/env bash
# Builds and (re)starts vps-monitor under pm2. Run as the deploy user
# (the same user that owns your other pm2 apps) — not root.
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "Missing .env — copy .env.example to .env and fill it in first." >&2
  exit 1
fi

mkdir -p logs

echo "Installing dependencies..."
npm ci

echo "Building..."
npm run build

if pm2 describe vps-monitor &>/dev/null; then
  echo "Reloading existing pm2 process..."
  pm2 reload ecosystem.config.js
else
  echo "Starting new pm2 process..."
  pm2 start ecosystem.config.js
fi

pm2 save

echo "Done. Check status with: pm2 status vps-monitor"
