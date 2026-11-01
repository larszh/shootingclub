/**
 * Resultat-Import: Datenzeilen nach Spaltenzuordnung zu Schützen zusammenfassen und gegen die
 * Serien eines Programms prüfen. Reine Funktionen (Browser-Vorschau und Server-Übernahme
 * rechnen identisch), mit Vitest getestet.
 */
import { parseSwissDate } from "../../members/import";
import { maxShotValue, stageTotal, stageZones, type Stage } from "../types";
import {
  SCORE_IMPORT_MAX_SHOOTERS,
  isSighter,
  parseNumber,
  parseShotValue,
  type ScoreField,
  type ScoreLayout,
  type ScoreTable,
} from "./parse";
import { foldName } from "./fuzzy";

export type RawShot = {
  value: number;
  /** Serienbezeichnung aus der Datei (Zahl), null = keine Angabe */
  series: number | null;
  /** Schuss-Nr. aus der Datei, sonst Reihenfolge in der Datei */
  order: number;
  x: number | null;
  y: number | null;
};

export type ImportedShooter = {
  /** Eindeutiger Schlüssel innerhalb der Datei (Startnummer + Name) */
  key: string;
  name: string;
  startNo: string | null;
  club: string | null;
  firstLine: number;
  rowCount: number;
  shots: RawShot[];
  /** Serientotale nach Serienindex (0-basiert), null = fehlt */
  seriesTotals: Array<number | null>;
  total: number | null;
  sighters: number;
  /** Trefferlage (X/Y) in der Datei vorhanden */
  hasXY: boolean;
  /** Lesefehler (unlesbare Werte) */
  errors: string[];
  warnings: string[];
};

export type BuildResult = {
  shooters: ImportedShooter[];
  /** Verschiedene Disziplinen in der Datei (für den Filter) */
  disciplines: string[];
  /** Erkannte Daten (YYYY-MM-DD), häufigstes zuerst */
  dates: string[];
  /** Zeilen ohne Schütze/Wert oder durch den Disziplin-Filter ausgeschlossen */
  skippedRows: number;
  errors: string[];
};

/** Name, wenn keine Namensspalte zugeordnet ist (z.B. ShotMarker: eine Datei = ein Schütze). */
export const SINGLE_SHOOTER_NAME = "Schütze aus Datei";

function col(mapping: readonly ScoreField[], field: ScoreField): number {
  return mapping.indexOf(field);
}
function cols(mapping: readonly ScoreField[], field: ScoreField): number[] {
  const out: number[] = [];
  mapping.forEach((f, i) => {
    if (f === field) out.push(i);
  });
  return out;
}

/** Serienangabe → Zahl («2», «Serie 2», «S2»). Probeschuss → "sighter", leer → null, unlesbar → NaN. */
function parseSeries(raw: string): number | null | "sighter" {
  const s = raw.trim();
  if (!s) return null;
  if (isSighter(s, "series")) return "sighter";
  const n = parseNumber(s);
  if (n !== null && Number.isInteger(n)) return n;
  const m = /(\d{1,3})\s*$/.exec(s);
  return m ? Number(m[1]) : Number.NaN;
}

function pushOnce(list: string[], msg: string) {
  if (!list.includes(msg) && list.length < 20) list.push(msg);
}

/**
 * Zeilen → Schützen. `discipline` filtert auf einen Wert der Disziplin-Spalte (null = alle).
 */
