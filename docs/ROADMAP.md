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

### Welle B: Vereinsbetrieb (erledigt)
- **Bundesübungen** (`/federal`): amtliche Art pro Programm (OP/FS/QUAL) mit einstellbaren Bestehensregeln, «Amtlich bestätigen» durch den Schützenmeister mit Versuchsnummer und Sperre gegen Änderungen, Durchgang zum Obligatorisch-Anlass, Verbliebene, Fristen pro Jahr, SAT-Admin-Export (CSV und Druckliste, ohne AHV-Nummern), Schiessnachweis mit Bestätigung zum Drucken, Erinnerungen.
- **Standbetrieb** (`/range`): Standbuch mit Standchef, QR-Check-in mit Bestätigung der Standordnung, Gäste, Vereinswaffen am Stand, Tagesabschluss mit Schiesshalbtagen, bewilligte Schiesszeiten (auch als Prüfung bei Reservationen) und Halbtage-Kontingent, Vorfälle, Jahresbericht und CSV.
- **Vereinswaffen** (`/weapons`): Inventar, Ausleihe mit Quittung, Rückgabe mit Schusszähler, Wartung, Meldefrist bei Minderjährigen; **Munitionskontrolle** (`/admin/ammo/stock`) mit Bewegungsjournal, Inventur und Jahresübersicht nach Finanzierung.
- **Helfereinsätze** (`/shifts`): Schichten zu Anlässen und Standdienst, Ein- und Austragen, Arbeitsstunden-Konto, Ersatzabgabe als QR-Rechnung, **Qualifikationen** (`/admin/qualifications`) mit Ablaufwarnung.
- **Kurse** (`/courses`): Jungschützenkurs, J+S, Ausbildung mit Teilnehmenden (CSV-Import), Kurstagen, Präsenz am Handy, Präsenz-CSV für die NDS, Pflichtprogrammen, Kursausweis; Qualifikationsschiessen mit Regeln.
- **Jahresmeisterschaft** (`/championship`): Programme mit Gewichtung, Streichresultaten und Kategorien, Rangliste mit «Mein Stand», Veröffentlichen, GV-Druck und CSV.
- **Live-Rangliste** (`/admin/live`, öffentlich `/live/[token]`): Vollbild für den Bildschirm im Schützenhaus mit SSE-Aktualisierung, ablaufendem geheimem Link und QR-Code.
- **Integration**: Navigation mit Gruppen «Schiessen» und «Verein», Statuskarten auf der Startseite, Querverweise im Anlass (Obligatorisch, Helfer gesucht), Erinnerungen über `REMINDER_HOOKS` (Schichten, Vereinswaffen, Bundesübungen), Demo-Daten für alle Module, FAQ.
- **Offen aus Welle B**: Feldschiessen-Auszeichnungen (Kranz/Karte) mit Limitentabelle; Einstellungen pro Verein für Waffen-Meldefristen und Sperrgrund als eigene Felder (braucht Schema-Erweiterung); Pro-rata-Arbeitsstunden bei Eintritt im Lauf des Jahres; Vor- und Nachname getrennt für den SAT-Export.

