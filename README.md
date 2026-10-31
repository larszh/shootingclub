# Standchef

**Die App für Schiessvereine und Schiessanlagen in der Schweiz.** Punkteerfassung, Zielscheiben zum Drucken, Anlässe, Reservationen, Mitgliederbeiträge, Dateiablage, Chat und Munitionsverkauf, Bundesübungen, Standbetrieb, Vereinswaffen, Helfereinsätze, Kurse, Jahresmeisterschaft und Live-Rangliste, Vereinsverwaltung mit Mandanten (Tenants) und Rollen. Modular aufgebaut, mobile-first, ohne Verbandsbindung.

> Der *Standchef* führt den Betrieb am Schiessstand: einteilen, organisieren, Resultate führen, abrechnen. Genau das macht die App für den Verein. Domain: standchef.ch

## Deployment

Die App läuft auf **CloudPanel** als Node.js-Site mit **MySQL/MariaDB**, ohne Docker. Anleitung: [`docs/DEPLOY-CLOUDPANEL.md`](docs/DEPLOY-CLOUDPANEL.md). Updates mit `bash scripts/deploy.sh`.

## Schnellstart (lokal)

Voraussetzung: MySQL oder MariaDB läuft lokal, Datenbank `standchef` und Benutzer `standchef` existieren (siehe `.env.example`).

```bash
cp .env.example .env         # DATABASE_URL und AUTH_SECRET anpassen
npm install
npx prisma migrate dev       # Tabellen anlegen
npm run db:seed:demo         # Super-Admin, globale Programme & Scheiben, Demo-Verein
npm run dev                  # http://localhost:3000
```

Nach dem Demo-Seed:

| Konto | Passwort | Rolle |
|---|---|---|
| admin@example.ch | admin1234 | Super-Admin, Inhaber Demo-Verein |
| anna@example.ch | demo1234 | Admin Demo-Verein |
| beat@example.ch | demo1234 | Mitglied Demo-Verein |

Beitrittscode Demo-Verein: `DEMO42`. Im Demo-Verein sind alle Module aktiv, inklusive Dateiablage (Beispielordner), Chat (Gruppe «Vorstand» und eine Direktnachricht) und Munition (Beispielsortiment mit Bestandesjournal), dazu Beispieldaten für Bundesübungen, Standbetrieb (Standordnung, Schiesszeiten, Standbücher), Vereinswaffen, Helfereinsätze mit Qualifikationen, Kurse und Jahresmeisterschaft mit Live-Rangliste. Der Seed ist idempotent und kann mehrfach laufen. Ohne Seed wird das allererste registrierte Konto automatisch Super-Admin.

Weitere Befehle: `npm test` (Vitest, reine Funktionen), `npm run typecheck`, `npm run lint`, `npm run build`, `npm run db:deploy` (Migrationen in Produktion), `npm run db:studio`.

## Stack

- Next.js 16 (App Router, Server Actions, Turbopack), React 19, TypeScript
- Tailwind CSS 4 mit eigenen Design-Tokens (hell/dunkel automatisch)
- Prisma 7 mit MySQL/MariaDB (`@prisma/adapter-mariadb`), versionierte Migrationen in `prisma/migrations`. Das Schema verzichtet bewusst auf Enums und Json-Spalten, damit es bei Bedarf auf PostgreSQL portierbar bleibt.
- Eigene Session-Auth (bcrypt, DB-Sessions, httpOnly-Cookie), Zwei-Faktor-Anmeldung (TOTP), kein externer Auth-Dienst
- E-Mail über SMTP (nodemailer) mit Warteschlange in der DB, Web Push (VAPID), Hintergrund-Jobs im Node-Prozess
- Mehrsprachigkeit DE/FR/IT (`src/lib/i18n`) für Mails, Benachrichtigungen und Rechnungen
- Vitest für Unit-Tests
- Datei-Uploads im lokalen `storage/uploads` (`src/lib/storage.ts`); die Dateiablage wählt den Speicherort pro Verein: Server, S3 (AWS, Hetzner, kompatible) oder Nextcloud/WebDAV (`src/lib/file-storage/`)
- Chat-Echtzeit über Server-Sent Events (`/api/chat/stream`) mit In-Process-Bus, passend zum langlebigen Node-Prozess unter PM2 (nicht serverless)

## Architektur

