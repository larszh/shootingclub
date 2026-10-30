import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getAppContext } from "@/lib/tenant";
import { todayZurich } from "@/lib/time";
import { slugify } from "@/lib/utils";
import { csvResponse, toCsv } from "@/modules/billing/csv";
import { dayKeyToDbDate, dbDateKey } from "@/modules/range/logic";
import { fmtTime } from "@/modules/range/format";

export const dynamic = "force-dynamic";

const yn = (b: boolean) => (b ? "ja" : "nein");

/**
 * Standbuch als CSV (Semikolon, UTF-8 mit BOM), nur für «range.manage».
 * ?year=YYYY&kind=days (ein Eintrag pro Standbuch) | visits (ein Eintrag pro Besuch).
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Nicht angemeldet", { status: 401 });
  const ctx = await getAppContext();
  if (!ctx.tenant) return new NextResponse("Kein Verein ausgewählt", { status: 400 });
  if (!ctx.hasModule("range")) return new NextResponse("Modul nicht aktiv", { status: 403 });
  if (!ctx.can("range.manage")) return new NextResponse("Keine Berechtigung", { status: 403 });

  const current = Number(todayZurich().slice(0, 4));
  const rawYear = Number(req.nextUrl.searchParams.get("year"));
  const year = Number.isInteger(rawYear) && rawYear >= 2000 && rawYear <= current + 1 ? rawYear : current;
  const kind = req.nextUrl.searchParams.get("kind") === "visits" ? "visits" : "days";
  const tenantId = ctx.tenant.id;
  const where = { tenantId, date: { gte: dayKeyToDbDate(`${year}-01-01`), lte: dayKeyToDbDate(`${year}-12-31`) } };
  const name = slugify(ctx.tenant.name) || "verein";

  if (kind === "days") {
    const days = await db.rangeDay.findMany({
      where,
      include: { resource: { select: { name: true } }, visits: { select: { userId: true } } },
      orderBy: [{ date: "asc" }, { openedAt: "asc" }],
    });
    const header = ["Datum", "Anlage", "Standdienst", "Geöffnet", "Abgeschlossen", "Vormittag", "Nachmittag", "Abend", "Besuche", "davon Gäste", "Notizen"];
    const rows = days.map((d) => [
      dbDateKey(d.date), d.resource?.name ?? "Ganze Anlage", d.dutyName ?? "", fmtTime(d.openedAt), d.closedAt ? fmtTime(d.closedAt) : "offen",
      yn(d.usedAm), yn(d.usedPm), yn(d.usedEvening), d.visits.length, d.visits.filter((v) => !v.userId).length, d.notes ?? "",
    ]);
    return csvResponse(toCsv([header, ...rows]), `standbuch-tage-${name}-${year}.csv`);
  }

  const visits = await db.rangeVisit.findMany({
    where: { tenantId, rangeDay: where },
    include: { user: { select: { name: true } }, rangeDay: { select: { date: true, resource: { select: { name: true } } } } },
    orderBy: { checkedInAt: "asc" },
  });
  const hostIds = [...new Set(visits.map((v) => v.hostUserId).filter((x): x is string => !!x))];
  const weaponIds = [...new Set(visits.map((v) => v.clubWeaponId).filter((x): x is string => !!x))];
  const [hosts, weapons] = await Promise.all([
    hostIds.length ? db.user.findMany({ where: { id: { in: hostIds } }, select: { id: true, name: true } }) : [],
    weaponIds.length ? db.clubWeapon.findMany({ where: { tenantId, id: { in: weaponIds } }, select: { id: true, name: true } }) : [],
  ]);
  const hostName = new Map(hosts.map((h) => [h.id, h.name]));
  const weaponName = new Map(weapons.map((w) => [w.id, w.name]));
  const header = ["Datum", "Anlage", "Name", "Gast", "Jahrgang", "Betreut durch", "Ausweis geprüft", "Check-in", "Check-out", "Bahn", "Disziplin", "Vereinswaffe", "Standordnung bestätigt", "Bemerkung"];
  const rows = visits.map((v) => [
    v.rangeDay ? dbDateKey(v.rangeDay.date) : "", v.rangeDay?.resource?.name ?? "Ganze Anlage", v.user?.name ?? v.guestName ?? "", yn(!v.userId),
    v.guestBirthYear ?? "", v.hostUserId ? (hostName.get(v.hostUserId) ?? "") : "", v.userId ? "" : yn(v.guestIdChecked),
    fmtTime(v.checkedInAt), v.checkedOutAt ? fmtTime(v.checkedOutAt) : "", v.lane ?? "", v.discipline ?? "",
    v.clubWeaponId ? (weaponName.get(v.clubWeaponId) ?? "") : "", yn(!!v.rulesAcceptedAt), v.note ?? "",
  ]);
  return csvResponse(toCsv([header, ...rows]), `standbuch-besuche-${name}-${year}.csv`);
}
