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

Optional, aber für den Betrieb empfohlen (Details in den Abschnitten unten):

```
# E-Mail (Einladungen, Passwort-Reset, Rechnungen, Benachrichtigungen)
SMTP_HOST="mail.infomaniak.com"
SMTP_PORT=587
SMTP_USER="noreply@standchef.ch"
SMTP_PASS="<passwort>"
MAIL_FROM="Standchef <noreply@standchef.ch>"
# Web Push (npx web-push generate-vapid-keys)
VAPID_PUBLIC_KEY="<public key>"
VAPID_PRIVATE_KEY="<private key>"
VAPID_SUBJECT="mailto:info@standchef.ch"
# Website-Widgets: nur diese Websites dürfen /embed/... einbetten (Standard "*", Änderung braucht neuen Build)
EMBED_FRAME_ANCESTORS="https://www.sv-muster.ch"
```

Alle Variablen mit Erklärung stehen in `.env.example`.

`APP_URL` muss stimmen: Links in E-Mails (Einladung, Passwort-Reset) zeigen dorthin, Zahlungsanbieter leiten nach der Zahlung dorthin zurück, und die Webhook-Adressen für Stripe und Payrexx werden daraus gebildet. Die Serverzeit spielt keine Rolle, alle Buchungszeiten werden in Europe/Zurich berechnet.

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

Das Seed-Passwort nach dem ersten Login ändern (**Mehr → Sicherheit**), dort gleich die Zwei-Faktor-Anmeldung einschalten und `SEED_ADMIN_PASSWORD` aus `.env` entfernen.

## 5. Updates einspielen

```bash
cd ~/htdocs/<domain>
bash scripts/deploy.sh
```

Das Script arbeitet in dieser Reihenfolge:

1. Code holen (`git fetch`, Stand `origin/<branch>` bzw. `DEPLOY_SHA`) in ein **separates Release-Verzeichnis** (`git worktree`, Standard `.<projektordner>-release` neben dem Projektordner, änderbar mit `RELEASE_DIR`), dort `npm ci` und `prisma generate`
2. **Build** im Release-Verzeichnis (ohne Datenbank; scheitert früh, bevor etwas an der DB geändert wird)
3. **Datenbank-Backup** (gzip, siehe «Backups und Wiederherstellung»)
4. `prisma migrate deploy`, neue globale Programme und Scheiben
5. **Umschalten**: Projektordner auf den neuen Commit setzen, `.next`, `node_modules` und `src/generated` aus dem Release-Verzeichnis hineinschieben (`mv`, Sekundenbruchteile); der bisherige Stand bleibt als `.next.prev`, `node_modules.prev`, `src/generated.prev` liegen
6. `pm2 reload` und **Healthcheck** auf `/api/health`

Bis zum Umschalten läuft die bisherige Instanz unverändert weiter: `npm ci` und Build laufen nicht unter dem laufenden Prozess, ein fehlgeschlagener Build oder eine fehlgeschlagene Migration lässt Code, `.next` und `node_modules` der laufenden Instanz unangetastet. Schlagen Reload oder Healthcheck nach dem Umschalten fehl, schaltet das Script automatisch auf den vorherigen Commit und Build zurück (der fehlgeschlagene liegt dann in `.next.failed`). Die Datenbank bleibt dabei auf dem migrierten Stand; ist das ein Problem, das Backup einspielen (siehe unten). Das Script gibt in jedem Fehlerfall den Code-Stand und den Wiederherstellungsbefehl für das Backup aus.

Platzbedarf: Release-Verzeichnis während des Builds plus ein vorheriger Stand (`*.prev`), zusammen etwa das Dreifache von `node_modules` + `.next`. Release-Verzeichnis und Projektordner müssen auf demselben Dateisystem liegen.

Neue globale Vorlagen (Programme, Scheiben) kommen über den Seed. Für Updates gibt es dafür einen eigenen Modus, der nur fehlende Vorlagen anlegt, kein Konto anfasst und keine `SEED_ADMIN_*`-Variablen braucht:

```bash
npx tsx prisma/seed.ts --presets-only   # oder: npm run db:seed:presets
```

