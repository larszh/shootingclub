import "server-only";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireTenant, type AppContext } from "@/lib/tenant";

/** Live-Ranglisten verwalten: «match.viewAll» (Trainer) oder «events.manage». */
export function canManageLive(ctx: AppContext) {
  return ctx.can("match.viewAll") || ctx.can("events.manage");
}

export async function requireLiveAdmin() {
  const ctx = await requireTenant();
  if (!canManageLive(ctx)) redirect("/?denied=1");
  return ctx;
}

export type LiveBoardListItem = {
  id: string;
  title: string;
  token: string;
  programId: string | null;
  programName: string | null;
  eventId: string | null;
  eventTitle: string | null;
  day: string | null;
  showDecimals: boolean;
  expiresAt: Date | null;
  createdAt: Date;
};

export async function listLiveBoards(tenantId: string): Promise<LiveBoardListItem[]> {
  const boards = await db.liveBoard.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 100 });
  return withNames(tenantId, boards);
}

export async function getLiveBoard(tenantId: string, id: string): Promise<LiveBoardListItem | null> {
  if (!id || id.length > 40) return null;
  const b = await db.liveBoard.findFirst({ where: { id, tenantId } });
  if (!b) return null;
  return (await withNames(tenantId, [b]))[0] ?? null;
}

async function withNames(tenantId: string, boards: Array<{ id: string; title: string; token: string; programId: string | null; eventId: string | null; date: Date | null; showDecimals: boolean; expiresAt: Date | null; createdAt: Date }>) {
  const programIds = [...new Set(boards.map((b) => b.programId).filter((x): x is string => !!x))];
  const eventIds = [...new Set(boards.map((b) => b.eventId).filter((x): x is string => !!x))];
  const [programs, events] = await Promise.all([
    programIds.length ? db.program.findMany({ where: { id: { in: programIds }, OR: [{ tenantId: null }, { tenantId }] }, select: { id: true, name: true } }) : [],
    eventIds.length ? db.event.findMany({ where: { id: { in: eventIds }, tenantId }, select: { id: true, title: true } }) : [],
  ]);
  const pn = new Map(programs.map((p) => [p.id, p.name]));
  const en = new Map(events.map((e) => [e.id, e.title]));
  return boards.map((b) => ({
    id: b.id,
    title: b.title,
    token: b.token,
    programId: b.programId,
    programName: b.programId ? (pn.get(b.programId) ?? null) : null,
    eventId: b.eventId,
    eventTitle: b.eventId ? (en.get(b.eventId) ?? null) : null,
    day: b.date ? b.date.toISOString().slice(0, 10) : null,
    showDecimals: b.showDecimals,
    expiresAt: b.expiresAt,
    createdAt: b.createdAt,
  }));
}

/** Auswahl für das Formular: sichtbare Programme und Anlässe rund um heute. */
export async function liveFormOptions(tenantId: string, around: Date) {
  const [programs, hidden, events] = await Promise.all([
    db.program.findMany({ where: { OR: [{ tenantId: null }, { tenantId }], isArchived: false }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 500 }),
    db.programTenantSetting.findMany({ where: { tenantId, hidden: true }, select: { programId: true } }),
    db.event.findMany({
      where: { tenantId, isCancelled: false, startsAt: { gte: new Date(around.getTime() - 30 * 86_400_000), lte: new Date(around.getTime() + 60 * 86_400_000) } },
      select: { id: true, title: true, startsAt: true },
      orderBy: { startsAt: "asc" },
      take: 200,
    }),
  ]);
  const hiddenSet = new Set(hidden.map((h) => h.programId));
  return { programs: programs.filter((p) => !hiddenSet.has(p.id)), events };
}

/** Aktueller Zeitpunkt (ausserhalb des Renderns aufgerufen). */
export function nowDate() {
  return new Date();
}
