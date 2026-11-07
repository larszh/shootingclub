import "server-only";
import { db } from "@/lib/db";
import { zurichToUtc } from "@/lib/time";
import type { AppContext, ActiveTenant } from "@/lib/tenant";
import { getChampionship, loadRanking } from "@/modules/championship/queries";
import { getAccountingJournal } from "@/modules/accounting/queries";
import { buildReportAggregates, type ChampionshipLite, type ReportAggregates } from "./aggregates";

type TenantCtx = AppContext & { tenant: ActiveTenant };

const MAX_ROWS = 50_000;

/**
 * Rohdaten eines Vereinsjahrs laden (nur Felder für Zahlen) und zu Kennzahlen verdichten.
 * Module, die im Verein nicht aktiv sind, bleiben null. Meisterschaften nur, wenn veröffentlicht.
 */
export async function loadReportAggregates(ctx: TenantCtx, year: number): Promise<ReportAggregates> {
  const tenantId = ctx.tenant.id;
  const from = zurichToUtc(`${year}-01-01`, "00:00");
  const to = zurichToUtc(`${year + 1}-01-01`, "00:00");
  const has = (k: Parameters<TenantCtx["hasModule"]>[0]) => ctx.hasModule(k);

  const [memberships, events, bookings, op, fs, championships, finance] = await Promise.all([
    db.membership.findMany({
      where: { tenantId },
      select: { status: true, joinedAt: true, leftAt: true, user: { select: { birthDate: true } } },
      take: MAX_ROWS,
    }),
    has("events")
      ? db.event.findMany({
          where: { tenantId, startsAt: { gte: from, lt: to } },
          select: { kind: true, isCancelled: true, rsvps: { where: { status: "YES" }, select: { guests: true } } },
          take: MAX_ROWS,
        })
      : Promise.resolve(null),
    has("bookings")
      ? db.booking.findMany({ where: { tenantId, startsAt: { gte: from, lt: to } }, select: { status: true, persons: true }, take: MAX_ROWS })
      : Promise.resolve(null),
    has("federal")
      ? db.matchParticipant.findMany({
          where: { isOfficial: true, userId: { not: null }, match: { tenantId, date: { gte: from, lt: to }, program: { officialKind: "OP" } } },
          select: { userId: true, passed: true, attempt: true, match: { select: { date: true } } },
          take: MAX_ROWS,
        })
      : Promise.resolve(null),
    has("federal")
      ? db.matchParticipant.findMany({
          where: { total: { not: null }, match: { tenantId, date: { gte: from, lt: to }, program: { officialKind: "FS" } } },
          select: { userId: true, isOfficial: true },
          take: MAX_ROWS,
        })
      : Promise.resolve(null),
    has("championship") ? loadChampionships(tenantId, year) : Promise.resolve(null),
    // Buchhaltung ist kein eigenes Modul: Journal aus Beiträgen, Reservationen, Munition, Schützenstube
    ctx.can("accounting.export") && (has("billing") || has("bookings") || has("ammo") || has("kiosk"))
      ? getAccountingJournal(tenantId, `${year}-01-01`, `${year}-12-31`).then((j) => j.entries.map((e) => ({ kind: e.kind, type: e.type, amountCents: e.amountCents, currency: e.currency })))
      : Promise.resolve(null),
  ]);

  return buildReportAggregates({
    year,
    memberships: memberships.map((m) => ({ status: m.status, joinedAt: m.joinedAt, leftAt: m.leftAt, birthYear: m.user.birthDate ? m.user.birthDate.getUTCFullYear() : null })),
    events: events ? events.map((e) => ({ kind: e.kind, isCancelled: e.isCancelled, yes: e.rsvps.length, guests: e.rsvps.reduce((a, r) => a + r.guests, 0) })) : null,
    bookings,
    op: op ? op.map((r) => ({ userId: r.userId, passed: r.passed, attempt: r.attempt, date: r.match.date })) : null,
    fs,
    championships,
    finance,
  });
}

/** Veröffentlichte Meisterschaften des Jahres mit Rangierten 1–3 (höchstens 10 Meisterschaften). */
async function loadChampionships(tenantId: string, year: number): Promise<ChampionshipLite[]> {
  const rows = await db.championship.findMany({ where: { tenantId, year, isPublished: true }, select: { id: true }, orderBy: { startsOn: "asc" }, take: 10 });
  const out: ChampionshipLite[] = [];
  for (const r of rows) {
    const c = await getChampionship(tenantId, r.id);
    if (!c || !c.isPublished) continue;
    const { ranking } = await loadRanking(tenantId, c);
    out.push({
      name: c.name,
      isPublished: true,
      classified: ranking.ranked.length,
      podium: ranking.ranked.filter((e) => e.rank !== null && e.rank <= 3).map((e) => ({ rank: e.rank!, name: e.name, total: e.total })),
    });
  }
  return out;
}
