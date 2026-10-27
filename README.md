# Standchef

**Die App für Schiessvereine und Schiessanlagen in der Schweiz.** Punkteerfassung, Zielscheiben zum Drucken, Vereinsverwaltung mit Mandanten (Tenants) und Rollen. Modular aufgebaut, mobile-first, ohne Verbandsbindung.

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

Beitrittscode Demo-Verein: `DEMO42`. Ohne Seed wird das allererste registrierte Konto automatisch Super-Admin.

Weitere Befehle: `npm run typecheck`, `npm run lint`, `npm run build`, `npm run db:deploy` (Migrationen in Produktion), `npm run db:studio`.

## Stack

- Next.js 16 (App Router, Server Actions, Turbopack), React 19, TypeScript
- Tailwind CSS 4 mit eigenen Design-Tokens (hell/dunkel automatisch)
- Prisma 7 mit MySQL/MariaDB (`@prisma/adapter-mariadb`), versionierte Migrationen in `prisma/migrations`. Das Schema verzichtet bewusst auf Enums und Json-Spalten, damit es bei Bedarf auf PostgreSQL portierbar bleibt.
- Eigene Session-Auth (bcrypt, DB-Sessions, httpOnly-Cookie), kein externer Auth-Dienst
- Datei-Uploads im lokalen `storage/uploads` (Schnittstelle in `src/lib/storage.ts`, für S3/R2 austauschbar)

## Architektur

```
src/
  lib/            Kern: db, auth, tenant-kontext, permissions, modules-registry, storage
  modules/
    core/         Auth- und Tenant-Actions (Registrierung, Beitritt, Rollen, Module)
    scores/       Punkteerfassung: types, presets, queries, actions, ui/
    targets/      Zielscheiben: types, presets, svg-generator, queries, actions, ui/
    bookings/     Reservationen: types, availability, pricing, invoice, payments/{stripe,worldline,sumup}, actions, ui/
    billing/      Mitgliederbeiträge: types, queries, actions, render (Rechnungsdaten), profile (Rechnungsprofil), ui/
  app/
    (auth)/       login, register
    (app)/        eingeloggter Bereich mit App-Shell (Tab-Bar mobil, Sidebar Desktop)
      scores/     Programme, Durchgänge, Statistik
      targets/    Galerie, Anlegen/Bearbeiten
      admin/      Tenant-Einstellungen, Module, Mitglieder
      super/      Super-Admin: Tenants, Benutzer, globale Programme/Scheiben
      bookings/   Reservieren, Detail, Bezahlen, Rücksprung vom Zahlungsanbieter
      admin/bookings/  Übersicht, Ressourcen, Einstellungen, Zahlungsanbieter
      billing/    Meine Beiträge
      admin/billing/   Übersicht und Jahreslauf, Mitglieder, Kategorien, Rechnungsprofil
    targets/[id]/print   Druckansicht ohne App-Shell
    bookings/[id]/invoice  Druckbare Reservations-Rechnung mit QR-Zahlteil
    billing/invoices/[id]/print   Druckbare Beitragsrechnung (optional als Zahlungserinnerung)
    admin/billing/runs/[id]/print Sammeldruck eines Jahreslaufs
  lib/qr-bill.ts            Schweizer QR-Rechnung als SVG (swissqrbill)
  components/invoice-document.tsx  Gemeinsames A4-Rechnungslayout
    api/files/[id]       Auslieferung hochgeladener Dateien (mit Rechteprüfung)
    api/payments/stripe/[tenantId]  Stripe-Webhook pro Tenant
```

### Tenants und Rollen

Ein Benutzer kann in beliebig vielen Tenants (Verein, Anlage, Gruppe) Mitglied sein, mit je eigener Rolle. Der aktive Tenant wird per Cookie gewechselt (`Mehr` → Verein wählen).

| Rolle | Darf |
|---|---|
| Super-Admin (global) | alles; globale Programme/Scheiben, Tenants und Benutzer verwalten |
| OWNER | wie ADMIN, zusätzlich Inhaber ernennen |
| ADMIN | Mitglieder, Rollen, Module, Tenant-Programme/-Scheiben, verstecken/anzeigen |
| TRAINER | alle Durchgänge im Tenant sehen |
| MEMBER | eigene Durchgänge, Favoriten, eigene Scheiben hochladen |

Rechte sind in `src/lib/permissions.ts` zentral definiert (`can(actor, permission)`).

### Module

Registry in `src/lib/modules.ts`. Jedes Modul ist pro Tenant ein-/ausschaltbar (`TenantModule`). Neue Module: Eintrag in der Registry, Routen unter `src/app/(app)/<key>`, Logik unter `src/modules/<key>`.

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

**Erscheinungsbild pro Verein**: Logo-Upload mit Zuschnitt, Akzentfarbe und optionale Zweitfarbe (CI) mit Kontrastprüfung, Hell/Dunkel automatisch angepasst. Profilbilder pro Benutzer, Mitgliederverzeichnis, Darstellung System/Hell/Dunkel pro Benutzer.

**Rechnungsprofil** (gemeinsam): Zahlungsempfänger, Adresse, IBAN und Währung des Vereins, genutzt von Reservationen und Mitgliederbeiträgen. IBAN wird mit Prüfziffer validiert.

### Offline-Betrieb & App-Installation (PWA)

Standchef lässt sich auf dem Startbildschirm installieren (Teilen → «Zum Home-Bildschirm» bzw. «App installieren») und funktioniert im Schiessstand auch ohne Empfang.

- **Service Worker** (`public/sw.js`): Besuchte Seiten bleiben offline verfügbar (Netz zuerst, sonst Cache). Statische Dateien kommen aus dem Cache, Profilbilder und Scheiben werden im Hintergrund aufgefrischt. Ohne gespeicherte Seite erscheint `/offline`. Nie gecacht: Server Actions, `/api/sync`, Zahlungen, Login. Beim Abmelden werden benutzerbezogene Caches und Offline-Daten gelöscht. Bei Änderungen an `sw.js` die Konstante `VERSION` erhöhen; die App zeigt dann «Neue Version verfügbar – Aktualisieren».
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

Siehe `docs/DEPLOY-CLOUDPANEL.md`. Kurzfassung: `.env` ausfüllen, `npm ci`, `npx prisma migrate deploy`, `npm run db:seed`, `npm run build`, `pm2 start ecosystem.config.cjs`.