```
src/
  lib/            Kern: db, auth (inkl. Drosselung), tenant-kontext, permissions, modules-registry, storage,
                  crypto, time, money, qr-bill.ts (Schweizer QR-Rechnung als SVG), offline/ (IndexedDB, Outbox, Sync),
                  file-storage/ (Adapter LOCAL, S3, WebDAV mit Verbindungstest), audit.ts, mail/ (Warteschlange,
                  Layout, SMTP-Versand), jobs/ (Runner mit DB-Sperre, Registry), i18n/ (de/fr/it, extra/*),
                  push/ (Web Push), notify.ts (Push + E-Mail nach Einstellungen), totp.ts
  components/     Gemeinsame UI, u.a. invoice-document.tsx (A4-Rechnungslayout)
  modules/
    core/         Auth- und Tenant-Actions (Registrierung, Beitritt, Rollen, Module), invitations, two-factor,
                  privacy (Export, Kontolöschung), tenant-purge (Vereinslöschung), super-actions
    members/      Mitgliederverwaltung: queries, actions, Import (CSV/XLSX), Haushalte
    scores/       Punkteerfassung: types, presets, queries, actions, ui/
    targets/      Zielscheiben: types, presets, svg-generator, queries, actions, ui/
    events/       Anlässe & News: types, queries, actions, ics, seed, ui/
    bookings/     Reservationen: types, availability, pricing, invoice, payments/{stripe,worldline,sumup}, actions, ui/
    billing/      Mitgliederbeiträge: types, queries, actions, render, profile, camt (Bankimport für Beiträge,
                  Reservationen und Munition), overview (Zahlungsübersicht über alle Quellen), ui/
    files/        Dateiablage: types, queries, service (Rechteprüfung pro Ordner), actions, seed, ui/
    chat/         Chat: types, service, queries, actions, bus (In-Process), api, seed, ui/ (Stream-Client, Outbox)
    ammo/         Munition: types, service (Bestand, Ausgabe, Rechnungsnummer, QR-Referenz), queries, actions,
                  payments (markAmmoInvoicePaid), render, seed, ui/; stock* (Munitionskontrolle: Journal, Inventur)
    federal/      Bundesübungen: types (rein), queries, service (shootingDaysForUser, runFederalReminders), actions, seed
    range/        Standbetrieb: logic (rein), queries (listShootingDaysFromVisits), actions, booking-window, seed, ui/
    weapons/      Vereinswaffen: logic (rein), service (createWeaponLoan, returnWeaponLoan, runWeaponReminders), seed, ui/
    shifts/       Helfereinsätze: logic (rein), queries, service (runShiftReminders), actions, seed, ui/
    qualifications/  Qualifikationen: service (QUALIFICATION_KINDS, hasValidQualification, grantQualification)
    courses/      Kurse und Qualifikationsschiessen: logic (rein), queries, actions, seed, ui/
    championship/ Jahresmeisterschaft: ranking (rein), queries, actions, seed, ui/
    live/         Live-Rangliste: logic (rein), service (öffentlicher Snapshot), admin, actions, ui/
  app/
    (auth)/       login (+ 2FA), register, forgot-/reset-/set-password, invite/[token]
    (app)/        eingeloggter Bereich mit App-Shell (Tab-Bar mobil, Sidebar Desktop)
      scores/     Programme, Durchgänge, Statistik, Ranglisten
      targets/    Galerie, Anlegen/Bearbeiten
      events/     Kalender, Anlass-Detail, An-/Abmeldung, Mitteilungen
      bookings/   Reservieren, Detail, Bezahlen, Rücksprung vom Zahlungsanbieter
      billing/    Meine Beiträge
      payments/   Zahlungsübersicht: alle Rechnungen und Zahlungen des Mitglieds
      files/      Dateiablage mit Ordnern
      chat/       Unterhaltungen, neue Nachricht, neue Gruppe
      ammo/       Munition bestellen, eigene Bestellungen
      federal/    Bundesübungen, Schiessnachweis
      range/      Heute am Stand, Check-in, Standordnung, Standbuch, Kontingent, Vorfälle
      weapons/    Vereinswaffen (weapons.loan), Ausleihen
      shifts/     Helfereinsätze (Offen, Meine, Stunden), .ics pro Schicht
      courses/    Kurse, Teilnehmende, Kurstage, Resultate, Qualifikationsschiessen
      championship/  Jahresmeisterschaft, Rangliste, Mitglied-Detail, CSV
      members/    Mitgliederverzeichnis
      me/         Profil, Darstellung, Kalender-Abo; security/ (Passwort, 2FA, Sitzungen),
                  notifications/ (Sprache, Push/E-Mail), privacy/ (Export, Konto löschen)
      help/       Hilfe
      onboarding/ Verein beitreten oder anlegen
      admin/      Tenant-Einstellungen, Module
      admin/members/   Mitgliederliste, Detail, Haushalte, Einladungen, Import
      admin/audit/     Protokoll des Vereins, CSV, Vereinsarchiv
      admin/bookings/  Übersicht, Wochenkalender, Ressourcen, Einstellungen, Zahlungsanbieter
      admin/billing/   Übersicht und Jahreslauf, Mitglieder, Kategorien, Rechnungsprofil, Bankimport
      admin/payments/  Offene Posten über alle Bereiche, CSV-Export (admin/payments/export)
      admin/files/     Speicherort und Limits der Dateiablage
      admin/ammo/      Bestellungen, Ausgabe an der Theke, Sortiment, Einstellungen, Bestand (Munitionskontrolle)
      admin/range/     Standordnung, Schiesszeiten und Kontingent
      admin/shifts/    Einsatzplanung, Stunden und Ersatzabgabe, Einstellungen
      admin/qualifications/  Qualifikationen der Mitglieder
      admin/live/      Live-Ranglisten verwalten
      super/      Super-Admin: Tenants (inkl. Löschen/Wiederherstellen), Benutzer, globale Programme/Scheiben,
                  audit/ (alle Vereine), system/ (Mail-Warteschlange, Jobs)
    offline/      Ersatzseite ohne Empfang (Service Worker)
    targets/[id]/print                Druckansicht ohne App-Shell
    bookings/[id]/invoice             Druckbare Reservations-Rechnung mit QR-Zahlteil
    billing/invoices/[id]/print       Druckbare Beitragsrechnung (optional als Zahlungserinnerung)
    admin/billing/runs/[id]/print     Sammeldruck eines Jahreslaufs
    ammo/[id]/invoice                 Druckbare Munitionsrechnung mit QR-Zahlteil
    federal/print, federal/nachweis/print     SAT-Admin-Liste, Bestätigung Schiesstätigkeit
    range/{qr,quota/print,log/[id]/print,incidents/[id]/print}   QR-Plakat, Jahresbericht, Standbuch, Vorfall
    weapons/loans/[id]/receipt        Ausleihquittung
    courses/[id]/{print,certificate}, courses/qualifications/certificate/[id]   Kursliste, Kursausweis, Qualifikationsnachweis
    championship/[id]/print           GV-Rangliste
    admin/ammo/stock/{inventory,year}/print   Inventur-Differenzbericht, Jahresübersicht Munition
    live/[token]                      Öffentliche Live-Rangliste (ohne Anmeldung, geheimer Link)
    api/live/[token]{,/stream,/logo}  Live-Rangliste: JSON, Server-Sent Events, Logo
    api/files/[id]                    Hochgeladene Dateien (mit Rechteprüfung)
    api/documents/{upload,[id]}       Dateiablage und Chat-Anhänge (Upload, Abruf mit Rechteprüfung)
    api/chat/{stream,unread,[id]/…}   Chat: Server-Sent Events, Ungelesen-Zähler, Nachrichten, Lesestand, Anhänge
    api/avatars/{user,tenant}/[id]    Profilbilder und Vereinslogos
    api/targets/[id]/svg              Scheiben als SVG
    api/ical/{tenant,me,event}        iCal-Abos und Einzeltermine
    api/export/{scores,bookings,billing,events,ammo,federal,range,weapons,courses}  CSV-Exporte
    api/offline/snapshot              Offline-Snapshot des aktiven Vereins
    api/sync                          Übertragung der Offline-Outbox
    api/payments/stripe/[tenantId]    Stripe-Webhook pro Tenant
    api/export/{me,archive}           Datenexport (eigene Daten, Vereinsarchiv) als ZIP
    api/push/{key,subscribe}          Web Push: öffentlicher Schlüssel, Gerät an-/abmelden
    api/health                        Healthcheck (DB-Verbindung)
prisma/
  schema.prisma, migrations/, seed.ts (Super-Admin, globale Vorlagen, Demo-Verein; --presets-only für Updates)
```

