#!/usr/bin/env bash
# Deploy/Update auf CloudPanel. Als Site-Benutzer im Projektordner ausführen:
#   bash scripts/deploy.sh                 # aktuellen Branch aktualisieren
#   DEPLOY_BRANCH=main bash scripts/deploy.sh
#   DEPLOY_BRANCH=main DEPLOY_SHA=<commit> bash scripts/deploy.sh   # genau diesen (geprüften) Commit
# Wird auch von GitHub Actions per SSH aufgerufen (.github/workflows/deploy.yml, mit DEPLOY_SHA).
#
# Ablauf: Code in ein separates Release-Verzeichnis holen → npm ci → Prisma Client → Build
#         (ohne DB) → DB-Backup → Migrationen → Presets → Umschalten (Code, .next, node_modules)
#         → PM2 reload → Healthcheck.
# Die laufende Instanz bleibt bis zum Umschalten unangetastet: npm ci und Build laufen im
# Release-Verzeichnis, nicht unter dem laufenden Prozess. Schlägt Reload oder Healthcheck fehl,
# wird automatisch auf den vorherigen Stand (Code, .next, node_modules) zurückgeschaltet.
#
# Einstellungen (Umgebungsvariablen):
#   BACKUP_DIR       Ablage der DB-Backups (Standard: $HOME/backups/standchef)
#   BACKUP_KEEP      Anzahl aufbewahrter Backups (Standard: 14)
#   ALLOW_NO_BACKUP  1 = ohne mysqldump/mariadb-dump weitermachen (nur mit Warnung)
#   RELEASE_DIR      Build-Verzeichnis (Standard: .<projektordner>-release neben dem Projektordner,
#                    gleiches Dateisystem, damit das Umschalten ein schnelles mv ist)
#   DEPLOY_SHA       optional: genau diesen Commit deployen (muss auf origin/<branch> liegen)
# Das ganze Script steht in einem { … }-Block: Bash liest es so vollständig ein, bevor es läuft.
# Sonst würde das Umschalten (git reset auf einen Stand mit geänderter deploy.sh) mitten im Lauf
# den Rest des Scripts austauschen.
{
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

# BACKUP_DIR, BACKUP_KEEP, ALLOW_NO_BACKUP und RELEASE_DIR dürfen auch in .env stehen (Shell-Umgebung hat Vorrang).
env_from_file() {
  node -e 'try { require("dotenv").config({ path: ".env", quiet: true }); } catch {} process.stdout.write(process.env[process.argv[1]] || "")' "$1" 2> /dev/null || true
}
[ -n "${BACKUP_DIR:-}" ] || BACKUP_DIR="$(env_from_file BACKUP_DIR)"
[ -n "${BACKUP_KEEP:-}" ] || BACKUP_KEEP="$(env_from_file BACKUP_KEEP)"
[ -n "${ALLOW_NO_BACKUP:-}" ] || ALLOW_NO_BACKUP="$(env_from_file ALLOW_NO_BACKUP)"
[ -n "${RELEASE_DIR:-}" ] || RELEASE_DIR="$(env_from_file RELEASE_DIR)"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/standchef}"
BACKUP_KEEP="${BACKUP_KEEP:-14}"
case "$BACKUP_KEEP" in ''|*[!0-9]*) echo "BACKUP_KEEP muss eine Zahl sein." >&2; exit 1 ;; esac
[ "$BACKUP_KEEP" -ge 1 ] || BACKUP_KEEP=1
BACKUP_FILE=""
TARGET=""
DB_HOST="" DB_PORT="" DB_USER="" DB_NAME=""
PREV_COMMIT=""
SWITCHED=0
HAD_PREV_BUILD=0
RELEASE_DIR="${RELEASE_DIR:-$(dirname "$APP_DIR")/.$(basename "$APP_DIR")-release}"
# Schutz: das Release-Verzeichnis wird vor jedem Deploy gelöscht.
case "$RELEASE_DIR" in /?*) ;; *) echo "RELEASE_DIR muss ein absoluter Pfad sein." >&2; exit 1 ;; esac
case "$APP_DIR/" in "${RELEASE_DIR%/}/"*) echo "RELEASE_DIR darf nicht der Projektordner oder ein übergeordneter Ordner sein." >&2; exit 1 ;; esac
case "${RELEASE_DIR%/}/" in "$APP_DIR/"*) echo "RELEASE_DIR darf nicht im Projektordner liegen." >&2; exit 1 ;; esac
PM2="npx --yes pm2"

