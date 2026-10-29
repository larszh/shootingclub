#!/usr/bin/env bash
# Deploy/Update auf CloudPanel. Als Site-Benutzer im Projektordner ausführen:
#   bash scripts/deploy.sh                 # aktuellen Branch aktualisieren
#   DEPLOY_BRANCH=main bash scripts/deploy.sh
# Wird auch von GitHub Actions per SSH aufgerufen (.github/workflows/deploy.yml).
#
# Ablauf: Code holen → npm ci → Prisma Client → Build (ohne DB, scheitert früh) →
#         DB-Backup → Migrationen → Presets → PM2 reload → Healthcheck.
#
# Einstellungen (Umgebungsvariablen):
#   BACKUP_DIR       Ablage der DB-Backups (Standard: $HOME/backups/standchef)
#   BACKUP_KEEP      Anzahl aufbewahrter Backups (Standard: 14)
#   ALLOW_NO_BACKUP  1 = ohne mysqldump/mariadb-dump weitermachen (nur mit Warnung)
set -euo pipefail
cd "$(dirname "$0")/.."
APP_DIR="$(pwd)"

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

# BACKUP_DIR, BACKUP_KEEP und ALLOW_NO_BACKUP dürfen auch in .env stehen (Shell-Umgebung hat Vorrang).
env_from_file() {
  node -e 'try { require("dotenv").config({ path: ".env", quiet: true }); } catch {} process.stdout.write(process.env[process.argv[1]] || "")' "$1" 2> /dev/null || true
}
[ -n "${BACKUP_DIR:-}" ] || BACKUP_DIR="$(env_from_file BACKUP_DIR)"
[ -n "${BACKUP_KEEP:-}" ] || BACKUP_KEEP="$(env_from_file BACKUP_KEEP)"
[ -n "${ALLOW_NO_BACKUP:-}" ] || ALLOW_NO_BACKUP="$(env_from_file ALLOW_NO_BACKUP)"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/standchef}"
BACKUP_KEEP="${BACKUP_KEEP:-14}"
case "$BACKUP_KEEP" in ''|*[!0-9]*) echo "BACKUP_KEEP muss eine Zahl sein." >&2; exit 1 ;; esac
[ "$BACKUP_KEEP" -ge 1 ] || BACKUP_KEEP=1
BACKUP_FILE=""
TARGET=""
DB_HOST="" DB_PORT="" DB_USER="" DB_NAME=""

# Bei einem Fehler nach dem Backup: Wiederherstellungsbefehl anzeigen.
on_error() {
  local code=$?
  echo "" >&2
  echo "✗ Deploy abgebrochen (Exit $code)." >&2
  [ -n "${TARGET:-}" ] && rm -f "$TARGET.part"
  if [ -n "$BACKUP_FILE" ] && [ -f "$BACKUP_FILE" ]; then
    echo "  Datenbank-Backup vor den Migrationen: $BACKUP_FILE" >&2
    echo "  Wiederherstellen (Passwort wird abgefragt):" >&2
    echo "    gunzip -c '$BACKUP_FILE' | mysql -h '$DB_HOST' -P '$DB_PORT' -u '$DB_USER' -p '$DB_NAME'" >&2
  fi
  echo "  Logs: npx pm2 logs standchef --lines 100" >&2
  exit "$code"
}
trap on_error ERR

BRANCH="${DEPLOY_BRANCH:-$(git rev-parse --abbrev-ref HEAD)}"
echo "→ Code aktualisieren ($BRANCH)"
git fetch --prune origin "$BRANCH"
# Server ist reines Deploy-Ziel: lokale Änderungen an versionierten Dateien werden verworfen.
# .env, storage/uploads und node_modules sind nicht versioniert und bleiben erhalten.
git checkout -B "$BRANCH" "origin/$BRANCH"
git reset --hard "origin/$BRANCH"
COMMIT="$(git rev-parse --short HEAD)"
echo "  Stand: $(git log -1 --format='%h %s')"

echo "→ Abhängigkeiten installieren"
npm ci --no-audit --no-fund

echo "→ Prisma Client generieren"
npx prisma generate

# Zuerst bauen: ein fehlerhafter Stand bricht hier ab, bevor die Datenbank verändert wird.
# Die laufende Instanz wird erst nach erfolgreichem Build und Migration neu geladen.
echo "→ Build"
npm run build