### Tenants und Rollen

Ein Benutzer kann in beliebig vielen Tenants (Verein, Anlage, Gruppe) Mitglied sein, mit je eigener Rolle. Der aktive Tenant wird per Cookie gewechselt (`Mehr` → Verein wählen).

| Rolle | Darf |
|---|---|
| Super-Admin (global) | alles; globale Programme/Scheiben, Tenants und Benutzer verwalten |
| OWNER | wie ADMIN, zusätzlich Inhaber ernennen |
| ADMIN | Mitglieder, Rollen, Module, Tenant-Programme/-Scheiben, verstecken/anzeigen |
| TRAINER | alle Durchgänge im Tenant sehen; amtliche Resultate bestätigen, Standdienst, Vereinswaffen ausleihen, Kurse führen |
| MEMBER | eigene Durchgänge, Favoriten, eigene Scheiben hochladen |

Rechte sind in `src/lib/permissions.ts` zentral definiert (`can(actor, permission)`).

### Module

Registry in `src/lib/modules.ts`. Jedes Modul ist pro Tenant ein-/ausschaltbar (`TenantModule`). Neue Module: Eintrag in der Registry, Routen unter `src/app/(app)/<key>`, Logik unter `src/modules/<key>`.

**Navigation** (`src/components/app-shell.tsx`): Reihenfolge Start, Schiessen, Chat, Anlässe, Buchen, Scheiben, Dateien, Munition, Zahlungen, danach die Module der Welle B. Auf dem Desktop gruppiert die Seitenleiste in «Schiessen» (Resultate, Scheiben, Bundesübungen, Jahresmeisterschaft, Live-Rangliste) und «Verein» (Standbetrieb, Helfereinsätze, Kurse, Vereinswaffen); Vereinswaffen und Live-Rangliste erscheinen nur mit dem nötigen Recht. Die Tab-Leiste auf dem Handy zeigt höchstens fünf Einträge: die ersten vier aktiven plus «Mehr». Vorne steht, was man am Stand und unterwegs am häufigsten braucht (Resultate erfassen, Nachrichten, Termine, Reservieren). Alles Weitere ist unter «Mehr» (`/me`) aufgelistet und auf dem Desktop immer in der Seitenleiste. Der Ungelesen-Zähler des Chats hängt am Chat-Tab oder, wenn der Chat unter «Mehr» liegt, an «Mehr».

