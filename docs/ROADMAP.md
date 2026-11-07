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

### Welle D: Sprachen, Verband, Reste (erledigt)
- **Übersetzungen FR/IT der Mitgliederseiten**: App-Hülle (Navigation, «Mehr», Offline-Hinweis), Startseite, alle `/me`-Seiten, Hilfe/FAQ, Anmeldung, Registrierung, Einladung, Passwort, 404/Fehler, Verein wählen (Onboarding); Zahlungen, Beiträge und Online-Zahlung, Anlässe und Mitteilungen, Chat, «Meine Konsumationen»; Reservationen (Liste, Assistent, Detail, Bezahlen, Partner-Anlage, Rückkehr vom Zahlungsanbieter); Punkteerfassung, Schiessnachweis, Check-in, Helfereinsätze, Kurse, Meisterschaft «Mein Stand», Bundesübungen (Mitgliederansicht), Scheiben. `<html lang>` und Sprache für nicht angemeldete Personen (Cookie, Vereinssprache, Browser). Französisch mit Schweizer Schreibweise («société de tir», Guillemets mit schmalem geschütztem Leerzeichen), Italienisch mit «società di tiro». Wörterbücher `src/lib/i18n/extra/{shell,money,shooting,bookings}.ts` mit Tests auf Vollständigkeit und Platzhalter.
- **Kantonal-/Regionalverband** (`/association`, `/admin/association`, `/super/associations`): Super-Admins legen Verbände an und ernennen Verbandsadmins (ADMIN/VIEWER). Vereine treten per Code mit Einwilligung bei, der Verband gibt frei. Dashboard pro Jahr (Mitglieder, Obligatorisch, Feldschiessen, offene Bestätigungen, Fristen), vereinsübergreifende Rangliste (nur globale Programme; Namen nur bei «Namen teilen»), CSV und Druck. Beenden jederzeit, Zugriff endet sofort.
- **Beitritt mit Freigabe** (`Tenant.joinApproval`): Beitritt per Code erzeugt eine Anfrage (Membership `PENDING`) ohne Zugang; Freigabe/Ablehnung unter `/admin/members/requests` (`members.approve`), Zähler in der Navigation, Warteseite mit «Zurückziehen». Einladungen per E-Mail gelten weiter sofort (auch für wartende Anfragen).
- **Reservationen**: Serien für Trainer (`/bookings/series`, `bookings.series`) mit Vorschau und Konfliktprüfung (Öffnungszeiten, Sperren, Kapazität, Schiesszeiten), Storno einzeln oder ganz; Bestätigungs-Mail bei eigener Buchung und Storno; Erinnerung 24 h vorher (Job `bookings` in `REMINDER_HOOKS`, idempotent über `Booking.reminderSentAt`).
- **Offen aus Welle B erledigt**: Feldschiessen-Auszeichnungen mit Limitentabelle pro Programm/Jahr (`/federal/awards`, Druckliste, CSV, keine offiziellen Limiten eingebaut); `WeaponSettings` (Meldefrist Minderjährige, Wartungsintervall) und `ClubWeapon.blockReason`; Pro-rata-Arbeitsstunden; Nachname/Vorname im SAT-Export.
- **Offen aus Welle C erledigt**: Storno- und Rückerstattungsdatum als eigene Felder (Buchhaltung bucht am richtigen Tag); Barverkäufe der Schützenstube als Tagesbuchung (Kasse/Ertrag Schützenstube); Tab «Einzelrechnungen» mit Schutz gegen Doppelverrechnung bei Schützenstube-Rechnungen; Haushaltsrechnungen über `FeeInvoiceMember` (ältere Rechnungen werden einmalig nachgetragen); Partner-Rechnungen unter «Zahlungen» des Gastvereins mit Bankverbindung des Eigentümers; Mitgliedernummern natürlich sortiert.
- **Integration**: Navigation (Beitrittsanfragen mit Zähler, Verband, Verbände), FAQ (6 neue Einträge in DE/FR/IT), Datenexport und Kontolöschung mit Serien, Verbandsrollen und offenen Anfragen, Demo-Daten (Trainingsserie, Beitrittsanfrage, Demo-Kantonalverband `KSVDEMO1`, FS-Limiten als Beispiel), wartende Mitglieder in allen Modulen ausgeschlossen (`accessStatusWhere()`).
- **Offen aus Welle D**:
  - Admin-, Trainer- und Verbandsseiten sind weiterhin nur Deutsch (Verwaltung, Serien, Beitrittsanfragen, Verband, Auszeichnungen, Buchhaltung, Einzelrechnungen). Ebenso das Mitgliederverzeichnis `/members`, einige Server-Meldungen aus Helfereinsätzen, Kursen, Meisterschaft und Partnerbuchung, der Massstabshinweis auf der Scheiben-Detailseite und die Ausweichbezeichnung «Partnerverein».
  - Beträge in allen Sprachen im Format «CHF 4’380.00» (bewusst, gegen Unterschiede zwischen Server und Browser).
  - Gebühren der Zahlungsanbieter werden weiter von Hand gebucht (kein Anbieter liefert die Gebühr pro Zahlung).
  - Auszeichnungs-Kategorien nur nach Alter; Waffenkategorien (Stgw 90/57, Karabiner) über eigene Programme.
  - Partnerbuchungen über die gemeinsame Anlage und Online-Bezahlung lösen noch keine Bestätigungs-Mail aus.
  - Laufzeit-Prüfung im Browser (Playwright) für die neuen Seiten steht aus; geprüft mit Typprüfung, Lint, Unit-Tests und Produktions-Build.