pm2_reload() {
  if $PM2 describe standchef > /dev/null 2>&1; then
    $PM2 reload ecosystem.config.cjs --update-env
  else
    $PM2 start ecosystem.config.cjs
  fi
  $PM2 save > /dev/null
}

# Nach dem Umschalten: vorherigen Stand (Code, .next, node_modules, Prisma Client) wiederherstellen.
# Funktioniert auch, wenn das Umschalten mittendrin abgebrochen ist.
rollback_code() {
  local d
  [ -n "$PREV_COMMIT" ] && [ "$HAD_PREV_BUILD" = "1" ] || {
    echo "  Kein vorheriger Build vorhanden – kein automatisches Zurückschalten." >&2
    return 1
  }
  echo "  → Schalte zurück auf $PREV_COMMIT" >&2
  cd "$APP_DIR" || return 1
  git checkout -q -f -B "$BRANCH" "$PREV_COMMIT" && git reset -q --hard "$PREV_COMMIT" || return 1
  for d in .next node_modules src/generated; do
    [ -d "$d.prev" ] || continue
    rm -rf "$d.failed"
    { [ ! -e "$d" ] || mv "$d" "$d.failed"; } && mv "$d.prev" "$d" || return 1
  done
  pm2_reload || return 1
  echo "  Vorheriger Stand läuft wieder ($PREV_COMMIT); die Datenbank bleibt auf dem migrierten Stand." >&2
}

on_error() {
  local code=$?
  trap - ERR
  set +e
  echo "" >&2
  echo "✗ Deploy abgebrochen (Exit $code)." >&2
  [ -n "${TARGET:-}" ] && rm -f "$TARGET.part"
  if [ "$SWITCHED" = "1" ]; then
    rollback_code || echo "  ⚠ Zurückschalten fehlgeschlagen. Von Hand: git reset --hard $PREV_COMMIT, .next.prev/node_modules.prev zurückbenennen, npx pm2 reload standchef" >&2
  else
    echo "  Die laufende Instanz wurde nicht verändert (Code-Stand ${PREV_COMMIT:-unbekannt})." >&2
  fi
  if [ -n "$BACKUP_FILE" ] && [ -f "$BACKUP_FILE" ]; then
    echo "  Die Migrationen wurden evtl. (teilweise) eingespielt. Datenbank-Backup davor: $BACKUP_FILE" >&2
    echo "  Passt zum Code-Stand $PREV_COMMIT. Wiederherstellen siehe docs/DEPLOY-CLOUDPANEL.md" >&2
    echo "  («Backups und Wiederherstellung»: Datenbank leeren, dann einspielen):" >&2
    echo "    gunzip -c '$BACKUP_FILE' | mysql -h '$DB_HOST' -P '$DB_PORT' -u '$DB_USER' -p '$DB_NAME'" >&2
  fi
  echo "  Logs: npx pm2 logs standchef --lines 100" >&2
  exit "$code"
}
trap on_error ERR

