# Roadmap und Ideen

## Name

Gewählt: **Mouche**. Begründung und Alternativen:

| Kandidat | Pro | Contra |
|---|---|---|
| **Mouche** | Schützen-Jargon in DE-CH und FR-CH für den innersten Zehner. Kurz, positiv («eine Mouche schiessen»), passt zum Logo (Punkt im Ring). Als App-Name im Schiesssport nicht gefunden. | Allgemeines französisches Wort, Domain `mouche.ch` und Marke (Swissreg, Klasse 9/42) müssen geprüft werden. In Ticino weniger geläufig. |
| Zehni | Sehr schweizerisch, sympathisch. | Nur Deutschschweiz, in der Romandie nicht verständlich. |
| Zielwerk / Schusswerk | Neutral, keine Treffer gefunden. | Generisch, deutsch-only, weniger emotional. |
| Standblatt | Direkt aus dem Vereinsalltag. | Beschreibender Begriff, kaum schützbar. |

Vor dem Launch: Domain (`mouche.ch`, `mouche.app`, `getmouche.ch`), Swissreg-Markenrecherche, Social-Handles.

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
- **Reservationen**: Ressourcen pro Tenant, Slots, Wiederholungen, Freigabe nach Rolle. Platzhalter-Modul ist angelegt.
- **Zahlungen**: Schweizer QR-Rechnung (z.B. `swissqrbill`), TWINT/Karte über Stripe oder Payrexx, Munitionsabrechnung. Platzhalter-Modul ist angelegt.

### Technik
- **PostgreSQL** für Produktion, mit Row-Level-Security pro Tenant als zweite Verteidigungslinie zur Anwendungslogik.
- **Rate-Limiting** auf Login/Registrierung, Passwort-Reset per E-Mail (Resend/Postmark), optional Passkeys.
- **Storage-Adapter** für S3/Cloudflare R2 statt lokalem Dateisystem.
- **Tests**: Playwright-E2E für die Kernflüsse (Login, Durchgang, Druck) und Unit-Tests für `sanitizeShots`, `stageTotal`, SVG-Generator.
- **Audit-Log** für Admin-Aktionen (Rollenwechsel, Löschungen).
- **Soft-Delete** für Tenants und Durchgänge, damit versehentliches Löschen rückgängig gemacht werden kann.
- **Caching**: Programme und Scheiben pro Tenant mit `unstable_cache`/Tags, Invalidierung über Actions.