### Welle E: Englisch, Claude, Übersetzungen (erledigt)
- **Englisch** als vierte Sprache (en-CH-Formate): alle Wörterbücher, 56 Hilfe-Einträge, eingebaute Programme, Verbandsmitteilungen, Mails, QR-Zahlteil (EN), Offline-Seiten. Auswahl im Profil, auf den Anmeldeseiten und als Vereinssprache.
- **Admin-Seiten übersetzt** (FR/IT/EN): Mitglieder, Beiträge, Zahlungen, Buchhaltung, Schützenstube, Reservationen, Munition, Dateien, Protokoll (`adm1`); Standbetrieb, Vereinswaffen, Helfereinsätze, Qualifikationen, Kurse, Meisterschaft, Bundesübungen, Live, Widgets, Verband, Super-Admin, Scheiben-Beschriftungen (`adm2`). Server-Meldungen werden übersetzt.
- **Übersetzungsverwaltung** `/super/translations`: Overrides pro Text und Sprache, Import/Export JSON, Vorschläge mit Claude und Diff-Vorschau.
- **Claude** (Modul «KI-Assistent»): Plattform- und Vereinseinstellungen (`/super/ai`, `/admin/ai`) mit eigenem Schlüssel pro Verein, Zustimmung, Funktionen mit Mindestrolle, Monatslimite und Verbrauch; Hilfe-Assistent (`/help`, schwebender Knopf «Fragen?»), Support-Assistent für Super-Admins (`/super/support`), Übersetzung von Anlässen, Mitteilungen und Standordnung mit Prüfung, Schreibhilfe, Trainingsauswertung (`/scores/stats`), Jahresbericht (`/admin/reports`), Spaltenzuordnung beim Resultat- und Mitglieder-Import. Gemeinsamer Kern `src/lib/ai` (Beta-Messages mit serverseitigem Fallback, Prompt-Caching, Refusal- und Fehlerbehandlung, Nutzungsprotokoll ohne Inhalt, lokale Ratenbegrenzung).
- **Reste**: Bestätigung bei Partnerbuchungen und nach Online-Zahlung, Feldschiessen-Auszeichnungen nach Waffenkategorie, übersetzte Upload- und Freigabe-Meldungen.
- **Integration**: Navigation (Super: Übersetzungen, Claude, Support-Assistent; Verwaltung: Claude, Jahresbericht), Job `ai.cache.purge` (täglich), FAQ zu Claude und Datenschutz (DE/FR/IT/EN), Datenauskunft mit KI-Anfragen und Übersetzungs-Metadaten, Pseudonymisierung von `AiUsage.userId` bei der Kontolöschung, Vereinsarchiv mit KI-Einstellungen (ohne Schlüssel) und Verbrauch, Demo-Verein mit eingeschaltetem Modul ohne Schlüssel.
- **Offen aus Welle E**:
  - CHF-Schätzungen der Claude-Kosten beruhen auf angenommenen Preisen (`CHF_PER_MILLION` in `src/modules/ai/usage/logic.ts`); vor dem Einsatz mit der Preisliste von Anthropic abgleichen.
  - Kein Live-Test gegen die Anthropic-API (alle Tests mit gemocktem Client); vor dem Einsatz mit einem Testschlüssel prüfen.
  - Noch Deutsch: Upload-Fehler aus dem Speicher-Adapter (`src/lib/file-storage`), Meldungen des Mitglieder-Imports, Formulare der Feldschiessen-Limiten (`AWARD_FORMAT_HINT`), öffentliche Website-Widgets, CSV-Köpfe des Verbands-Exports, Formulare der Anlässe/Mitteilungen (Editoren, ausser den KI-Teilen), Zonen-Editor im Programm-Editor, Produkt-Vorschläge in Schützenstube und Munition, gespeicherte Protokolltexte, Dauer-Fehler mit Zeilenbezug in den Reservations-Einstellungen («Dauer 60 Min.: …»).
  - Inzwischen übersetzt: Reservationen-Verwaltung (inkl. serverseitiger Meldungen der Reservations-Aktionen: Einstellungen, Ressourcen, Sperrzeiten, Buchung erfassen, Zahlungsanbieter), Serien, Programm-Editor, Auszeichnungen Feldschiessen und Anlässe-Verwaltung (Listen, Aktionen).
  - Mitglieder wählen ihre Waffenkategorie für Auszeichnungen noch nicht selbst in der Punkteerfassung (Komponente vorhanden, heute setzt der Vorstand sie unter `/federal/awards`).
  - Übersetzungen von Standordnungs-Entwürfen bleiben beim Löschen des Entwurfs bis zur Vereinslöschung liegen (harmlos).
  - Ratenbegrenzung der KI-Funktionen im Arbeitsspeicher (eine PM2-Instanz).