BRANCH="${DEPLOY_BRANCH:-$(git rev-parse --abbrev-ref HEAD)}"
# Stand der laufenden Instanz: passt zum DB-Backup vor den Migrationen.
PREV_COMMIT="$(git rev-parse --short HEAD)"
echo "→ Code holen ($BRANCH)"
git fetch --prune origin "$BRANCH"
if [ -n "${DEPLOY_SHA:-}" ]; then
  # Genau den in CI geprüften Commit deployen, nicht den (evtl. weitergewanderten) Branch-Kopf.
  case "$DEPLOY_SHA" in *[!0-9a-f]*) echo "DEPLOY_SHA ist kein Commit-Hash." >&2; exit 1 ;; esac
  git cat-file -e "${DEPLOY_SHA}^{commit}" 2> /dev/null || git fetch origin "$DEPLOY_SHA"
  if ! git merge-base --is-ancestor "$DEPLOY_SHA" "origin/$BRANCH"; then
    echo "Commit $DEPLOY_SHA liegt nicht auf origin/$BRANCH – Abbruch." >&2
    exit 1
  fi
  TARGET_SHA="$(git rev-parse "${DEPLOY_SHA}^{commit}")"
else
  TARGET_SHA="$(git rev-parse "origin/$BRANCH^{commit}")"
fi
COMMIT="$(git rev-parse --short "$TARGET_SHA")"
echo "  Stand: $(git log -1 --format='%h %s' "$TARGET_SHA") (bisher $PREV_COMMIT)"

echo "→ Release-Verzeichnis vorbereiten ($RELEASE_DIR)"
git worktree remove --force "$RELEASE_DIR" > /dev/null 2>&1 || rm -rf "$RELEASE_DIR"
git worktree prune
git worktree add --force --detach "$RELEASE_DIR" "$TARGET_SHA" > /dev/null
ln -sfn "$APP_DIR/.env" "$RELEASE_DIR/.env"

cd "$RELEASE_DIR"
echo "→ Abhängigkeiten installieren"
npm ci --no-audit --no-fund

echo "→ Prisma Client generieren"
npx prisma generate

# Zuerst bauen: ein fehlerhafter Stand bricht hier ab, bevor die Datenbank verändert wird.
# Gebaut wird im Release-Verzeichnis; die laufende Instanz bleibt bis zum Umschalten unberührt.
echo "→ Build"
npm run build
cd "$APP_DIR"

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
  # Commit im Namen = Code-Stand, der zu diesem (Vor-Migrations-)Stand der Datenbank passt.
  TARGET="$BACKUP_DIR/standchef-${DB_NAME}-${STAMP}-${PREV_COMMIT}.sql.gz"
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

# Migrationen und Presets aus dem neuen Stand (Release-Verzeichnis, .env verlinkt).
cd "$RELEASE_DIR"
echo "→ Migrationen einspielen"
npx prisma migrate deploy

echo "→ Neue globale Programme und Scheiben ergänzen"
npx tsx prisma/seed.ts --presets-only
cd "$APP_DIR"

echo "→ Umschalten auf $COMMIT"
# Ab hier wird bei einem Fehler automatisch auf PREV_COMMIT zurückgeschaltet (on_error).
[ ! -d .next ] || HAD_PREV_BUILD=1
SWITCHED=1
rm -rf .next.prev node_modules.prev src/generated.prev .next.failed node_modules.failed src/generated.failed
# Server ist reines Deploy-Ziel: lokale Änderungen an versionierten Dateien werden verworfen.
git checkout -q -f -B "$BRANCH" "$TARGET_SHA"
git reset -q --hard "$TARGET_SHA"
[ ! -d .next ] || mv .next .next.prev
mv "$RELEASE_DIR/.next" .next
[ ! -d node_modules ] || mv node_modules node_modules.prev
mv "$RELEASE_DIR/node_modules" node_modules
[ ! -d src/generated ] || mv src/generated src/generated.prev
mv "$RELEASE_DIR/src/generated" src/generated
git worktree remove --force "$RELEASE_DIR" > /dev/null 2>&1 || { rm -rf "$RELEASE_DIR"; git worktree prune; }

echo "→ Neustart"
pm2_reload

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
exit 1
}