export function buildShooters(table: Pick<ScoreTable, "rows" | "firstLine">, mapping: readonly ScoreField[], layout: ScoreLayout, discipline: string | null = null): BuildResult {
  const c = {
    name: col(mapping, "name"),
    first: col(mapping, "firstName"),
    last: col(mapping, "lastName"),
    startNo: col(mapping, "startNo"),
    club: col(mapping, "club"),
    discipline: col(mapping, "discipline"),
    date: col(mapping, "date"),
    shotNo: col(mapping, "shotNo"),
    shotValues: cols(mapping, "shotValue"),
    series: col(mapping, "series"),
    seriesTotals: cols(mapping, "seriesTotal"),
    total: col(mapping, "total"),
    x: col(mapping, "x"),
    y: col(mapping, "y"),
  };
  const hasName = c.name >= 0 || c.first >= 0 || c.last >= 0;
  const errors: string[] = [];
  const shooters = new Map<string, ImportedShooter & { _hadRow: boolean; _shotNos: Set<string> }>();
  const disciplines = new Map<string, number>();
  const dates = new Map<string, number>();
  let skipped = 0;

  if (layout === "shots" && c.shotValues.length === 0) errors.push("Bitte eine Spalte als «Schusswert» zuordnen.");
  if (layout === "totals" && c.seriesTotals.length === 0 && c.total < 0 && c.shotValues.length === 0) errors.push("Bitte Spalten als «Serientotal», «Total» oder «Schusswert» zuordnen.");
  if (errors.length) return { shooters: [], disciplines: [], dates: [], skippedRows: table.rows.length, errors };

  table.rows.forEach((row, idx) => {
    const line = table.firstLine + idx;
    const get = (i: number) => (i >= 0 ? (row[i] ?? "").trim() : "");
    const disc = get(c.discipline);
    if (disc) disciplines.set(disc, (disciplines.get(disc) ?? 0) + 1);
    if (discipline !== null && disc !== discipline) {
      skipped++;
      return;
    }

    // «Name» plus «Vorname» zugeordnet: Name = Nachname
    let name = [get(c.first), get(c.name) || get(c.last)].filter(Boolean).join(" ");
    name = name.replace(/\s+/g, " ").slice(0, 60);
    const startNo = get(c.startNo).slice(0, 20) || null;
    if (!name && hasName) name = startNo ? `Startnr. ${startNo}` : "";
    if (!name && !hasName) name = SINGLE_SHOOTER_NAME;
    if (!name) {
      skipped++;
      return;
    }

    const d = get(c.date) ? parseSwissDate(get(c.date)) : null;
    if (d) dates.set(d, (dates.get(d) ?? 0) + 1);

    const key = `${startNo ?? ""}|${foldName(name)}`;
    let s = shooters.get(key);
    if (!s) {
      if (shooters.size >= SCORE_IMPORT_MAX_SHOOTERS) {
        pushOnce(errors, `Zu viele Schützen (höchstens ${SCORE_IMPORT_MAX_SHOOTERS} pro Import).`);
        skipped++;
        return;
      }
      s = { key, name, startNo, club: get(c.club).slice(0, 60) || null, firstLine: line, rowCount: 0, shots: [], seriesTotals: [], total: null, sighters: 0, hasXY: false, errors: [], warnings: [], _hadRow: false, _shotNos: new Set() };
      shooters.set(key, s);
    }
    s.rowCount++;

    const seriesRaw = get(c.series);
    const series = c.series >= 0 ? parseSeries(seriesRaw) : null;
    if (series === "sighter" || (c.shotNo >= 0 && isSighter(get(c.shotNo), "shotNo"))) {
      s.sighters++;
      return;
    }
    if (typeof series === "number" && Number.isNaN(series)) {
      pushOnce(s.errors, `Zeile ${line}: Serie «${seriesRaw.slice(0, 20)}» nicht lesbar`);
      return;
    }

    if (layout === "shots") {
      const raw = get(c.shotValues[0]!);
      const value = parseShotValue(raw);
      if (value === null) {
        skipped++;
        s.rowCount--;
        return;
      }
      if (Number.isNaN(value)) {
        pushOnce(s.errors, `Zeile ${line}: Schusswert «${raw.slice(0, 20)}» nicht lesbar`);
        return;
      }
      const no = c.shotNo >= 0 ? parseNumber(get(c.shotNo)) : null;
      // Doppelte Zeile (gleiche Schuss-Nr. in derselben Serie und Disziplin) würde den Schuss doppelt zählen
      if (no !== null && Number.isFinite(no)) {
        const shotKey = `${disc}|${series ?? ""}|${no}`;
        if (s._shotNos.has(shotKey)) {
          pushOnce(s.errors, `Schuss ${no}${typeof series === "number" ? ` (Serie ${series})` : ""} kommt mehrfach vor (Zeile ${line})`);
          return;
        }
        s._shotNos.add(shotKey);
      }
      const x = c.x >= 0 ? parseNumber(get(c.x)) : null;
      const y = c.y >= 0 ? parseNumber(get(c.y)) : null;
      const xy = { x: x !== null && !Number.isNaN(x) ? x : null, y: y !== null && !Number.isNaN(y) ? y : null };
      if (xy.x !== null && xy.y !== null) s.hasXY = true;
      s.shots.push({ value, series: series as number | null, order: no !== null && Number.isFinite(no) ? no : s.shots.length + 1, ...xy });
      return;
    }

    // Layout «totals»: eine Zeile pro Schütze (oder pro Serie, wenn eine Serienspalte zugeordnet ist)
    const readTotal = (i: number, label: string): number | null | undefined => {
      const raw = get(i);
      const n = parseNumber(raw);
      if (n === null) return null;
      if (Number.isNaN(n)) {
        pushOnce(s.errors, `Zeile ${line}: ${label} «${raw.slice(0, 20)}» nicht lesbar`);
        return undefined;
      }
      return n;
    };
    if (typeof series === "number") {
      const valueCol = c.seriesTotals[0] ?? c.total;
      if (valueCol === undefined || valueCol < 0) {
        pushOnce(s.errors, "Serientotal fehlt");
        return;
      }
      const v = readTotal(valueCol, "Serientotal");
      if (v === undefined || v === null) return;
      const i = series - 1;
      if (i < 0 || i >= 100) {
        pushOnce(s.errors, `Zeile ${line}: Serie ${series} ungültig`);
        return;
      }
      if (s.seriesTotals[i] !== undefined && s.seriesTotals[i] !== null) pushOnce(s.errors, `Serie ${series} kommt mehrfach vor (Zeile ${line})`);
      while (s.seriesTotals.length <= i) s.seriesTotals.push(null);
      s.seriesTotals[i] = v;
      return;
    }
    if (s._hadRow) {
      pushOnce(s.errors, `Mehrere Zeilen für denselben Schützen (Zeile ${line}) – bei einer Zeile pro Schuss bitte «Zeile pro Schuss» wählen`);
      return;
    }
    s._hadRow = true;
    c.seriesTotals.forEach((ci, k) => {
      const v = readTotal(ci, "Serientotal");
      if (v === undefined) return;
      while (s.seriesTotals.length <= k) s.seriesTotals.push(null);
      s.seriesTotals[k] = v;
    });
    if (c.total >= 0) {
      const v = readTotal(c.total, "Total");
      if (v !== undefined) s.total = v;
    }
    c.shotValues.forEach((ci, k) => {
      const raw = get(ci);
      const v = parseShotValue(raw);
      if (v === null) return;
      if (Number.isNaN(v)) {
        pushOnce(s.errors, `Zeile ${line}: Schusswert «${raw.slice(0, 20)}» nicht lesbar`);
        return;
      }
      s.shots.push({ value: v, series: null, order: k + 1, x: null, y: null });
    });
  });

  // Serientotale ohne Werte am Ende entfernen
  for (const s of shooters.values()) {
    while (s.seriesTotals.length && s.seriesTotals[s.seriesTotals.length - 1] === null) s.seriesTotals.pop();
  }
  const list = [...shooters.values()]
    .filter((s) => s.rowCount > 0)
    .map(({ _hadRow, _shotNos, ...rest }) => {
      void _hadRow;
      void _shotNos;
      return rest;
    });
  const byCount = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k]) => k);
  if (!list.length && !errors.length) errors.push("Keine Schützen mit Resultaten gefunden. Bitte Spaltenzuordnung und Aufbau prüfen.");
  return { shooters: list, disciplines: byCount(disciplines).slice(0, 50), dates: byCount(dates).slice(0, 20), skippedRows: skipped, errors };
}

