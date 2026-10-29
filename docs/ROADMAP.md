# Roadmap und Ideen

## Name

Gewählt: **Standchef** (standchef.ch gekauft, standchef.app als Ergänzung empfohlen).

| Kandidat | Pro | Contra |
|---|---|---|
| **Standchef** | Echte Vereinsrolle, jeder Schütze kennt sie. Trägt alle Module (Punkte, Reservationen, Beiträge). Als zusammengesetztes Wort markenfähig. | Deutsch; in FR «chef de stand», in IT «capo stand». Männliche Funktionsbezeichnung. |
| Mouche | Zehner-Jargon in DE-CH und FR-CH, passt zum Logo. | mouche.ch und .com vergeben. Trägt nur das Punkte-Modul. |
| Salve | Dreisprachig, kurz. | Allgemeines Wort, Domains vermutlich vergeben. |
| Standbuch | Bodenständig, DE/FR verständlich. | Weniger Persönlichkeit als Standchef. |

Offen: Swissreg-Markenrecherche (Klassen 9 und 42), Social-Handles, standchef.app sichern.

## Umgesetzt (Auszug)

Details im README.
- **Offline-Eingabe** als PWA: Service Worker, IndexedDB-Outbox, Synchronisation über `/api/sync`, Durchgang offline starten.
- **Ranglisten pro Programm** (Jahr/Monat/alle) und persönliche Rekorde.
- **Mehrere Scheiben pro Blatt** (2× A5, 4× A6 auf A4) mit Schnittlinien.
- **Reservationen**: Wochenkalender für Admins, iCal pro Buchung und als persönliches Abo, CSV-Export.
- **Mitgliederbeiträge**: Bankimport camt.053/054 mit automatischem Abgleich, QR-IBAN mit QR-Referenz, CSV-Export.
- **Anlässe & News** mit iCal-Abos.
- **Absicherung**: Drosselung von Login, Registrierung und Beitrittscodes; Schutz gegen Einbetten auf fremden Seiten.

### Welle A: Fundament (erledigt)
- **Plattform**: Audit-Log, E-Mail-Warteschlange mit SMTP-Versand und Wiederholungen, Hintergrund-Jobs mit DB-Sperre, Healthcheck `/api/health`, Systemseite für Super-Admins (`/super/system`).
- **Konten**: Passwort vergessen/zurücksetzen per E-Mail, Einladungen per E-Mail mit Rolle, Passwort-Setzen für importierte Mitglieder, **Zwei-Faktor-Anmeldung (TOTP)** mit Wiederherstellungscodes, aktive Sitzungen verwalten.
- **Mitgliederverwaltung**: Liste mit Filtern und Sammelaktionen, Detailseite (Lizenznummer, Eintritt/Austritt, Erziehungsberechtigte), Mitgliederstatus inkl. «Ausgetreten» ohne Zugang, **Haushalte** mit Sammelrechnung im Jahreslauf, **Import CSV/Excel** (ClubDesk, WebLing), Mitgliederverzeichnis mit Kontaktdaten nach Berechtigung.
- **Mehrsprachigkeit (Grundlage)**: i18n-Kern DE/FR/IT; Mails, Benachrichtigungen und Rechnungen (inkl. QR-Zahlteil) in der Sprache von Mitglied bzw. Verein; Sprachwahl im Profil.
- **Benachrichtigungen**: Web Push (VAPID) und E-Mail nach Thema, pro Mitglied einstellbar; angebunden an Chat, Mitteilungen, Anlässe, Reservationen und Rechnungen.
- **Datenschutz (revDSG)**: eigener Datenexport als ZIP, Kontolöschung mit Pseudonymisierung, Vereinsarchiv für Inhaber, Protokoll pro Verein und global mit CSV.
- **Betrieb**: Vereine mit 30 Tagen Frist löschen und wiederherstellen, DB-Backup vor jeder Migration mit Rotation und Wiederherstellungsbefehl, Unit-Tests (Vitest) in CI, gespeicherte Resultat-Totale für schnelle Ranglisten.

## Nächste Wellen

### Welle B: Vereinsbetrieb (Datenmodell steht bereits)
- **Standbetrieb**: Schiesstage, Standblatt/Besucherliste mit QR-Check-in, Standregeln mit Bestätigung, Schiessfenster und Kontingente, Vorfälle melden (`RangeDay`, `RangeVisit`, `RangeRules`, `RulesAcceptance`, `ShootingWindow`, `ShootingQuota`, `Incident`).
- **Bundesübungen**: Obligatorisch und Feldschiessen mit offiziellem Programm, Bestanden-Prüfung (Mindestpunkte, Nuller), Visierung durch Schützenmeister, Wiederholungen (`Program.officialKind`, `MatchParticipant.passed/verifiedById`), Munitionsabrechnung nach Bund/Verein (`AmmoProduct.fundingType`).
- **Kurse**: Jungschützen- und Einsteigerkurse mit Teilnehmenden, Lektionen, Präsenz und Resultaten (`Course*`), Qualifikationen mit Regeln und Ablauf (`Qualification`, `QualificationRule`).
- **Schichten / Arbeitsstunden**: Helfereinsätze (Schützenfest, Standdienst) mit Einteilung, Soll-Stunden pro Mitglied, Erfassung und Befreiungen (`Shift`, `ShiftAssignment`, `WorkHoursSettings`, `WorkLog`).
- **Waffen**: Vereinswaffen mit Ausleihe, Rückgabe und Service-Historie (`ClubWeapon`, `WeaponLoan`, `WeaponService`), Munitionsbestand mit Bewegungen (`AmmoStockMovement`).
- **Meisterschaft**: Vereinsmeisterschaft über mehrere Programme mit Streichresultaten und Kategorien (`Championship`, `ChampionshipProgram`).
- **Live-Rangliste**: Bildschirm im Schützenhaus mit laufender Rangliste (`LiveBoard`), Aktualisierung über den Chat-Bus/SSE.
- **Erinnerungen** dieser Module über `REMINDER_HOOKS` (`src/lib/jobs/registry.ts`) und `notify()`.

