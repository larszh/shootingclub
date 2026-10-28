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
npx pm2 start ecosystem.config.cjs
npx pm2 save
npx pm2 startup               # gibt einen Befehl aus, der einmalig als root ausgeführt wird (Autostart nach Reboot)
```

pm2 ist als Projektabhängigkeit dabei, darum `npx pm2`. Alternativ als root `npm install -g pm2`, dann geht `pm2` direkt. Der Port kommt aus `PORT` in `.env` und muss mit dem **App Port** der Site in CloudPanel übereinstimmen.

Danach ist die App unter der Domain erreichbar. Mit `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` anmelden, unter **Mehr → Globale Verwaltung** den ersten Verein anlegen oder über **Loslegen** beitreten.

Das Seed-Passwort nach dem ersten Login ändern (Profil) und `SEED_ADMIN_PASSWORD` aus `.env` entfernen.

## 5. Updates einspielen

```bash
cd ~/htdocs/<domain>
bash scripts/deploy.sh
```

Das Script zieht den Code, installiert Abhängigkeiten, spielt neue Migrationen ein, ergänzt neue globale Programme und Scheiben, baut und startet PM2 neu.

Neue globale Vorlagen (Programme, Scheiben) kommen über den Seed. Für Updates gibt es dafür einen eigenen Modus, der nur fehlende Vorlagen anlegt, kein Konto anfasst und keine `SEED_ADMIN_*`-Variablen braucht:

```bash
npx tsx prisma/seed.ts --presets-only   # oder: npm run db:seed:presets
```

`scripts/deploy.sh` führt ihn nach `prisma migrate deploy` aus. Den vollen `npm run db:seed` nach der Erstinstallation nicht mehr verwenden: Fehlen `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` in `.env`, legt er `admin@example.ch` mit dem Standardpasswort als Super-Admin an.

### Absicherung

- Die App setzt `X-Frame-Options: SAMEORIGIN` und `Content-Security-Policy: frame-ancestors 'self'` (Schutz gegen Einbetten auf fremden Seiten, `next.config.ts`).
- Login, Registrierung und Beitrittscodes werden pro IP und pro Konto gedrosselt (In-Memory, `src/lib/auth.ts`). Das passt zur einen PM2-Instanz aus `ecosystem.config.cjs`. Wer mehrere Instanzen betreibt, begrenzt zusätzlich in nginx (CloudPanel → Vhost, `limit_req`). Die IP wird aus `X-Forwarded-For` gelesen; nginx von CloudPanel setzt diesen Header bereits.

## Hochgeladene Dateien

Uploads (eigene Scheiben, Logos, Profilbilder und – beim Speicherort «Server» – die Dateiablage und Chat-Anhänge) liegen in `storage/uploads` (`UPLOAD_DIR`). Dieser Ordner liegt ausserhalb von Git und bleibt bei Updates erhalten. Ins Backup aufnehmen, zusammen mit der Datenbank (CloudPanel → Databases → Backup, oder `mysqldump`).

Grössere Dateien in der Dateiablage (pro Verein einstellbar, höchstens 200 MB) brauchen ein passendes Upload-Limit in nginx. In CloudPanel → Site → **Vhost** im `server`-Block anpassen:

```nginx
client_max_body_size 200M;
```

## Dateiablage: Speicherort pro Verein

Jeder Verein wählt unter **Mehr → Verwaltung → Dateiablage & Speicherort** (`/admin/files`), wo seine Dateien liegen. Zugangsdaten werden wie die Zahlungsanbieter mit AES-256-GCM verschlüsselt (`StorageConfig.credentialsEnc`, Schlüssel aus `AUTH_SECRET`). Beim Speichern schreibt, liest und löscht Standchef eine kleine Testdatei, falsche Angaben fallen also sofort auf. Bestehende Dateien werden bei einem Wechsel **nicht** verschoben.

| Speicherort | Angaben |
|---|---|
| **Server** (Standard) | keine; Dateien unter `UPLOAD_DIR/tenant-files/<tenant-id>/…` |
| **S3 / AWS** | Region (z.B. `eu-central-2` Zürich), Bucket, Access Key, Secret Key, optional Präfix |
| **S3 / Hetzner** | Standort `fsn1`, `nbg1` oder `hel1`, Bucket, S3-Zugangsschlüssel aus der Hetzner Console |
| **S3-kompatibel** (Infomaniak, Exoscale, MinIO …) | Endpoint, optional Region, Bucket, Schlüssel, Pfad-Stil |
| **Nextcloud** (WebDAV) | WebDAV-Adresse, Benutzername, App-Passwort |

### S3 / AWS: minimale Rechte

Eigenen IAM-Benutzer nur für Standchef anlegen, Bucket **ohne** öffentlichen Zugriff lassen («Block all public access» an). Standchef braucht nur Objekte schreiben, lesen und löschen – keine Bucket-Rechte, kein Auflisten:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "StandchefObjects",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::<bucket-name>/*"
    }
  ]
}
```

