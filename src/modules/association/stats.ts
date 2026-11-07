/**
 * Kantonal-/Regionalverband: reine Auswertungen (ohne DB, getestet). Die Abfragen in queries.ts liefern
 * nur die nötigsten Felder; hier entstehen daraus Zahlen und Ranglisten.
 */
import { toCsv } from "@/modules/scores/analytics";
import { DEADLINE_FIELDS, daysBetween, rankFs, summarizeOp, type DeadlineKey, type OfficialResultLite } from "@/modules/federal/types";

// ---------------------------------------------------------------------------
// Mitglieder
// ---------------------------------------------------------------------------

/** Bis zu diesem Alter (im Auswertungsjahr) zählt ein Mitglied als Junior (Jungschützen bis 20). */
export const JUNIOR_MAX_AGE = 20;

export type MemberLite = { status: string; birthYear: number | null };

/** Junior: Status JUNIOR oder höchstens JUNIOR_MAX_AGE Jahre alt im Auswertungsjahr. */
export function isJunior(m: MemberLite, year: number): boolean {
  if (m.status === "JUNIOR") return true;
  if (m.birthYear === null) return false;
  const age = year - m.birthYear;
  return age >= 0 && age <= JUNIOR_MAX_AGE;
}

/**
 * Zahlen pro Verein. Erwartet nur Mitgliedschaften mit Zugang (nicht LEFT, nicht PENDING).
 * total = alle; active = Aktiv- und Juniormitglieder; juniors siehe isJunior.
 */
export function memberCounts(members: readonly MemberLite[], year: number) {
  let active = 0;
  let juniors = 0;
  for (const m of members) {
    if (m.status === "ACTIVE" || m.status === "JUNIOR") active += 1;
    if (isJunior(m, year)) juniors += 1;
  }
  return { total: members.length, active, juniors };
}
export type MemberCounts = ReturnType<typeof memberCounts>;

// ---------------------------------------------------------------------------
// Obligatorisch
// ---------------------------------------------------------------------------

/**
 * Obligatorisch-Statistik aus bestätigten amtlichen Resultaten (isOfficial) eines Jahres:
 * shooters = Schützen mit mindestens einem Resultat, passed = bestanden, notPassedResults = nicht
 * bestandene Versuche, remaining = Schützen ohne bestandenes Resultat (verblieben), unknown = ohne
 * Bestehensregel.
 */
export function opStats(results: readonly OfficialResultLite[]) {
  const s = summarizeOp(results);
  return {
    results: s.confirmed,
    shooters: s.shooters,
    passed: s.passed,
    notPassedResults: results.filter((r) => r.userId && r.passed === false).length,
    remaining: s.failed,
    unknown: s.unknown,
  };
}
export type OpStats = ReturnType<typeof opStats>;

// ---------------------------------------------------------------------------
// Feldschiessen
// ---------------------------------------------------------------------------

export type FsLite = { userId: string | null; isOfficial: boolean };

/** Beteiligung: Teilnahmen (Mitglieder pro Person einmal gezählt, Gäste pro Resultat), davon bestätigt. */
export function fsStats(rows: readonly FsLite[]) {
  const members = new Set<string>();
  const confirmedMembers = new Set<string>();
  let guests = 0;
  let confirmedGuests = 0;
  for (const r of rows) {
    if (r.userId) {
      members.add(r.userId);
      if (r.isOfficial) confirmedMembers.add(r.userId);
    } else {
      guests += 1;
      if (r.isOfficial) confirmedGuests += 1;
    }
  }
  return { participants: members.size + guests, members: members.size, guests, confirmed: confirmedMembers.size + confirmedGuests };
}
export type FsStats = ReturnType<typeof fsStats>;

// ---------------------------------------------------------------------------
// Fristen
// ---------------------------------------------------------------------------

export type DeadlineStatus = "upcoming" | "soon" | "today" | "past";
export type DeadlineView = { key: DeadlineKey; label: string; day: string; daysLeft: number; status: DeadlineStatus };

/** Tage, ab denen eine Frist als «bald» gilt. */
export const DEADLINE_SOON_DAYS = 14;

