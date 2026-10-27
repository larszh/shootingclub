#!/usr/bin/env bash
# Deploy/Update auf CloudPanel. Als Site-Benutzer im Projektordner ausführen:
#   bash scripts/deploy.sh                 # aktuellen Branch aktualisieren
#   DEPLOY_BRANCH=main bash scripts/deploy.sh
# Wird auch von GitHub Actions per SSH aufgerufen (.github/workflows/deploy.yml).
set -euo pipefail
cd "$(dirname "$0")/.."

# Nicht-interaktive SSH-Sitzungen laden ~/.bashrc oft nicht: Node aus nvm explizit laden.
if ! command -v node > /dev/null 2>&1; then
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  # shellcheck disable=SC1091
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
fi
command -v node > /dev/null 2>&1 || { echo "Node.js nicht gefunden (nvm?)." >&2; exit 1; }

if [ ! -f .env ]; then
  echo "Keine .env gefunden. Bitte .env.example kopieren und ausfüllen oder per GitHub Actions schreiben lassen." >&2
  exit 1
fi

BRANCH="${DEPLOY_BRANCH:-$(git rev-parse --abbrev-ref HEAD)}"
echo "→ Code aktualisieren ($BRANCH)"
git fetch --prune origin "$BRANCH"
# Server ist reines Deploy-Ziel: lokale Änderungen an versionierten Dateien werden verworfen.
# .env, storage/uploads und node_modules sind nicht versioniert und bleiben erhalten.
git checkout -B "$BRANCH" "origin/$BRANCH"
git reset --hard "origin/$BRANCH"
echo "  Stand: $(git log -1 --format='%h %s')"

echo "→ Abhängigkeiten installieren"
npm ci --no-audit --no-fund

echo "→ Prisma Client generieren und Migrationen einspielen"
npx prisma generate
npx prisma migrate deploy

echo "→ Build"
npm run build

echo "→ Neustart"
PM2="npx --yes pm2"
if $PM2 describe standchef > /dev/null 2>&1; then
  $PM2 reload ecosystem.config.cjs --update-env
else
  $PM2 start ecosystem.config.cjs
fi
$PM2 save > /dev/null

echo "→ Healthcheck"
PORT_VALUE="$(grep -E '^PORT=' .env | tail -1 | cut -d= -f2 | tr -d '"' || true)"
PORT_VALUE="${PORT_VALUE:-3000}"
for i in $(seq 1 20); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORT_VALUE}/login" || true)"
  if [ "$code" = "200" ]; then echo "  OK (HTTP 200 auf Port ${PORT_VALUE})"; echo "Fertig."; exit 0; fi
  sleep 2
done
echo "Healthcheck fehlgeschlagen (letzter Status: ${code:-keiner}). Logs: npx pm2 logs standchef --lines 100" >&2
exit 1