### Welle C: Anbindungen (erledigt)
- **Online-Zahlung** (`src/lib/payments`): gemeinsame Anbieterschicht für Reservationen und Beiträge; neu **Payrexx** (TWINT, PostFinance, Karte) mit signierten API-Aufrufen und Webhook `/api/payments/payrexx/[tenantId]`, der den Status immer beim Anbieter nachliest. Beitragsrechnungen (Jahresbeitrag, Ersatzabgabe, Schützenstube) sind online bezahlbar (`/billing/invoices/[id]/pay`), Verbuchung genau einmal und nur bei passendem Betrag. **Munition bleibt bewusst nur per Rechnung** (Vorgaben der Anbieter).
- **Buchhaltung** (`/admin/accounting`): Kontenplan nach KMU-Kontenrahmen, Journal aus Beiträgen, Reservationen, Munition und Online-Zahlungen (inkl. Storno, Rückerstattung, Doppelzahlung), Export für Banana (.txt), bexio (CSV) und als generisches CSV.
- **Resultat-Import** (`/scores/import`): Assistent für Meyton, SIUS, ShotMarker und CSV (Vorlagen, bitte mit eigener Exportdatei prüfen), Namensabgleich mit Mitgliedern, Prüfung gegen das Programm, Schutz vor Doppelimport.
- **Website-Widgets und iCal** (`/admin/embed`, öffentlich `/embed/[token]/…`): Kalender, Schiesszeiten, signierte Ranglisten und Jahresmeisterschaft als iframe; iCal mit Zeitzone Europe/Zurich, abgesagten Terminen, Kursen und Helfereinsätzen im persönlichen Abo.
- **Gemeinsame Anlagen**: Anlagen mit Partnervereinen teilen (Partnertarif, Pause, Widerruf), Buchung durch Partnermitglieder nach den Regeln des Eigentümers, Bericht und CSV pro Partnerverein (`/admin/bookings/partners`).
- **Schützenstube** (`/kiosk`): Theke für Tablets mit Offline-Warteschlange, «Meine Konsumationen», Sortiment, periodische Abrechnung als Beitragsrechnung, Kasse pro Tag, CSV.
- **Integration**: Navigation, Verwaltungslinks, «Online bezahlen» auf der Startseite, FAQ, Demo-Daten, Datenexport und Kontolöschung inkl. Schützenstube.
- **Offen aus Welle C**: Live-Test mit einer Payrexx-Testinstanz vor dem Einsatz; Gebühren der Zahlungsanbieter und Barverkäufe der Schützenstube werden nicht automatisch gebucht; Rückerstattungen nur von Hand im Backoffice des Anbieters; X/Y-Trefferlage beim Import wird nicht gespeichert; Partner-Rechnungen erscheinen nicht unter «Zahlungen» des Gastvereins.

## Nächste Wellen

### Welle D
- **Übersetzungen der Mitgliederseiten** (FR/IT): Zahlungen, Anlässe, Reservationen, Chat, Punkteerfassung, Schützenstube, danach Login/Registrierung und Admin-Seiten.
- **Kantonalverband**: Ansicht über mehrere Vereine (z.B. Obligatorisch-Statistik, Meldungen, Jahresmeisterschaft).
- **bexio-API**: Buchungen und Debitoren direkt übertragen statt CSV-Import.
- **Live-Import aus elektronischen Trefferanzeigen**: Resultate während des Schiessens übernehmen (Meyton/SIUS-Schnittstelle, später Polytronic), angebunden an die Live-Rangliste.

### Mehrsprachigkeit, nächste Schritte
1. App-Shell und /me übersetzen, `<html lang>` aus `getRequestLocale()`.
2. Häufigste Mitgliederseiten (Zahlungen, Anlässe, Reservationen, Chat, Punkteerfassung).
3. Login, Registrierung, Einladung.
4. Admin-Seiten.

## Optimierungen (noch nicht umgesetzt)

### Produkt
- **Live-Wettkampf**: Gegner sehen die Eingabe des anderen in Echtzeit (Server-Sent Events oder Polling alle paar Sekunden auf der Match-Seite).
- **Vereinsmeisterschaft**: Vergleich mit dem eigenen Schnitt (die Wertung selbst ist mit der Jahresmeisterschaft umgesetzt).
- **Trefferbild**: Optional pro Schuss die Lage auf der Scheibe antippen (x/y), daraus Streukreis und Mittelpunkt berechnen. Kombiniert Modul Scheiben und Punkte.
- **Beitritt mit Freigabe** durch Admin (statt sofort per Code), Gäste nachträglich einem Konto zuordnen.
- **Programm-Import/-Export** als JSON, damit Vereine Programme tauschen können.
- **Scheiben-Druck**: Vektor-PDF serverseitig (z.B. mit `pdf-lib`) statt Browser-Druck.
- **Reservationen, nächste Schritte**: Wiederkehrende Buchungen (jeden Dienstag), Serienbuchung für Trainer, E-Mail-Bestätigung und Erinnerung, automatische Rückerstattung bei Storno (Stripe-Refund-API), Gästebuchungen ohne Konto mit Bezahlung, Preisregeln nach Rolle (Mitglieder gratis, Gäste zahlen) und Tageszeit (Nebenzeiten günstiger).
- **Mitgliederbeiträge, nächste Schritte**: Rechnung als PDF-Anhang per E-Mail, Teilzahlungen, Familienrabatte, pro-rata-Beitrag bei Austritt. Beitragsübersicht zählt Haushaltsmitglieder ohne eigene Rechnung noch als «nicht verrechnet».
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