/** Fristen eines Jahres mit Status relativ zu heute (beide "YYYY-MM-DD"), chronologisch. */
export function deadlineViews(deadlines: Partial<Record<DeadlineKey, string | null>>, today: string): DeadlineView[] {
  const out: DeadlineView[] = [];
  for (const f of DEADLINE_FIELDS) {
    const day = deadlines[f.key];
    if (!day) continue;
    const left = daysBetween(today, day);
    if (!Number.isFinite(left)) continue;
    const status: DeadlineStatus = left < 0 ? "past" : left === 0 ? "today" : left <= DEADLINE_SOON_DAYS ? "soon" : "upcoming";
    out.push({ key: f.key, label: f.label, day, daysLeft: left, status });
  }
  return out.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
}

/** Nächste noch offene Frist (heute oder später), sonst null. */
export function nextDeadline(views: readonly DeadlineView[]): DeadlineView | null {
  return views.find((v) => v.status !== "past") ?? null;
}

// ---------------------------------------------------------------------------
// Dashboard: Summen über alle Vereine
// ---------------------------------------------------------------------------

export type ClubStatsRow = {
  tenantId: string;
  clubName: string;
  members: MemberCounts;
  op: OpStats;
  fs: FsStats;
  unconfirmed: number;
  deadlines: DeadlineView[];
};

export function sumClubStats(rows: readonly ClubStatsRow[]) {
  const sum = {
    clubs: rows.length,
    members: { total: 0, active: 0, juniors: 0 },
    op: { results: 0, shooters: 0, passed: 0, notPassedResults: 0, remaining: 0, unknown: 0 },
    fs: { participants: 0, members: 0, guests: 0, confirmed: 0 },
    unconfirmed: 0,
  };
  for (const r of rows) {
    for (const k of ["total", "active", "juniors"] as const) sum.members[k] += r.members[k];
    for (const k of ["results", "shooters", "passed", "notPassedResults", "remaining", "unknown"] as const) sum.op[k] += r.op[k];
    for (const k of ["participants", "members", "guests", "confirmed"] as const) sum.fs[k] += r.fs[k];
    sum.unconfirmed += r.unconfirmed;
  }
  return sum;
}

/** Bestehensquote in Prozent (ganzzahlig), null ohne Schützen. */
export function passRate(op: Pick<OpStats, "shooters" | "passed">): number | null {
  if (op.shooters <= 0) return null;
  return Math.round((op.passed / op.shooters) * 100);
}

export const STATS_CSV_HEADER = [
  "Verein", "Mitglieder", "Aktive", "Junioren",
  "OP Schützen", "OP bestanden", "OP nicht bestandene Versuche", "OP verblieben", "OP ohne Regel",
  "FS Teilnahmen", "FS Mitglieder", "FS Gäste", "FS bestätigt",
  "Unbestätigte Resultate", "Nächste Frist", "Frist",
];

function fmtDay(day: string) {
  const [y, m, d] = day.split("-");
  return `${d}.${m}.${y}`;
}

export function buildStatsCsv(rows: readonly ClubStatsRow[]): string {
  return toCsv([
    STATS_CSV_HEADER,
    ...rows.map((r) => {
      const next = nextDeadline(r.deadlines);
      return [
        r.clubName, r.members.total, r.members.active, r.members.juniors,
        r.op.shooters, r.op.passed, r.op.notPassedResults, r.op.remaining, r.op.unknown,
        r.fs.participants, r.fs.members, r.fs.guests, r.fs.confirmed,
        r.unconfirmed, next ? next.label : "", next ? fmtDay(next.day) : "",
      ];
    }),
  ]);
}

// ---------------------------------------------------------------------------
// Verbandsrangliste
// ---------------------------------------------------------------------------

export type RankingInput = {
  tenantId: string;
  clubName: string;
  userId: string;
  name: string;
  total: number;
  zeros: number | null;
};

export type RankedShooter = { id: string; rank: number; name: string; clubName: string; tenantId: string; total: number; zeros: number | null; results: number };
export type AnonymousClub = { tenantId: string; clubName: string; shooters: number; results: number };

/**
 * Rangliste über Vereine: pro Schütze und Verein das beste Resultat (höchstes Total, dann weniger Nuller).
 * Nur Vereine in `nameClubIds` erscheinen mit Namen; alle anderen Vereine nur als Anzahl Schützen und
 * Resultate (ohne Namen und ohne Resultate einzelner Personen). Einträge anderer Vereine werden verworfen.
 */