**Punkteerfassung** (`scores`)
- Programme mit Waffe, Wertungsmodus (Ringe ganz, Ringe Zehntel, Treffer/Fehler) und beliebig vielen Serien/Stationen (Distanz, Schusszahl, Max-Ring, Zeit, Anschlag, Scheibe, Hinweis). Passt vom 300-m-Stand bis zum Indoor-Parcours mit Hindernissen.
- Global (Super-Admin) oder pro Tenant (Admin). Tenants können globale Programme verstecken. Benutzer setzen Favoriten für den Schnellstart.
- Durchgang starten: Mitglieder des gleichen Tenants als Gegner wählen oder Gast mit Name/Bemerkung. Alle Teilnehmer mit Konto sehen den Durchgang und die Resultate.
- Eingabe mit grossem Tastenfeld, automatisches Speichern pro Serie, Live-Stand, Abschliessen/Wiedereröffnen.
- Persönliche Statistik (Bestleistung pro Programm).

**Zielscheiben** (`targets`)
- Generierte Sujets in Schwarz-Weiss: 10-Ring, 5-Ring, Punkte-Raster, Einschiessraster, Oval-Silhouette, Rauten, jeweils mit Parametern und Live-Vorschau.
- Eigene Uploads (PNG/JPG/SVG/PDF), privat oder mit dem Verein geteilt. Global (Super-Admin) und pro Tenant (Admin), Tenants können verstecken.
- Druckansicht für A4/A5/A6 mit exakten Millimetermassen; unten rechts klein Datum, Benutzer, Verein.

**Reservationen & Zahlungen** (`bookings`, pro Tenant aktivierbar)
- Ressourcen (Anlage, Bahn, Raum) mit Kapazität, optional eigenen Preisen; Sperrzeiten für Anlässe und Unterhalt.
- Pro Tenant: buchbare Dauern mit Preis (z.B. 30/60/90 Min.), Startraster, Öffnungszeiten je Wochentag, Vorlauf, Vorausbuchung, Stornofrist, Rabatt für spontane Buchungen.
- Freigabe durch Admin oder Sofortbuchung; Zahlung per Rechnung (automatische Nummer, Schweizer QR-Rechnung bei hinterlegter IBAN) und/oder Online-Zahlung.
- Zahlungsanbieter pro Tenant mit eigenem Konto: Stripe (Checkout + Webhook), Worldline Saferpay (Payment Page) und SumUp (Hosted Checkout). Zugangsdaten werden mit AES-256-GCM verschlüsselt gespeichert (`src/lib/crypto.ts`).
- Mitglieder sehen Verfügbarkeit live, buchen in vier Schritten, stornieren innerhalb der Frist. Admins geben frei, markieren Rechnungen als bezahlt, verwalten Erstattungen.
- Nicht abgeschlossene Online-Zahlungen geben den Slot nach 30 Minuten automatisch wieder frei.