echo "→ Datenbank-Backup"
# DATABASE_URL (mysql://benutzer:passwort@host:port/datenbank) aus .env lesen und zerlegen.
DB_FIELDS="$(node -e '
  require("dotenv").config({ path: ".env", quiet: true });
  const raw = process.env.DATABASE_URL;
  if (!raw) { console.error("DATABASE_URL fehlt in .env"); process.exit(1); }
  const u = new URL(raw);
  const out = [u.hostname || "127.0.0.1", u.port || "3306", decodeURIComponent(u.username), decodeURIComponent(u.password), u.pathname.replace(/^\//, "")];
  if (out.some((v) => v.includes("\n"))) { console.error("Ungültige DATABASE_URL"); process.exit(1); }
  process.stdout.write(out.join("\n"));
')"
{ IFS= read -r DB_HOST; IFS= read -r DB_PORT; IFS= read -r DB_USER; IFS= read -r DB_PASS; IFS= read -r DB_NAME; } <<< "$DB_FIELDS" || true
unset DB_FIELDS
[ -n "$DB_NAME" ] || { echo "Datenbankname fehlt in DATABASE_URL." >&2; exit 1; }

DUMP_BIN=""
for bin in mariadb-dump mysqldump; do
  if command -v "$bin" > /dev/null 2>&1; then DUMP_BIN="$bin"; break; fi
done

if [ -z "$DUMP_BIN" ]; then
  if [ "${ALLOW_NO_BACKUP:-0}" = "1" ]; then
    echo "  ⚠ mysqldump/mariadb-dump nicht gefunden – Migrationen OHNE Backup (ALLOW_NO_BACKUP=1)." >&2
  else
    echo "mysqldump/mariadb-dump nicht gefunden. Ohne Backup werden keine Migrationen eingespielt." >&2
    echo "Installieren (z.B. apt install mariadb-client) oder bewusst mit ALLOW_NO_BACKUP=1 deployen." >&2
    exit 1
  fi
else
  umask 077
  mkdir -p "$BACKUP_DIR"
  chmod 700 "$BACKUP_DIR"
  STAMP="$(date +%Y%m%d-%H%M%S)"
  TARGET="$BACKUP_DIR/standchef-${DB_NAME}-${STAMP}-${COMMIT}.sql.gz"
  # Passwort nur über die Umgebung (MYSQL_PWD), nie auf der Kommandozeile (sichtbar in ps).
  MYSQL_PWD="$DB_PASS" "$DUMP_BIN" \
    --single-transaction --quick --routines --no-tablespaces \
    -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "$DB_NAME" | gzip -6 > "$TARGET.part"
  if ! gzip -t "$TARGET.part" || [ "$(gzip -cd "$TARGET.part" | head -c 1 | wc -c)" -eq 0 ]; then
    rm -f "$TARGET.part"
    echo "Backup ist leer oder beschädigt – Abbruch vor den Migrationen." >&2
    exit 1
  fi
  mv "$TARGET.part" "$TARGET"
  BACKUP_FILE="$TARGET"
  echo "  $(du -h "$BACKUP_FILE" | cut -f1)  $BACKUP_FILE"
  # Nur die neuesten BACKUP_KEEP Backups behalten.
  mapfile -t OLD < <(ls -1t "$BACKUP_DIR"/standchef-*.sql.gz 2> /dev/null | tail -n +"$((BACKUP_KEEP + 1))")
  if [ "${#OLD[@]}" -gt 0 ]; then
    rm -f -- "${OLD[@]}"
    echo "  ${#OLD[@]} ältere(s) Backup(s) entfernt (behalte $BACKUP_KEEP)."
  fi
  umask 022
fi
unset DB_PASS

echo "→ Migrationen einspielen"
npx prisma migrate deploy

echo "→ Neue globale Programme und Scheiben ergänzen"
npx tsx prisma/seed.ts --presets-only

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
BASE="http://127.0.0.1:${PORT_VALUE}"
code="" body=""
for _ in $(seq 1 30); do
  body="$(curl -s --max-time 5 -w '\n%{http_code}' "$BASE/api/health" || true)"
  code="$(printf '%s' "$body" | tail -n 1)"
  if [ "$code" = "200" ] && printf '%s' "$body" | grep -q '"ok":true'; then
    echo "  OK (/api/health, Port ${PORT_VALUE})"
    trap - ERR
    echo "Fertig ($COMMIT)."
    exit 0
  fi
  if [ "$code" = "404" ]; then
    # Älterer Stand ohne /api/health: Login-Seite prüfen.
    code="$(curl -s --max-time 5 -o /dev/null -w '%{http_code}' "$BASE/login" || true)"
    if [ "$code" = "200" ]; then
      echo "  OK (/login, Port ${PORT_VALUE})"
      trap - ERR
      echo "Fertig ($COMMIT)."
      exit 0
    fi
  fi
  sleep 2
done
echo "Healthcheck fehlgeschlagen (letzter Status: ${code:-keiner})." >&2
false
