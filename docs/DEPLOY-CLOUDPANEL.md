# Deployment auf CloudPanel

Standchef läuft als **Node.js-Site** in CloudPanel. CloudPanel stellt nginx als Reverse Proxy, SSL (Let's Encrypt), MySQL/MariaDB und PM2 bereit. Es braucht kein Docker.

## Voraussetzungen

- CloudPanel 2.x auf einem Server (Ubuntu/Debian)
- Node.js 22 (bringt CloudPanel mit, wird beim Anlegen der Site gewählt)
- Git-Zugriff auf dieses Repository

## 1. Site anlegen

1. CloudPanel → **Sites** → **Add Site** → **Create a Node.js Site**
2. Domain eintragen (z.B. `standchef.ch`), Node-Version **22**, **App Port** `3000` (frei wählbar, muss zu `PORT` in `.env` passen).
3. Site-Benutzer und Passwort notieren.
4. Unter **SSL/TLS** ein Let's-Encrypt-Zertifikat holen.

## 2. Datenbank anlegen

1. **Databases** → **Add Database**: Name `standchef`, Benutzer `standchef`, Passwort generieren.
2. Zugangsdaten notieren. Host ist `127.0.0.1`, Port `3306`.

## 3. Code holen und konfigurieren

Per SSH als Site-Benutzer einloggen (`ssh <site-user>@<server>`):

```bash
cd ~/htdocs/<domain>
rm -rf ./*            # Platzhalter von CloudPanel entfernen
git clone <repo-url> .
cp .env.example .env
nano .env
```

In `.env` setzen:

```
DATABASE_URL="mysql://standchef:<db-passwort>@127.0.0.1:3306/standchef"
AUTH_SECRET="<openssl rand -base64 48>"
APP_URL="https://standchef.ch"
PORT=3000
UPLOAD_DIR="./storage/uploads"
SEED_ADMIN_EMAIL="du@verein.ch"
SEED_ADMIN_PASSWORD="<sicheres passwort>"
```

`APP_URL` muss stimmen: Zahlungsanbieter leiten nach der Zahlung dorthin zurück, und der Stripe-Webhook-Endpoint wird daraus gebildet. Die Serverzeit spielt keine Rolle, alle Buchungszeiten werden in Europe/Zurich berechnet.

## 4. Erstinstallation

```bash
npm ci
npx prisma generate
npx prisma migrate deploy     # legt alle Tabellen an
npm run db:seed               # Super-Admin, globale Programme und Scheiben
npm run build
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup                   # Befehl ausführen, den pm2 ausgibt (Autostart nach Reboot)
```

Danach ist die App unter der Domain erreichbar. Mit `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` anmelden, unter **Mehr → Globale Verwaltung** den ersten Verein anlegen oder über **Loslegen** beitreten.

Das Seed-Passwort nach dem ersten Login ändern (Profil) und `SEED_ADMIN_PASSWORD` aus `.env` entfernen.

## 5. Updates einspielen

```bash
cd ~/htdocs/<domain>
bash scripts/deploy.sh
```

Das Script zieht den Code, installiert Abhängigkeiten, spielt neue Migrationen ein, baut und startet PM2 neu.

## Hochgeladene Dateien

Uploads (eigene Scheiben) liegen in `storage/uploads`. Dieser Ordner liegt ausserhalb von Git und bleibt bei Updates erhalten. Ins Backup aufnehmen, zusammen mit der Datenbank (CloudPanel → Databases → Backup, oder `mysqldump`).

## Zahlungsanbieter (pro Verein)

Jeder Verein richtet seinen Anbieter selbst unter **Mehr → Reservationen verwalten → Zahlungsanbieter** ein. Das Geld fliesst direkt auf das Konto des Vereins.

- **Stripe**: Secret Key aus dem Dashboard. Empfohlen: Webhook auf `https://<domain>/api/payments/stripe/<tenant-id>` mit Ereignis `checkout.session.completed`, Signing Secret eintragen. Ohne Webhook wird die Zahlung beim Rücksprung des Mitglieds geprüft.
- **Worldline Saferpay**: Customer ID, Terminal ID, JSON-API-Benutzer und -Passwort aus dem Backoffice; Umgebung `test` oder `live`.
- **SumUp**: API Key (Secret) und Händlercode aus dem SumUp-Dashboard.

Die Zugangsdaten werden mit einem aus `AUTH_SECRET` abgeleiteten Schlüssel verschlüsselt. **`AUTH_SECRET` nach der Einrichtung nicht mehr ändern**, sonst müssen alle Vereine ihre Anbieter neu eintragen.

## Betrieb

| Aufgabe | Befehl |
|---|---|
| Logs | `pm2 logs standchef` |
| Status | `pm2 status` |
| Neustart | `pm2 reload standchef` |
| DB-Konsole | `mysql -u standchef -p standchef` |
| Prisma Studio (nur lokal/SSH-Tunnel) | `npx prisma studio` |

## Lokale Entwicklung

Lokal braucht es ebenfalls MySQL oder MariaDB (z.B. `brew install mariadb`, Docker `mariadb:11`, oder XAMPP/MAMP). Datenbank und Benutzer anlegen, `DATABASE_URL` in `.env` setzen, dann:

```bash
npm install
npx prisma migrate dev        # Migrationen einspielen (braucht Rechte zum Anlegen einer Shadow-DB)
npm run db:seed:demo          # inkl. Demo-Verein und Testkonten
npm run dev
```

Falls der DB-Benutzer keine Datenbanken anlegen darf: `npx prisma migrate deploy` statt `migrate dev`.

## Warum nicht PHP?

CloudPanel behandelt Node.js-Sites gleichwertig zu PHP-Sites (eigener Site-Benutzer, nginx, SSL, Backups). Die App bleibt damit eine einzige Codebasis mit Server-Rendering, ohne separate API. Ein Umbau auf PHP/Laravel wäre ein kompletter Neuschrieb ohne funktionalen Gewinn.