**Mitgliederbeiträge** (`billing`, pro Tenant aktivierbar)
- Beitragskategorien pro Verein (Aktiv, Passiv, Jungschützen, …) mit Betrag; Zuordnung pro Mitglied, optional individueller Betrag und Mitgliedernummer.
- Jahreslauf: ein Klick erstellt für alle Mitglieder mit Beitrag die Rechnung mit fortlaufender Nummer (z.B. `MB-2026-0001`). Neue Mitglieder erhalten ihre Rechnung einzeln.
- Jede Rechnung mit Schweizer QR-Zahlteil (Zahler vorausgefüllt, wenn das Mitglied seine Adresse im Profil hinterlegt hat). Sammeldruck aller offenen Rechnungen, Zahlungserinnerungen für überfällige mit neuer Frist.
- Zahlungsstatus pro Rechnung (offen, bezahlt, storniert), Übersicht pro Jahr mit offenen und bezahlten Beträgen.
- Mitglieder sehen ihre Rechnungen unter «Beiträge» und drucken oder scannen sie direkt.

**Anlässe & News** (`events`, standardmässig aktiv)
- Vereinskalender mit Trainings, Wettkämpfen, Obligatorisch-Terminen, Sitzungen, Arbeitseinsätzen. An- und Abmeldung (Zusage, Vielleicht, Absage) mit Gästen, Kapazität und Anmeldeschluss.
- Wiederkehrende Anlässe (wöchentlich, 14-täglich), Absage mit Hinweis, Teilnehmerliste als CSV.
- Mitteilungen an alle Mitglieder, anpinnbar, mit Ablaufdatum. Dashboard-Karten für nächste Anlässe und Mitteilungen.
- iCal-Abos: Vereinskalender (`/api/ical/tenant/<token>.ics`) und persönlicher Kalender mit Zusagen und Reservationen (`/api/ical/me/<token>.ics`), Download pro Anlass oder Buchung.

**Zahlungsübersicht** (gemeinsam, sobald Beiträge, Reservationen oder Munition aktiv sind)
- Mitglieder sehen unter «Zahlungen» (`/payments`) alle Rechnungen und Zahlungen im Verein in einer Liste: Beitragsrechnungen, Reservations-Rechnungen, Online-Zahlungen von Reservationen und Munitionsrechnungen. Filter Offen/Bezahlt/Alle, Summen «offen» und «bezahlt dieses Jahr», überfällige rot markiert.
- Offene Rechnungen mit Kopierknöpfen für IBAN, QR-Referenz (bzw. Zahlungszweck) und Betrag; jede Zeile öffnet die Druckansicht mit QR-Zahlteil.
- Admins sehen unter «Offene Posten» (`/admin/payments`) alle unbezahlten Rechnungen aller Bereiche mit Summen pro Bereich, Filter «Nur überfällige» und CSV-Export.
- Bankimport (camt.053/054) ordnet Beiträge, Reservationen und Munitionsrechnungen über QR-Referenz oder Rechnungsnummer und Betrag zu, idempotent.

**Dateiablage** (`files`, pro Tenant aktivierbar)
- Ordner mit Sichtbarkeit pro Rolle (Mitglieder, Trainer, Admins, Inhaber; vererbt sich auf Unterordner), Upload für Mitglieder, Vorschau für Bilder und PDF, Suche.
- Speicherort pro Verein: **Server** (Standard), **S3/AWS**, **S3/Hetzner**, S3-kompatibel oder **Nextcloud** (WebDAV mit App-Passwort). Zugangsdaten verschlüsselt, Verbindungstest beim Speichern, Limit pro Datei und Kontingent pro Verein. Einrichtung: `docs/DEPLOY-CLOUDPANEL.md`.
- Dateien werden nie öffentlich verlinkt, sondern über `/api/documents/[id]` mit Rechteprüfung ausgeliefert.

**Chat** (`chat`, standardmässig aktiv)
- Direktnachrichten und Gruppen unter Mitgliedern eines Vereins, optional eine Vereinsgruppe mit allen Mitgliedern. Anhänge (Bilder, Dokumente), Bearbeiten und Löschen eigener Nachrichten, Stummschalten.
- Echtzeit über Server-Sent Events (`/api/chat/stream`), bei Problemen automatisch Abfragen im Hintergrund. Ungelesen-Zähler in Tab-Leiste und Seitenleiste, Karte auf der Startseite. Hinter nginx `proxy_buffering off` für den Stream setzen (Snippet in `docs/DEPLOY-CLOUDPANEL.md`).
- Wird ein Mitglied aus dem Verein entfernt, verlässt es automatisch alle Unterhaltungen dieses Vereins.

**Munition** (`ammo`, pro Tenant aktivierbar, **nur auf Rechnung**)
- Sortiment mit Kaliber, Verkaufseinheit, Preis und optionalem Bestand. Mitglieder bestellen in der App, Admins geben auf dem Platz aus (optional mit Freigabe und Ausweisprüfung) oder verkaufen direkt an der Theke.
- Bei der Abgabe entsteht eine Rechnung mit fortlaufender Nummer und QR-Zahlteil. Bar-, Karten- und Online-Zahlung sind bewusst nicht vorgesehen: Jede Abgabe ist so einer Person zugeordnet und nachvollziehbar. Die gesetzlichen Pflichten bleiben beim Verein.

