/**
 * Schützen-Coach: Kennzahlen aus den eigenen Resultaten eines Mitglieds (reine Funktionen, getestet).
 * Alle Zahlen (Schnitte, Trend, schwächste Serie) rechnet die App – Claude formuliert nur die Auswertung.
 */

export type CoachStage = { name: string; distanceM: number; shots: number; maxPerShot: number };

/** Ein Durchgang des Mitglieds, wie aus der Datenbank geladen. */
export type CoachMatchInput = {
  /** «YYYY-MM-DD» (Schweizer Datum) */
  date: string;
  programId: string;
  programName: string;
  scoringMode: string;
  /** Höchstes Total des Programms */
  max: number;
  stages: CoachStage[];
  /** Serien: Index, Schusswerte (kann leer sein, wenn nur das Total erfasst ist), Total */
  results: Array<{ stageIndex: number; shots: number[]; total: number }>;
  /** Vollständig (abgeschlossen oder alle Serien erfasst) – sonst wird der Durchgang ignoriert */
  complete: boolean;
};

export type CoachTrend = "up" | "down" | "stable" | "unknown";

export type CoachMatchLine = {
  date: string;
  program: string;
  total: number;
  max: number;
  /** Prozent des Maximums (0–100) */
  pct: number;
  stageTotals: number[];
  /** Schusswerte (alle Serien), nur wenn erfasst – höchstens MAX_SHOTS_PER_MATCH */
  shots: number[];
};

export type CoachStageStat = { name: string; distanceM: number; avg: number; max: number; pct: number };

export type CoachProgramStat = {
  programId: string;
  name: string;
  scoringMode: string;
  max: number;
  count: number;
  avg: number;
  best: number;
  last: number;
  /** Standardabweichung der Totale (Konstanz) */
  stdDev: number;
  trend: CoachTrend;
  /** Veränderung pro Durchgang (lineare Regression), Punkte */
  slopePerMatch: number;
  /** Schnitt der älteren und der neueren Hälfte (ab 4 Durchgängen) */
  olderAvg: number | null;
  newerAvg: number | null;
  stages: CoachStageStat[];
  /** Serie mit dem tiefsten Anteil am Maximum (nur bei mehreren Serien) */
  weakestStage: string | null;
  /** Schusswerte: Anzahl, Schnitt, Anteil Höchstwerte und Nuller (nur bei Ring- und Trefferwertung) */
  shotStats: { count: number; avg: number; topPct: number; zeroPct: number } | null;
};

export type CoachSummary = {
  matchCount: number;
  from: string | null;
  to: string | null;
  /** Neueste zuerst */
  matches: CoachMatchLine[];
  programs: CoachProgramStat[];
};

export const COACH_MAX_MATCHES = 12;
export const MAX_SHOTS_PER_MATCH = 60;
const MAX_PROGRAMS = 4;

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
function round2(n: number) {
  return Math.round(n * 100) / 100;
}
function mean(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
function pctOf(v: number, max: number) {
  return max > 0 ? Math.max(0, Math.min(100, Math.round((v / max) * 1000) / 10)) : 0;
}

/** Steigung der Regressionsgeraden (x = 0..n-1). */
export function slope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const mx = (n - 1) / 2;
  const my = mean(values);
  let num = 0;
  let den = 0;
  values.forEach((y, x) => {
    num += (x - mx) * (y - my);
    den += (x - mx) ** 2;
  });
  return den ? num / den : 0;
}

/**
 * Trend aus den Totalen (älteste zuerst). Ab 3 Durchgängen; «stabil», wenn sich das Total
 * pro Durchgang um weniger als 0,5 % des Maximums verändert.
 */
export function trendOf(values: number[], max: number): { trend: CoachTrend; slopePerMatch: number } {
  if (values.length < 3) return { trend: "unknown", slopePerMatch: 0 };
  const s = slope(values);
  const threshold = Math.max(0.05, max * 0.005);
  return { trend: Math.abs(s) < threshold ? "stable" : s > 0 ? "up" : "down", slopePerMatch: round2(s) };
}

function stdDev(values: number[]) {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((a, v) => a + (v - m) ** 2, 0) / values.length);
}

function matchTotal(m: CoachMatchInput) {
  return round1(m.results.reduce((a, r) => a + r.total, 0));
}

function stageTotals(m: CoachMatchInput) {
  return m.stages.map((_, i) => round1(m.results.find((r) => r.stageIndex === i)?.total ?? 0));
}

/**
 * Zusammenfassung der letzten `limit` vollständigen Durchgänge (neueste zuerst angezeigt,
 * Trend chronologisch). Programme nach Anzahl Durchgängen, höchstens vier.
 */
