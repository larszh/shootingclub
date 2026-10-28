import type { Metadata } from "next";
import Link from "next/link";
import { getAppContext } from "@/lib/tenant";
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
      <p>Unter <Link href="/me">Mehr</Link> findest du dein Profil: Foto hochladen, Name und Adresse (für QR-Rechnungen), Darstellung (System, Hell, Dunkel) und Passwort.</p>
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
    "Wie richte ich Zahlungsanbieter (Stripe, Worldline, SumUp) ein?",
    "Zahlungsanbieter Online-Zahlung Stripe Worldline Saferpay SumUp Kreditkarte Twint API Schlüssel Webhook",
    <>
      <ol>
        <li>Modul «Reservationen» unter <Link href="/admin">Verein</Link> einschalten.</li>
        <li>Unter <Link href="/admin/bookings/payments">Reservationen → Zahlungsanbieter</Link> den Anbieter wählen und die Zugangsdaten aus deinem Händlerkonto eintragen. Sie werden verschlüsselt gespeichert.</li>
        <li>Bei Stripe die angezeigte Webhook-Adresse im Stripe-Dashboard hinterlegen.</li>
        <li>In den <Link href="/admin/bookings/settings">Reservations-Einstellungen</Link> «Online-Zahlung» aktivieren.</li>
      </ol>
      <p>Das Geld fliesst direkt auf das Konto des Vereins. Ohne Anbieter funktioniert die Zahlung per Rechnung mit QR-Code.</p>
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
    "module",
    "admin",
    "Welche Module gibt es und wie schalte ich sie ein?",
    "Module einschalten ausschalten Punkteerfassung Zielscheiben Anlässe Reservationen Mitgliederbeiträge Dateiablage Chat Munition",
    <>
      <p>Unter <Link href="/admin">Verein</Link> schaltest du Module pro Verein ein oder aus: Punkteerfassung, Zielscheiben, Anlässe & News, Reservationen, Mitgliederbeiträge, Dateiablage, Chat und Munition. Ausgeschaltete Module verschwinden für alle Mitglieder aus dem Menü – Daten bleiben erhalten.</p>
    </>,
  ),
];

export default async function HelpPage() {
  const ctx = await getAppContext();
  const isAdmin = ctx.tenant ? ctx.can("tenant.manage") : ctx.user.isSuperAdmin;
  const entries = isAdmin ? ENTRIES : ENTRIES.filter((e) => e.audience === "member");

  return (
    <div>
      <PageHeader title="Hilfe" subtitle="Antworten auf häufige Fragen. Tippe auf eine Frage, um die Antwort zu sehen." back={{ href: "/me", label: "Mehr" }} />
      <Faq entries={entries} isAdmin={isAdmin} />
      <p className="mt-8 text-center text-sm text-ink-3">
        Nicht gefunden, was du suchst? Frag deinen Vereinsadmin{ctx.tenant ? <> von {ctx.tenant.name}</> : null}.
      </p>
    </div>
  );
}