Mit Präfix (z.B. `standchef`) lässt sich die Resource auf `arn:aws:s3:::<bucket-name>/standchef/*` einschränken. Dateien werden immer unter `tenant-files/<tenant-id>/…` (nach dem Präfix) abgelegt und nur über die App ausgeliefert (Rechteprüfung pro Ordner), nie per öffentlicher URL.

### S3 / Hetzner Object Storage

Endpoint-Format: `https://<standort>.your-objectstorage.com`, also `https://fsn1.your-objectstorage.com` (Falkenstein), `https://nbg1.your-objectstorage.com` (Nürnberg) oder `https://hel1.your-objectstorage.com` (Helsinki). Die App setzt den Endpoint aus dem gewählten Standort selbst. Bucket in der Hetzner Console im gleichen Standort anlegen, unter **Security → S3 Credentials** einen Schlüssel erzeugen (Secret wird nur einmal angezeigt).

### Nextcloud (WebDAV)

- **WebDAV-Adresse**: `https://<nextcloud>/remote.php/dav/files/<benutzer>/<ordner>`, z.B. `https://cloud.example.ch/remote.php/dav/files/verein/Standchef`. Der Ordner muss existieren. Die genaue Adresse zeigt Nextcloud unter **Dateien → Dateieinstellungen (unten links) → WebDAV**.
- **App-Passwort** statt des normalen Passworts: Nextcloud → **Persönliche Einstellungen → Sicherheit → Geräte & Sitzungen → Neues App-Passwort erstellen**. So lässt sich der Zugang jederzeit einzeln widerrufen, und Zwei-Faktor-Anmeldung stört nicht.
- Empfohlen: eigenes Nextcloud-Konto für den Verein statt eines persönlichen Kontos.

Aus Sicherheitsgründen lehnt die App Speicher-Adressen in privaten Netzen (127.0.0.1, 10.x, 192.168.x …) ab. Läuft MinIO oder Nextcloud bewusst im gleichen Netz, `FILE_STORAGE_ALLOW_PRIVATE_HOSTS=1` in `.env` setzen.

## Chat: Server-Sent Events hinter nginx

Der Chat hält pro geöffnetem Browser-Tab eine Verbindung zu `/api/chat/stream` offen (Server-Sent Events). Die Route sendet zwar `X-Accel-Buffering: no`, sicherer ist aber eine eigene `location` im Vhost, damit nginx nichts puffert oder komprimiert und die Verbindung nicht nach 60 s trennt. In CloudPanel → Site → **Vhost** **vor** dem bestehenden `location /`-Block einfügen:

```nginx
location /api/chat/stream {
  proxy_pass http://127.0.0.1:{{app_port}};
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header Connection "";
  proxy_buffering off;
  proxy_cache off;
  gzip off;
  proxy_read_timeout 3600s;
  proxy_send_timeout 3600s;
}
```

`{{app_port}}` ist der Platzhalter der CloudPanel-Vorlage für den App-Port; steht im bestehenden `location /` eine feste Zahl (z.B. `3000`), dieselbe verwenden. Danach **Save** – CloudPanel prüft und lädt nginx neu.

Hinweise:
- Ohne `proxy_buffering off` kommen Nachrichten erst verzögert oder gar nicht an; die App fällt dann nach zwei Fehlversuchen auf Abfragen alle paar Sekunden zurück («degraded»), funktioniert also weiter, nur langsamer.
- Läuft die Domain über **Cloudflare**, funktioniert SSE ebenfalls (Proxy-Modus). Der Server schickt alle 25 s ein Lebenszeichen und schliesst jede Verbindung nach 30 Minuten; der Browser verbindet automatisch neu.
- Neue Nachrichten werden innerhalb des Node-Prozesses sofort verteilt. Bei mehreren PM2-Instanzen gleicht zusätzlich eine Datenbankabfrage alle 5 s ab; die Standardkonfiguration (`instances: 1`) braucht nichts davon.

