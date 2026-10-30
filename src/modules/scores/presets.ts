import { DEFAULT_ZONES, OFFICIAL_RULES_HINT, type OfficialKind, type ProgramInput, type Stage, type Zone } from "./types";

/**
 * Vorlage für ein globales Programm. `key` ist ein stabiler Schlüssel für Updates per Seed
 * (Abgleich über den Namen bzw. frühere Namen in `aliases`), auch wenn die Bezeichnung ändert.
 */
export type ProgramPreset = ProgramInput & {
  key?: string;
  aliases?: string[];
  /** Früher von dieser Vorlage vorbelegte Bestehensgrenze, die beim Abgleich wieder entfernt wird (nur wenn unverändert). */
  legacyPassRule?: { passMinScore: number; passMaxZeros: number };
};

// ---------------------------------------------------------------------------
// Zonen für taktische Programme (Wertung «ZONES»). Jede Zone hat einen eigenen Punktwert.
// ---------------------------------------------------------------------------

/** Geiselnahme: nur der Kopfbereich des Täters zählt voll, Geisel getroffen ist ein schwerer Fehler. */
const HOSTAGE_ZONES: Zone[] = [
  { key: "K", label: "Kopfzone Täter", points: 5 },
  { key: "A", label: "Rumpf Täter", points: 2 },
  { key: "M", label: "Fehl", points: 0 },
  { key: "VF", label: "Verfahrensfehler", points: -5, penalty: true },
  { key: "NS", label: "Geisel getroffen", points: -20 },
];

/** Shoot/No-Shoot: Bedrohung treffen, Unbeteiligte auf keinen Fall. */
const SHOOT_NO_SHOOT_ZONES: Zone[] = [
  { key: "T", label: "Bedrohung getroffen", points: 5 },
  { key: "M", label: "Fehl", points: 0 },
  { key: "VF", label: "Falsche Entscheidung (nicht geschossen)", points: -5 },
  { key: "NS", label: "Unbeteiligte getroffen", points: -10 },
];

/** Kopf/Brust-Silhouette. */
const HEAD_CHEST_ZONES: Zone[] = [
  { key: "K", label: "Kopf", points: 5 },
  { key: "B", label: "Brust", points: 3 },
  { key: "R", label: "Rest Silhouette", points: 1 },
  { key: "M", label: "Fehl", points: 0 },
  { key: "NS", label: "Unbeteiligte getroffen", points: -10 },
];

/** Serie mit Zonenwertung; maxPerShot = höchste Zone. */
function zoneStage(stage: Omit<Stage, "maxPerShot" | "zones">, zones: Zone[] = DEFAULT_ZONES): Stage {
  return { ...stage, zones: zones.map((z) => ({ ...z })), maxPerShot: Math.max(1, ...zones.map((z) => z.points)) };
}

/** Serie mit Treffer/Fehler-Wertung. */
function hitStage(stage: Omit<Stage, "maxPerShot">): Stage {
  return { ...stage, maxPerShot: 1 };
}

/** n Serien à `shots` Schuss mit Ringwertung. */
function ringSeries(n: number, base: Omit<Stage, "name">, prefix = "Serie", offset = 0): Stage[] {
  return Array.from({ length: n }, (_, i) => ({ ...base, name: `${prefix} ${i + 1 + offset}` }));
}

/**
 * Globale Standardprogramme. Werden beim Seed als globale Programme (tenantId = null)
 * angelegt. Tenants können sie verstecken, Super-Admins bearbeiten.
 */