export function buildAssociationRanking(entries: readonly RankingInput[], readableIds: readonly string[], nameClubIds: readonly string[]) {
  const readable = new Set(readableIds);
  const named = new Set(nameClubIds.filter((id) => readable.has(id)));
  const best = new Map<string, RankingInput & { results: number }>();
  const anon = new Map<string, { tenantId: string; clubName: string; users: Set<string>; results: number }>();
  for (const e of entries) {
    if (!readable.has(e.tenantId) || !Number.isFinite(e.total)) continue;
    if (!named.has(e.tenantId)) {
      const a = anon.get(e.tenantId) ?? { tenantId: e.tenantId, clubName: e.clubName, users: new Set<string>(), results: 0 };
      a.users.add(e.userId);
      a.results += 1;
      anon.set(e.tenantId, a);
      continue;
    }
    const key = `${e.tenantId}:${e.userId}`;
    const cur = best.get(key);
    if (!cur) {
      best.set(key, { ...e, results: 1 });
      continue;
    }
    cur.results += 1;
    const better = e.total > cur.total || (e.total === cur.total && (e.zeros ?? 0) < (cur.zeros ?? 0));
    if (better) {
      cur.total = e.total;
      cur.zeros = e.zeros;
    }
  }
  const ranked: RankedShooter[] = rankFs([...best.entries()].map(([id, b]) => ({ id, name: b.name, total: b.total, zeros: b.zeros, clubName: b.clubName, tenantId: b.tenantId, results: b.results })));
  const anonymous: AnonymousClub[] = [...anon.values()]
    .map((a) => ({ tenantId: a.tenantId, clubName: a.clubName, shooters: a.users.size, results: a.results }))
    .sort((a, b) => a.clubName.localeCompare(b.clubName, "de-CH"));
  return { ranked, anonymous };
}
export type AssociationRanking = ReturnType<typeof buildAssociationRanking>;

export function formatTotal(n: number, decimal: boolean): string {
  return decimal ? n.toFixed(1) : String(Math.round(n * 10) / 10);
}

export function buildRankingCsv(r: AssociationRanking, decimal: boolean): string {
  return toCsv([
    ["Rang", "Name", "Verein", "Total", "Nuller", "Resultate"],
    ...r.ranked.map((e) => [e.rank, e.name, e.clubName, formatTotal(e.total, decimal), e.zeros ?? "", e.results]),
    ...(r.anonymous.length ? [[], ["Vereine ohne Namensfreigabe", "", "", "", "", ""], ["", "Verein", "Schützen", "Resultate", "", ""], ...r.anonymous.map((a) => ["", a.clubName, a.shooters, a.results, "", ""])] : []),
  ]);
}

// ---------------------------------------------------------------------------
// Parameter
// ---------------------------------------------------------------------------

/** "YYYY-MM-DD" prüfen, sonst Ersatzwert. */
export function parseDayParam(raw: string | null | undefined, fallback: string): string {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return fallback;
  const [y, m, d] = raw.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m! - 1 || dt.getUTCDate() !== d) return fallback;
  return raw;
}

/** Zeitraum ordnen und auf höchstens zwei Jahre begrenzen. */
export function normalizePeriod(from: string, to: string): { from: string; to: string } {
  let a = from;
  let b = to;
  if (a > b) [a, b] = [b, a];
  const maxDays = 731;
  if (daysBetween(a, b) > maxDays) {
    const end = new Date(`${b}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() - maxDays);
    a = end.toISOString().slice(0, 10);
  }
  return { from: a, to: b };
}

export type RankingParams = { programId: string | null; from: string; to: string; officialOnly: boolean };

/**
 * Parameter der Verbandsrangliste aus der URL: Programm muss in `programIds` sein (sonst das erste),
 * Zeitraum standardmässig 1.1. bis heute des laufenden Jahres, «nur bestätigte» mit official=1.
 */
export function parseRankingParams(raw: { program?: string | null; from?: string | null; to?: string | null; official?: string | null }, programIds: readonly string[], today: string): RankingParams {
  const programId = raw.program && programIds.includes(raw.program) ? raw.program : (programIds[0] ?? null);
  const period = normalizePeriod(parseDayParam(raw.from, `${today.slice(0, 4)}-01-01`), parseDayParam(raw.to, today));
  return { programId, ...period, officialOnly: raw.official === "1" };
}

/** Query-String für Links (CSV, Druck) mit denselben Parametern. */
export function rankingQuery(p: RankingParams): string {
  const q = new URLSearchParams();
  if (p.programId) q.set("program", p.programId);
  q.set("from", p.from);
  q.set("to", p.to);
  if (p.officialOnly) q.set("official", "1");
  return q.toString();
}
