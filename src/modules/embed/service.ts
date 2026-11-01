import "server-only";
import { db } from "@/lib/db";
import { MODULES, type ModuleKey } from "@/lib/modules";
import { normalizeHex } from "@/lib/brand";
import { APP_TZ, formatTimeRange, zurichParts } from "@/lib/time";
import { formatScore, safeJson } from "@/lib/utils";
import { effectiveEnd, kindMeta } from "@/modules/events/types";
import { tenantFeedPath } from "@/modules/events/queries";
import { parseStages, programTotals } from "@/modules/scores/types";
import { assignRanks, compareEntries, countTopShots, periodRange, round1, type Period, type RankedEntry } from "@/modules/scores/analytics";
import { getChampionship, loadRanking } from "@/modules/championship/queries";
import { shortNames } from "@/modules/live/logic";
import { formatMinutes, mergeWindows, WEEKDAY_ORDER, WEEKDAYS } from "@/modules/range/logic";
import { isPlausibleEmbedToken } from "./logic";
import type { CalendarItem, RankRow, TimesGroup } from "./render";

export type EmbedTenant = {
  id: string;
  name: string;
  token: string;
  brandColor: string | null;
  logoPath: string | null;
  logoVersion: number;
  calendarToken: string | null;
};

/** Verein zum Embed-Token (nicht gelöscht). null = unbekannter Token oder widerrufen. */
export async function findEmbedTenant(token: string | null | undefined): Promise<EmbedTenant | null> {
  if (!isPlausibleEmbedToken(token)) return null;
  const t = await db.tenant.findFirst({
    where: { embedToken: token, deletedAt: null },
    select: { id: true, name: true, embedToken: true, brandColor: true, logoPath: true, updatedAt: true, calendarToken: true },
  });
  // Vergleich auf exakte Gleichheit (MariaDB-Kollation ist evtl. nicht case-sensitiv)
  if (!t || t.embedToken !== token) return null;
  return { id: t.id, name: t.name, token, brandColor: normalizeHex(t.brandColor), logoPath: t.logoPath, logoVersion: t.updatedAt.getTime(), calendarToken: t.calendarToken };
}

export function embedLogoUrl(t: EmbedTenant) {
  return t.logoPath ? `/embed/${encodeURIComponent(t.token)}/logo?v=${t.logoVersion}` : null;
}

export async function isModuleOn(tenantId: string, key: ModuleKey) {
  const row = await db.tenantModule.findUnique({ where: { tenantId_moduleKey: { tenantId, moduleKey: key } }, select: { enabled: true } });
  if (row) return row.enabled;
  return MODULES.find((m) => m.key === key)?.defaultEnabled ?? false;
}

// ---------------------------------------------------------------------------
// Kalender
// ---------------------------------------------------------------------------

const dayFmt = new Intl.DateTimeFormat("de-CH", { timeZone: APP_TZ, day: "numeric" });
const monthFmt = new Intl.DateTimeFormat("de-CH", { timeZone: APP_TZ, month: "short" });
const weekdayFmt = new Intl.DateTimeFormat("de-CH", { timeZone: APP_TZ, weekday: "short" });
const dateFmt = new Intl.DateTimeFormat("de-CH", { timeZone: APP_TZ, day: "2-digit", month: "2-digit", year: "numeric" });

