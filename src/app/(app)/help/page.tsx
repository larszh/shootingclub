import type { Metadata } from "next";
import Link from "next/link";
import { getAppContext } from "@/lib/tenant";
import type { Permission } from "@/lib/permissions";
import { PageHeader } from "@/components/ui";
import { Faq, type FaqEntry } from "./faq";

export const metadata: Metadata = { title: "Hilfe" };

/** Fragen mit Antwort als JSX und als Klartext (für die Suche). */
function entry(id: string, audience: FaqEntry["audience"], q: string, text: string, a: React.ReactNode): FaqEntry {
  return { id, audience, q, text, a };
}

const ENTRIES: FaqEntry[] = [
  entry(
    "beitreten",
    "member",
    "Wie trete ich einem Verein bei?",
    "Beitrittscode vom Vorstand Einladungslink registrieren Mehr weiterem Verein beitreten mehrere Vereine wechseln",
    <>
      <p>Du brauchst den Beitrittscode deines Vereins (z.B. <span className="font-mono">7KQ2PX</span>). Den bekommst du vom Vorstand oder als Einladungslink.</p>
      <ol>
        <li>Neu hier: Beim <strong>Registrieren</strong> den Code ins Feld «Beitrittscode» eintragen. Mit einem Einladungslink ist er schon ausgefüllt.</li>
        <li>Schon ein Konto: Unter <Link href="/me">Mehr</Link> → «Weiterem Verein beitreten / neu anlegen» den Code eingeben.</li>
      </ol>
      <p>Du kannst in mehreren Vereinen sein und unter «Mehr» jederzeit wechseln.</p>
    </>,
  ),
  entry(
    "offline",
    "member",
    "Wie erfasse ich Resultate offline (ohne Empfang im Stand)?",
    "offline ohne Internet Empfang Keller Stand Synchronisierung übertragen später Sync Cache Wolke",
    <>
      <p>Standchef funktioniert auch ohne Internet. Wichtig ist nur, dass du die App <strong>einmal mit Verbindung</strong> und angemeldet geöffnet hast – dann sind Programme und Mitglieder auf dem Gerät gespeichert.</p>
      <ul>
        <li>Ohne Verbindung startest du Durchgänge und erfasst Schüsse wie gewohnt. Alles wird auf dem Gerät gespeichert.</li>
        <li>Sobald du wieder online bist, werden die Daten automatisch übertragen. Eine kleine Anzeige zeigt, wie viel noch wartet.</li>
        <li>Seiten, die du schon einmal geöffnet hast, kannst du offline weiter ansehen.</li>
      </ul>
      <p>Tipp: Auf dem Handy über das Teilen-Menü «Zum Home-Bildschirm» hinzufügen – dann startet Standchef wie eine App.</p>
    </>,
  ),
  entry(
    "durchgang",
    "member",
    "Wie starte ich einen Durchgang und erfasse Schüsse?",
    "Durchgang starten Programm Favorit Stern Gegner Gast Tastenfeld Serie speichern abschliessen",
    <>
      <ol>
        <li>Auf der Startseite «Durchgang starten» tippen oder ein Favoriten-Programm wählen.</li>
        <li>Optional Vereinskollegen oder Gäste hinzufügen.</li>
        <li>Schüsse mit dem grossen Tastenfeld eingeben. Jede Serie wird automatisch gespeichert.</li>
        <li>Zum Schluss «Abschliessen». Bei Bedarf kannst du den Durchgang wieder öffnen.</li>
      </ol>
      <p>Mit dem Stern bei einem <Link href="/scores/programs">Programm</Link> erscheint es auf der Startseite zum Schnellstart.</p>
    </>,
  ),
  entry(
    "scheiben",
    "member",
    "Wie drucke ich Zielscheiben?",
    "Scheibe drucken Zielscheiben A4 A5 A6 Drucker Massstab 100% tatsächliche Grösse PDF eigene hochladen",
    <>
      <ol>
        <li>Unter <Link href="/targets">Scheiben</Link> ein Sujet wählen.</li>
        <li>Unter «Druckoptionen» Papierformat (A4, A5 oder A6) und Anzahl Blätter wählen, dann drucken.</li>
        <li>Im Druckdialog <strong>«Tatsächliche Grösse» bzw. Skalierung 100 %</strong> wählen, damit die Ringe exakt stimmen.</li>
      </ol>
      <p>Eigene Scheiben kannst du als PNG, JPG, SVG oder PDF hochladen und mit dem Verein teilen.</p>
    </>,
  ),
  entry(
    "reservieren",
    "member",
    "Wie reserviere ich eine Bahn oder die Anlage?",
    "reservieren Reservation Bahn Anlage Raum buchen Zeit stornieren Freigabe bezahlen online Rechnung",
    <>
      <ol>
        <li>Unter <Link href="/bookings">Reservieren</Link> die Ressource wählen (z.B. Bahn 1).</li>
        <li>Tag, Dauer und freie Startzeit antippen.</li>
        <li>Bestätigen und – je nach Verein – per Rechnung oder online bezahlen.</li>
      </ol>
      <p>Muss der Verein freigeben, siehst du «wartet auf Freigabe». Stornieren kannst du bis zur Stornofrist direkt in der Reservation.</p>
    </>,
  ),
  entry(
    "qr-rechnung",
    "member",
    "Wie bezahle ich Beiträge mit der QR-Rechnung?",
    "Beiträge Mitgliederbeitrag QR-Rechnung bezahlen Banking App scannen E-Banking Twint Einzahlungsschein Referenz",
    <>
      <ol>
        <li>Unter <Link href="/payments">Zahlungen</Link> (oder <Link href="/billing">Beiträge</Link>) die offene Rechnung öffnen.</li>
        <li>In deiner Banking-App «QR-Rechnung scannen» wählen und den QR-Code abfotografieren – Betrag, Konto und Referenz sind dann schon ausgefüllt.</li>
        <li>Am Computer: Rechnung drucken oder als PDF speichern und wie gewohnt einzahlen.</li>
      </ol>
      <p>Den Zahlungseingang trägt der Verein ein. Danach steht die Rechnung auf «bezahlt».</p>
    </>,
  ),
  entry(
    "zahlungen",
    "member",
    "Wo sehe ich alle meine Rechnungen und Zahlungen?",
    "Zahlungsübersicht Zahlungen Rechnungen offen bezahlt Beiträge Reservation Munition Online-Zahlung IBAN Referenz kopieren überfällig",
    <>
      <p>Unter <Link href="/payments">Zahlungen</Link> (auf dem Handy unter «Mehr») siehst du alles an einem Ort: Mitgliederbeiträge, Rechnungen für Reservationen, Online-Zahlungen und Munitionsrechnungen.</p>
      <ul>
        <li><strong>Offen</strong> zeigt, was du noch bezahlen musst. Überfällige Rechnungen sind rot markiert.</li>
        <li>Bei offenen Rechnungen kopierst du IBAN und Referenz mit einem Tipp und fügst sie im E-Banking ein. Oder du öffnest die QR-Rechnung und scannst sie mit der Banking- oder TWINT-App.</li>
        <li><strong>Bezahlt</strong> zeigt erledigte Rechnungen, oben steht die Summe für dieses Jahr.</li>
      </ul>
      <p>Bis der Verein deine Zahlung verbucht hat, kann es ein paar Tage dauern. Danach steht die Rechnung auf «bezahlt».</p>
    </>,
  ),
  entry(
    "online-bezahlen",
    "member",
    "Kann ich Beiträge online bezahlen (TWINT, Karte)?",
    "online bezahlen TWINT PostFinance Karte Kreditkarte Payrexx Stripe Worldline SumUp Beitrag Ersatzabgabe Schützenstube Munition",
    <>
      <p>Wenn dein Verein einen Zahlungsanbieter eingerichtet hat, steht bei offenen Beitragsrechnungen (Jahresbeitrag, Ersatzabgabe, Schützenstube) der Knopf <strong>«Online bezahlen»</strong> – auf der Startseite, unter <Link href="/payments">Zahlungen</Link> und unter <Link href="/billing">Beiträge</Link>.</p>
      <ol>
        <li>«Online bezahlen» tippen und auf der nächsten Seite bestätigen.</li>
        <li>Auf der Zahlungsseite des Anbieters mit TWINT, PostFinance oder Karte bezahlen (welche Zahlarten es gibt, hängt vom Verein ab).</li>
        <li>Danach kommst du zurück zu Standchef. Die Rechnung steht nach wenigen Sekunden auf «bezahlt».</li>
      </ol>
      <p><strong>Munitionsrechnungen</strong> bezahlst du immer mit der QR-Rechnung – eine Online-Zahlung ist dafür nicht möglich.</p>
    </>,
  ),
  entry(
    "schuetzenstube",
    "member",
    "Wie funktioniert die Schützenstube (Konsumationen aufschreiben)?",
    "Schützenstube Kiosk Konsumation Getränke aufschreiben Theke bar bezahlen Abrechnung Rechnung Meine Konsumationen",
    <>
      <p>An der Theke schreibt das Thekenteam deine Getränke und Snacks auf deinen Namen auf – oder du bezahlst bar. Unter <Link href="/kiosk/me">Meine Konsumationen</Link> siehst du, was noch offen ist und was schon verrechnet wurde.</p>
      <p>Der Verein rechnet periodisch ab (z.B. monatlich). Du bekommst dann eine Rechnung «Schützenstube …», die du mit der QR-Rechnung oder – falls eingerichtet – online bezahlst.</p>
    </>,
  ),
  entry(
    "partner-anlagen",
    "member",
    "Kann ich die Anlage eines Partnervereins reservieren?",
    "Partnerverein Partner-Anlage gemeinsame Anlage teilen fremder Verein reservieren buchen Partnertarif",
    <>
      <p>Teilt ein anderer Verein eine Anlage mit deinem Verein, erscheint sie unter <Link href="/bookings">Buchen</Link> in der Gruppe «Anlagen von …». Du buchst wie gewohnt; es gelten die Regeln und Öffnungszeiten des anderen Vereins, der Preis mit dem vereinbarten Partnertarif.</p>
      <p>Die Rechnung stellt der Verein, dem die Anlage gehört (QR-Rechnung, keine Online-Zahlung). Deine Partnerbuchungen siehst du unter «Meine Reservationen», markiert mit «Anlage von …».</p>
    </>,
  ),
  entry(
    "kalender-abo",
    "member",
    "Wie sehe ich Anlässe, Reservationen und Helfereinsätze in meinem Handy-Kalender?",
    "Kalender abonnieren iCal ics Google Kalender Apple Outlook Abo Anlässe Reservationen Helfereinsätze Kurse",
    <>
      <p>Unter <Link href="/events">Anlässe</Link> findest du den Link «Kalender abonnieren». Dein persönlicher Kalender enthält deine Anmeldungen, Reservationen (auch bei Partnervereinen), Helfereinsätze und Kurstage. Abgesagte Termine werden im Kalender als abgesagt markiert.</p>
      <p>Den Link nicht weitergeben – er ist persönlich.</p>
    </>,
  ),
  entry(
    "chat",
    "member",
    "Wie funktioniert der Chat?",
    "Chat Nachricht schreiben Gruppe Direktnachricht ungelesen Zähler stumm Bild Datei anhängen bearbeiten löschen Vereinsgruppe",
    <>
      <ol>
        <li>Unter <Link href="/chat">Chat</Link> «Neue Nachricht» tippen und ein Vereinsmitglied wählen – oder eine Gruppe mit mehreren Personen anlegen.</li>
        <li>Nachricht schreiben und senden. Fotos und Dokumente hängst du mit der Büroklammer an.</li>
        <li>Die Zahl beim Chat-Symbol zeigt, wie viele Nachrichten du noch nicht gelesen hast.</li>
      </ol>
      <ul>
        <li>Eigene Nachrichten kannst du kurz nach dem Senden noch bearbeiten oder löschen.</li>
        <li>Wird es zu viel, schaltest du eine Unterhaltung stumm. Sie zählt dann nicht mehr zu den ungelesenen.</li>
        <li>Ohne Empfang wird die Nachricht gesendet, sobald du wieder online bist.</li>
      </ul>
      <p>Den Chat sehen nur Mitglieder deines Vereins. Wer den Verein verlässt, wird aus allen Unterhaltungen entfernt.</p>
    </>,
  ),
  entry(
    "dateien",
    "member",
    "Wo finde ich Reglemente, Protokolle und andere Dokumente?",
    "Dateiablage Dateien Dokumente Reglement Protokoll Formular herunterladen hochladen Ordner PDF Foto",
    <>
      <p>In der <Link href="/files">Dateiablage</Link> legt der Verein Dokumente in Ordnern ab, z.B. Reglemente, Formulare oder Fotos. Tippe auf eine Datei, um sie anzusehen oder herunterzuladen.</p>
      <p>Manche Ordner sind nur für Trainer oder den Vorstand sichtbar. Je nach Verein darfst du auch selbst Dateien hochladen.</p>
    </>,
  ),
  entry(
    "munition",
    "member",
    "Wie bestelle ich Munition – und warum nur auf Rechnung?",
    "Munition bestellen kaufen Rechnung bar Karte TWINT online Ausweis Abgabe Schiessplatz Waffengesetz Erwerbsberechtigung",
    <>
      <ol>
        <li>Unter <Link href="/ammo">Munition</Link> Sorte und Anzahl wählen und bestellen.</li>
        <li>Beim nächsten Training gibt dir die zuständige Person die Munition ab. Bring einen amtlichen Ausweis mit, falls der Verein das verlangt.</li>
        <li>Bei der Abgabe entsteht automatisch eine Rechnung mit QR-Code. Du findest sie unter <Link href="/payments">Zahlungen</Link>.</li>
      </ol>
      <p><strong>Warum nur auf Rechnung?</strong> Munition darf nur an berechtigte Personen abgegeben werden, und die Abgabe muss nachvollziehbar sein. Mit der Rechnung ist klar, wer wann was erhalten hat – ohne Bargeld in der Schützenstube und ohne Online-Kauf, bei dem niemand die Berechtigung prüfen kann.</p>
    </>,
  ),
  entry(
    "profil",
    "member",
    "Wie ändere ich Profilbild, Darstellung oder Passwort?",
    "Profilbild Foto Avatar dunkel hell Darstellung Dark Mode Passwort Adresse Profil",
    <>
      <p>Unter <Link href="/me">Mehr</Link> findest du dein Profil: Foto hochladen, Name, Telefon und Adresse (für QR-Rechnungen) und Darstellung (System, Hell, Dunkel). Passwort, Zwei-Faktor-Anmeldung und angemeldete Geräte findest du unter <Link href="/me/security">Sicherheit</Link>.</p>
    </>,
  ),
  entry(
    "benachrichtigungen",
    "member",
    "Wie schalte ich Benachrichtigungen ein oder aus? Wie wechsle ich die Sprache?",
    "Benachrichtigung Push Mitteilung E-Mail Mail Sprache Französisch Italienisch langue lingua iPhone Home-Bildschirm",
    <>
      <p>Unter <Link href="/me/notifications">Mehr → Benachrichtigungen &amp; Sprache</Link> wählst du die Sprache (Deutsch, Französisch, Italienisch) und pro Thema, ob du eine Push-Mitteilung und/oder eine E-Mail erhältst. Push schaltest du dort pro Gerät ein. Auf iPhone und iPad geht das erst, wenn Standchef über «Teilen → Zum Home-Bildschirm» installiert ist.</p>
    </>,
  ),
  entry(
    "zwei-faktor",
    "member",
    "Wie schütze ich mein Konto mit Zwei-Faktor-Anmeldung?",
    "Zwei-Faktor 2FA TOTP Authenticator Code Sicherheit Wiederherstellungscode Passwort vergessen",
    <>
      <p>Unter <Link href="/me/security">Mehr → Sicherheit</Link> «Zwei-Faktor einschalten» wählen, den QR-Code mit einer Authenticator-App scannen (z.B. Aegis, Google oder Microsoft Authenticator) und den 6-stelligen Code eingeben. Die Wiederherstellungscodes gut aufbewahren: Sie helfen, wenn das Handy verloren geht. Für Admins und Inhaber sehr empfohlen.</p>
      <p>Passwort vergessen? Auf der Anmeldeseite «Passwort vergessen?» wählen, du erhältst einen Link per E-Mail.</p>
    </>,
  ),
  entry(
    "datenschutz",
    "member",
    "Wie lade ich meine Daten herunter oder lösche mein Konto?",
    "Datenschutz DSG revDSG Export Daten herunterladen Konto löschen Account löschen Austritt",
    <>
      <p>Unter <Link href="/me/privacy">Mehr → Datenschutz</Link> lädst du alle deine Daten als ZIP herunter oder löschst dein Konto. Rechnungen, Buchungen und Resultate bleiben für den Verein erhalten, aber ohne deinen Namen (pseudonymisiert).</p>
    </>,
  ),
  entry(
    "logo-farben",
    "admin",
    "Wie setze ich Logo und Vereinsfarben?",
    "Logo Farben Akzentfarbe Markenfarbe CI Corporate Design Branding Verein Einstellungen Zweitfarbe",
    <>
      <ol>
        <li>Unter <Link href="/admin">Verein</Link> das Logo hochladen (quadratisch wirkt am besten, PNG oder JPG).</li>
        <li>Akzentfarbe und optional Zweitfarbe wählen. Die App passt Knöpfe, Hervorhebungen und die Browserleiste an – hell und dunkel.</li>
      </ol>
      <p>Mit dem Knopf «Standard» kehrst du jederzeit zu den Standchef-Farben zurück.</p>
    </>,
  ),
  entry(
    "mitglieder",
    "admin",
    "Wie lade ich Mitglieder ein und vergebe Rollen?",
    "Mitglieder einladen Beitrittscode Link teilen Rollen Admin Trainer Inhaber Mitglied entfernen",
    <>
      <p>Unter <Link href="/admin">Verein</Link> findest du Beitrittscode und Einladungslink zum Teilen (z.B. per WhatsApp oder E-Mail). Unter <Link href="/admin/members">Mitglieder</Link> fügst du bestehende Konten per E-Mail hinzu und vergibst Rollen.</p>
      <ul>
        <li><strong>Mitglied</strong>: eigene Resultate, Scheiben, Reservationen.</li>
        <li><strong>Trainer</strong>: sieht alle Resultate, führt Anlässe.</li>
        <li><strong>Admin</strong>: verwaltet Verein, Module, Mitglieder, Beiträge.</li>
        <li><strong>Inhaber</strong>: wie Admin, darf zusätzlich Inhaber ernennen.</li>
      </ul>
      <p>Wurde der Code weitergegeben, kannst du einen neuen erzeugen – der alte gilt dann nicht mehr.</p>
    </>,
  ),
  entry(
    "zahlungsanbieter",
    "admin",
    "Wie richte ich Online-Zahlung (Payrexx/TWINT, Stripe, Worldline, SumUp) ein?",
    "Zahlungsanbieter Online-Zahlung Payrexx TWINT PostFinance Stripe Worldline Saferpay SumUp Kreditkarte API Secret Instanz Webhook Beiträge Reservationen",
    <>
      <ol>
        <li>Unter <Link href="/admin/bookings/payments">Reservationen → Zahlungsanbieter</Link> (ohne Modul «Reservationen»: <Link href="/admin/billing/settings">Rechnungsprofil</Link>) den Anbieter wählen und die Zugangsdaten aus deinem Händlerkonto eintragen. Geheimnisse werden verschlüsselt gespeichert und nie wieder angezeigt.</li>
        <li><strong>Payrexx</strong>: Instanzname (der Teil vor <span className="font-mono">.payrexx.com</span>) und API-Secret eintragen, «Verbindung testen». Im Payrexx-Backend unter Webhooks die angezeigte Adresse <span className="font-mono">/api/payments/payrexx/&lt;Vereins-ID&gt;</span> hinterlegen (Typ Transaktion). Zuschläge für Zahlende ausgeschaltet lassen.</li>
        <li><strong>Stripe</strong>: die angezeigte Webhook-Adresse im Stripe-Dashboard hinterlegen (Ereignis checkout.session.completed).</li>
        <li>Für Reservationen: in den <Link href="/admin/bookings/settings">Reservations-Einstellungen</Link> «Online-Zahlung» aktivieren und den Anbieter wählen.</li>
        <li>Für Beiträge: im <Link href="/admin/billing/settings">Rechnungsprofil</Link> unter «Online-Zahlung für Beiträge» den Anbieter wählen.</li>
      </ol>
      <p>Das Geld fliesst direkt auf das Konto des Vereins; die Anbieter verrechnen dafür Gebühren. Munitionsrechnungen sind nie online bezahlbar (nur QR-Rechnung). Bitte vor dem Start eine Testzahlung machen.</p>
    </>,
  ),
  entry(
    "rechnungsprofil",
    "admin",
    "Wie erstelle ich Beitragsrechnungen mit QR-Code?",
    "Rechnungsprofil IBAN QR-IBAN Zahlungsempfänger Beitragskategorien Jahreslauf Mahnung Erinnerung bezahlt",
    <>
      <ol>
        <li>Unter <Link href="/admin/billing/settings">Rechnungsprofil</Link> Empfänger, Adresse und IBAN erfassen.</li>
        <li><Link href="/admin/billing/categories">Kategorien</Link> anlegen (z.B. Aktiv, Passiv, Jungschützen) und den Mitgliedern zuordnen.</li>
        <li>Unter <Link href="/admin/billing">Beiträge</Link> den Jahreslauf starten – alle erhalten ihre Rechnung mit QR-Zahlteil.</li>
      </ol>
      <p>Mit einer QR-IBAN wird automatisch eine Referenznummer erzeugt, so lassen sich Zahlungen leicht zuordnen.</p>
    </>,
  ),
  entry(
    "speicherort",
    "admin",
    "Wo werden die Dateien gespeichert? (Server, S3/AWS, Hetzner, Nextcloud)",
    "Dateiablage Speicherort Speicher Server lokal S3 AWS Amazon Hetzner Object Storage Nextcloud WebDAV App-Passwort Bucket Access Key Kontingent",
    <>
      <p>Unter <Link href="/admin/files">Dateiablage & Speicherort</Link> wählst du, wo die Dateien des Vereins liegen. Die Zugangsdaten werden verschlüsselt gespeichert.</p>
      <ul>
        <li><strong>Server</strong> (Standard): auf dem Standchef-Server. Nichts einzurichten.</li>
        <li><strong>S3 / AWS</strong>: eigener Bucket bei Amazon, z.B. in Zürich (<span className="font-mono">eu-central-2</span>). Bucket, Region, Access Key und Secret Key eintragen. Der Schlüssel braucht nur Lesen, Schreiben und Löschen in diesem Bucket.</li>
        <li><strong>S3 / Hetzner</strong>: Hetzner Object Storage. Standort wählen (Falkenstein, Nürnberg oder Helsinki), dann Bucket und S3-Zugangsschlüssel aus der Hetzner-Konsole eintragen.</li>
        <li><strong>Nextcloud</strong> (WebDAV): Adresse des Ordners, z.B. <span className="font-mono break-all">https://cloud.example.ch/remote.php/dav/files/verein/Standchef</span>, Benutzername und ein <strong>App-Passwort</strong> (Nextcloud → Persönliche Einstellungen → Sicherheit → Neues App-Passwort), nicht das normale Passwort.</li>
      </ul>
      <p>Beim Speichern prüft Standchef die Verbindung mit einer kleinen Testdatei. Wechselst du später den Speicherort, werden bestehende Dateien nicht automatisch verschoben.</p>
    </>,
  ),
  entry(
    "offene-posten",
    "admin",
    "Wie behalte ich den Überblick über offene Rechnungen?",
    "Offene Posten Debitoren überfällig Mahnung Bankimport camt CSV Export Beiträge Reservationen Munition bezahlt markieren",
    <>
      <p>Unter <Link href="/admin/payments">Offene Posten</Link> siehst du alle unbezahlten Rechnungen aus Beiträgen, Reservationen und Munition mit Summen pro Bereich. Überfällige sind rot markiert, mit «Nur überfällige» filterst du sie. Über «CSV» exportierst du die Liste für die Buchhaltung.</p>
      <p>Zahlungen verbuchst du am schnellsten mit dem <Link href="/admin/billing/import">Bankimport</Link>: Kontoauszug als camt.053 oder camt.054 aus dem E-Banking hochladen. Standchef ordnet die Zahlungen über die QR-Referenz oder Rechnungsnummer und Betrag zu – auch Munitionsrechnungen.</p>
    </>,
  ),
  entry(
    "munition-admin",
    "admin",
    "Wie richte ich den Munitionsverkauf ein?",
    "Munition Sortiment Produkte Kaliber Preis Bestand Ausgabe Ausweis prüfen Freigabe Rechnung Verkauf Theke",
    <>
      <ol>
        <li>Modul «Munition» unter <Link href="/admin">Verein</Link> einschalten und das <Link href="/admin/billing/settings">Rechnungsprofil</Link> mit IBAN ausfüllen.</li>
        <li>Unter <Link href="/admin/ammo">Munition verwalten</Link> das Sortiment mit Kaliber, Verkaufseinheit und Preis erfassen, optional mit Bestand.</li>
        <li>In den Einstellungen festlegen, ob Bestellungen freigegeben werden müssen und ob bei der Abgabe der Ausweis geprüft wird.</li>
      </ol>
      <p>Bei der Abgabe entsteht die Rechnung mit QR-Zahlteil. Barzahlung, Karte oder Online-Zahlung gibt es für Munition bewusst nicht: Die Rechnung dokumentiert jede Abgabe an eine bestimmte Person. Für die Einhaltung der gesetzlichen Vorgaben bleibt der Verein verantwortlich.</p>
    </>,
  ),
  entry(
    "stand-checkin",
    "member",
    "Wie checke ich am Stand ein?",
    "Standbetrieb Check-in einchecken auschecken QR-Code Standordnung Standbuch Stand offen",
    <>
      <p>Scanne den QR-Code am Stand oder öffne <Link href="/range">Standbetrieb</Link> → «Einchecken». Beim ersten Mal bestätigst du die aktuelle Standordnung. Beim Gehen tippst du auf «Auschecken».</p>
      <p>So weiss der Standchef, wer am Stand ist. Die Einträge landen im Standbuch des Vereins.</p>
    </>,
  ),
  entry(
    "helfer",
    "member",
    "Wie trage ich mich für einen Helfereinsatz ein?",
    "Helfereinsätze Schicht eintragen austragen Arbeitsstunden Ersatzabgabe Stunden erfassen Kalender",
    <>
      <p>Unter <Link href="/shifts">Helfereinsätze</Link> siehst du offene Schichten. Mit «Ich helfe mit» übernimmst du einen Platz, bis zum Beginn kannst du dich wieder austragen. Unter «Meine» lädst du eine Schicht in deinen Kalender.</p>
      <p>Hat dein Verein Pflicht-Arbeitsstunden, siehst du unter «Stunden», wie viele dir noch fehlen. Arbeit ausserhalb von Schichten erfasst du dort selbst, der Vorstand bestätigt sie.</p>
    </>,
  ),
  entry(
    "obligatorisch",
    "member",
    "Wo sehe ich, ob mein Obligatorisch bestanden ist?",
    "Bundesübungen Obligatorisch Feldschiessen bestanden verblieben amtlich Schiessnachweis Bestätigung Waffenerwerb",
    <>
      <p>Unter <Link href="/federal">Bundesübungen</Link> siehst du deinen Stand im laufenden Jahr. Er erscheint, sobald der Schützenmeister dein Resultat amtlich bestätigt hat. Bestätigte Resultate kannst du nicht mehr selbst ändern.</p>
      <p>Unter «Schiessnachweis» findest du deine Schiesstage der letzten Jahre und eine Bestätigung zum Ausdrucken. Welche Nachweise eine Behörde verlangt, entscheidet die zuständige Stelle.</p>
    </>,
  ),
  entry(
    "meisterschaft",
    "member",
    "Wie wird die Jahresmeisterschaft berechnet?",
    "Jahresmeisterschaft Rangliste Rang Streichresultate beste Resultate Kategorie Bonus Pflichtprogramm nicht klassiert",
    <>
      <p>Für jedes Programm der Meisterschaft zählen deine besten Resultate (z.B. die besten 3), die übrigen werden gestrichen. Fehlt ein Pflichtprogramm, bist du «nicht klassiert». Die genauen Regeln stehen auf der Seite der <Link href="/championship">Meisterschaft</Link>; massgebend ist das Reglement deines Vereins.</p>
    </>,
  ),
  entry(
    "kurse",
    "member",
    "Wo sehe ich meinen Stand im Kurs?",
    "Kurse Jungschützenkurs J+S Ausbildung Präsenz Pflichtprogramme Kursausweis",
    <>
      <p>Unter <Link href="/courses">Kurse</Link> siehst du deine Kurse mit Präsenz und den Pflichtprogrammen, die du schon bestanden hast. Den Kursausweis erstellt die Kursleitung nach dem Abschluss.</p>
    </>,
  ),
  entry(
    "amtlich-bestaetigen",
    "admin",
    "Wie bestätige ich amtliche Resultate (Obligatorisch, Feldschiessen)?",
    "amtlich bestätigen Schützenmeister Obligatorisch Feldschiessen Mindestpunktzahl Nuller Versuch SAT-Admin Export Verbliebene Fristen",
    <>
      <ol>
        <li>Beim Programm die amtliche Art (OP, FS) und die Bestehensregeln einstellen. Werte bitte mit den aktuellen Vorgaben (VBS/SSV/Kanton) prüfen.</li>
        <li>Unter <Link href="/federal">Bundesübungen</Link> einen Durchgang zum Obligatorisch-Anlass starten; angemeldete Mitglieder werden übernommen.</li>
        <li>Im Durchgang pro Person «Amtlich bestätigen». Danach ist das Resultat für die Schützen gesperrt.</li>
      </ol>
      <p>Für die Meldung gibt es einen CSV-Export und eine Druckliste für SAT-Admin. AHV-Nummern speichert Standchef nicht. Die Verantwortung für die Meldung bleibt beim Schützenmeister.</p>
    </>,
  ),
  entry(
    "standbuch",
    "admin",
    "Wie führe ich als Standchef das Standbuch?",
    "Standbuch Standchef Standdienst öffnen schliessen Gäste Ausweis Minderjährige Halbtage Vorfall Übergabe",
    <>
      <ol>
        <li>Unter <Link href="/range">Standbetrieb</Link> «Stand öffnen» – für eine Anlage oder die ganze Anlage.</li>
        <li>Mitglieder checken selbst per QR-Code ein, Gäste erfasst du direkt (Name, Jahrgang, «Ausweis geprüft»).</li>
        <li>Am Schluss «Tag abschliessen»: Offene Besuche werden ausgecheckt, die Schiesshalbtage werden vorgeschlagen.</li>
      </ol>
      <p>Vorfälle meldest du unter «Vorfälle». Die App hilft beim Dokumentieren, die Verantwortung am Stand bleibt beim Standchef.</p>
    </>,
  ),
  entry(
    "schiesszeiten",
    "admin",
    "Wo erfasse ich Standordnung, Schiesszeiten und Kontingent?",
    "Standordnung Schiesszeiten bewilligt Kontingent Halbtage Reservationen ausserhalb Version veröffentlichen",
    <>
      <p>Unter <Link href="/admin/range/rules">Standordnung</Link> schreibst und veröffentlichst du die Standordnung; Mitglieder bestätigen sie beim Einchecken. Unter <Link href="/admin/range/times">Schiesszeiten</Link> erfasst du die bewilligten Zeiten und das Halbtage-Kontingent pro Jahr.</p>
      <p>Reservationen ausserhalb der bewilligten Zeiten werden für Mitglieder abgelehnt. Werte bitte mit der Bewilligung eurer Gemeinde bzw. des Kantons abgleichen.</p>
    </>,
  ),
  entry(
    "vereinswaffen",
    "admin",
    "Wie leihe ich eine Vereinswaffe aus?",
    "Vereinswaffen Ausleihe Quittung Rückgabe Schusszähler Wartung Minderjährige Meldung gesperrt",
    <>
      <p>Unter <Link href="/weapons">Vereinswaffen</Link> eine verfügbare Waffe öffnen und «Ausleihen» wählen – an ein Mitglied oder mit freiem Namen. Die Quittung kannst du ausdrucken und unterschreiben lassen. Bei der Rückgabe trägst du die Schusszahl ein; ist die Wartung fällig, wird die Waffe automatisch auf «Wartung» gesetzt.</p>
      <p>Bei Minderjährigen erinnert die App an eine allfällige Meldefrist. Ob und wie gemeldet werden muss, bitte mit den aktuellen Vorgaben (Waffengesetz, Kanton) prüfen.</p>
    </>,
  ),
  entry(
    "munitionskontrolle",
    "admin",
    "Wie führe ich die Munitionskontrolle?",
    "Munitionskontrolle Bestand Eingang Abgabe Rücknahme Korrektur Inventur Jahresübersicht Bundesmunition subventioniert",
    <>
      <p>Unter <Link href="/admin/ammo/stock">Munitionskontrolle</Link> buchst du Eingänge, Abgaben am Stand, Rücknahmen und Korrekturen. Verkäufe über das Munitionsmodul werden automatisch gebucht. Mit der Inventur gleichst du den gezählten Bestand ab.</p>
      <p>Die Jahresübersicht zeigt die Bewegungen getrennt nach Finanzierung (Bund, subventioniert, kommerziell) – zum Ausdrucken oder als CSV.</p>
    </>,
  ),
  entry(
    "arbeitsstunden",
    "admin",
    "Wie plane ich Helfereinsätze und verrechne die Ersatzabgabe?",
    "Helfereinsätze Schichten planen kopieren Arbeitsstunden Pflicht Ersatzabgabe Rechnung bestätigen erledigt",
    <>
      <ol>
        <li>Unter <Link href="/admin/shifts">Helfereinsätze</Link> Schichten erfassen – zu einem Anlass oder als Standdienst – und bei Bedarf auf mehrere Daten kopieren.</li>
        <li>Nach dem Einsatz «erledigt» bestätigen; die Stunden werden angerechnet.</li>
        <li>Unter <Link href="/admin/shifts/settings">Einstellungen</Link> Pflichtstunden und Ansatz pro fehlende Stunde festlegen; unter «Stunden» die Ersatzabgabe als QR-Rechnung verrechnen.</li>
      </ol>
      <p>Massgebend sind die Statuten bzw. Beschlüsse eures Vereins.</p>
    </>,
  ),
  entry(
    "qualifikationen",
    "admin",
    "Wofür sind Qualifikationen?",
    "Qualifikationen Schützenmeister J+S Leiter Erste Hilfe Standchef gültig bis abgelaufen Qualifikationsschiessen",
    <>
      <p>Unter <Link href="/admin/qualifications">Qualifikationen</Link> erfasst du z.B. Schützenmeister, J+S-Leitung oder Erste Hilfe mit Gültigkeit. Schichten und Standdienst warnen, wenn niemand mit der nötigen Qualifikation eingeteilt ist; vor dem Ablauf gibt es eine Erinnerung.</p>
      <p>Die App ersetzt keine offizielle Anerkennung. Bitte keine AHV-Nummern erfassen.</p>
    </>,
  ),
  entry(
    "kurse-admin",
    "admin",
    "Wie führe ich einen Jungschützenkurs oder J+S-Kurs?",
    "Kurse Jungschützenkurs J+S NDS Teilnehmende Import Präsenz Pflichtprogramme Kursausweis Qualifikationsschiessen",
    <>
      <p>Unter <Link href="/courses">Kurse</Link> legst du den Kurs an, erfasst Teilnehmende (auch per CSV-Import) und Kurstage. Die Präsenz nimmst du am Handy auf; die Präsenzliste gibt es als CSV für die Übertragung in die NDS. Pflichtprogramme zeigen, wer was bestanden hat.</p>
      <p>Unter «Qualifikationsschiessen» definierst du Regeln und erteilst danach Qualifikationen. Details der Kursarten bitte mit den aktuellen Vorgaben (VBS, BASPO/J+S) prüfen.</p>
    </>,
  ),
  entry(
    "live-rangliste",
    "admin",
    "Wie zeige ich die Live-Rangliste auf dem Bildschirm im Schützenhaus?",
    "Live-Rangliste Bildschirm TV Fernseher Link QR-Code Anzeige Wettkampf Resultate live",
    <>
      <p>Unter <Link href="/admin/live">Live-Rangliste</Link> eine Anzeige für ein Programm oder einen Anlass anlegen. Den geheimen Link öffnest du im Browser des Bildschirms – ohne Anmeldung. Die Anzeige aktualisiert sich selbst und läuft zum eingestellten Zeitpunkt ab. Mit «Neuer Link» machst du einen weitergegebenen Link ungültig.</p>
    </>,
  ),
  entry(
    "meisterschaft-admin",
    "admin",
    "Wie richte ich die Jahresmeisterschaft ein?",
    "Jahresmeisterschaft einrichten Programme Gewichtung Streichresultate Kategorien Bonus veröffentlichen GV Rangliste drucken",
    <>
      <p>Unter <Link href="/championship">Jahresmeisterschaft</Link> Zeitraum, Programme (Pflicht, Gewichtung) und Anzahl gewerteter Resultate festlegen, optional Kategorien mit Bonus. Die Rangliste rechnet sich laufend aus den abgeschlossenen Durchgängen. Mit «Veröffentlichen» sehen sie alle Mitglieder; für die GV gibt es eine Druckansicht.</p>
    </>,
  ),
  entry(
    "buchhaltung",
    "admin",
    "Wie übernehme ich die Buchungen in Banana oder bexio?",
    "Buchhaltung Export Banana bexio Kontenplan Konten Journal CSV Debitoren Bank Jahresabschluss Quartal",
    <>
      <ol>
        <li>Unter <Link href="/admin/accounting">Buchhaltung</Link> einmal den Kontenplan prüfen (Vorschlag nach KMU-Kontenrahmen, z.B. 1020 Bank, 1100 Debitoren, 3000 Beiträge).</li>
        <li>Zeitraum wählen (Jahr, Quartal, Monat) und die Vorschau kontrollieren.</li>
        <li><strong>Banana</strong>: «Banana Buchhaltung» herunterladen (.txt), in Banana «Aktionen → In Buchhaltung importieren → Buchungen», Format «Textdatei mit Spaltenüberschriften» wählen und die Spaltenzuordnung prüfen.</li>
        <li><strong>bexio</strong>: «bexio (CSV für manuellen Import)» herunterladen und im Buchungsimport von bexio die Spalten zuordnen.</li>
      </ol>
      <p>Am besten nur abgeschlossene Zeiträume exportieren. Gebühren der Zahlungsanbieter und Barverkäufe der Schützenstube bitte von Hand buchen.</p>
    </>,
  ),
  entry(
    "website-widgets",
    "admin",
    "Wie zeige ich Kalender, Schiesszeiten oder Ranglisten auf unserer Vereinswebsite?",
    "Website Widget einbetten iframe Homepage Kalender Schiesszeiten Rangliste Jahresmeisterschaft WordPress Jimdo Code",
    <>
      <ol>
        <li>Unter <Link href="/admin/embed">Website-Widgets</Link> die Widgets einschalten.</li>
        <li>Widget wählen (Kalender, Zeiten, Rangliste, Meisterschaft), Optionen einstellen und den Code kopieren.</li>
        <li>Den Code auf der Website als HTML-Block einfügen. Das kleine Skript (optional) passt die Höhe automatisch an.</li>
      </ol>
      <p>Ranglisten zeigen Namen gekürzt («Anna M.») und nur, was du freigibst. Mit «Neu erzeugen» werden alle bisherigen Codes ungültig.</p>
    </>,
  ),
  entry(
    "resultat-import",
    "admin",
    "Wie importiere ich Resultate aus Meyton, SIUS oder ShotMarker?",
    "Resultate importieren Import elektronische Trefferanzeige Meyton SIUS ShotMarker CSV Export Datei Zuordnung",
    <>
      <ol>
        <li>Unter <Link href="/scores/import">Resultat-Import</Link> die Exportdatei der Trefferanzeige hochladen.</li>
        <li>Vorlage und Programm wählen, die Spaltenzuordnung in der Vorschau prüfen.</li>
        <li>Schützen den Mitgliedern zuordnen (oder als Gast übernehmen) und importieren.</li>
      </ol>
      <p>Die Vorlagen für Meyton, SIUS und ShotMarker sind Vorschläge – die Spalten unterscheiden sich je nach Version. Bitte mit einer eigenen Exportdatei prüfen. Dieselbe Datei lässt sich nur einmal importieren.</p>
    </>,
  ),
  entry(
    "schuetzenstube-theke",
    "admin",
    "Wie erfasse ich Konsumationen an der Theke der Schützenstube?",
    "Schützenstube Theke Kiosk erfassen aufschreiben bar Gast offline rückgängig Tablet",
    <>
      <p>Unter <Link href="/kiosk">Schützenstube</Link> Mitglied wählen (oder «Gast bar»), Produkte antippen und «Aufschreiben» oder «Bar erfassen». Der letzte Eintrag lässt sich 2 Minuten lang rückgängig machen.</p>
      <p>Ohne Internet werden Einträge auf dem Gerät zwischengespeichert und automatisch gesendet, sobald wieder Verbindung besteht.</p>
    </>,
  ),
  entry(
    "schuetzenstube-admin",
    "admin",
    "Wie rechne ich die Schützenstube ab?",
    "Schützenstube Abrechnung Sortiment Preise Rechnung Kasse Tagesumsatz Storno Export",
    <>
      <p>Unter <Link href="/admin/kiosk">Schützenstube verwalten</Link> pflegst du das Sortiment. Unter «Abrechnung» Zeitraum wählen, Vorschau prüfen und Rechnungen erstellen: jedes Mitglied erhält eine Rechnung «Schützenstube …» mit QR-Code. Einträge werden nie doppelt verrechnet. «Kasse» zeigt die Barverkäufe pro Tag.</p>
      <p>Für die Abrechnung braucht es das Modul «Mitgliederbeiträge» und ein ausgefülltes Rechnungsprofil.</p>
    </>,
  ),
  entry(
    "partner-teilen",
    "admin",
    "Wie teile ich eine Anlage mit einem Partnerverein?",
    "Anlage teilen Partnerverein gemeinsame Anlage Partnertarif Preisfaktor Beitrittscode Slug Abrechnung",
    <>
      <ol>
        <li>Unter <Link href="/admin/bookings/resources">Reservationen → Anlagen</Link> die Anlage öffnen und «Mit Partnerverein teilen» wählen.</li>
        <li>Partnerverein über Kurzname oder Beitrittscode suchen, Buchen erlauben und den Partnertarif in % festlegen.</li>
      </ol>
      <p>Mitglieder des Partnervereins buchen nach deinen Regeln; die Buchungen und Rechnungen liegen bei deinem Verein. Unter <Link href="/admin/bookings/partners">Partner-Anlagen</Link> siehst du Stunden und Beträge pro Partnerverein (mit CSV).</p>
    </>,
  ),
  entry(
    "module",
    "admin",
    "Welche Module gibt es und wie schalte ich sie ein?",
    "Module einschalten ausschalten Punkteerfassung Zielscheiben Anlässe Reservationen Mitgliederbeiträge Dateiablage Chat Munition Bundesübungen Standbetrieb Vereinswaffen Helfereinsätze Kurse Jahresmeisterschaft Schützenstube",
    <>
      <p>Unter <Link href="/admin">Verein</Link> schaltest du Module pro Verein ein oder aus: Punkteerfassung, Zielscheiben, Anlässe & News, Reservationen, Mitgliederbeiträge, Dateiablage, Chat, Munition, Bundesübungen, Standbetrieb, Vereinswaffen, Helfereinsätze, Kurse, Jahresmeisterschaft und Schützenstube. Ausgeschaltete Module verschwinden für alle Mitglieder aus dem Menü – Daten bleiben erhalten.</p>
      <p>Mobil liegen weniger genutzte Module unter «Mehr», auf dem Computer in der Seitenleiste unter «Schiessen» und «Verein».</p>
    </>,
  ),
];