## Munition: nur auf Rechnung

Das Modul **Munition** kennt bewusst keine Bar-, Karten- oder Online-Zahlung. Mitglieder bestellen in der App, die Abgabe erfolgt auf dem Platz (optional mit Ausweisprüfung und Freigabe), und erst bei der Abgabe entsteht eine Rechnung mit fortlaufender Nummer (z.B. `MU-2026-0001`) und QR-Zahlteil aus dem Rechnungsprofil. So ist jede Abgabe einer Person zugeordnet und nachvollziehbar. Bei QR-IBAN erhält die Rechnung eine QR-Referenz; der Bankimport (camt.053/054) ordnet Munitionsrechnungen wie Beiträge und Reservationen automatisch zu. Die Verantwortung für die gesetzlichen Vorgaben beim Munitionsverkauf bleibt beim Verein.

## Rechnungsprofil (pro Verein)

Unter **Mehr → Mitgliederbeiträge verwalten → Rechnungsprofil** (`/admin/billing/settings`, auch erreichbar, wenn nur Reservationen oder Munition aktiv sind) trägt jeder Verein Zahlungsempfänger, Adresse und IBAN ein. Es gilt für Beiträge, Reservations- und Munitionsrechnungen. Ohne diese Angaben werden Rechnungen ohne QR-Zahlteil erstellt. Mitglieder hinterlegen ihre Adresse unter **Mehr → Profil**, damit sie im QR-Code als Zahler erscheinen.

## Zahlungsanbieter (pro Verein)

Jeder Verein richtet seinen Anbieter selbst unter **Mehr → Reservationen verwalten → Zahlungsanbieter** ein. Das Geld fliesst direkt auf das Konto des Vereins.

- **Stripe**: Secret Key aus dem Dashboard. Empfohlen: Webhook auf `https://<domain>/api/payments/stripe/<tenant-id>` mit Ereignis `checkout.session.completed`, Signing Secret eintragen. Ohne Webhook wird die Zahlung beim Rücksprung des Mitglieds geprüft.
- **Worldline Saferpay**: Customer ID, Terminal ID, JSON-API-Benutzer und -Passwort aus dem Backoffice; Umgebung `test` oder `live`.
- **SumUp**: API Key (Secret) und Händlercode aus dem SumUp-Dashboard.

Die Zugangsdaten werden mit einem aus `AUTH_SECRET` abgeleiteten Schlüssel verschlüsselt. **`AUTH_SECRET` nach der Einrichtung nicht mehr ändern**, sonst müssen alle Vereine ihre Anbieter und Speicher-Zugangsdaten (Dateiablage) neu eintragen.

## Betrieb

| Aufgabe | Befehl |
|---|---|
| Logs | `npx pm2 logs standchef` |
| Status | `npx pm2 status` |
| Neustart | `npx pm2 reload standchef` |
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

## Automatisches Deployment mit GitHub Actions

Der Workflow `.github/workflows/deploy.yml` prüft jeden Push und jeden Pull Request (Typecheck, Lint, Build). Bei einem Push auf `main` oder manuell über **Actions → CI & Deploy → Run workflow** verbindet er sich per SSH mit dem Server und führt `scripts/deploy.sh` aus (Code holen, `npm ci`, Migrationen, Build, PM2-Reload, Healthcheck). Schlägt der Healthcheck fehl, wird der Lauf rot.

### 1. SSH-Schlüssel für GitHub erzeugen (lokal, einmalig)

```bash
ssh-keygen -t ed25519 -C "github-actions-standchef" -f standchef_deploy -N ""
```

- Inhalt von `standchef_deploy.pub` in CloudPanel unter **Sites → standchef.ch → Settings → SSH Keys** (oder auf dem Server in `~/.ssh/authorized_keys` des Site-Benutzers) eintragen.
- Inhalt von `standchef_deploy` (privater Schlüssel) kommt als Secret zu GitHub. Danach die lokale Datei löschen.

Host-Schlüssel des Servers ermitteln (für `SSH_KNOWN_HOSTS`, schützt vor Man-in-the-Middle):

