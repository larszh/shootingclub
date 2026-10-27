#!/usr/bin/env bash
# Deploy/Update auf CloudPanel. Als Site-Benutzer im Projektordner ausführen:
#   bash scripts/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "Keine .env gefunden. Bitte .env.example kopieren und ausfüllen." >&2
  exit 1
fi

echo "→ Code aktualisieren"
git pull --ff-only

echo "→ Abhängigkeiten installieren"
npm ci --no-audit --no-fund

echo "→ Prisma Client generieren und Migrationen einspielen"
npx prisma generate
npx prisma migrate deploy

echo "→ Build"
npm run build

echo "→ Neustart"
PM2="npx pm2"
if $PM2 describe standchef > /dev/null 2>&1; then
  $PM2 reload ecosystem.config.cjs --update-env
else
  $PM2 start ecosystem.config.cjs
  $PM2 save
fi
echo "Fertig."