export const PROGRAM_PRESETS: ProgramPreset[] = [
  {
    name: "Pistole 25 m – Präzision",
    description: "Klassisches Präzisionsprogramm auf 25 m. 6 Serien à 5 Schuss, Ringe 1–10.",
    discipline: "PISTOL",
    weaponNote: "Sportpistole / Standardpistole",
    scoringMode: "RINGS_INT",
    stages: Array.from({ length: 6 }, (_, i) => ({
      name: `Serie ${i + 1}`,
      distanceM: 25,
      shots: 5,
      maxPerShot: 10,
      timeLimitSec: 300,
      position: "STANDING",
      targetName: "Präzisionsscheibe 25 m",
    })),
  },
  {
    name: "Pistole 25 m – Duell",
    description: "Duell: 6 Serien à 5 Schuss, 3 s Scheibe sichtbar / 7 s verdeckt.",
    discipline: "PISTOL",
    scoringMode: "RINGS_INT",
    stages: Array.from({ length: 6 }, (_, i) => ({
      name: `Serie ${i + 1}`,
      distanceM: 25,
      shots: 5,
      maxPerShot: 10,
      position: "STANDING",
      targetName: "Schnellfeuerscheibe",
    })),
  },
  {
    name: "Pistole 10 m – 40 Schuss",
    description: "Luftpistole 10 m, 4 Serien à 10 Schuss.",
    discipline: "AIR_PISTOL",
    scoringMode: "RINGS_INT",
    stages: Array.from({ length: 4 }, (_, i) => ({
      name: `Serie ${i + 1}`,
      distanceM: 10,
      shots: 10,
      maxPerShot: 10,
      position: "STANDING",
      targetName: "LP-Scheibe 10 m",
    })),
  },
  {
    name: "Luftgewehr 10 m – 40 Schuss (Zehntel)",
    description: "Luftgewehr 10 m mit Zehntelwertung, 4 Serien à 10 Schuss.",
    discipline: "AIR_RIFLE",
    scoringMode: "RINGS_DECIMAL",
    stages: Array.from({ length: 4 }, (_, i) => ({
      name: `Serie ${i + 1}`,
      distanceM: 10,
      shots: 10,
      maxPerShot: 10,
      position: "STANDING",
      targetName: "LG-Scheibe 10 m",
    })),
  },
  {
    key: "op-300",
    name: "Gewehr 300 m – Obligatorisch",
    description: `Beispiel für das Bundesprogramm 300 m (Serien und Wertung bitte gemäss den aktuellen Vorgaben anpassen). Bestehensgrenze bitte im Verein passend zur Wertung eintragen. ${OFFICIAL_RULES_HINT}`,
    discipline: "RIFLE",
    officialKind: "OP",
    // Keine vorbelegte Bestehensgrenze: die amtliche Grenze gilt für eine andere Wertung als die Ringwertung dieser Vorlage.
    // Frühere Versionen haben 42 Punkte / 3 Nuller vorbelegt; presetOfficialUpdate entfernt dieses Paar wieder.
    legacyPassRule: { passMinScore: 42, passMaxZeros: 3 },
    weaponNote: "Ordonnanzwaffe",
    scoringMode: "RINGS_INT",
    stages: [
      { name: "Einzelschüsse", distanceM: 300, shots: 5, maxPerShot: 10, position: "PRONE", targetName: "Scheibe A10" },
      { name: "Serie 1", distanceM: 300, shots: 2, maxPerShot: 10, position: "PRONE", targetName: "Scheibe A10" },
      { name: "Serie 2", distanceM: 300, shots: 2, maxPerShot: 10, position: "PRONE", targetName: "Scheibe A10" },
      { name: "Serie 3", distanceM: 300, shots: 3, maxPerShot: 10, position: "PRONE", targetName: "Scheibe A10" },
      { name: "Schnellfeuer", distanceM: 300, shots: 6, maxPerShot: 10, position: "PRONE", targetName: "Scheibe A10" },
    ],
  },
  {
    key: "op-25-pistol",
    name: "Pistole 25 m – Obligatorisch",
    description: "Bundesprogramm Pistole 25 m: 5 Einzelschüsse, 2 Serien à 5 Schuss, 1 Serie à 5 Schuss (Schnellfeuer). Bestehensgrenze bitte im Verein gemäss den aktuellen Vorgaben eintragen.",
    discipline: "PISTOL",
    officialKind: "OP",
    passMinScore: null,
    passMaxZeros: null,
    weaponNote: "Ordonnanzpistole",
    scoringMode: "RINGS_INT",
    stages: [
      { name: "Einzelschüsse", distanceM: 25, shots: 5, maxPerShot: 10, position: "STANDING", targetName: "Scheibe P10" },
      { name: "Serie 1", distanceM: 25, shots: 5, maxPerShot: 10, position: "STANDING", targetName: "Scheibe P10" },
      { name: "Serie 2", distanceM: 25, shots: 5, maxPerShot: 10, position: "STANDING", targetName: "Scheibe P10" },
      { name: "Schnellfeuer", distanceM: 25, shots: 5, maxPerShot: 10, position: "STANDING", targetName: "Scheibe P10" },
    ],
  },
  {
    name: "Indoor – Distanzleiter 5 bis 20 m",
    description: "Für Indoor-Stände mit variabler Distanz: je 5 Schuss auf 5, 10, 15 und 20 m.",
    discipline: "PISTOL",
    scoringMode: "RINGS_INT",
    stages: [5, 10, 15, 20].map((d) => ({
      name: `${d} m`,
      distanceM: d,
      shots: 5,
      maxPerShot: 10,
      position: "STANDING",
    })),
  },
  {
    name: "Indoor – Parcours mit Hindernissen",
    description: "Dynamisches Training: Treffer/Fehler-Wertung über mehrere Stationen mit Deckung und Positionswechsel.",
    discipline: "PISTOL",
    scoringMode: "HITS",
    stages: [
      { name: "Station 1 – Deckung links", distanceM: 7, shots: 6, maxPerShot: 1, timeLimitSec: 20, position: "STANDING", note: "Hinter Barrikade" },
      { name: "Station 2 – Kniend", distanceM: 12, shots: 6, maxPerShot: 1, timeLimitSec: 20, position: "KNEELING" },
      { name: "Station 3 – Bewegung", distanceM: 10, shots: 8, maxPerShot: 1, timeLimitSec: 30, position: "MOVING", note: "Vorwärts von 15 auf 5 m" },
      { name: "Station 4 – Weit", distanceM: 20, shots: 4, maxPerShot: 1, timeLimitSec: 15, position: "STANDING" },
    ],
  },
  // ---------------------------------------------------------------------------
  // Weitere Vorlagen. «nachempfunden» = an offizielle Programme angelehnt, ohne Anspruch
  // auf das jeweils gültige Reglement. Für Wettkämpfe immer das aktuelle Reglement beachten.
  // ---------------------------------------------------------------------------
  {
    key: "fs-300",
    officialKind: "FS",
    name: "Feldschiessen 300 m (nachempfunden)",
    description: "An das Feldschiessen angelehnt: 18 Schuss liegend auf 300 m in drei Teilen (Einzelfeuer, Serie, Schnellfeuer). Massgebend ist das aktuelle Reglement.",
    discipline: "RIFLE",
    weaponNote: "Ordonnanz- oder Sportwaffe",
    scoringMode: "RINGS_INT",
    stages: [
      { name: "Einzelfeuer", distanceM: 300, shots: 6, maxPerShot: 5, timeLimitSec: 360, position: "PRONE", targetName: "Feldscheibe B", note: "Je Schuss 1 Minute" },
      { name: "Serie", distanceM: 300, shots: 6, maxPerShot: 5, timeLimitSec: 60, position: "PRONE", targetName: "Feldscheibe B" },
      { name: "Schnellfeuer", distanceM: 300, shots: 6, maxPerShot: 5, timeLimitSec: 60, position: "PRONE", targetName: "Feldscheibe B" },
    ],
  },
  {
    key: "fs-25-pistol",
    officialKind: "FS",
    name: "Feldschiessen Pistole 25 m (nachempfunden)",
    description: "An das Feldschiessen Pistole angelehnt: 18 Schuss auf 25 m, Einzelfeuer und zwei Serien mit Zeitlimit. Massgebend ist das aktuelle Reglement.",
    discipline: "PISTOL",
    weaponNote: "Ordonnanz- oder Sportpistole",
    scoringMode: "RINGS_INT",
    stages: [
      { name: "Einzelfeuer", distanceM: 25, shots: 6, maxPerShot: 10, timeLimitSec: 180, position: "STANDING", targetName: "Scheibe P10" },
      { name: "Serie 60 s", distanceM: 25, shots: 6, maxPerShot: 10, timeLimitSec: 60, position: "STANDING", targetName: "Scheibe P10" },
      { name: "Schnellfeuer 40 s", distanceM: 25, shots: 6, maxPerShot: 10, timeLimitSec: 40, position: "STANDING", targetName: "Scheibe P10" },
    ],
  },
  {
    name: "Jungschützen-Kurs – Übung",
    description: "Einfache Übung für Jungschützen: Einschiessen, Einzelschüsse und eine kurze Serie auf 300 m liegend. Gut zum Lernen von Atmung und Abzug.",
    discipline: "RIFLE",
    weaponNote: "Stgw 90 / Leihwaffe",
    scoringMode: "RINGS_INT",
    stages: [
      { name: "Einschiessen", distanceM: 300, shots: 3, maxPerShot: 10, position: "PRONE", targetName: "Scheibe A10", note: "Zum Einschiessen und Kontrollieren der Visierung (zählt hier im Total mit)" },
      { name: "Einzelschüsse", distanceM: 300, shots: 5, maxPerShot: 10, position: "PRONE", targetName: "Scheibe A10" },
      { name: "Serie", distanceM: 300, shots: 5, maxPerShot: 10, timeLimitSec: 120, position: "PRONE", targetName: "Scheibe A10" },
    ],
  },
  {
    name: "Luftgewehr 10 m – 60 Schuss (Zehntel)",
    description: "Luftgewehr 10 m stehend mit Zehntelwertung, 6 Serien à 10 Schuss (Wettkampfumfang nach ISSF).",
    discipline: "AIR_RIFLE",
    scoringMode: "RINGS_DECIMAL",
    stages: Array.from({ length: 6 }, (_, i) => ({
      name: `Serie ${i + 1}`,
      distanceM: 10,
      shots: 10,
      maxPerShot: 10,
      position: "STANDING",
      targetName: "LG-Scheibe 10 m",
    })),
  },
  {
    name: "Luftpistole 10 m – 60 Schuss",
    description: "Luftpistole 10 m, 6 Serien à 10 Schuss (Wettkampfumfang nach ISSF).",
    discipline: "AIR_PISTOL",
    scoringMode: "RINGS_INT",
    stages: Array.from({ length: 6 }, (_, i) => ({
      name: `Serie ${i + 1}`,
      distanceM: 10,
      shots: 10,
      maxPerShot: 10,
      position: "STANDING",
      targetName: "LP-Scheibe 10 m",
    })),
  },
  {
    name: "Pistole 50 m – 60 Schuss",
    description: "Freie Pistole / Präzision 50 m, 6 Serien à 10 Schuss einhändig stehend.",
    discipline: "PISTOL",
    weaponNote: "Freie Pistole",
    scoringMode: "RINGS_INT",
    stages: Array.from({ length: 6 }, (_, i) => ({
      name: `Serie ${i + 1}`,
      distanceM: 50,
      shots: 10,
      maxPerShot: 10,
      position: "STANDING",
      targetName: "Präzisionsscheibe 50 m",
    })),
  },
  {
    name: "Kleinkaliber 50 m liegend – 60 Schuss (Zehntel)",
    description: "Kleinkalibergewehr 50 m liegend mit Zehntelwertung, 6 Serien à 10 Schuss.",
    discipline: "RIFLE",
    weaponNote: "Kleinkaliber .22 lr",
    scoringMode: "RINGS_DECIMAL",
    stages: Array.from({ length: 6 }, (_, i) => ({
      name: `Serie ${i + 1}`,
      distanceM: 50,
      shots: 10,
      maxPerShot: 10,
      position: "PRONE",
      targetName: "KK-Scheibe 50 m",
    })),
  },
  {
    name: "Präzision 5 × 5 frei",
    description: "Vorlage für freies Präzisionstraining: 5 Serien à 5 Schuss. Distanz und Scheibe beim Start anpassen.",
    discipline: "OTHER",
    scoringMode: "RINGS_INT",
    stages: Array.from({ length: 5 }, (_, i) => ({
      name: `Serie ${i + 1}`,
      distanceM: 25,
      shots: 5,
      maxPerShot: 10,
    })),
  },
  {
    name: "Drill – Drei-Ziele-Drill",
    description: "Praktischer Drill: drei Ziele nebeneinander, je zwei Treffer pro Ziel. Treffer/Fehler-Wertung mit Zeitlimit.",
    discipline: "PISTOL",
    scoringMode: "HITS",
    stages: [
      { name: "Durchgang 1", distanceM: 7, shots: 6, maxPerShot: 1, timeLimitSec: 8, position: "STANDING", note: "Links – Mitte – Rechts, je 2 Schuss" },
      { name: "Durchgang 2", distanceM: 7, shots: 6, maxPerShot: 1, timeLimitSec: 8, position: "STANDING", note: "Rechts – Mitte – Links, je 2 Schuss" },
      { name: "Durchgang 3", distanceM: 10, shots: 6, maxPerShot: 1, timeLimitSec: 10, position: "STANDING", note: "Freie Reihenfolge" },
    ],
  },
  {
    name: "Drill – Distanzwechsel 3-7-10 m",
    description: "Je eine Serie auf 3, 7 und 10 m mit kurzer Zeit. Trainiert das Anpassen von Tempo und Präzision an die Distanz.",
    discipline: "PISTOL",
    scoringMode: "HITS",
    stages: [
      { name: "3 m", distanceM: 3, shots: 4, maxPerShot: 1, timeLimitSec: 4, position: "STANDING" },
      { name: "7 m", distanceM: 7, shots: 4, maxPerShot: 1, timeLimitSec: 6, position: "STANDING" },
      { name: "10 m", distanceM: 10, shots: 4, maxPerShot: 1, timeLimitSec: 8, position: "STANDING" },
    ],
  },
  {
    name: "Drill – Schwache Hand / Starke Hand",
    description: "Einhändiges Schiessen: zuerst mit der starken, dann mit der schwachen Hand, zum Schluss beidhändig.",
    discipline: "PISTOL",
    scoringMode: "HITS",
    stages: [
      { name: "Starke Hand", distanceM: 7, shots: 5, maxPerShot: 1, timeLimitSec: 10, position: "STANDING", note: "Nur starke Hand" },
      { name: "Schwache Hand", distanceM: 7, shots: 5, maxPerShot: 1, timeLimitSec: 12, position: "STANDING", note: "Nur schwache Hand" },
      { name: "Beidhändig", distanceM: 7, shots: 5, maxPerShot: 1, timeLimitSec: 8, position: "STANDING" },
    ],
  },
  {
    name: "Drill – Nachladen unter Zeit",
    description: "Zwei Schuss, Magazinwechsel, zwei Schuss. Trainiert einen ruhigen, schnellen Magazinwechsel.",
    discipline: "PISTOL",
    scoringMode: "HITS",
    stages: [
      { name: "Durchgang 1", distanceM: 7, shots: 4, maxPerShot: 1, timeLimitSec: 8, position: "STANDING", note: "2 Schuss – Nachladen – 2 Schuss" },
      { name: "Durchgang 2", distanceM: 7, shots: 4, maxPerShot: 1, timeLimitSec: 7, position: "STANDING", note: "2 Schuss – Nachladen – 2 Schuss" },
      { name: "Durchgang 3", distanceM: 10, shots: 4, maxPerShot: 1, timeLimitSec: 8, position: "STANDING", note: "2 Schuss – Nachladen – 2 Schuss" },
    ],
  },
  // ---------------------------------------------------------------------------
  // Sportprogramme (nachempfunden)
  // ---------------------------------------------------------------------------
  {
    name: "Pistole 25 m Sport (30+30, nachempfunden)",
    description: "An das Sportpistolenprogramm angelehnt: 30 Schuss Präzision (6 Serien à 5 Schuss, je 5 Minuten) und 30 Schuss Duell (6 Serien à 5 Schuss, 3 s sichtbar / 7 s verdeckt). Massgebend ist das aktuelle Reglement.",
    discipline: "PISTOL",
    weaponNote: "Sportpistole .22 lr",
    scoringMode: "RINGS_INT",
    stages: [
      ...ringSeries(6, { distanceM: 25, shots: 5, maxPerShot: 10, timeLimitSec: 300, position: "STANDING", targetName: "Präzisionsscheibe 25 m" }, "Präzision"),
      ...ringSeries(6, { distanceM: 25, shots: 5, maxPerShot: 10, position: "STANDING", targetName: "Schnellfeuerscheibe", note: "Je Schuss 3 s sichtbar, 7 s verdeckt" }, "Duell"),
    ],
  },
  {
    name: "Zentralfeuer 30+30 (nachempfunden)",
    description: "An das Zentralfeuerprogramm angelehnt: 30 Schuss Präzision und 30 Schuss Duell auf 25 m mit Zentralfeuerpistole. Massgebend ist das aktuelle Reglement.",
    discipline: "PISTOL",
    weaponNote: "Zentralfeuerpistole .32 bis .38",
    scoringMode: "RINGS_INT",
    stages: [
      ...ringSeries(6, { distanceM: 25, shots: 5, maxPerShot: 10, timeLimitSec: 300, position: "STANDING", targetName: "Präzisionsscheibe 25 m" }, "Präzision"),
      ...ringSeries(6, { distanceM: 25, shots: 5, maxPerShot: 10, position: "STANDING", targetName: "Schnellfeuerscheibe", note: "Je Schuss 3 s sichtbar, 7 s verdeckt" }, "Duell"),
    ],
  },
  {
    name: "Standardpistole 150/20/10 s (nachempfunden)",
    description: "An die Standardpistole angelehnt: je 4 Serien à 5 Schuss in 150 s, 20 s und 10 s auf 25 m. Massgebend ist das aktuelle Reglement.",
    discipline: "PISTOL",
    weaponNote: "Standardpistole .22 lr",
    scoringMode: "RINGS_INT",
    stages: [
      ...ringSeries(4, { distanceM: 25, shots: 5, maxPerShot: 10, timeLimitSec: 150, position: "STANDING", targetName: "Präzisionsscheibe 25 m" }, "150 s – Serie"),
      ...ringSeries(4, { distanceM: 25, shots: 5, maxPerShot: 10, timeLimitSec: 20, position: "STANDING", targetName: "Präzisionsscheibe 25 m" }, "20 s – Serie"),
      ...ringSeries(4, { distanceM: 25, shots: 5, maxPerShot: 10, timeLimitSec: 10, position: "STANDING", targetName: "Präzisionsscheibe 25 m" }, "10 s – Serie"),
    ],
  },
  {
    name: "Schnellfeuerpistole 25 m 8/6/4 s (nachempfunden)",
    description: "An die Schnellfeuerpistole angelehnt: je 2 Serien à 5 Schuss auf fünf Scheiben in 8 s, 6 s und 4 s. Massgebend ist das aktuelle Reglement.",
    discipline: "PISTOL",
    weaponNote: "Schnellfeuerpistole .22 kurz",
    scoringMode: "RINGS_INT",
    stages: [
      ...ringSeries(2, { distanceM: 25, shots: 5, maxPerShot: 10, timeLimitSec: 8, position: "STANDING", targetName: "Schnellfeuer 5 Marken" }, "8 s – Serie"),
      ...ringSeries(2, { distanceM: 25, shots: 5, maxPerShot: 10, timeLimitSec: 6, position: "STANDING", targetName: "Schnellfeuer 5 Marken" }, "6 s – Serie"),
      ...ringSeries(2, { distanceM: 25, shots: 5, maxPerShot: 10, timeLimitSec: 4, position: "STANDING", targetName: "Schnellfeuer 5 Marken" }, "4 s – Serie"),
    ],
  },
  {
    name: "Gewehr 50 m Dreistellung (nachempfunden, Zehntel)",
    description: "Kleinkaliber 50 m in drei Stellungen mit Zehntelwertung: je 2 Serien à 10 Schuss kniend, liegend und stehend. Massgebend ist das aktuelle Reglement.",
    discipline: "RIFLE",
    weaponNote: "Kleinkaliber .22 lr",
    scoringMode: "RINGS_DECIMAL",
    stages: [
      ...ringSeries(2, { distanceM: 50, shots: 10, maxPerShot: 10, position: "KNEELING", targetName: "KK-Scheibe 50 m" }, "Kniend"),
      ...ringSeries(2, { distanceM: 50, shots: 10, maxPerShot: 10, position: "PRONE", targetName: "KK-Scheibe 50 m" }, "Liegend"),
      ...ringSeries(2, { distanceM: 50, shots: 10, maxPerShot: 10, position: "STANDING", targetName: "KK-Scheibe 50 m" }, "Stehend"),
    ],
  },
  {
    name: "Gewehr 300 m liegend – 60 Schuss (nachempfunden)",
    description: "Sportgewehr 300 m liegend, 6 Serien à 10 Schuss auf die A10-Scheibe. Massgebend ist das aktuelle Reglement.",
    discipline: "RIFLE",
    weaponNote: "Sport- oder Standardgewehr",
    scoringMode: "RINGS_INT",
    stages: ringSeries(6, { distanceM: 300, shots: 10, maxPerShot: 10, position: "PRONE", targetName: "Scheibe A10" }),
  },
  // ---------------------------------------------------------------------------
  // Taktik / Behörden: Trainingsprogramme für Polizei, Sicherheitsdienste und Ausbildung.
  // Zonenwertung mit Strafpunkten (z.B. Geisel getroffen) oder Treffer/Fehler mit Zeitlimit.
  // Nur unter Aufsicht einer ausgebildeten Schiessleitung durchführen.
  // ---------------------------------------------------------------------------
  {
    name: "Geiselnahme – Präzision unter Zeit",
    description: "Täter hinter einer Geisel: nur der freie Kopfbereich darf getroffen werden. Präzision vor Tempo – eine getroffene Geisel kostet 20 Punkte.",
    discipline: "TACTICAL",
    weaponNote: "Dienstpistole",
    scoringMode: "ZONES",
    stages: [
      zoneStage({ name: "Geisel links, 5 m", distanceM: 5, shots: 2, timeLimitSec: 5, position: "STANDING", targetName: "Geiselnahme Geisel links", note: "Aus Bereitschaftshaltung, 2 Schuss Kopfzone" }, HOSTAGE_ZONES),
      zoneStage({ name: "Geisel rechts, 5 m", distanceM: 5, shots: 2, timeLimitSec: 5, position: "STANDING", targetName: "Geiselnahme Geisel rechts", note: "Aus Bereitschaftshaltung, 2 Schuss Kopfzone" }, HOSTAGE_ZONES),
      zoneStage({ name: "Geisel rechts, 7 m", distanceM: 7, shots: 2, timeLimitSec: 6, position: "STANDING", targetName: "Geiselnahme Geisel rechts" }, HOSTAGE_ZONES),
      zoneStage({ name: "Geisel links, 10 m kniend", distanceM: 10, shots: 2, timeLimitSec: 8, position: "KNEELING", targetName: "Geiselnahme Geisel links" }, HOSTAGE_ZONES),
    ],
  },
  {
    name: "Shoot/No-Shoot Entscheidung",
    description: "Sechs Ziele, Bedrohungen und Unbeteiligte gemischt. Die Schiessleitung sagt die Bedrohungen erst beim Startsignal an. Nicht geschossen auf eine Bedrohung = Verfahrensfehler.",
    discipline: "TACTICAL",
    weaponNote: "Dienstpistole",
    scoringMode: "ZONES",
    stages: [
      zoneStage({ name: "Durchgang 1", distanceM: 7, shots: 4, timeLimitSec: 8, position: "STANDING", targetName: "Shoot/No-Shoot 6 Figuren", note: "Ansage beim Startsignal, je 2 Schuss pro Bedrohung" }, SHOOT_NO_SHOOT_ZONES),
      zoneStage({ name: "Durchgang 2", distanceM: 7, shots: 4, timeLimitSec: 7, position: "STANDING", targetName: "Shoot/No-Shoot 6 Figuren", note: "Neue Ansage" }, SHOOT_NO_SHOOT_ZONES),
      zoneStage({ name: "Durchgang 3", distanceM: 10, shots: 6, timeLimitSec: 10, position: "STANDING", targetName: "Shoot/No-Shoot 6 Figuren", note: "Drei Bedrohungen, je 2 Schuss" }, SHOOT_NO_SHOOT_ZONES),
    ],
  },
  {
    name: "Teildeckung links/rechts",
    description: "Schiessen aus der Deckung: Barrikade links und rechts umgehen, möglichst wenig Körper zeigen. Wertung nach Trefferzonen A/C/D.",
    discipline: "TACTICAL",
    weaponNote: "Dienstpistole",
    scoringMode: "ZONES",
    stages: [
      zoneStage({ name: "Deckung links, stehend", distanceM: 10, shots: 4, timeLimitSec: 8, position: "STANDING", targetName: "Barrikade seitlich", note: "Links an der Barrikade vorbei" }),
      zoneStage({ name: "Deckung rechts, stehend", distanceM: 10, shots: 4, timeLimitSec: 8, position: "STANDING", targetName: "Barrikade seitlich", note: "Rechts an der Barrikade vorbei" }),
      zoneStage({ name: "Deckung links, kniend", distanceM: 10, shots: 4, timeLimitSec: 10, position: "KNEELING", targetName: "Barrikade seitlich" }),
      zoneStage({ name: "Deckung rechts, kniend", distanceM: 10, shots: 4, timeLimitSec: 10, position: "KNEELING", targetName: "Barrikade seitlich" }),
    ],
  },
  {
    name: "Distanzwechsel 3–7–15 m",
    description: "Drei Distanzen in einem Ablauf: schnell auf 3 m, kontrolliert auf 7 m, präzise auf 15 m. Treffer/Fehler mit Zeitlimit.",
    discipline: "TACTICAL",
    weaponNote: "Dienstpistole",
    scoringMode: "HITS",
    stages: [
      hitStage({ name: "3 m – aus der Hüfte", distanceM: 3, shots: 4, timeLimitSec: 4, position: "STANDING", targetName: "Oval-Silhouette", note: "Waffe nahe am Körper" }),
      hitStage({ name: "7 m", distanceM: 7, shots: 4, timeLimitSec: 6, position: "STANDING", targetName: "Oval-Silhouette" }),
      hitStage({ name: "15 m", distanceM: 15, shots: 4, timeLimitSec: 10, position: "STANDING", targetName: "Oval-Silhouette" }),
    ],
  },
  {
    name: "Mehrfachziele Reihenfolge",
    description: "Drei Ziele in der angesagten Reihenfolge bekämpfen. Falsche Reihenfolge = Verfahrensfehler (−5 pro Fehler).",
    discipline: "TACTICAL",
    weaponNote: "Dienstpistole",
    scoringMode: "ZONES",
    stages: [
      zoneStage({ name: "Links – Mitte – Rechts", distanceM: 7, shots: 6, timeLimitSec: 8, position: "STANDING", targetName: "Mehrfachziele Reihenfolge", note: "Je 2 Schuss pro Ziel" }),
      zoneStage({ name: "Rechts – Links – Mitte", distanceM: 7, shots: 6, timeLimitSec: 8, position: "STANDING", targetName: "Mehrfachziele Reihenfolge", note: "Je 2 Schuss pro Ziel" }),
      zoneStage({ name: "Ansage durch Schiessleitung", distanceM: 10, shots: 6, timeLimitSec: 10, position: "STANDING", targetName: "Mehrfachziele Reihenfolge", note: "Reihenfolge erst beim Startsignal" }),
    ],
  },
  {
    name: "Nachladen und Störung beheben",
    description: "Ladehemmung und leeres Magazin unter Zeit: Störung erkennen, beheben, weiterschiessen. Übungspatronen (Dummies) vorher in die Magazine mischen.",
    discipline: "TACTICAL",
    weaponNote: "Dienstpistole, Übungspatronen",
    scoringMode: "HITS",
    stages: [
      hitStage({ name: "Störung Typ 1", distanceM: 7, shots: 4, timeLimitSec: 8, position: "STANDING", note: "Dummy im Magazin: Antippen – Repetieren – weiter" }),
      hitStage({ name: "Leeres Magazin", distanceM: 7, shots: 4, timeLimitSec: 8, position: "STANDING", note: "2 Schuss – Nachladen aus der Leerstellung – 2 Schuss" }),
      hitStage({ name: "Taktisches Nachladen", distanceM: 10, shots: 4, timeLimitSec: 10, position: "KNEELING", note: "Hinter Deckung nachladen, Magazin sichern" }),
    ],
  },
  {
    name: "Schwache Hand",
    description: "Einhändig mit der schwachen Hand, z.B. bei verletzter Schusshand. Mit Zonenwertung, damit Präzision zählt.",
    discipline: "TACTICAL",
    weaponNote: "Dienstpistole",
    scoringMode: "ZONES",
    stages: [
      zoneStage({ name: "Schwache Hand, 5 m", distanceM: 5, shots: 5, timeLimitSec: 10, position: "STANDING", targetName: "Silhouette Zonen A/C/D", note: "Waffe in der schwachen Hand" }),
      zoneStage({ name: "Schwache Hand, 7 m", distanceM: 7, shots: 5, timeLimitSec: 12, position: "STANDING", targetName: "Silhouette Zonen A/C/D" }),
      zoneStage({ name: "Handwechsel unter Zeit", distanceM: 7, shots: 4, timeLimitSec: 12, position: "STANDING", targetName: "Silhouette Zonen A/C/D", note: "2 Schuss starke Hand – Wechsel – 2 Schuss schwache Hand" }),
    ],
  },
  {
    name: "Bewegung seitlich",
    description: "Schiessen während seitlicher Bewegung: Tempo so wählen, dass die Treffer noch sitzen. Treffer/Fehler mit Zeitlimit.",
    discipline: "TACTICAL",
    weaponNote: "Dienstpistole",
    scoringMode: "HITS",
    stages: [
      hitStage({ name: "Nach links", distanceM: 7, shots: 4, timeLimitSec: 8, position: "MOVING", targetName: "Oval-Silhouette", note: "3 m seitlich gehen" }),
      hitStage({ name: "Nach rechts", distanceM: 7, shots: 4, timeLimitSec: 8, position: "MOVING", targetName: "Oval-Silhouette", note: "3 m seitlich gehen" }),
      hitStage({ name: "Hin und zurück", distanceM: 10, shots: 6, timeLimitSec: 14, position: "MOVING", targetName: "Oval-Silhouette" }),
    ],
  },
  {
    name: "Kopfzone 5 m",
    description: "Kurze Distanz, kleine Zone: kontrollierte Einzelschüsse auf den Kopfbereich. Wertung Kopf/Brust mit Strafpunkten für Unbeteiligte.",
    discipline: "TACTICAL",
    weaponNote: "Dienstpistole",
    scoringMode: "ZONES",
    stages: [
      zoneStage({ name: "Einzelschüsse", distanceM: 5, shots: 5, timeLimitSec: 15, position: "STANDING", targetName: "Silhouette Kopf/Brust" }, HEAD_CHEST_ZONES),
      zoneStage({ name: "Je 3 s", distanceM: 5, shots: 5, timeLimitSec: 15, position: "STANDING", targetName: "Silhouette Kopf/Brust", note: "Aus Bereitschaftshaltung, 3 s pro Schuss" }, HEAD_CHEST_ZONES),
      zoneStage({ name: "Neben Unbeteiligter", distanceM: 5, shots: 4, timeLimitSec: 8, position: "STANDING", targetName: "Silhouette mit NS-Zone" }, HEAD_CHEST_ZONES),
    ],
  },
  {
    name: "Kontrolliertes Paar und Kopfschuss",
    description: "Zwei Schuss Brust, ein Schuss Kopf. Trainiert den Wechsel von Tempo zu Präzision auf dieselbe Silhouette.",
    discipline: "TACTICAL",
    weaponNote: "Dienstpistole",
    scoringMode: "ZONES",
    stages: [
      zoneStage({ name: "Durchgang 1", distanceM: 5, shots: 3, timeLimitSec: 4, position: "STANDING", targetName: "Silhouette Kopf/Brust", note: "Brust – Brust – Kopf" }, HEAD_CHEST_ZONES),
      zoneStage({ name: "Durchgang 2", distanceM: 7, shots: 3, timeLimitSec: 5, position: "STANDING", targetName: "Silhouette Kopf/Brust", note: "Brust – Brust – Kopf" }, HEAD_CHEST_ZONES),
      zoneStage({ name: "Durchgang 3", distanceM: 7, shots: 3, timeLimitSec: 5, position: "STANDING", targetName: "Silhouette Kopf/Brust", note: "Brust – Brust – Kopf" }, HEAD_CHEST_ZONES),
      zoneStage({ name: "Durchgang 4", distanceM: 10, shots: 3, timeLimitSec: 6, position: "STANDING", targetName: "Silhouette Kopf/Brust", note: "Brust – Brust – Kopf" }, HEAD_CHEST_ZONES),
    ],
  },
  {
    name: "Low-Light Grundlagen",
    description: "Schiessen bei wenig Licht mit Taschenlampe. Halle abdunkeln, Lampe in der schwachen Hand. Treffer/Fehler mit Zeitlimit.",
    discipline: "TACTICAL",
    weaponNote: "Dienstpistole, Taschenlampe",
    scoringMode: "HITS",
    stages: [
      hitStage({ name: "Lampe an, 5 m", distanceM: 5, shots: 4, timeLimitSec: 8, position: "STANDING", targetName: "Low-Light dunkel", note: "Lampe dauernd an" }),
      hitStage({ name: "Lampe kurz, 7 m", distanceM: 7, shots: 4, timeLimitSec: 10, position: "STANDING", targetName: "Low-Light dunkel", note: "Ziel nur kurz beleuchten, dann Position wechseln" }),
      hitStage({ name: "Identifizieren, 7 m", distanceM: 7, shots: 4, timeLimitSec: 12, position: "STANDING", targetName: "Shoot/No-Shoot 6 Figuren", note: "Erst identifizieren, dann schiessen" }),
    ],
  },
  {
    name: "Qualifikation Dienstpistole (nachempfunden)",
    description: "An gängige Qualifikationen für Dienstpistolen angelehnt: 30 Schuss von 3 bis 15 m mit Zonenwertung A/C/D. Kein offizielles Programm – massgebend sind die Vorgaben des eigenen Korps.",
    discipline: "TACTICAL",
    weaponNote: "Dienstpistole",
    scoringMode: "ZONES",
    stages: [
      zoneStage({ name: "3 m, einhändig", distanceM: 3, shots: 4, timeLimitSec: 4, position: "STANDING", targetName: "Silhouette Zonen A/C/D", note: "Starke Hand" }),
      zoneStage({ name: "5 m", distanceM: 5, shots: 6, timeLimitSec: 6, position: "STANDING", targetName: "Silhouette Zonen A/C/D" }),
      zoneStage({ name: "7 m mit Nachladen", distanceM: 7, shots: 6, timeLimitSec: 12, position: "STANDING", targetName: "Silhouette Zonen A/C/D", note: "3 Schuss – Nachladen – 3 Schuss" }),
      zoneStage({ name: "10 m kniend", distanceM: 10, shots: 6, timeLimitSec: 12, position: "KNEELING", targetName: "Silhouette Zonen A/C/D" }),
      zoneStage({ name: "15 m aus Deckung", distanceM: 15, shots: 8, timeLimitSec: 20, position: "STANDING", targetName: "Silhouette Zonen A/C/D", note: "Je 4 Schuss links und rechts der Barrikade" }),
    ],
  },
  {
    name: "Teamübung 2 Schützen",
    description: "Zwei Schützen arbeiten zusammen: Kommunikation, Feuerverteilung und Nachladen abwechselnd. Beide Schützen als Teilnehmer erfassen.",
    discipline: "TACTICAL",
    weaponNote: "Dienstpistole",
    scoringMode: "ZONES",
    stages: [
      zoneStage({ name: "Feuerverteilung", distanceM: 7, shots: 4, timeLimitSec: 10, position: "STANDING", targetName: "Silhouette Zonen A/C/D", note: "Jeder Schütze seine Seite, 2 Ziele je 2 Schuss" }),
      zoneStage({ name: "Nachladen im Wechsel", distanceM: 10, shots: 6, timeLimitSec: 20, position: "STANDING", targetName: "Silhouette Zonen A/C/D", note: "«Nachladen!» rufen, Partner deckt" }),
      zoneStage({ name: "Shoot/No-Shoot zu zweit", distanceM: 10, shots: 4, timeLimitSec: 12, position: "KNEELING", targetName: "Shoot/No-Shoot 6 Figuren", note: "Ansage durch Schiessleitung" }, SHOOT_NO_SHOOT_ZONES),
    ],
  },
  {
    name: "Stress-Parcours Behörden",
    description: "Kurzer Parcours mit Bewegung, Deckung und Unbeteiligten. Erst nach den Grundlagenübungen schiessen.",
    discipline: "TACTICAL",
    weaponNote: "Dienstpistole",
    scoringMode: "ZONES",
    stages: [
      zoneStage({ name: "Start nach Belastung", distanceM: 7, shots: 4, timeLimitSec: 10, position: "STANDING", targetName: "Silhouette Zonen A/C/D", note: "Vorher 20 Liegestütze oder Sprint" }),
      zoneStage({ name: "Vorrücken zur Deckung", distanceM: 10, shots: 4, timeLimitSec: 12, position: "MOVING", targetName: "Silhouette mit NS-Zone" }),
      zoneStage({ name: "Geisel aus der Deckung", distanceM: 7, shots: 2, timeLimitSec: 6, position: "KNEELING", targetName: "Geiselnahme Geisel rechts" }, HOSTAGE_ZONES),
      zoneStage({ name: "Abschluss", distanceM: 5, shots: 4, timeLimitSec: 6, position: "STANDING", targetName: "Shoot/No-Shoot 6 Figuren" }, SHOOT_NO_SHOOT_ZONES),
    ],
  },
  // -------------------------------------------------------------------------
  // Armbrust (Vorschläge – Anschlag kniend/stehend wird nicht abgebildet)
  // -------------------------------------------------------------------------
  {
    key: "crossbow-10-30",
    name: "Armbrust 10 m – 30 Schuss",
    description: "Armbrust 10 m: 3 Serien à 10 Schuss, Ringe 0–10. Anschlag (kniend/stehend) wird nicht separat erfasst. Vorschlag, bitte Reglement prüfen.",
    discipline: "CROSSBOW",
    weaponNote: "Armbrust 10 m",
    scoringMode: "RINGS_INT",
    stages: ringSeries(3, { distanceM: 10, shots: 10, maxPerShot: 10, targetName: "Armbrustscheibe 10 m" }),
  },
  {
    key: "crossbow-30-30",
    name: "Armbrust 30 m – 30 Schuss",
    description: "Armbrust 30 m: 3 Serien à 10 Schuss, Ringe 0–10. Anschlag (kniend/stehend) wird nicht separat erfasst. Vorschlag, bitte Reglement prüfen.",
    discipline: "CROSSBOW",
    weaponNote: "Armbrust 30 m",
    scoringMode: "RINGS_INT",
    stages: ringSeries(3, { distanceM: 30, shots: 10, maxPerShot: 10, targetName: "Armbrustscheibe 30 m" }),
  },
  {
    key: "crossbow-10-probe-20",
    name: "Armbrust 10 m – Probe + 20",
    description: "Allgemeines Armbrust-Programm: Probeschüsse vorgängig (ohne Erfassung), danach 2 Serien à 10 Schuss. Vorschlag, bitte Reglement prüfen.",
    discipline: "CROSSBOW",
    weaponNote: "Armbrust",
    scoringMode: "RINGS_INT",
    stages: ringSeries(2, { distanceM: 10, shots: 10, maxPerShot: 10, targetName: "Armbrustscheibe 10 m", note: "Probeschüsse vorher, nicht erfassen" }),
  },
  {
    name: "Freies Training – 10 Schuss",
    description: "Schnelle Serie ohne Vorgaben. Distanz beim Start anpassen.",
    discipline: "OTHER",
    scoringMode: "RINGS_INT",
    stages: [{ name: "Serie", distanceM: 10, shots: 10, maxPerShot: 10 }],
  },
];