export async function loadCalendar(t: EmbedTenant, opts: { kinds: string[]; limit: number; baseUrl: string; now: Date }) {
  const since = new Date(opts.now.getTime() - 14 * 86_400_000); // mehrtägige Anlässe, die schon begonnen haben
  const rows = await db.event.findMany({
    where: { tenantId: t.id, startsAt: { gte: since }, ...(opts.kinds.length ? { kind: { in: opts.kinds } } : {}) },
    orderBy: { startsAt: "asc" },
    select: { id: true, title: true, kind: true, startsAt: true, endsAt: true, allDay: true, location: true, isCancelled: true },
    take: 300,
  });
  const upcoming = rows.filter((e) => effectiveEnd(e).getTime() >= opts.now.getTime()).slice(0, opts.limit);
  const items: CalendarItem[] = upcoming.map((e) => {
    const multiDay = e.endsAt && zurichParts(e.endsAt).dateStr !== zurichParts(e.startsAt).dateStr;
    const dateLabel = dateFmt.format(e.startsAt) + (multiDay && e.endsAt ? ` – ${dateFmt.format(e.allDay ? new Date(e.endsAt.getTime() - 1) : e.endsAt)}` : "");
    const timeLabel = e.allDay ? "ganztägig" : e.endsAt && !multiDay ? `${formatTimeRange(e.startsAt, e.endsAt)} Uhr` : `${zurichParts(e.startsAt).timeStr} Uhr`;
    return {
      day: dayFmt.format(e.startsAt).replace(".", ""),
      month: monthFmt.format(e.startsAt).replace(".", ""),
      weekday: weekdayFmt.format(e.startsAt).replace(".", ""),
      dateLabel,
      timeLabel,
      title: e.title,
      kindLabel: kindMeta(e.kind).label,
      location: e.location,
      cancelled: e.isCancelled,
    };
  });
  const kindQuery = opts.kinds.length ? `?kind=${opts.kinds.join(",")}` : "";
  const icalUrl = t.calendarToken ? `${opts.baseUrl}${tenantFeedPath(t.calendarToken)}${kindQuery}` : null;
  return { items, icalUrl };
}

// ---------------------------------------------------------------------------
// Rangliste (bestes Resultat pro Mitglied, abgeschlossene Durchgänge)
// ---------------------------------------------------------------------------

const MAX_ROWS = 50;

export async function loadProgramRanking(t: EmbedTenant, programId: string, period: Period, now: Date) {
  if (!programId || programId.length > 40) return null;
  const program = await db.program.findFirst({ where: { id: programId, OR: [{ tenantId: null }, { tenantId: t.id }] }, select: { id: true, name: true, stagesJson: true, scoringMode: true } });
  if (!program) return null;
  const stages = parseStages(program.stagesJson);
  const range = periodRange(period, now);
  const parts = await db.matchParticipant.findMany({
    where: {
      userId: { not: null },
      total: { not: null },
      user: { deletedAt: null, memberships: { some: { tenantId: t.id, status: { not: "LEFT" } } } },
      match: { tenantId: t.id, programId: program.id, status: "FINISHED", ...(range.from ? { date: { gte: range.from } } : {}) },
    },
    select: { id: true, userId: true, total: true, user: { select: { name: true } }, match: { select: { date: true } } },
    take: 20_000,
  });

  type Row = { id: string; userId: string; name: string; total: number; date: Date };
  const best = new Map<string, Row[]>();
  for (const p of parts) {
    if (!p.userId || !p.user || p.total === null) continue;
    const row: Row = { id: p.id, userId: p.userId, name: p.user.name, total: p.total, date: p.match.date };
    const cur = best.get(p.userId);
    if (!cur || row.total > cur[0]!.total) best.set(p.userId, [row]);
    else if (row.total === cur[0]!.total) cur.push(row);
  }

  // Feinwertung (Höchstwerte, letzte Serie) nur für die Bestwerte
  const candidateIds = [...best.values()].flat().map((r) => r.id);
  const details = new Map<string, { topShots: number; lastStage: number }>();
  for (let i = 0; i < candidateIds.length; i += 1000) {
    const results = await db.matchResult.findMany({ where: { participantId: { in: candidateIds.slice(i, i + 1000) } }, select: { participantId: true, stageIndex: true, shotsJson: true, total: true } });
    const byPart = new Map<string, typeof results>();
    for (const r of results) byPart.set(r.participantId, [...(byPart.get(r.participantId) ?? []), r]);
    for (const [id, rs] of byPart) {
      const byIdx = new Map(rs.map((r) => [r.stageIndex, r]));
      const shots = stages.map((_, idx) => safeJson<number[]>(byIdx.get(idx)?.shotsJson, []));
      details.set(id, { topShots: countTopShots(shots, stages, program.scoringMode), lastStage: round1(stages.length ? (byIdx.get(stages.length - 1)?.total ?? 0) : 0) });
    }
  }

  type Entry = RankedEntry & { name: string };
  const entries: Entry[] = [...best.values()].map((rows) => {
    const scored = rows.map((r) => ({ name: r.name, total: round1(r.total), date: r.date, ...(details.get(r.id) ?? { topShots: 0, lastStage: 0 }) })).sort(compareEntries);
    return scored[0]!;
  });
  const ranked = assignRanks(entries.sort(compareEntries)).slice(0, MAX_ROWS);
  const names = shortNames(ranked.map((e) => e.name));
  const decimal = program.scoringMode === "RINGS_DECIMAL";
  const rows: RankRow[] = ranked.map((e, i) => ({ rank: e.rank, name: names[i]!, score: formatScore(e.total, decimal) }));
  return { programName: program.name, periodLabel: range.label, max: programTotals(stages, program.scoringMode).max, rows, total: entries.length };
}

