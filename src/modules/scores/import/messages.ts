/**
 * Meldungen des Resultat-Imports übersetzen. Die reinen Funktionen (parse, shooters, plan) liefern
 * deutsche Meldungen (getestet, unverändert); hier werden sie für die Anzeige anhand fester Muster
 * in die Sprache des Benutzers übertragen (Schlüssel aicoach.imp.msg.*). Unbekannte Meldungen
 * bleiben, wie sie sind. Für Deutsch ergibt die Übersetzung wieder genau den Originaltext.
 */
import type { TFunction } from "@/lib/i18n/core";

type Rule = { re: RegExp; out: (m: RegExpExecArray, t: TFunction, again: (s: string) => string) => string };

/** Feldbezeichnung in Meldungen («Serientotal», «Total») */
function label(raw: string, t: TFunction) {
  if (raw === "Serientotal") return t("aicoach.imp.field.seriesTotal");
  if (raw === "Total") return t("aicoach.imp.field.total");
  return raw;
}

const k = (key: string) => `aicoach.imp.msg.${key}`;

const RULES: Rule[] = [
  // Datei lesen
  { re: /^Die Datei ist leer\.$/, out: (_, t) => t(k("empty")) },
  { re: /^Die Datei ist grösser als 5 MB\. Bitte in mehrere Dateien aufteilen\.$/, out: (_, t) => t(k("tooLarge")) },
  { re: /^Das sieht nicht nach einer Text- oder CSV-Datei aus\. Bitte den Export als CSV oder TXT speichern\.$/, out: (_, t) => t(k("notText")) },
  { re: /^Die Datei enthält keine Datenzeilen \(erste Zeile = Spaltennamen\)\.$/, out: (_, t) => t(k("noData")) },
  { re: /^Zu viele Zeilen \((\d+)\)\. Höchstens (\d+) pro Import\.$/, out: (m, t) => t(k("tooManyRows"), { n: m[1]!, max: m[2]! }) },
  { re: /^Die Datei konnte nicht gelesen werden\.$/, out: (_, t) => t(k("unreadable")) },
  // Schützen bilden
  { re: /^Bitte eine Spalte als «Schusswert» zuordnen\.$/, out: (_, t) => t(k("needShotValue")) },
  { re: /^Bitte Spalten als «Serientotal», «Total» oder «Schusswert» zuordnen\.$/, out: (_, t) => t(k("needTotals")) },
  { re: /^Zu viele Schützen \(höchstens (\d+) pro Import\)\.$/, out: (m, t) => t(k("tooManyShooters"), { max: m[1]! }) },
  { re: /^Keine Schützen mit Resultaten gefunden\. Bitte Spaltenzuordnung und Aufbau prüfen\.$/, out: (_, t) => t(k("noShooters")) },
  { re: /^Serie «(.*)» nicht lesbar$/, out: (m, t) => t(k("seriesUnreadable"), { value: m[1]! }) },
  { re: /^Schusswert «(.*)» nicht lesbar$/, out: (m, t) => t(k("shotUnreadable"), { value: m[1]! }) },
  { re: /^(Serientotal|Total) «(.*)» nicht lesbar$/, out: (m, t) => t(k("valueUnreadable"), { label: label(m[1]!, t), value: m[2]! }) },
  { re: /^Schuss (\S+) \(Serie (\S+)\) kommt mehrfach vor \(Zeile (\d+)\)$/, out: (m, t) => t(k("shotDupSeries"), { no: m[1]!, series: m[2]!, line: m[3]! }) },
  { re: /^Schuss (\S+) kommt mehrfach vor \(Zeile (\d+)\)$/, out: (m, t) => t(k("shotDup"), { no: m[1]!, line: m[2]! }) },
  { re: /^Serientotal fehlt$/, out: (_, t) => t(k("seriesTotalMissing")) },
  { re: /^Serie (\S+) ungültig$/, out: (m, t) => t(k("seriesInvalid"), { series: m[1]! }) },
  { re: /^Serie (\S+) kommt mehrfach vor \(Zeile (\d+)\)$/, out: (m, t) => t(k("seriesDup"), { series: m[1]!, line: m[2]! }) },
  { re: /^Mehrere Zeilen für denselben Schützen \(Zeile (\d+)\) – bei einer Zeile pro Schuss bitte «Zeile pro Schuss» wählen$/, out: (m, t) => t(k("multiRows"), { line: m[1]! }) },
  // Bewertung
  { re: /^Wert (\S+) passt zu keiner Zone$/, out: (m, t) => t(k("noZone"), { value: m[1]! }) },
  { re: /^negativer Wert (\S+)$/, out: (m, t) => t(k("negativeValue"), { value: m[1]! }) },
  { re: /^Wert (\S+) über dem Maximum (\S+)$/, out: (m, t) => t(k("overMax"), { value: m[1]!, max: m[2]! }) },
  { re: /^(Serientotal|Total): negativer Wert$/, out: (m, t) => t(k("labelNegative"), { label: label(m[1]!, t) }) },
  { re: /^(Serientotal|Total): (\S+) über dem Maximum (\S+)$/, out: (m, t) => t(k("labelOverMax"), { label: label(m[1]!, t), value: m[2]!, max: m[3]! }) },
  { re: /^(Serientotal|Total): Zehntelwert (\S+), das Programm wertet ganze Zahlen$/, out: (m, t) => t(k("labelDecimal"), { label: label(m[1]!, t), value: m[2]! }) },
  { re: /^Programm ohne Serien$/, out: (_, t) => t(k("noStages")) },
  { re: /^(\d+) Schüsse ohne Serienangabe$/, out: (m, t) => t(k("shotsNoSeries"), { n: m[1]! }) },
  { re: /^(\d+) Serien in der Datei, das Programm hat (\d+)$/, out: (m, t) => t(k("seriesCount"), { n: m[1]!, max: m[2]! }) },
  { re: /^(\d+) Schüsse, das Programm hat (\d+)$/, out: (m, t) => t(k("shotCount"), { n: m[1]!, max: m[2]! }) },
  { re: /^Serie (\d+) \(«(.*)»\): keine Schüsse$/, out: (m, t) => t(k("stageNoShots"), { i: m[1]!, name: m[2]! }) },
  { re: /^Serie (\d+): (\d+) Schüsse, erlaubt sind (\d+)$/, out: (m, t) => t(k("stageTooMany"), { i: m[1]!, n: m[2]!, max: m[3]! }) },
  { re: /^Serie (\d+): (\d+) von (\d+) Schüssen$/, out: (m, t) => t(k("stageTooFew"), { i: m[1]!, n: m[2]!, max: m[3]! }) },
  { re: /^Serie (\d+): kein Total$/, out: (m, t) => t(k("stageNoTotal"), { i: m[1]! }) },
  { re: /^Zehntelwerte auf ganze Ringe abgerundet$/, out: (_, t) => t(k("floored")) },
  { re: /^Total in der Datei (\S+), aus den Schüssen berechnet (\S+)$/, out: (m, t) => t(k("totalVsShots"), { file: m[1]!, computed: m[2]! }) },
  { re: /^Total in der Datei (\S+), Summe der Serien (\S+)$/, out: (m, t) => t(k("totalVsSeries"), { file: m[1]!, computed: m[2]! }) },
  { re: /^1 Probeschuss nicht übernommen$/, out: (_, t) => t(k("sighters.one"), { n: 1 }) },
  { re: /^(\d+) Probeschüsse nicht übernommen$/, out: (m, t) => t(k("sighters.other"), { n: m[1]! }) },
  { re: /^Nur das Gesamttotal ist bekannt – es wird bei Serie 1 gespeichert$/, out: (_, t) => t(k("onlyTotal")) },
  { re: /^Keine Resultate$/, out: (_, t) => t(k("noResults")) },
  { re: /^Mitglied ist mehreren Schützen zugeordnet$/, out: (_, t) => t(k("memberTwice")) },
  { re: /^Programm wählen$/, out: (_, t) => t(k("chooseProgram")) },
  { re: /^Mitglied nicht \(mehr\) im Verein$/, out: (_, t) => t(k("memberGone")) },
  // Bemerkung des Teilnehmers (participantNote): «Startnr. 12 · Verein»
  { re: /^Startnr\. (\S+)( · .*)?$/, out: (m, t) => `${t("aicoach.imp.startNo", { no: m[1]! })}${m[2] ?? ""}` },
  // Präfixe zuletzt: Rest wieder übersetzen
  { re: /^Zeile (\d+): (.+)$/, out: (m, t, again) => t(k("linePrefix"), { line: m[1]!, text: again(m[2]!) }) },
  { re: /^Serie (\d+): (.+)$/, out: (m, t, again) => t(k("stagePrefix"), { i: m[1]!, text: again(m[2]!) }) },
];

/** Deutsche Meldung des Imports → Sprache von `t`. Unbekannte Meldungen unverändert. */
export function localizeImportMessage(msg: string, t: TFunction): string {
  const run = (s: string, depth: number): string => {
    for (const r of RULES) {
      const m = r.re.exec(s);
      if (m) return r.out(m, t, (rest) => (depth < 3 ? run(rest, depth + 1) : rest));
    }
    return s;
  };
  return run(msg, 0);
}