### Welle C: Anbindungen
- **TWINT** (über Zahlungsanbieter) für Beiträge, Reservationen und Munition.
- **Banana Buchhaltung**: Export der Buchungen (Beiträge, Reservationen, Munition) im Banana-Format.
- **Elektronische Trefferanzeige**: Import von Resultaten aus SIUS/Polytronic/Meyton (CSV/XML).
- **Widgets**: einbettbare Termine, Ranglisten und Reservationskalender für die Vereinswebsite.
- **Gemeinsame Anlagen**: mehrere Vereine teilen eine Schiessanlage (Belegung, Kosten, Standbetrieb).

### Mehrsprachigkeit, nächste Schritte
1. App-Shell und /me übersetzen, `<html lang>` aus `getRequestLocale()`.
2. Häufigste Mitgliederseiten (Zahlungen, Anlässe, Reservationen, Chat, Punkteerfassung).
3. Login, Registrierung, Einladung.
4. Admin-Seiten.

## Optimierungen (noch nicht umgesetzt)

### Produkt
- **Live-Wettkampf**: Gegner sehen die Eingabe des anderen in Echtzeit (Server-Sent Events oder Polling alle paar Sekunden auf der Match-Seite).
- **Vereinsmeisterschaft** mit eigener Wertung über mehrere Programme und Vergleich mit dem eigenen Schnitt.
- **Trefferbild**: Optional pro Schuss die Lage auf der Scheibe antippen (x/y), daraus Streukreis und Mittelpunkt berechnen. Kombiniert Modul Scheiben und Punkte.
- **Beitritt mit Freigabe** durch Admin (statt sofort per Code), Gäste nachträglich einem Konto zuordnen.
- **Programm-Import/-Export** als JSON, damit Vereine Programme tauschen können.
- **Scheiben-Druck**: Vektor-PDF serverseitig (z.B. mit `pdf-lib`) statt Browser-Druck.
- **Reservationen, nächste Schritte**: Wiederkehrende Buchungen (jeden Dienstag), Serienbuchung für Trainer, E-Mail-Bestätigung und Erinnerung, automatische Rückerstattung bei Storno (Stripe-Refund-API), Gästebuchungen ohne Konto mit Bezahlung, Preisregeln nach Rolle (Mitglieder gratis, Gäste zahlen) und Tageszeit (Nebenzeiten günstiger).
- **Mitgliederbeiträge, nächste Schritte**: Rechnung als PDF-Anhang per E-Mail, Online-Zahlung der Beitragsrechnung über den Zahlungsanbieter des Vereins, Teilzahlungen, Familienrabatte, pro-rata-Beitrag bei Austritt. Beitragsübersicht zählt Haushaltsmitglieder ohne eigene Rechnung noch als «nicht verrechnet».
- **Mitgliedernummern** numerisch sortieren (heute Textsortierung: «10» vor «9»).

### Technik
- **Datenbank**: MySQL/MariaDB bleibt (CloudPanel). Bei Bedarf später PostgreSQL mit Row-Level-Security pro Tenant als zweite Verteidigungslinie; das Schema ist dafür vorbereitet.
- **Rate-Limiting** über mehrere Instanzen (heute In-Memory pro Prozess, ebenso TOTP-Wiederholschutz, Chat-Präsenz und Push-Verzögerung), optional Passkeys. Sitzungen mit Gerätename/User-Agent (Schema-Erweiterung).
- **Storage-Adapter** für S3/Cloudflare R2 statt lokalem Dateisystem.
- **Tests**: Playwright-E2E für die Kernflüsse (Login inkl. 2FA, Durchgang, Druck, Einladung). Unit-Tests (Vitest) bestehen bereits.
- **Soft-Delete** auch für Durchgänge (Vereine sind erledigt).
- **Haushaltsrechnungen explizit verknüpfen** (sobald Migrationen wieder möglich sind): Join-Tabelle `FeeInvoiceMember` (`invoiceId`, `membershipId`) oder ein Feld `coveredMembershipIds` an der Beitragsrechnung. Heute wird die Abdeckung aus `householdId`, `createdAt` und der Bezeichnung «(n Mitglieder)» abgeleitet (`householdCoverage` in `src/modules/billing/fee-run-plan.ts`).
- **Deploy ohne Ausfall**: in ein separates `distDir` bauen und umschalten, damit ein abgebrochener Build nie ein halbes `.next` hinterlässt.
- **Caching**: Programme und Scheiben pro Tenant mit `unstable_cache`/Tags, Invalidierung über Actions.