`scripts/deploy.sh` führt ihn nach `prisma migrate deploy` aus. Den vollen `npm run db:seed` nach der Erstinstallation nicht mehr verwenden: Fehlen `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` in `.env`, legt er `admin@example.ch` mit dem Standardpasswort als Super-Admin an.

### Absicherung

- Die App setzt `X-Frame-Options: SAMEORIGIN` und `Content-Security-Policy: frame-ancestors 'self'` (Schutz gegen Einbetten auf fremden Seiten, `next.config.ts`).
- Login, Registrierung und Beitrittscodes werden pro IP und pro Konto gedrosselt (In-Memory, `src/lib/auth.ts`). Das passt zur einen PM2-Instanz aus `ecosystem.config.cjs`. Wer mehrere Instanzen betreibt, begrenzt zusätzlich in nginx (CloudPanel → Vhost, `limit_req`). Die IP kommt aus `X-Real-IP`, sonst aus dem letzten Eintrag von `X-Forwarded-For` (nginx von CloudPanel setzt beide). `CF-Connecting-IP` zählt nur mit `TRUST_CLOUDFLARE=1`, siehe unten.

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
  proxy_set_header CF-Connecting-IP "";
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
- `proxy_set_header CF-Connecting-IP "";` entfernt einen vom Client selbst mitgeschickten `CF-Connecting-IP`-Header, damit er nicht bis zur App durchgereicht wird (siehe «Schutz vor Durchprobieren»). Dieselbe Zeile auch im bestehenden `location /`-Block ergänzen. Hinter Cloudflare (`TRUST_CLOUDFLARE=1`) diese Zeile weglassen, sonst geht der echte Wert von Cloudflare verloren.
- Ohne `proxy_buffering off` kommen Nachrichten erst verzögert oder gar nicht an; die App fällt dann nach zwei Fehlversuchen auf Abfragen alle paar Sekunden zurück («degraded»), funktioniert also weiter, nur langsamer.
- Läuft die Domain über **Cloudflare**, funktioniert SSE ebenfalls (Proxy-Modus). Der Server schickt alle 25 s ein Lebenszeichen und schliesst jede Verbindung nach 30 Minuten; der Browser verbindet automatisch neu.
- Neue Nachrichten werden innerhalb des Node-Prozesses sofort verteilt. Bei mehreren PM2-Instanzen gleicht zusätzlich eine Datenbankabfrage alle 5 s ab; die Standardkonfiguration (`instances: 1`) braucht nichts davon.

## Munition: nur auf Rechnung

Das Modul **Munition** kennt bewusst keine Bar-, Karten- oder Online-Zahlung. Mitglieder bestellen in der App, die Abgabe erfolgt auf dem Platz (optional mit Ausweisprüfung und Freigabe), und erst bei der Abgabe entsteht eine Rechnung mit fortlaufender Nummer (z.B. `MU-2026-0001`) und QR-Zahlteil aus dem Rechnungsprofil. So ist jede Abgabe einer Person zugeordnet und nachvollziehbar. Bei QR-IBAN erhält die Rechnung eine QR-Referenz; der Bankimport (camt.053/054) ordnet Munitionsrechnungen wie Beiträge und Reservationen automatisch zu. Die Verantwortung für die gesetzlichen Vorgaben beim Munitionsverkauf bleibt beim Verein.

## Rechnungsprofil (pro Verein)

Unter **Mehr → Mitgliederbeiträge verwalten → Rechnungsprofil** (`/admin/billing/settings`, auch erreichbar, wenn nur Reservationen oder Munition aktiv sind) trägt jeder Verein Zahlungsempfänger, Adresse und IBAN ein. Es gilt für Beiträge, Reservations- und Munitionsrechnungen. Ohne diese Angaben werden Rechnungen ohne QR-Zahlteil erstellt. Mitglieder hinterlegen ihre Adresse unter **Mehr → Profil**, damit sie im QR-Code als Zahler erscheinen.

## Zahlungsanbieter (pro Verein)

