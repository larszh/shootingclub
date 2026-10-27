import type { TargetInput } from "./types";

/**
 * Globale Scheibenvorlagen (Seed). Der Seed legt fehlende Vorlagen anhand des
 * Namens an – neue Einträge erscheinen beim nächsten Seed automatisch.
 * Bestehende Namen nicht umbenennen, sonst entstehen Duplikate.
 */
export const TARGET_PRESETS: TargetInput[] = [
  { name: "10-Ring Pistole", description: "Ringscheibe 1–10, schwarzer Spiegel ab 7.", subject: "RINGS_10", paperSizes: ["A4", "A5", "A6"], params: { numbers: true, blackFrom: 7 }, sharedWithTenant: false },
  { name: "10-Ring Gewehr (klein)", description: "Kleine Ringscheibe 1–10 mit Spiegel ab 4, für Luftgewehr und Kleinkaliber.", subject: "RINGS_10", paperSizes: ["A4", "A5", "A6"], params: { diameterMm: 80, numbers: true, blackFrom: 4 }, sharedWithTenant: false },
  { name: "5-Ring gross", description: "Grobe Ringe 6–10, gut sichtbar auf Distanz.", subject: "RINGS_5", paperSizes: ["A4", "A5"], params: { numbers: true }, sharedWithTenant: false },
  { name: "Punkte-Raster 3×4", description: "Zwölf kleine Scheiben für Präzisionsserien.", subject: "DOTS", paperSizes: ["A4", "A5"], params: { columns: 3, rows: 4 }, sharedWithTenant: false },
  { name: "Einschiessraster 10 mm", description: "Zentimeterraster mit Fadenkreuz.", subject: "GRID", paperSizes: ["A4", "A5", "A6"], params: { gridMm: 10 }, sharedWithTenant: false },
  { name: "Oval-Silhouette", description: "Trefferzonen A/C/D für dynamisches Training.", subject: "SILHOUETTE", paperSizes: ["A4", "A5"], params: {}, sharedWithTenant: false },
  { name: "Rauten 2×3", description: "Sechs Rauten, kontrastreich.", subject: "DIAMOND", paperSizes: ["A4", "A5"], params: { columns: 2, rows: 3 }, sharedWithTenant: false },

  // --- Präzision (nachempfunden, keine offiziellen Scheiben) ---------------
  { name: "Präzisionspistole 50 m auf 10 m", description: "Präzisionsscheibe 25/50 m nachempfunden, verkleinert für 10 m (Massstab 1:5).", subject: "ISSF_PISTOL", paperSizes: ["A4", "A5"], params: { numbers: true, originalDistanceM: 50, shotDistanceM: 10 }, sharedWithTenant: false },
  { name: "Präzisionspistole 25 m (verkleinert)", description: "Präzisionsscheibe 25/50 m nachempfunden, so gross wie das Papier erlaubt. Massstab steht oben links.", subject: "ISSF_PISTOL", paperSizes: ["A4", "A5", "A6"], params: { numbers: true }, sharedWithTenant: false },
  { name: "Luftpistole 10 m", description: "Luftpistolenscheibe nachempfunden, Originalgrösse 155.5 mm.", subject: "AIR_PISTOL", paperSizes: ["A4", "A5", "A6"], params: { numbers: true }, sharedWithTenant: false },
  { name: "Luftgewehr 10 m", description: "Luftgewehrscheibe nachempfunden, Originalgrösse 45.5 mm.", subject: "AIR_RIFLE", paperSizes: ["A4", "A5", "A6"], params: { numbers: true }, sharedWithTenant: false },
  { name: "Luftgewehr-Streifen 2×5 mit Probe", description: "Zehn Luftgewehrscheiben (nachempfunden) pro A4 in nummerierten Feldern, erste Scheibe als Probe.", subject: "AIR_RIFLE_SHEET", paperSizes: ["A4"], params: { columns: 2, rows: 5, sighter: true }, sharedWithTenant: false },
  { name: "Luftgewehr-Streifen A5 (2×3)", description: "Sechs Luftgewehrscheiben pro A5, ohne Probe.", subject: "AIR_RIFLE_SHEET", paperSizes: ["A5"], params: { columns: 2, rows: 3, sighter: false }, sharedWithTenant: false },

  // --- Schweizer Stil (nachempfunden, Masse angenähert) --------------------
  { name: "A-Scheibe 10er: 300 m auf 25 m", description: "A-Scheibe (CH-Stil) nachempfunden, Masse angenähert. Massstab 1:12 für das Training auf 25 m.", subject: "SWISS_A", paperSizes: ["A4", "A5"], params: { variant: "10", numbers: true, originalDistanceM: 300, shotDistanceM: 25 }, sharedWithTenant: false },
  { name: "A-Scheibe 5er: 300 m auf 25 m", description: "A-Scheibe mit 5er-Wertung (CH-Stil) nachempfunden, Masse angenähert. Massstab 1:12.", subject: "SWISS_A", paperSizes: ["A4", "A5"], params: { variant: "5", numbers: true, originalDistanceM: 300, shotDistanceM: 25 }, sharedWithTenant: false },
  { name: "P10: 50 m auf 10 m", description: "Pistolenscheibe P10 (CH-Stil) nachempfunden, Masse angenähert, Massstab 1:5 für 10 m.", subject: "SWISS_P10", paperSizes: ["A4", "A5"], params: { numbers: true, originalDistanceM: 50, shotDistanceM: 10 }, sharedWithTenant: false },
  { name: "Leere Ringscheibe 10 Ringe", description: "Nur Wertungsringe ohne Spiegel – zum Markieren und für eigene Distanzen.", subject: "BLANK_RINGS", paperSizes: ["A4", "A5", "A6"], params: { ringCount: 10, numbers: true }, sharedWithTenant: false },

  // --- Drills ---------------------------------------------------------------
  { name: "Schnellfeuer 5 Marken", description: "Drei Serien mit je fünf Schnellfeuer-Marken (nachempfunden) für Zielwechsel-Drills.", subject: "RAPID_FIRE", paperSizes: ["A4", "A5"], params: { variant: "marks", count: 5, rows: 3, numbers: true }, sharedWithTenant: false },
  { name: "Duell-Ovale 5er-Reihe", description: "Fünf Ovale pro Reihe für Duell- und Schnellfeuer-Drills.", subject: "RAPID_FIRE", paperSizes: ["A4", "A5"], params: { variant: "ovals", count: 5, rows: 3, numbers: true }, sharedWithTenant: false },
  { name: "Punkte-Drill 1–10", description: "Zehn nummerierte Kreise und Quadrate mit Aufgabe pro Nummer.", subject: "DOT_DRILL", paperSizes: ["A4", "A5"], params: { numbers: true }, sharedWithTenant: false },
  { name: "Ansage-Training Formen & Zahlen", description: "Kreise, Quadrate, Dreiecke mit 1–9 und A–C. Partner sagt an, du schiesst.", subject: "CALLOUT", paperSizes: ["A4", "A5"], params: { seed: 1 }, sharedWithTenant: false },
  { name: "Distanzleiter 10–25 m", description: "Gleiche Scheibe in vier Grössen: simuliert 10, 15, 20 und 25 m beim Schiessen auf 10 m.", subject: "DISTANCE_LADDER", paperSizes: ["A4", "A5"], params: { shotDistanceM: 10, stepM: 5, count: 4 }, sharedWithTenant: false },
  { name: "Plates-Rack 6er", description: "Sechs Plates in einer Reihe, zwei Reihen pro Blatt – für Speed-Drills.", subject: "PLATES", paperSizes: ["A4", "A5"], params: { variant: "plates", count: 6, rows: 2 }, sharedWithTenant: false },
  { name: "Kegel 6er", description: "Sechs Kegel in einer Reihe für Speed-Drills.", subject: "PLATES", paperSizes: ["A4", "A5"], params: { variant: "pins", count: 6, rows: 2 }, sharedWithTenant: false },

  // --- Einschiessen ---------------------------------------------------------
  { name: "Einschiessen mit Rauten", description: "Zentimeter-Raster, Rauten als Haltepunkte und Hilfetext zu Zoll, MOA und mrad.", subject: "ZEROING", paperSizes: ["A4", "A5", "A6"], params: { gridMm: 10, shotDistanceM: 25 }, sharedWithTenant: false },

  // --- Spiele ---------------------------------------------------------------
  { name: "Tic-Tac-Toe", description: "Spielfeld 3×3 – zwei Schützen spielen gegeneinander.", subject: "TIC_TAC_TOE", paperSizes: ["A4", "A5"], params: { count: 1 }, sharedWithTenant: false },
  { name: "Zahlenfeld 1–25", description: "Gemischte Zahlen 1–25 im 5×5-Feld. Zahl ansagen und treffen.", subject: "NUMBER_GRID", paperSizes: ["A4", "A5"], params: { variant: "numbers", seed: 1 }, sharedWithTenant: false },
  { name: "Bingo-Karte", description: "B-I-N-G-O-Karte mit Zahlen 1–75 und freiem Mittelfeld.", subject: "NUMBER_GRID", paperSizes: ["A4", "A5"], params: { variant: "bingo", seed: 1 }, sharedWithTenant: false },
  { name: "Uhr 12 Ziele", description: "Zwölf Ziele wie ein Zifferblatt – Ansage «3 Uhr», Ziel 3 treffen.", subject: "CLOCK", paperSizes: ["A4", "A5", "A6"], params: { numbers: true }, sharedWithTenant: false },

  // --- Silhouetten ----------------------------------------------------------
  { name: "Silhouette Zonen A/C/D", description: "Neutrale Umriss-Silhouette ohne Gesicht mit Trefferzonen A, C und D.", subject: "HUMANOID", paperSizes: ["A4", "A5"], params: { variant: "zones" }, sharedWithTenant: false },
  { name: "Silhouette Kopf/Brust", description: "Neutrale Silhouette mit zwei Zonen: Kopf und Brust.", subject: "HUMANOID", paperSizes: ["A4", "A5"], params: { variant: "headchest" }, sharedWithTenant: false },
  { name: "Silhouette mit NS-Zone", description: "Silhouette mit schraffierter «NS»-Zone, die nicht getroffen werden darf.", subject: "HUMANOID", paperSizes: ["A4", "A5"], params: { variant: "noshoot" }, sharedWithTenant: false },
];