// ---------------------------------------------------------------------------
// Jahresmeisterschaft (nur veröffentlichte)
// ---------------------------------------------------------------------------

const pointsFmt = new Intl.NumberFormat("de-CH", { maximumFractionDigits: 2 });

export async function loadChampionshipRanking(t: EmbedTenant, id: string) {
  const c = await getChampionship(t.id, id);
  if (!c || !c.isPublished) return null;
  const { ranking } = await loadRanking(t.id, c);
  const all = [...ranking.ranked, ...ranking.unclassified];
  const names = shortNames(all.map((e) => e.name));
  const nameOf = new Map(all.map((e, i) => [e.userId, names[i]!]));
  const multiCat = ranking.categories.length > 1;
  const rows: RankRow[] = ranking.ranked.slice(0, 100).map((e) => ({
    rank: e.rank ?? 0,
    name: nameOf.get(e.userId) ?? "Schütze/in",
    score: pointsFmt.format(e.total),
    detail: multiCat && e.category ? e.category : null,
  }));
  return { name: c.name, year: c.year, rows, unclassified: ranking.unclassified.length };
}

// ---------------------------------------------------------------------------
// Schiesszeiten (Standbetrieb)
// ---------------------------------------------------------------------------

export async function loadTimes(t: EmbedTenant) {
  const windows = await db.shootingWindow.findMany({
    where: { tenantId: t.id, OR: [{ resourceId: null }, { resource: { isActive: true } }] },
    select: { resourceId: true, weekday: true, startMinute: true, endMinute: true, resource: { select: { name: true, sortOrder: true } } },
    orderBy: [{ weekday: "asc" }, { startMinute: "asc" }],
    take: 500,
  });
  const groups = new Map<string, { name: string; sort: number; list: typeof windows }>();
  for (const w of windows) {
    const key = w.resourceId ?? "";
    const g = groups.get(key) ?? { name: w.resource?.name ?? "Ganze Anlage", sort: w.resourceId ? (w.resource?.sortOrder ?? 0) + 1 : -1, list: [] };
    g.list.push(w);
    groups.set(key, g);
  }
  const out: TimesGroup[] = [...groups.values()]
    .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, "de-CH"))
    .map((g) => ({
      name: groups.size > 1 ? g.name : "",
      days: WEEKDAY_ORDER.map((wd) => {
        const ranges = mergeWindows(g.list.filter((w) => w.weekday === wd));
        return { label: WEEKDAYS[wd], ranges: ranges.length ? ranges.map((r) => `${formatMinutes(r.startMinute)}–${formatMinutes(r.endMinute)}`).join(", ") : null };
      }),
    }));
  return out;
}