/**
 * Anleitungen für Funktionen, die schon unterhalb der Admin-Rolle erlaubt sind (z.B. Trainer/Schützenmeister).
 * Wer die Berechtigung hat, sieht die Anleitung auch ohne «tenant.manage».
 */
const ENTRY_PERMISSION: Partial<Record<string, Permission>> = {
  "amtlich-bestaetigen": "results.verify",
  standbuch: "range.duty",
  vereinswaffen: "weapons.loan",
  "kurse-admin": "courses.manage",
  "live-rangliste": "match.viewAll",
  "resultat-import": "match.viewAll",
  "schuetzenstube-theke": "kiosk.sell",
  "schuetzenstube-admin": "kiosk.manage",
  buchhaltung: "accounting.export",
};

export default async function HelpPage() {
  const ctx = await getAppContext();
  const isAdmin = ctx.tenant ? ctx.can("tenant.manage") : ctx.user.isSuperAdmin;
  const entries = ENTRIES.filter((e) => {
    if (e.audience === "member" || isAdmin) return true;
    const perm = ENTRY_PERMISSION[e.id];
    return !!perm && ctx.can(perm);
  });
  const showAudienceFilter = entries.some((e) => e.audience === "admin");

  return (
    <div>
      <PageHeader title="Hilfe" subtitle="Antworten auf häufige Fragen. Tippe auf eine Frage, um die Antwort zu sehen." back={{ href: "/me", label: "Mehr" }} />
      <Faq entries={entries} isAdmin={showAudienceFilter} />
      <p className="mt-8 text-center text-sm text-ink-3">
        Nicht gefunden, was du suchst? Frag deinen Vereinsadmin{ctx.tenant ? <> von {ctx.tenant.name}</> : null}.
      </p>
    </div>
  );
}