Jeder Verein richtet seinen Anbieter selbst unter **Mehr → Reservationen verwalten → Zahlungsanbieter** (`/admin/bookings/payments`) ein; ohne Modul «Reservationen» stehen dieselben Formulare im Rechnungsprofil (`/admin/billing/settings`). Das Geld fliesst direkt auf das Konto des Vereins. Geheime Felder werden nie wieder angezeigt (leer lassen = behalten). Der Anbieter gilt danach für Reservationen (Reservations-Einstellungen → «Online-Zahlung») und/oder für Beiträge (Rechnungsprofil → «Online-Zahlung für Beiträge»). **Munitionsrechnungen sind nie online bezahlbar.**

- **Payrexx (TWINT, PostFinance, Karte)**:
  1. Im Payrexx-Backend unter *Einstellungen → API* einen API-Schlüssel anlegen.
  2. In Standchef **Instanz** (der Teil vor `.payrexx.com`, z.B. `sgmusterhausen`) und **API-Secret** eintragen, optional Zahlarten (z.B. `twint,postfinance_card,visa,mastercard`), aktivieren und «Verbindung testen» (ruft `SignatureCheck` auf).
  3. Im Payrexx-Backend unter *Webhooks* die Adresse `https://<domain>/api/payments/payrexx/<tenant-id>` hinterlegen (Typ *Transaktion*, JSON oder Formular). Die genaue Adresse mit Vereins-ID zeigt das Formular an. Der Webhook liest den Status immer über die API nach, der Inhalt der Nachricht wird nicht übernommen.
  4. **Zuschläge für Zahlende ausschalten**: weicht der bezahlte Betrag von der Rechnung ab, wird die Zahlung nicht automatisch verbucht (Eintrag im Protokoll).
  5. Vor dem Einsatz eine Testzahlung mit kleinem Betrag machen.
- **Stripe**: Secret Key aus dem Dashboard. Empfohlen: Webhook auf `https://<domain>/api/payments/stripe/<tenant-id>` mit Ereignis `checkout.session.completed`, Signing Secret eintragen. Ohne Webhook wird die Zahlung beim Rücksprung des Mitglieds geprüft. Der Webhook verbucht Reservationen und Beiträge.
- **Worldline Saferpay**: Customer ID, Terminal ID, JSON-API-Benutzer und -Passwort aus dem Backoffice; Umgebung `test` oder `live`.
- **SumUp**: API Key (Secret) und Händlercode aus dem SumUp-Dashboard (nur Karte, kein TWINT).

Die Webhook-Pfade `/api/payments/*` müssen von aussen erreichbar sein (keine Basic-Auth oder IP-Sperre davor). Rückerstattungen erfolgen von Hand im Backoffice des Anbieters; Zahlungen auf bereits bezahlte oder stornierte Rechnungen erhalten den Vermerk «Rückerstattung prüfen».

Die Zugangsdaten werden mit einem aus `AUTH_SECRET` abgeleiteten Schlüssel verschlüsselt. **`AUTH_SECRET` nach der Einrichtung nicht mehr ändern**, sonst müssen alle Vereine ihre Anbieter und Speicher-Zugangsdaten (Dateiablage) neu eintragen; zudem werden alle signierten Ranglisten-Widgets ungültig.

## Website-Widgets (Einbetten auf der Vereinswebsite)

Unter **Einstellungen → Website-Widgets** (`/admin/embed`) schaltet ein Admin die Widgets ein (erzeugt `Tenant.embedToken`), wählt Widget und Optionen und kopiert den iframe-Code, z.B.:

```html
<iframe src="https://standchef.ch/embed/<token>/calendar?limit=8&theme=auto" title="Termine – Standchef" data-standchef-embed width="100%" height="520" style="width:100%;border:0" loading="lazy" referrerpolicy="no-referrer"></iframe>
```