// --- Prüfung gegen das Programm ------------------------------------------------------

export type ProgramSpec = { stages: Stage[]; scoringMode: string };

export type StageOutcome = {
  stageIndex: number;
  /** Einzelschüsse (bei Zeile pro Schuss), null = nur Total bekannt */
  shots: number[] | null;
  total: number;
};

export type ShooterEvaluation = {
  stages: StageOutcome[];
  total: number;
  shotCount: number;
  errors: string[];
  warnings: string[];
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Schusswert in die Wertung des Programms übersetzen. Gibt den Wert oder eine Fehlermeldung zurück. */
export function convertShot(value: number, stage: Stage, mode: string): { value: number; floored?: boolean } | { error: string } {
  // Zonenwertung: nur Werte einer Zone der Serie (Strafzonen sind negativ)
  if (mode === "ZONES") {
    const pts = new Set(stageZones(stage).map((z) => z.points));
    if (!Number.isInteger(value) || !pts.has(value)) return { error: `Wert ${value} passt zu keiner Zone` };
    return { value };
  }
  if (value < 0) return { error: `negativer Wert ${value}` };
  if (mode === "HITS") return { value: value > 0 ? 1 : 0 };
  if (mode === "RINGS_DECIMAL") {
    const v = round1(value);
    if (v > maxShotValue(stage, mode)) return { error: `Wert ${v} über dem Maximum ${maxShotValue(stage, mode)}` };
    return { value: v };
  }
  // Ganze Ringe: Zehntelwerte der Anzeige werden abgerundet (10.7 → 10)
  const v = Math.floor(value + 1e-9);
  if (v > stage.maxPerShot) return { error: `Wert ${value} über dem Maximum ${stage.maxPerShot}` };
  return { value: v, floored: v !== value };
}

function checkStageTotal(v: number, stage: Stage, mode: string, label: string): string | null {
  if (mode !== "ZONES" && v < 0) return `${label}: negativer Wert`;
  const max = round1(stage.shots * maxShotValue(stage, mode));
  if (v > max) return `${label}: ${v} über dem Maximum ${max}`;
  if ((mode === "RINGS_INT" || mode === "HITS" || mode === "ZONES") && !Number.isInteger(v)) return `${label}: Zehntelwert ${v}, das Programm wertet ganze Zahlen`;
  return null;
}

/** Schütze gegen Programm prüfen und Serien für die Übernahme berechnen. */
export function evaluateShooter(s: ImportedShooter, program: ProgramSpec): ShooterEvaluation {
  const { stages, scoringMode: mode } = program;
  const errors = [...s.errors];
  const warnings = [...s.warnings];
  const out: StageOutcome[] = [];
  const programShots = stages.reduce((a, st) => a + st.shots, 0);
  if (!stages.length) return { stages: [], total: 0, shotCount: 0, errors: ["Programm ohne Serien"], warnings };

  if (s.shots.length) {
    const groups: RawShot[][] = stages.map(() => []);
    const withSeries = s.shots.filter((x) => x.series !== null);
    if (withSeries.length && withSeries.length !== s.shots.length) {
      errors.push(`${s.shots.length - withSeries.length} Schüsse ohne Serienangabe`);
    } else if (withSeries.length) {
      // Seriennummern 1 … n (bzw. 0 … n-1) direkt den Programmserien zuordnen, damit eine fehlende
      // Serie nicht die folgenden verschiebt; andere Bezeichnungen der Reihe nach.
      const labels = [...new Set(withSeries.map((x) => x.series!))].sort((a, b) => a - b);
      const base = labels[0] === 0 ? 0 : 1;
      const direct = labels.every((l) => Number.isInteger(l) && l - base >= 0 && l - base < stages.length);
      const indexOf = (label: number) => (direct ? label - base : labels.indexOf(label));
      if (!direct && labels.length > stages.length) errors.push(`${labels.length} Serien in der Datei, das Programm hat ${stages.length}`);
      for (const shot of withSeries) {
        const i = indexOf(shot.series!);
        if (i >= 0 && i < stages.length) groups[i]!.push(shot);
      }
      groups.forEach((g) => g.sort((a, b) => a.order - b.order));
    } else {
      // Ohne Serien: Schüsse der Reihe nach auf die Serien verteilen
      const sorted = [...s.shots].sort((a, b) => a.order - b.order);
      if (sorted.length > programShots) errors.push(`${sorted.length} Schüsse, das Programm hat ${programShots}`);
      let k = 0;
      stages.forEach((st, i) => {
        groups[i] = sorted.slice(k, k + st.shots);
        k += st.shots;
      });
    }
    let floored = false;
    groups.forEach((g, i) => {
      const st = stages[i]!;
      if (!g.length) {
        if (!errors.length) warnings.push(`Serie ${i + 1} («${st.name}»): keine Schüsse`);
        return;
      }
      if (g.length > st.shots) errors.push(`Serie ${i + 1}: ${g.length} Schüsse, erlaubt sind ${st.shots}`);
      else if (g.length < st.shots) warnings.push(`Serie ${i + 1}: ${g.length} von ${st.shots} Schüssen`);
      const shots: number[] = [];
      for (const shot of g.slice(0, st.shots)) {
        const r = convertShot(shot.value, st, mode);
        if ("error" in r) {
          pushOnce(errors, `Serie ${i + 1}: ${r.error}`);
          continue;
        }
        if (r.floored) floored = true;
        shots.push(r.value);
      }
      out.push({ stageIndex: i, shots, total: stageTotal(shots) });
    });
    if (floored) warnings.push("Zehntelwerte auf ganze Ringe abgerundet");
    const computed = round1(out.reduce((a, o) => a + o.total, 0));
    const fileTotal = s.total ?? (s.seriesTotals.length ? round1(s.seriesTotals.reduce<number>((a, v) => a + (v ?? 0), 0)) : null);
    if (fileTotal !== null && !errors.length && fileTotal !== computed && !(mode === "RINGS_INT" && floored)) {
      warnings.push(`Total in der Datei ${fileTotal}, aus den Schüssen berechnet ${computed}`);
    }
    if (s.sighters) warnings.push(`${s.sighters} ${s.sighters === 1 ? "Probeschuss" : "Probeschüsse"} nicht übernommen`);
    return { stages: out, total: computed, shotCount: out.reduce((a, o) => a + (o.shots?.length ?? 0), 0), errors, warnings };
  }

  if (s.seriesTotals.some((v) => v !== null)) {
    s.seriesTotals.forEach((v, i) => {
      if (v === null) {
        if (i < stages.length) warnings.push(`Serie ${i + 1}: kein Total`);
        return;
      }
      if (i >= stages.length) {
        pushOnce(errors, `${s.seriesTotals.length} Serien in der Datei, das Programm hat ${stages.length}`);
        return;
      }
      const st = stages[i]!;
      const val = mode === "RINGS_DECIMAL" ? round1(v) : v;
      const err = checkStageTotal(val, st, mode, `Serie ${i + 1}`);
      if (err) errors.push(err);
      else out.push({ stageIndex: i, shots: null, total: val });
    });
    for (let i = s.seriesTotals.length; i < stages.length; i++) warnings.push(`Serie ${i + 1}: kein Total`);
    const computed = round1(out.reduce((a, o) => a + o.total, 0));
    if (s.total !== null && !errors.length && round1(s.total) !== computed) warnings.push(`Total in der Datei ${s.total}, Summe der Serien ${computed}`);
    if (s.sighters) warnings.push(`${s.sighters} ${s.sighters === 1 ? "Probeschuss" : "Probeschüsse"} nicht übernommen`);
    return { stages: out, total: computed, shotCount: 0, errors, warnings };
  }

  if (s.total !== null) {
    const val = mode === "RINGS_DECIMAL" ? round1(s.total) : s.total;
    const whole: Stage = { ...stages[0]!, shots: programShots };
    const err = checkStageTotal(val, stages.length === 1 ? stages[0]! : whole, mode, "Total");
    if (err) errors.push(err);
    else {
      out.push({ stageIndex: 0, shots: null, total: val });
      if (stages.length > 1) warnings.push("Nur das Gesamttotal ist bekannt – es wird bei Serie 1 gespeichert");
    }
    return { stages: out, total: errors.length ? 0 : val, shotCount: 0, errors, warnings };
  }

  if (!errors.length) errors.push("Keine Resultate");
  return { stages: [], total: 0, shotCount: 0, errors, warnings };
}

// --- Zuordnung zu Mitgliedern -----------------------------------------------------

/** Zuordnung eines Schützen: Mitglied (User-ID), Gast oder nicht übernehmen. */
export type Assignment = { kind: "member"; userId: string } | { kind: "guest" } | { kind: "skip" };

/** Wire-Format für die Zuordnung: «m:<userId>», «guest» oder «skip». */
export function parseAssignment(raw: unknown): Assignment | null {
  if (raw === "guest") return { kind: "guest" };
  if (raw === "skip") return { kind: "skip" };
  if (typeof raw === "string" && /^m:[A-Za-z0-9_-]{1,64}$/.test(raw)) return { kind: "member", userId: raw.slice(2) };
  return null;
}
export function assignmentValue(a: Assignment): string {
  return a.kind === "member" ? `m:${a.userId}` : a.kind;
}

/** Fehler über alle Schützen: dasselbe Mitglied zweimal zugeordnet. Gibt Schlüssel → Meldung zurück. */
export function duplicateAssignments(assignments: ReadonlyArray<{ key: string; assignment: Assignment }>): Map<string, string> {
  const byUser = new Map<string, string[]>();
  for (const a of assignments) {
    if (a.assignment.kind !== "member") continue;
    byUser.set(a.assignment.userId, [...(byUser.get(a.assignment.userId) ?? []), a.key]);
  }
  const out = new Map<string, string>();
  for (const keys of byUser.values()) {
    if (keys.length < 2) continue;
    for (const k of keys) out.set(k, "Mitglied ist mehreren Schützen zugeordnet");
  }
  return out;
}

/** Bezeichnung der Teilnahme (Notiz), z.B. «Startnr. 12 · SG Musterdorf». */
export function participantNote(s: Pick<ImportedShooter, "startNo" | "club">): string | null {
  const note = [s.startNo ? `Startnr. ${s.startNo}` : null, s.club].filter(Boolean).join(" · ");
  return note ? note.slice(0, 120) : null;
}