export function buildCoachSummary(input: CoachMatchInput[], limit = COACH_MAX_MATCHES): CoachSummary {
  const complete = input
    .filter((m) => m.complete && m.results.length > 0 && m.stages.length > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  const recent = complete.slice(-Math.max(1, limit));

  const matches: CoachMatchLine[] = recent
    .map((m) => {
      const total = matchTotal(m);
      const shots = m.stages.flatMap((_, i) => m.results.find((r) => r.stageIndex === i)?.shots ?? []).slice(0, MAX_SHOTS_PER_MATCH);
      return { date: m.date, program: m.programName, total, max: m.max, pct: pctOf(total, m.max), stageTotals: stageTotals(m), shots };
    })
    .reverse();

  const groups = new Map<string, CoachMatchInput[]>();
  for (const m of recent) groups.set(m.programId, [...(groups.get(m.programId) ?? []), m]);

  const programs: CoachProgramStat[] = [...groups.values()]
    .sort((a, b) => b.length - a.length || b.at(-1)!.date.localeCompare(a.at(-1)!.date))
    .slice(0, MAX_PROGRAMS)
    .map((list) => programStat(list));

  return {
    matchCount: recent.length,
    from: recent[0]?.date ?? null,
    to: recent.at(-1)?.date ?? null,
    matches,
    programs,
  };
}

function programStat(list: CoachMatchInput[]): CoachProgramStat {
  const first = list.at(-1)!; // neuestes Programm-Layout gilt
  const totals = list.map(matchTotal);
  const max = first.max;
  const { trend, slopePerMatch } = trendOf(totals, max);
  const half = Math.floor(totals.length / 2);
  const olderAvg = totals.length >= 4 ? round1(mean(totals.slice(0, half))) : null;
  const newerAvg = totals.length >= 4 ? round1(mean(totals.slice(totals.length - half))) : null;

  // Serien nur vergleichen, wenn alle Durchgänge dieselbe Anzahl Serien haben
  const sameLayout = list.every((m) => m.stages.length === first.stages.length);
  const stages: CoachStageStat[] = sameLayout
    ? first.stages.map((st, i) => {
        const avg = round1(mean(list.map((m) => m.results.find((r) => r.stageIndex === i)?.total ?? 0)));
        const stageMax = round1(st.shots * st.maxPerShot);
        return { name: st.name, distanceM: st.distanceM, avg, max: stageMax, pct: pctOf(avg, stageMax) };
      })
    : [];
  const weakestStage = stages.length > 1 ? [...stages].sort((a, b) => a.pct - b.pct)[0]!.name : null;

  let shotStats: CoachProgramStat["shotStats"] = null;
  if (first.scoringMode !== "ZONES") {
    const values: number[] = [];
    let top = 0;
    for (const m of list) {
      m.stages.forEach((st, i) => {
        const shots = m.results.find((r) => r.stageIndex === i)?.shots ?? [];
        for (const v of shots) {
          values.push(v);
          if (v >= st.maxPerShot) top++;
        }
      });
    }
    if (values.length) {
      shotStats = {
        count: values.length,
        avg: round2(mean(values)),
        topPct: pctOf(top, values.length),
        zeroPct: pctOf(values.filter((v) => v <= 0).length, values.length),
      };
    }
  }

  return {
    programId: first.programId,
    name: first.programName,
    scoringMode: first.scoringMode,
    max,
    count: list.length,
    avg: round1(mean(totals)),
    best: Math.max(...totals),
    last: totals.at(-1)!,
    stdDev: round1(stdDev(totals)),
    trend,
    slopePerMatch,
    olderAvg,
    newerAvg,
    stages,
    weakestStage,
    shotStats,
  };
}

const MODE_LABEL: Record<string, string> = {
  RINGS_INT: "rings (integer)",
  RINGS_DECIMAL: "rings (decimal)",
  HITS: "hits (1 = hit, 0 = miss)",
  ZONES: "zone points",
};

/**
 * Kompakter Text für den Prompt (Englisch, Zahlen mit Punkt). Programmnamen stammen vom Verein –
 * der Aufrufer grenzt den Text mit untrusted() ab.
 */
export function formatCoachSummary(s: CoachSummary): string {
  const lines: string[] = [];
  lines.push(`Completed sessions analysed: ${s.matchCount} (${s.from ?? "-"} to ${s.to ?? "-"})`);
  for (const p of s.programs) {
    lines.push("");
    lines.push(`Programme "${clip(p.name)}" – scoring: ${MODE_LABEL[p.scoringMode] ?? p.scoringMode}, maximum ${p.max}`);
    lines.push(`  sessions ${p.count}, average ${p.avg}, best ${p.best}, last ${p.last}, standard deviation ${p.stdDev}`);
    lines.push(`  trend: ${p.trend}${p.trend === "unknown" ? " (fewer than 3 sessions)" : ` (${p.slopePerMatch >= 0 ? "+" : ""}${p.slopePerMatch} points per session)`}`);
    if (p.olderAvg !== null && p.newerAvg !== null) lines.push(`  older half average ${p.olderAvg}, newer half average ${p.newerAvg}`);
    if (p.stages.length) {
      lines.push(`  series averages: ${p.stages.map((st) => `${clip(st.name)} ${st.distanceM} m ${st.avg}/${st.max} (${st.pct}%)`).join("; ")}`);
      if (p.weakestStage) lines.push(`  weakest series (share of maximum): ${clip(p.weakestStage)}`);
    }
    if (p.shotStats) lines.push(`  shots recorded ${p.shotStats.count}, average per shot ${p.shotStats.avg}, top value ${p.shotStats.topPct}%, zero/miss ${p.shotStats.zeroPct}%`);
  }
  lines.push("");
  lines.push("Recent sessions (newest first):");
  for (const m of s.matches) {
    const series = m.stageTotals.length > 1 ? ` series ${m.stageTotals.join(" / ")}` : "";
    const shots = m.shots.length ? ` shots ${m.shots.join(" ")}` : "";
    lines.push(`- ${m.date} "${clip(m.program)}": ${m.total}/${m.max} (${m.pct}%)${series}${shots}`);
  }
  return lines.join("\n");
}

function clip(s: string) {
  return s.replace(/[\r\n"]+/g, " ").trim().slice(0, 80);
}

/** Stabiler Fingerabdruck der Daten (ändert sich mit jedem neuen Resultat). */
export function summaryFingerprint(s: CoachSummary): string {
  return s.matches.map((m) => `${m.date}|${m.program}|${m.total}|${m.shots.length}`).join(";");
}