## Nächste Wellen

### Welle F
- **E2E-Tests** (Playwright) für Beitritt mit Freigabe, Serienbuchung, Verband, Sprachumschaltung (inkl. Englisch) und die Claude-Einrichtung mit gemocktem Anbieter.
- **bexio-API**: Buchungen und Debitoren direkt übertragen statt CSV-Import. Braucht einen Partnerzugang bei bexio (OAuth-App, Freigabe durch bexio) und eine Testfirma; bis dahin bleibt der Export (CSV/Banana) der Weg.
- **Live-Import aus elektronischen Trefferanzeigen**: Resultate während des Schiessens übernehmen (Meyton/SIUS-Schnittstelle, später Polytronic), angebunden an die Live-Rangliste. Braucht Zugang zu den Herstellerschnittstellen (Dokumentation, teils Lizenz) und eine Anlage mit echter Hardware zum Testen; der Datei-Import aus Welle C deckt den Ablauf nach dem Schiessen ab.

## Optimierungen (noch nicht umgesetzt)

### Produkt
- **Live-Wettkampf**: Gegner sehen die Eingabe des anderen in Echtzeit (Server-Sent Events oder Polling alle paar Sekunden auf der Match-Seite).
- **Vereinsmeisterschaft**: Vergleich mit dem eigenen Schnitt (die Wertung selbst ist mit der Jahresmeisterschaft umgesetzt).
- **Trefferbild**: Optional pro Schuss die Lage auf der Scheibe antippen (x/y), daraus Streukreis und Mittelpunkt berechnen. Kombiniert Modul Scheiben und Punkte.
- **Gäste nachträglich einem Konto zuordnen** (Beitritt mit Freigabe ist mit Welle D umgesetzt).
- **Programm-Import/-Export** als JSON, damit Vereine Programme tauschen können.
- **Scheiben-Druck**: Vektor-PDF serverseitig (z.B. mit `pdf-lib`) statt Browser-Druck.
- **Reservationen, nächste Schritte** (Serien, Bestätigung und Erinnerung sind mit Welle D umgesetzt): automatische Rückerstattung bei Storno (Stripe-Refund-API), Gästebuchungen ohne Konto mit Bezahlung, Preisregeln nach Rolle (Mitglieder gratis, Gäste zahlen) und Tageszeit (Nebenzeiten günstiger).
- **Mitgliederbeiträge, nächste Schritte**: Rechnung als PDF-Anhang per E-Mail, Teilzahlungen, Familienrabatte, pro-rata-Beitrag bei Austritt.

### Technik
- **Datenbank**: MySQL/MariaDB bleibt (CloudPanel). Bei Bedarf später PostgreSQL mit Row-Level-Security pro Tenant als zweite Verteidigungslinie; das Schema ist dafür vorbereitet.
- **Rate-Limiting** über mehrere Instanzen (heute In-Memory pro Prozess, ebenso TOTP-Wiederholschutz, Chat-Präsenz und Push-Verzögerung), optional Passkeys. Sitzungen mit Gerätename/User-Agent (Schema-Erweiterung).
- **Storage-Adapter** für S3/Cloudflare R2 statt lokalem Dateisystem.
- **Tests**: Playwright-E2E für die Kernflüsse (Login inkl. 2FA, Durchgang, Druck, Einladung). Unit-Tests (Vitest) bestehen bereits.
- **Soft-Delete** auch für Durchgänge (Vereine sind erledigt).
- **Deploy ohne Ausfall**: in ein separates `distDir` bauen und umschalten, damit ein abgebrochener Build nie ein halbes `.next` hinterlässt.
- **Caching**: Programme und Scheiben pro Tenant mit `unstable_cache`/Tags, Invalidierung über Actions.