- Widgets: `calendar` (Anlässe, `?kind=`, `?limit=`), `times` (Schiesszeiten), `ranking` und `championship` (nur mit signiertem Link aus `/admin/embed`). `?theme=auto|light|dark`.
- `/embed/*` erhält eine eigene CSP ohne `X-Frame-Options`; `frame-ancestors` kommt aus **`EMBED_FRAME_ANCESTORS`** (durch Leerzeichen oder Kommas getrennt, z.B. `"https://www.sv-muster.ch https://*.muster.ch"`; Standard `*` nur wenn leer. Die eigene Origin der App (`'self'`) ist immer erlaubt, für die Vorschau unter `/admin/embed`. Ist die Variable gesetzt, aber kein Eintrag gültig, gilt `'self'` und der Build gibt eine Warnung aus; `'none'` sperrt jedes Einbetten). Die Variable wird beim Build gelesen: nach einer Änderung `scripts/deploy.sh` bzw. `npm run build` und Neustart. Alle anderen Seiten bleiben gegen Einbetten geschützt.
- Antworten sind 5 Minuten öffentlich zwischengespeichert (Fehlerseiten 60 s). Widerruf oder «Neu erzeugen» wirkt also spätestens nach 5 Minuten. Hinter Cloudflare den Cache für `/embed/*` nicht länger einstellen.

## Buchhaltung: Export für Banana und bexio

Unter **Einstellungen → Buchhaltung** (`/admin/accounting`, Recht `accounting.export`) einmal den Kontenplan prüfen und anpassen, dann Zeitraum wählen und exportieren:

- **Banana Buchhaltung Plus**: «Banana Buchhaltung» herunterladen (.txt, Tabulator-getrennt, Spalten Date/Doc/Description/AccountDebit/AccountCredit/Amount, Datum JJJJ-MM-TT). In Banana *Aktionen → In Buchhaltung importieren…* → *Buchungen* → Format *Textdatei mit Spaltenüberschriften* wählen, Datei auswählen und die Spaltenzuordnung prüfen. Die Konten müssen im Banana-Kontenplan existieren.
- **bexio**: «bexio (CSV für manuellen Import)» herunterladen (Semikolon, UTF-8 mit BOM) und im Buchungsimport von bexio die Spalten zuordnen.
- **CSV**: generisch mit zusätzlichen Spalten (Währung, Bereich, Art) für Excel oder andere Programme.

Das Journal enthält Beiträge, Ersatzabgabe, Schützenstube, Reservationen (auch «Bar / vor Ort» bezahlte: Bank an Reservationen), Munition und Online-Zahlungen. Es wird aus dem aktuellen Stand der Belege berechnet: nur abgeschlossene Zeiträume exportieren. Gebühren der Zahlungsanbieter und Barverkäufe der Schützenstube werden nicht automatisch gebucht. Jeder Export steht im Protokoll.

## Resultat-Import aus elektronischen Trefferanzeigen

`/scores/import` (Trainer und Vorstand) liest Exportdateien von Meyton, SIUS (SIUSData), ShotMarker oder allgemeines CSV (bis 5 MB, über Server Actions; `next.config.ts` erlaubt 10 MB). Die Vorlagen sind **Vorschläge** und mit einer eigenen Exportdatei zu prüfen, da die Spalten je nach Version abweichen. Dieselbe Datei lässt sich pro Verein nur einmal importieren.

## Gemeinsame Anlagen

Ein Verein teilt eine Anlage unter *Reservationen verwalten → Anlagen → <Anlage> → Mit Partnerverein teilen* (Suche über Kurzname oder Beitrittscode, Partnertarif in %). Mitglieder des Partnervereins brauchen dort das Modul «Reservationen» und buchen unter «Buchen → Anlagen von …». Buchungen und Rechnungen gehören dem Eigentümerverein (nur Rechnung, keine Online-Zahlung). Bericht pro Partnerverein mit CSV unter `/admin/bookings/partners`.

## E-Mail-Versand (SMTP)

Standchef verschickt Einladungen, Passwort-Links, Sicherheitshinweise, Rechnungs- und Erinnerungsmails sowie Benachrichtigungen. Mails landen zuerst in einer Warteschlange (Tabelle `MailMessage`); der Job `mail.send` verschickt sie alle 30 Sekunden, höchstens 200 pro Lauf, mit Wiederholung (2, 4, 8, 16 Minuten) und nach 5 Fehlversuchen Status «fehlgeschlagen». Ohne `SMTP_HOST` werden Mails als «übersprungen» markiert (die App läuft trotzdem).

Beispiele für `.env`:

| Anbieter | `SMTP_HOST` | `SMTP_PORT` | `SMTP_USER` / `SMTP_PASS` |
|---|---|---|---|
| Infomaniak (Mail Service) | `mail.infomaniak.com` | `587` | Adresse / Passwort der Mailbox |
| Hostpoint | `asmtp.mail.hostpoint.ch` | `587` | Adresse / Passwort der Mailbox |
| Mailgun (EU) | `smtp.eu.mailgun.org` | `587` | SMTP-Benutzer der Domain / SMTP-Passwort |
| Postmark | `smtp.postmarkapp.com` | `587` | Server-API-Token / gleicher Token |

Für Port 465 (implizites TLS) zusätzlich `SMTP_SECURE=true`. `MAIL_FROM` muss eine Adresse der Domain sein, für die der Anbieter senden darf, z.B. `Standchef <noreply@standchef.ch>`. Antworten gehen an die im Verein hinterlegte Antwortadresse (Vereinseinstellungen), sonst an den Absender.

**Zustellbarkeit (wichtig):** Ohne SPF und DKIM landen Mails im Spam oder werden abgewiesen.

- **SPF**: TXT-Record auf der Absenderdomain, z.B. `v=spf1 include:spf.infomaniak.ch ~all` (Wert laut Anbieter; nur **ein** SPF-Record pro Domain, mehrere `include:` darin kombinieren).
- **DKIM**: den vom Anbieter erzeugten Schlüssel als TXT/CNAME eintragen und im Anbieter aktivieren.
- **DMARC**: mindestens `_dmarc.standchef.ch TXT "v=DMARC1; p=none; rua=mailto:dmarc@standchef.ch"`, später `p=quarantine`.

Kontrolle unter **Mehr → System** (`/super/system`, nur Super-Admins): SMTP-Status, Warteschlange, Jobs, die letzten fehlgeschlagenen Mails mit «Erneut senden» und **«Testmail an mich»**. Platzhalter-Adressen importierter Mitglieder ohne E-Mail (`…@standchef.invalid`) werden nie verschickt.

## Push-Benachrichtigungen (Web Push)

Push braucht ein VAPID-Schlüsselpaar. Einmalig erzeugen (lokal oder auf dem Server):

```bash
npx web-push generate-vapid-keys
```

Die beiden Werte als `VAPID_PUBLIC_KEY` und `VAPID_PRIVATE_KEY` in `.env` eintragen, dazu `VAPID_SUBJECT="mailto:info@standchef.ch"`, dann `npx pm2 reload standchef`. Ohne Schlüssel wird Push still übersprungen; E-Mail-Benachrichtigungen funktionieren trotzdem.

