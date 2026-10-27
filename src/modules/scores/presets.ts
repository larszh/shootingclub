import type { ProgramInput } from "./types";

/**
 * Globale Standardprogramme. Werden beim Seed als globale Programme (tenantId = null)
 * angelegt. Tenants können sie verstecken, Super-Admins bearbeiten.
 */
export const PROGRAM_PRESETS: ProgramInput[] = [
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
    name: "Gewehr 300 m – Obligatorisch",
    description: "Bundesprogramm 300 m: 5 Einzelschüsse, 2 Serien à 2 Schuss, 1 Serie à 3 Schuss, 1 Serie à 6 Schuss.",
    discipline: "RIFLE",
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
    name: "Pistole 25 m – Obligatorisch",
    description: "Bundesprogramm Pistole 25 m: 5 Einzelschüsse, 2 Serien à 5 Schuss, 1 Serie à 5 Schuss (Schnellfeuer).",
    discipline: "PISTOL",
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
  {
    name: "Freies Training – 10 Schuss",
    description: "Schnelle Serie ohne Vorgaben. Distanz beim Start anpassen.",
    discipline: "OTHER",
    scoringMode: "RINGS_INT",
    stages: [{ name: "Serie", distanceM: 10, shots: 10, maxPerShot: 10 }],
  },
];
