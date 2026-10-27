# Mouche

**Die App für Schiessvereine und Schiessanlagen in der Schweiz.** Punkteerfassung, Zielscheiben zum Drucken, Vereinsverwaltung mit Mandanten (Tenants) und Rollen. Modular aufgebaut, mobile-first, ohne Verbandsbindung.

> *Mouche* ist das Wort, das Schweizer Schützen in Deutsch und Französisch für den innersten Zehner benutzen. Kurz, zweisprachig, merkbar. Siehe `docs/ROADMAP.md` für die Namensabwägung.

## Deployment

Die App läuft auf **CloudPanel** als Node.js-Site mit **MySQL/MariaDB**, ohne Docker. Anleitung: [`docs/DEPLOY-CLOUDPANEL.md`](docs/DEPLOY-CLOUDPANEL.md). Updates mit `bash scripts/deploy.sh`.

## Schnellstart (lokal)

Voraussetzung: MySQL oder MariaDB läuft lokal, Datenbank `mouche` und Benutzer `mouche` existieren (siehe `.env.example`).

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
  app/
    (auth)/       login, register
    (app)/        eingeloggter Bereich mit App-Shell (Tab-Bar mobil, Sidebar Desktop)
      scores/     Programme, Durchgänge, Statistik
      targets/    Galerie, Anlegen/Bearbeiten
      admin/      Tenant-Einstellungen, Module, Mitglieder
      super/      Super-Admin: Tenants, Benutzer, globale Programme/Scheiben
      bookings/   Platzhalter Reservationen
      billing/    Platzhalter Zahlungen
    targets/[id]/print   Druckansicht ohne App-Shell
    api/files/[id]       Auslieferung hochgeladener Dateien (mit Rechteprüfung)
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

## Produktion

Siehe `docs/DEPLOY-CLOUDPANEL.md`. Kurzfassung: `.env` ausfüllen, `npm ci`, `npx prisma migrate deploy`, `npm run db:seed`, `npm run build`, `pm2 start ecosystem.config.cjs`.
