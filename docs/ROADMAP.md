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

## Optimierungen (noch nicht umgesetzt)

### Produkt
- **Live-Wettkampf**: Gegner sehen die Eingabe des anderen in Echtzeit (Server-Sent Events oder Polling alle paar Sekunden auf der Match-Seite).
- **Vereinsmeisterschaft** mit eigener Wertung über mehrere Programme und Vergleich mit dem eigenen Schnitt.
- **Trefferbild**: Optional pro Schuss die Lage auf der Scheibe antippen (x/y), daraus Streukreis und Mittelpunkt berechnen. Kombiniert Modul Scheiben und Punkte.
- **Mehrsprachigkeit** (DE/FR/IT): UI-Strings sind heute direkt im Code. Als nächster Schritt in ein Dictionary auslagern (`src/lib/i18n`) und über `user.locale` wählen. Das Feld existiert bereits.
- **Einladungen per E-Mail** statt nur Beitrittscode (oder Beitritt mit Freigabe durch Admin), plus Gäste nachträglich einem Konto zuordnen.
- **Programm-Import/-Export** als JSON, damit Vereine Programme tauschen können.
- **Scheiben-Druck**: Vektor-PDF serverseitig (z.B. mit `pdf-lib`) statt Browser-Druck.
- **Reservationen, nächste Schritte**: Wiederkehrende Buchungen (jeden Dienstag), Serienbuchung für Trainer, E-Mail-Bestätigung und Erinnerung, automatische Rückerstattung bei Storno (Stripe-Refund-API), Gästebuchungen ohne Konto mit Bezahlung, Preisregeln nach Rolle (Mitglieder gratis, Gäste zahlen) und Tageszeit (Nebenzeiten günstiger).
- **Mitgliederbeiträge, nächste Schritte**: Versand per E-Mail als PDF statt Druck, Online-Zahlung der Beitragsrechnung über den Zahlungsanbieter des Vereins, Teilzahlungen, Familienrabatte, Austrittsdatum mit pro-rata-Beitrag.

### Technik
- **Datenbank**: MySQL/MariaDB bleibt (CloudPanel). Bei Bedarf später PostgreSQL mit Row-Level-Security pro Tenant als zweite Verteidigungslinie; das Schema ist dafür vorbereitet.
- **Rate-Limiting** über mehrere Instanzen (heute In-Memory pro Prozess), Passwort-Reset per E-Mail (Resend/Postmark), optional Passkeys.
- **Storage-Adapter** für S3/Cloudflare R2 statt lokalem Dateisystem.
- **Tests**: Playwright-E2E für die Kernflüsse (Login, Durchgang, Druck) und Unit-Tests für `sanitizeShots`, `stageTotal`, SVG-Generator.
- **Audit-Log** für Admin-Aktionen (Rollenwechsel, Löschungen).
- **Soft-Delete** für Tenants und Durchgänge, damit versehentliches Löschen rückgängig gemacht werden kann.
- **Caching**: Programme und Scheiben pro Tenant mit `unstable_cache`/Tags, Invalidierung über Actions.