// ---------------------------------------------------------------------------
// Abgleich mit bestehenden globalen Programmen (Seed --presets-only)
// ---------------------------------------------------------------------------

/** Namen, unter denen eine Vorlage in der DB gesucht wird (aktueller Name zuerst). */
export function presetNames(p: ProgramPreset): string[] {
  return [p.name, ...(p.aliases ?? [])];
}

type ExistingProgram = { officialKind: string | null; passMinScore: number | null; passMaxZeros: number | null };

/**
 * Änderungen an einem bestehenden globalen Programm aufgrund der Vorlage, oder null wenn nichts zu tun ist.
 * Idempotent und schonend: die amtliche Art wird nur gesetzt, solange das Programm noch keine hat.
 * Grenzwerte werden nie gesetzt (sie hängen von der Wertung ab und gehören in die Hand des Super-Admins).
 * Einzige Ausnahme: eine von früheren Versionen vorbelegte, unveränderte Grenze (legacyPassRule) wird entfernt.
 */
export function presetOfficialUpdate(existing: ExistingProgram, preset: ProgramPreset): { officialKind?: OfficialKind; passMinScore?: null; passMaxZeros?: null } | null {
  if (!preset.officialKind) return null;
  const patch: { officialKind?: OfficialKind; passMinScore?: null; passMaxZeros?: null } = {};
  if (!existing.officialKind) patch.officialKind = preset.officialKind;
  const legacy = preset.legacyPassRule;
  if (legacy && existing.passMinScore === legacy.passMinScore && existing.passMaxZeros === legacy.passMaxZeros) {
    patch.passMinScore = null;
    patch.passMaxZeros = null;
  }
  return Object.keys(patch).length ? patch : null;
}
