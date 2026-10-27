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

## Optimierungen (noch nicht umgesetzt)

### Produkt
- **Offline-Eingabe**: Schiesskeller haben oft kein Netz. PWA mit Service Worker, Eingabe lokal puffern (IndexedDB) und beim nächsten Kontakt synchronisieren. Das Datenmodell (Serie = Liste von Schüssen) ist dafür schon geeignet.
- **Live-Wettkampf**: Gegner sehen die Eingabe des anderen in Echtzeit (Server-Sent Events oder Polling alle paar Sekunden auf der Match-Seite).
- **Ranglisten pro Tenant** (Vereinsmeisterschaft, Jahresbestenliste pro Programm) und Vergleich mit dem eigenen Schnitt.
- **Trefferbild**: Optional pro Schuss die Lage auf der Scheibe antippen (x/y), daraus Streukreis und Mittelpunkt berechnen. Kombiniert Modul Scheiben und Punkte.
- **Mehrsprachigkeit** (DE/FR/IT): UI-Strings sind heute direkt im Code. Als nächster Schritt in ein Dictionary auslagern (`src/lib/i18n`) und über `user.locale` wählen. Das Feld existiert bereits.
- **Einladungen per E-Mail** statt nur Beitrittscode, plus Gäste nachträglich einem Konto zuordnen.
- **Programm-Import/-Export** als JSON, damit Vereine Programme tauschen können.
- **Scheiben-Druck**: Mehrere Scheiben pro Blatt (z.B. 4× A6 auf A4), Schnittmarken, Vektor-PDF serverseitig (z.B. mit `pdf-lib`) statt Browser-Druck.
- **Reservationen, nächste Schritte**: Wiederkehrende Buchungen (jeden Dienstag), Serienbuchung für Trainer, Kalenderansicht pro Woche, iCal-Export, E-Mail-Bestätigung und Erinnerung, automatische Rückerstattung bei Storno (Stripe-Refund-API), Gästebuchungen ohne Konto mit Bezahlung, Preisregeln nach Rolle (Mitglieder gratis, Gäste zahlen) und Tageszeit (Nebenzeiten günstiger).
- **Mitgliederbeiträge**: Beitragskategorien, Jahresrechnung mit QR-Rechnung, Zahlungsabgleich per camt.054, Mahnwesen. Platzhalter-Modul ist angelegt; Rechnungs- und QR-Logik aus dem Reservationsmodul ist wiederverwendbar.

### Technik
- **Datenbank**: MySQL/MariaDB bleibt (CloudPanel). Bei Bedarf später PostgreSQL mit Row-Level-Security pro Tenant als zweite Verteidigungslinie; das Schema ist dafür vorbereitet.
- **Rate-Limiting** auf Login/Registrierung, Passwort-Reset per E-Mail (Resend/Postmark), optional Passkeys.
- **Storage-Adapter** für S3/Cloudflare R2 statt lokalem Dateisystem.
- **Tests**: Playwright-E2E für die Kernflüsse (Login, Durchgang, Druck) und Unit-Tests für `sanitizeShots`, `stageTotal`, SVG-Generator.
- **Audit-Log** für Admin-Aktionen (Rollenwechsel, Löschungen).
- **Soft-Delete** für Tenants und Durchgänge, damit versehentliches Löschen rückgängig gemacht werden kann.
- **Caching**: Programme und Scheiben pro Tenant mit `unstable_cache`/Tags, Invalidierung über Actions.