**Erscheinungsbild pro Verein**: Logo-Upload mit Zuschnitt, Akzentfarbe und optionale Zweitfarbe (CI) mit Kontrastprüfung, Hell/Dunkel automatisch angepasst. Profilbilder pro Benutzer, Mitgliederverzeichnis, Darstellung System/Hell/Dunkel pro Benutzer.

**Rechnungsprofil** (gemeinsam): Zahlungsempfänger, Adresse, IBAN und Währung des Vereins, genutzt von Reservationen, Mitgliederbeiträgen und Munition. IBAN wird mit Prüfziffer validiert.

**Mitgliederverwaltung** (Berechtigungen `members.view` / `members.manage`)
- `/admin/members`: Liste mit Suche, Filtern (Status, Rolle, Kategorie, Haushalt, Zugang, Minderjährige), Seiten à 50, Sammelaktionen (Status, Kategorie, Zugangsmail, CSV-Export). Detailseite mit allen Feldern (Lizenznummer, Eintritt/Austritt, Erziehungsberechtigte bei Minderjährigen, interne Notiz) und Protokoll.
- **Status** Aktiv, Passiv, Ehrenmitglied, Jungschütze, Gönner, Ausgetreten. Ausgetretene behalten ihre Daten (Resultate, Rechnungen), haben aber keinen Zugang mehr zum Verein.
- **Haushalte**: Familien mit zahlender Person; der Jahreslauf erstellt pro Haushalt eine Sammelrechnung.
- **Import** (`/admin/members/import`): CSV oder Excel (.xlsx), Vorlagen für ClubDesk, WebLing und Excel, Vorschau mit Fehlern und Dubletten, optional Einladungsmail zum Passwort-Setzen.
- **Einladungen** per E-Mail mit Rolle (`/admin/members/invitations`), Annahme unter `/invite/<token>` mit Anmeldung oder Registrierung.

**Konto & Sicherheit** (`/me`)
- Profil mit Telefon und Geburtsdatum; **Sicherheit** (`/me/security`): Passwort ändern, Zwei-Faktor-Anmeldung (TOTP mit QR-Code, 8 Wiederherstellungscodes), aktive Sitzungen beenden. Passwort vergessen per E-Mail-Link.
- **Benachrichtigungen & Sprache** (`/me/notifications`): Sprache DE/FR/IT, Push auf diesem Gerät, pro Thema (Chat, Mitteilungen, Reservationen, Rechnungen, Anlässe, Erinnerungen, System) Push und E-Mail ein/aus. Benachrichtigt wird bei neuen Chatnachrichten (nur wenn nicht online), Mitteilungen, Absagen von Anlässen, Reservationsstatus und Rechnungen.
- **Datenschutz** (`/me/privacy`): alle eigenen Daten als ZIP, Konto löschen (pseudonymisiert; Rechnungen und Resultate bleiben dem Verein erhalten).
  Der Export umfasst auch die Daten der Welle-B-Module (Standbesuche, bestätigte Standordnungen, Qualifikationen, Kursteilnahmen mit Präsenz und Resultaten, Waffenausleihen, Helfereinsätze, Arbeitsstunden, gemeldete Vorfälle, Standdienste).
  Beim Löschen werden die Kopien von Personendaten anonymisiert: Name und Kontaktdaten in verknüpften Kursteilnahmen, der Name im Standdienst (`RangeDay.dutyName`), der Ausleihername bei Mitglieder-Ausleihen und Qualifikationsnummern.
  Bewusst erhalten bleiben (mit pseudonymisiertem Konto): Waffenausleihen samt Datum, Schusszahl und Meldefrist (Nachweis der Abgabe von Vereinswaffen, Waffengesetz/kantonale Vorgaben – bitte mit dem Kanton prüfen), Standbuch und Vorfälle (Nachweis des Standbetriebs) sowie Kurs-, Präsenz- und Qualifikationsresultate (Kursnachweis/NDS, Ranglisten). Die Aufbewahrungsfrist legt der Verein fest.