```bash
ssh-keyscan -p 22 <server-ip-oder-hostname>
```

Wichtig: die echte Server-IP oder den Hostnamen nehmen, **nicht** `standchef.ch`, solange die Domain über den Cloudflare-Proxy läuft (Cloudflare leitet kein SSH weiter).

### 2. Environment in GitHub anlegen

GitHub → Repository → **Settings → Environments → New environment** → Name `production`. Optional «Required reviewers» setzen, dann muss jedes Deployment bestätigt werden, und unter «Deployment branches» nur `main` erlauben.

### 3. Secrets (im Environment `production`)

| Secret | Inhalt |
|---|---|
| `SSH_HOST` | Server-IP oder Hostname (nicht hinter Cloudflare) |
| `SSH_USER` | Site-Benutzer, z.B. `standchef` |
| `SSH_PRIVATE_KEY` | privater Schlüssel aus Schritt 1, komplett inkl. `-----BEGIN…` |
| `SSH_KNOWN_HOSTS` | Ausgabe von `ssh-keyscan` |
| `DATABASE_URL` | nur bei `MANAGE_ENV=true`: `mysql://user:pass@127.0.0.1:3306/standchef` |
| `AUTH_SECRET` | nur bei `MANAGE_ENV=true`: **identisch** mit dem bisherigen Wert, sonst werden alle Sitzungen ungültig und gespeicherte Zahlungsanbieter-Daten unlesbar |
| `EXTRA_ENV` | optional, weitere Zeilen für `.env` (z.B. `SEED_ADMIN_EMAIL=…`) |

### 4. Variablen (im Environment `production`)

| Variable | Beispiel | Zweck |
|---|---|---|
| `APP_DIR` | `/home/standchef/htdocs/standchef.ch/shootingclub` | Projektordner auf dem Server |
| `APP_URL` | `https://standchef.ch` | Öffentliche URL (Link im Deployment, Rücksprung der Zahlungsanbieter) |
| `PORT` | `3000` | muss dem App Port der CloudPanel-Site entsprechen |
| `SSH_PORT` | `22` | falls abweichend |
| `DEPLOY_BRANCH` | `main` | welcher Branch auf den Server kommt |
| `MANAGE_ENV` | `true` oder leer | `true`: GitHub schreibt bei jedem Deploy die `.env` aus den Secrets. Leer: die `.env` auf dem Server bleibt unangetastet |
| `UPLOAD_DIR` | `./storage/uploads` | optional |

Empfehlung: `MANAGE_ENV=true` setzen, sobald alle Werte in GitHub stehen. Dann ist GitHub die einzige Quelle für Konfiguration, und die `.env` auf dem Server wird nicht mehr von Hand bearbeitet.

### 5. Erster Lauf

- Manuell: **Actions → CI & Deploy → Run workflow**, optional einen Branch angeben.
- Danach automatisch bei jedem Merge auf `main`.

### Hinweise

- `scripts/deploy.sh` setzt den Server hart auf den Stand von `origin/<branch>` zurück. Nicht versionierte Dateien (`.env`, `storage/uploads`, `node_modules`) bleiben erhalten, Änderungen an versionierten Dateien auf dem Server gehen verloren. Auf dem Server also nichts im Code ändern.
- Node wird aus nvm geladen, falls die SSH-Sitzung `~/.bashrc` nicht einliest.
- Fehler stehen im Actions-Log, Laufzeitfehler mit `npx pm2 logs standchef`.

## Schutz vor Durchprobieren (Login, Beitrittscodes)

Login, Registrierung und Beitrittscodes werden pro IP und pro Konto gebremst (10 Fehlversuche pro Konto bzw. 30 pro IP in 15 Minuten). Die Besucher-IP wird in dieser Reihenfolge ermittelt: `CF-Connecting-IP` (Cloudflare), `X-Real-IP` (von nginx gesetzt), letzter Eintrag von `X-Forwarded-For`. CloudPanel setzt `X-Real-IP` in der Node.js-Vorlage standardmässig. Läuft die Domain über Cloudflare, wird automatisch dessen Header verwendet, sonst würden sich alle Besucher die IP eines Cloudflare-Knotens teilen.

Der Zähler liegt im Arbeitsspeicher des Node-Prozesses und wird bei einem Neustart zurückgesetzt. Für eine einzelne Instanz unter PM2 ist das ausreichend.