- Den privaten Schlüssel **nicht wechseln**: sonst sind alle gespeicherten Geräte ungültig und alle müssen Push neu einschalten.
- Mitglieder schalten Push unter **Mehr → Benachrichtigungen & Sprache** ein (auf iPhone/iPad erst nach «Zum Home-Bildschirm», ab iOS 16.4). Dort wählen sie pro Thema Push und E-Mail sowie die Sprache (DE/FR/IT).
- Push funktioniert nur über HTTPS (Let's Encrypt in CloudPanel).

## Hintergrund-Jobs

Der Job-Runner startet mit dem Node-Prozess (`src/instrumentation.ts`) und führt aus:

| Job | Intervall | Aufgabe |
|---|---|---|
| `mail.send` | 30 s | Mail-Warteschlange verschicken |
| `cleanup` | stündlich | abgelaufene Sitzungen, Tokens, Einladungen und alte Mails löschen |
| `reminders` | stündlich | Erinnerungen der Module (Hooks in `src/lib/jobs/registry.ts`) |
| `tenant.purge` | täglich | Vereine 30 Tage nach der Löschung endgültig entfernen (inkl. Dateien) |
| `scores.backfill` | täglich | gespeicherte Totale älterer Durchgänge nachtragen |

Jeder Job belegt eine Sperrzeile (Tabelle `JobLock`); eine zweite Instanz führt einen Job darum nie gleichzeitig aus. Trotzdem ist der Betrieb auf **eine PM2-Instanz** ausgelegt (`ecosystem.config.cjs`, `instances: 1`): Drosselung, Chat-Live-Bus, Online-Status und TOTP-Wiederholschutz liegen im Arbeitsspeicher. Mit `JOBS_DISABLED=1` lässt sich der Runner abschalten (z.B. auf einer Zusatzinstanz). Status und «Jetzt ausführen» unter `/super/system`.

## Backups und Wiederherstellung

`scripts/deploy.sh` sichert die Datenbank **vor jeder Migration** mit `mariadb-dump`/`mysqldump` (`--single-transaction`, gzip) nach `BACKUP_DIR` (Standard `~/backups/standchef`, Rechte 700/600) und behält die neuesten `BACKUP_KEEP` Dateien (Standard 14). Das Passwort wird über die Umgebung übergeben, nie auf der Befehlszeile. Fehlt das Dump-Programm, bricht der Deploy ab (`apt install mariadb-client`), ausser `ALLOW_NO_BACKUP=1` ist gesetzt. Die drei Werte können in `.env` oder in der Shell stehen.

Der Commit im Dateinamen ist der Code-Stand, der **vor** dem Deploy lief und zu diesem Datenbankstand passt (nicht der neu deployte).

Wiederherstellen: Die Datenbank zuerst leeren und neu anlegen. Der Dump löscht nur die Tabellen, die er selbst enthält; Tabellen, die eine (teilweise) eingespielte Migration neu angelegt hat, blieben sonst stehen, und das nächste `prisma migrate deploy` scheitert mit «already exists» (MariaDB kann DDL nicht zurückrollen).

```bash
npx pm2 stop standchef
mysql -h 127.0.0.1 -u standchef -p -e 'DROP DATABASE standchef; CREATE DATABASE standchef CHARACTER SET utf8mb4;'
gunzip -c ~/backups/standchef/standchef-standchef-<zeit>-<commit>.sql.gz | mysql -h 127.0.0.1 -u standchef -p standchef
# Passender Code-Stand = <commit> aus dem Dateinamen. Hat deploy.sh bereits automatisch
# zurückgeschaltet, läuft dieser Stand schon (git log -1). Sonst:
git checkout -B main <commit> && npm ci && npx prisma generate && npm run build
npx pm2 start standchef
```

Darf der Datenbankbenutzer keine Datenbank anlegen, die Datenbank in CloudPanel (**Databases**) löschen und mit demselben Namen und Benutzer neu anlegen.

Zusätzlich empfohlen: tägliche Backups in CloudPanel (**Databases → Backups** bzw. **Admin Area → Backups**, auch extern z.B. auf S3) und `storage/uploads` mitsichern. Ein Backup gilt erst als Backup, wenn die Wiederherstellung einmal geprobt wurde.

## Healthcheck

`GET /api/health` antwortet ohne Login mit `{"ok":true,"db":true,"time":"…"}` (HTTP 200) oder HTTP 503, wenn die Datenbank nicht innert 3 Sekunden antwortet. `deploy.sh` prüft ihn nach jedem Reload. Für ein externes Monitoring (UptimeRobot, Better Stack, Uptime Kuma) diese URL alle 1–5 Minuten abfragen und auf `"ok":true` prüfen.

## Sicherheit: Zwei-Faktor-Anmeldung und Passwörter

- **2FA (TOTP)** unter **Mehr → Sicherheit** (`/me/security`): QR-Code mit jeder Authenticator-App (Aegis, Google/Microsoft Authenticator, 1Password, Bitwarden). Dazu 8 Wiederherstellungscodes. Admins und Inhaber ohne 2FA sehen auf der Startseite und unter Einstellungen einen Hinweis. Das TOTP-Geheimnis ist mit einem aus `AUTH_SECRET` abgeleiteten Schlüssel verschlüsselt.
- **Passwort vergessen** über `/forgot-password` (Link 60 Minuten gültig, beendet alle Sitzungen). Braucht SMTP.
- **Importierte Mitglieder** erhalten einen Link zum Passwort-Setzen (14 Tage gültig).
- Hat jemand den Zugang zu Authenticator **und** Wiederherstellungscodes verloren, kann ein Super-Admin 2FA nicht einfach abschalten; die Person setzt ihr Passwort zurück und wendet sich an den Support (manuell in der DB: `UPDATE User SET totpSecretEnc=NULL, totpEnabledAt=NULL WHERE email=…`).

## Datenschutz (revDSG)

- **Mehr → Datenschutz** (`/me/privacy`): Mitglieder laden alle eigenen Daten als ZIP herunter und können ihr Konto löschen. Das Konto wird pseudonymisiert; Rechnungen, Buchungen und Resultate bleiben für die Buchhaltung und Ranglisten erhalten. Künftige, noch nicht bezahlte Buchungen werden dabei storniert (offene Rechnung → storniert), noch nicht versandte Mails an die alte Adresse verworfen. Alleinige Inhaber eines Vereins müssen zuerst eine andere Person zum Inhaber machen. Kopien von Name und Kontaktdaten in Kursteilnahmen, Standdienst (`dutyName`), Mitglieder-Waffenausleihen (`borrowerName`) und Qualifikationsnummern werden anonymisiert. Waffenausleihen (Datum, Schusszahl, Meldefrist), Standbuch, Vorfälle sowie Kurs- und Qualifikationsresultate bleiben als Nachweis mit pseudonymisiertem Konto erhalten (Waffengesetz/kantonale Vorgaben bzw. Standbetrieb; Frist legt der Verein fest).
- **Protokoll** (`/admin/audit`, Berechtigung `audit.view`): Rollenwechsel, Löschungen, Importe, Exporte und Einstellungen pro Verein, mit CSV-Export. Inhaber laden dort das **Vereinsarchiv** (ZIP mit CSVs) herunter. Super-Admins sehen alle Vereine unter `/super/audit`.
- **Vereine löschen** (`/super/tenants`): Löschung mit Eingabe des Kürzels, der Verein ist sofort für Mitglieder gesperrt und wird nach 30 Tagen endgültig gelöscht (Job `tenant.purge`); bis zum Ablauf der Frist «Wiederherstellen» (danach nicht mehr, der Löschjob kann bereits laufen).
- Ausgetretene Mitglieder (Status «ausgetreten») behalten ihre Daten im Verein, haben aber keinen Zugang mehr.

## Tests

```bash
npm test               # Vitest: reine Funktionen (Geld, Zeit, QR-Referenz, camt, Punkte, TOTP, Mail-Layout, i18n, Import …)
npx tsc --noEmit       # Typecheck
npx eslint .           # Lint
```

Die GitHub-Action führt alle drei plus `npm run build` bei jedem Push und Pull Request aus.

## Betrieb

| Aufgabe | Befehl |
|---|---|
| Logs | `npx pm2 logs standchef` |
| Status | `npx pm2 status` |
| Neustart | `npx pm2 reload standchef` |
| DB-Konsole | `mysql -u standchef -p standchef` |
| Prisma Studio (nur lokal/SSH-Tunnel) | `npx prisma studio` |
| Healthcheck | `curl -s https://standchef.ch/api/health` |
| Mail-Warteschlange und Jobs | `/super/system` im Browser |
| Backups | `ls -lt ~/backups/standchef` |

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

Der Workflow `.github/workflows/deploy.yml` prüft jeden Push und jeden Pull Request (Typecheck, Lint, Tests, Build). Bei einem Push auf `main` oder manuell über **Actions → CI & Deploy → Run workflow** verbindet er sich per SSH mit dem Server und führt `scripts/deploy.sh` aus (Code holen, `npm ci`, Build, Backup, Migrationen, Umschalten, PM2-Reload, Healthcheck). Deployt wird genau der Commit, den der Job «Typecheck, Lint, Build» geprüft hat (`DEPLOY_SHA=${{ github.sha }}` auf dem Branch des Laufs), nicht der Branch-Kopf zum Zeitpunkt der SSH-Verbindung. Schlägt der Healthcheck fehl, wird der Lauf rot und der Server läuft wieder auf dem vorherigen Stand.

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
| `SMTP_PASS` | optional (nur bei `MANAGE_ENV=true`): Passwort/Token des SMTP-Kontos |
| `VAPID_PRIVATE_KEY` | optional (nur bei `MANAGE_ENV=true`): privater Web-Push-Schlüssel, nie wechseln |
| `EXTRA_ENV` | optional, weitere Zeilen für `.env` (z.B. `SEED_ADMIN_EMAIL=…`) |

### 4. Variablen (im Environment `production`)

| Variable | Beispiel | Zweck |
|---|---|---|
| `APP_DIR` | `/home/standchef/htdocs/standchef.ch/shootingclub` | Projektordner auf dem Server |
| `APP_URL` | `https://standchef.ch` | Öffentliche URL (Link im Deployment, Rücksprung der Zahlungsanbieter) |
| `PORT` | `3000` | muss dem App Port der CloudPanel-Site entsprechen |
| `SSH_PORT` | `22` | falls abweichend |
| `MANAGE_ENV` | `true` oder leer | `true`: GitHub schreibt bei jedem Deploy die `.env` aus den Secrets. Leer: die `.env` auf dem Server bleibt unangetastet |
| `UPLOAD_DIR` | `./storage/uploads` | optional |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `MAIL_FROM` | `mail.infomaniak.com`, `587`, `false`, `noreply@standchef.ch`, `Standchef <noreply@standchef.ch>` | optional, Mailversand |
| `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT` | `B…`, `mailto:info@standchef.ch` | optional, Web Push |
| `JOBS_DISABLED`, `CHAT_POLL_MS`, `DB_POOL` | leer, `30000`, `10` | optional, Betrieb |
| `BACKUP_DIR`, `BACKUP_KEEP`, `ALLOW_NO_BACKUP` | `~/backups/standchef`, `14`, leer | optional, Backups beim Deploy |

Leere optionale Werte werden nicht in die `.env` geschrieben. Werte dürfen keine Zeilenumbrüche und keine doppelten Anführungszeichen enthalten.

Empfehlung: `MANAGE_ENV=true` setzen, sobald alle Werte in GitHub stehen. Dann ist GitHub die einzige Quelle für Konfiguration, und die `.env` auf dem Server wird nicht mehr von Hand bearbeitet.

### 5. Erster Lauf

- Manuell: **Actions → CI & Deploy → Run workflow**. Unter «Use workflow from» den Branch wählen; geprüft und deployt wird dessen aktueller Commit. Mit «Deployment branches: main» im Environment sind nur Läufe von `main` erlaubt.
- Danach automatisch bei jedem Merge auf `main`.

### Hinweise

- `scripts/deploy.sh` setzt den Server hart auf den deployten Commit von `origin/<branch>` zurück. Nicht versionierte Dateien (`.env`, `storage/uploads`) bleiben erhalten, `node_modules` und `.next` werden durch die im Release-Verzeichnis gebauten ersetzt, Änderungen an versionierten Dateien auf dem Server gehen verloren. Auf dem Server also nichts im Code ändern.
- Node wird aus nvm geladen, falls die SSH-Sitzung `~/.bashrc` nicht einliest.
- Fehler stehen im Actions-Log, Laufzeitfehler mit `npx pm2 logs standchef`.

## Schutz vor Durchprobieren (Login, Beitrittscodes)

Login, Registrierung und Beitrittscodes werden pro IP und pro Konto gebremst (10 Fehlversuche pro Konto bzw. 30 pro IP in 15 Minuten). Die Besucher-IP kommt aus `X-Real-IP` (von nginx aus der Verbindungsadresse gesetzt), sonst aus dem letzten Eintrag von `X-Forwarded-For`. CloudPanel setzt `X-Real-IP` in der Node.js-Vorlage standardmässig.

`CF-Connecting-IP` wird nur verwendet, wenn in `.env` `TRUST_CLOUDFLARE=1` gesetzt ist. Das nur setzen, wenn die Domain über Cloudflare (Proxy-Modus) läuft **und** der Server Verbindungen ausschliesslich aus den IP-Bereichen von Cloudflare annimmt (Firewall, oder in nginx `allow`/`deny` mit den Bereichen von https://www.cloudflare.com/ips/). Ist der Server auch direkt erreichbar, kann jeder Client den Header fälschen und so die IP-Drosselung umgehen. Ohne `TRUST_CLOUDFLARE` teilen sich hinter Cloudflare alle Besucher die IP eines Cloudflare-Knotens; die Drosselung pro Konto greift trotzdem.

Der Zähler liegt im Arbeitsspeicher des Node-Prozesses und wird bei einem Neustart zurückgesetzt. Für eine einzelne Instanz unter PM2 ist das ausreichend.