**Vereinsbetrieb (Welle B)** – alle Module pro Verein einschaltbar. Grenzwerte, Fristen und Regeln sind einstellbar und nie als Tatsache hinterlegt («Werte bitte mit den aktuellen Vorgaben (VBS/SSV/Kanton) prüfen»). Die App unterstützt Schützenmeister und Standchef, ersetzt aber nicht deren Verantwortung. AHV-Nummern werden nicht gespeichert.
- **Bundesübungen** (`/federal`, Recht `results.verify`): amtliche Art pro Programm (OP/FS/QUAL) mit Mindestpunkten und Nullern, «Amtlich bestätigen» mit Versuchsnummer und Sperre gegen spätere Änderungen, Durchgang zum Obligatorisch-Anlass, Verbliebene, Fristen pro Jahr, SAT-Admin-Export (CSV, Druckliste), Schiessnachweis (`/federal/nachweis`). Nach dem Update einmal `npm run db:seed:presets` ausführen (setzt die amtliche Art der globalen Vorlagen).
- **Standbetrieb** (`/range`, `range.duty` / `range.manage`): Standbuch mit Standchef und Übergabe, QR-Check-in (`/range/qr`) mit Bestätigung der Standordnung, Gäste, Vereinswaffen am Stand, Tagesabschluss mit Schiesshalbtagen, bewilligte Schiesszeiten (prüfen auch Reservationen) und Kontingent, Vorfälle, Jahresbericht, CSV.
- **Vereinswaffen** (`/weapons`, `weapons.loan` / `weapons.manage`): Inventar, Ausleihe mit Quittung, Rückgabe mit Schusszähler, Wartung, Meldefrist bei Minderjährigen. **Munitionskontrolle** (`/admin/ammo/stock`): Journal aller Bewegungen (Verkäufe automatisch), Inventur, Jahresübersicht nach Finanzierung.
- **Helfereinsätze** (`/shifts`, `shifts.manage`): Schichten zu Anlässen und Standdienst, Ein-/Austragen mit Platzsperre, Arbeitsstunden-Konto, Ersatzabgabe als QR-Rechnung. **Qualifikationen** (`/admin/qualifications`) mit Ablaufwarnung, genutzt von Standbetrieb, Schichten und Kursen.
- **Kurse** (`/courses`, `courses.manage`): Jungschützenkurs, J+S, Ausbildung; Teilnehmende mit CSV-Import, Kurstage mit Präsenz am Handy, Präsenz-CSV für die NDS, Pflichtprogramme, Kursausweis; Qualifikationsschiessen.
- **Jahresmeisterschaft** (`/championship`, `championship.manage`): Programme mit Gewichtung und Streichresultaten, Kategorien mit Bonus, «Mein Stand», Veröffentlichen, GV-Druck, CSV.
- **Live-Rangliste** (`/admin/live`): öffentlicher Vollbild-Link `/live/[token]` für den Bildschirm im Schützenhaus, Aktualisierung per Server-Sent Events. nginx darf `/api/live/*/stream` nicht puffern (wie `/api/chat/stream`).
- **Startseite**: Karten «Stand heute», «Meine nächste Schicht», «Obligatorisch» und «Meisterschaft: mein Rang», sobald das Modul aktiv ist. Anlässe vom Typ Obligatorisch verlinken auf Bundesübungen, Anlässe mit Schichten auf «Helfer gesucht».
- **Erinnerungen** (stündlicher Job `reminders`, `REMINDER_HOOKS`): Schichten (24 h vorher, Unterbesetzung, ablaufende Qualifikationen), Vereinswaffen (überfällige Ausleihen, Meldefristen, Wartung), Bundesübungen (Fristen, Vorabend des Obligatorisch). Jede Erinnerung wird über einen Protokolleintrag höchstens einmal verschickt.

**Betrieb & Nachvollziehbarkeit**
- **Protokoll** (Audit-Log) für Rollenwechsel, Löschungen, Importe, Exporte und Einstellungen: pro Verein unter `/admin/audit` (mit CSV und Vereinsarchiv als ZIP für Inhaber), für Super-Admins über alle Vereine unter `/super/audit`.
- **Vereine löschen** mit 30 Tagen Frist und «Wiederherstellen»; danach entfernt ein täglicher Job Daten und Dateien endgültig.
- **System** (`/super/system`): SMTP-Status, Mail-Warteschlange, fehlgeschlagene Mails erneut senden, Testmail, Job-Übersicht mit «Jetzt ausführen».
- **Hintergrund-Jobs** (`src/lib/jobs`): Mailversand (30 s), Aufräumen (stündlich), Erinnerungen (stündlich: Schichten, Vereinswaffen, Bundesübungen), Vereinslöschung und Totale nachtragen (täglich). Jeder Job ist über eine DB-Sperre gegen Doppelausführung geschützt; ausgelegt auf eine PM2-Instanz.
- **Healthcheck** `GET /api/health` (`{"ok":true}` / HTTP 503) für Deploy und Monitoring; `scripts/deploy.sh` sichert die Datenbank vor jeder Migration.

### Offline-Betrieb & App-Installation (PWA)

Standchef lässt sich auf dem Startbildschirm installieren (Teilen → «Zum Home-Bildschirm» bzw. «App installieren») und funktioniert im Schiessstand auch ohne Empfang.

- **Service Worker** (`public/sw.js`): Besuchte Seiten bleiben offline verfügbar (Netz zuerst, sonst Cache). Statische Dateien kommen aus dem Cache, Profilbilder und Scheiben werden im Hintergrund aufgefrischt. Ohne gespeicherte Seite erscheint `/offline`. Nie gecacht: Server Actions, `/api/sync`, Zahlungen, Login, Live-Rangliste (`/live`). Beim Abmelden werden benutzerbezogene Caches und Offline-Daten gelöscht. Bei Änderungen an `sw.js` die Konstante `VERSION` erhöhen; die App zeigt dann «Neue Version verfügbar – Aktualisieren».
- **Offline-Daten** (`src/lib/offline/`, IndexedDB `standchef-offline`): Snapshot des aktiven Vereins (Programme, Mitglieder, offene Durchgänge, `GET /api/offline/snapshot`) und eine Outbox mit ausstehenden Operationen.
- **Punkteerfassung offline**: Jeder Schuss wird sofort auf dem Gerät gespeichert und über `POST /api/sync` übertragen, sobald Empfang da ist (beim Wiederverbinden, beim Zurückkehren in die App, alle 60 s und per Background Sync). Gleichzeitige Änderungen: die jüngste gewinnt (`MatchResult.clientUpdatedAt`).
- **Durchgang offline starten**: entsteht lokal mit einer Client-ID (`Match.clientId`), wird später idempotent erstellt; die Offline-Ansicht wechselt danach automatisch zur normalen Seite.
- **Statusanzeige**: Eine Pille über der Tab-Leiste zeigt «Offline» und ausstehende oder fehlgeschlagene Übertragungen, mit «Jetzt synchronisieren», erneut versuchen oder verwerfen.
- **Zeitnehmung**: Bei Serien mit Zeitlimit grosser Countdown mit 3-2-1-Vorlauf, Ton, Vibration und wachem Bildschirm; sonst eine Stoppuhr.
- Entwicklung: Der Service Worker ist nur im Produktionsbuild aktiv, lokal mit `NEXT_PUBLIC_SW_DEV=1` einschaltbar.

Weitere Ergänzungen dieser Version:
- **Punkteerfassung**: Ranglisten pro Programm (Jahr/Monat/alle, Podest), Verlaufsdiagramm, persönliche Rekorde und Serien, CSV-Export (eigene Resultate, für Trainer/Admins alle), «Nochmals schiessen» mit denselben Gegnern, Vereinskopie globaler Programme, zwölf zusätzliche Programme.
- **Zielscheiben**: 25 neue Sujets (Präzision 25/50 m, Luftpistole/-gewehr mit Mehrfachblatt, Schweizer A- und P10-Scheibe nachempfunden, Einschiessen, Drills, Spiele, Uhr, Distanzleiter, Silhouetten, Platten), Massstab für Distanz (z.B. 300 m auf 25 m simulieren), mehrere Scheiben pro Blatt (2× A5, 4× A6 auf A4) mit Schnittlinien, Kategorien und Suche.
- **Reservationen**: Wochenkalender für Admins, Buchung im Auftrag eines Mitglieds (Rechnung, bar oder gratis), «Wiederholen», `.ics` pro Buchung, CSV-Export.
- **Beiträge**: QR-IBAN mit automatischer QR-Referenz, Bankimport camt.053/054 mit Vorschau und automatischem Abgleich (`/admin/billing/import`), Sammelmarkierung, Mahnzähler, CSV-Export, Kopierknöpfe für IBAN und Referenz.
- **Bedienung**: Toasts, barrierefreie Bestätigungsdialoge, Hilfe-Seite (`/help`), Erste-Schritte-Checkliste für Admins, Fehler- und 404-Seiten, Passwort anzeigen, Passwort ändern.
- **CI/CD**: GitHub Actions mit Prüfung und SSH-Deploy, siehe `docs/DEPLOY-CLOUDPANEL.md`.

## Produktion

Siehe `docs/DEPLOY-CLOUDPANEL.md` (inkl. SMTP mit SPF/DKIM, VAPID-Schlüssel, Backups und Wiederherstellung, Healthcheck, Jobs). Alle Umgebungsvariablen mit Erklärung stehen in `.env.example`. Kurzfassung: `.env` ausfüllen, `npm ci`, `npx prisma migrate deploy`, `npm run db:seed`, `npm run build`, `pm2 start ecosystem.config.cjs`. Updates mit `bash scripts/deploy.sh`; neue globale Programme und Scheiben ergänzt dabei `npx tsx prisma/seed.ts --presets-only` (legt nur fehlende Vorlagen an, kein Konto).
