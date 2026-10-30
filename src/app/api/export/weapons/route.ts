import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getAppContext } from "@/lib/tenant";
import { formatDateTimeZurich, formatDateZurich, todayZurich } from "@/lib/time";
import { slugify } from "@/lib/utils";
import { csvAmount, csvResponse, toCsv } from "@/modules/billing/csv";
import { blockReasonOf, stripBlockReason } from "@/modules/weapons/logic";
import { listWeapons } from "@/modules/weapons/queries";
import { serviceKindLabel, weaponStatusInfo } from "@/modules/weapons/types";

export const dynamic = "force-dynamic";

const day = (d: Date | null) => (d ? formatDateZurich(d, { weekday: undefined }) : "");
const dt = (d: Date | null) => (d ? formatDateTimeZurich(d) : "");

/**
 * Vereinswaffen als CSV (Semikolon, UTF-8 mit BOM), nur für «weapons.manage».
 * ?kind=inventory (Standard) | loans (alle Ausleihen) | services (Wartungsjournal)
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Nicht angemeldet", { status: 401 });
  const ctx = await getAppContext();
  if (!ctx.tenant) return new NextResponse("Kein Verein ausgewählt", { status: 400 });
  if (!ctx.hasModule("weapons")) return new NextResponse("Modul nicht aktiv", { status: 403 });
  if (!ctx.can("weapons.manage")) return new NextResponse("Keine Berechtigung", { status: 403 });
  const tenantId = ctx.tenant.id;
  const kind = req.nextUrl.searchParams.get("kind") ?? "inventory";
  const club = slugify(ctx.tenant.name) || "verein";
  const today = todayZurich();

  if (kind === "loans") {
    const loans = await db.weaponLoan.findMany({
      where: { tenantId },
      include: { weapon: { select: { name: true, serialNumber: true } }, user: { select: { name: true } } },
      orderBy: { loanedAt: "desc" },
      take: 20_000,
    });
    const issuers = await db.user.findMany({ where: { id: { in: [...new Set(loans.map((l) => l.issuedById).filter((x): x is string => !!x))] } }, select: { id: true, name: true } });
    const names = new Map(issuers.map((u) => [u.id, u.name]));
    const header = ["Waffe", "Seriennummer", "Ausleihende Person", "Minderjährig", "Nur am Stand", "Ausgegeben", "Rückgabe bis", "Zurück", "Schüsse", "Meldefrist", "Gemeldet", "Ausgegeben durch", "Bemerkung"];
    const rows = loans.map((l) => [
      l.weapon.name, l.weapon.serialNumber ?? "", l.user?.name ?? l.borrowerName ?? "", l.isMinor ? "ja" : "nein", l.onSiteOnly ? "ja" : "nein",
      dt(l.loanedAt), day(l.dueAt), dt(l.returnedAt), l.shots ?? "", day(l.reportDueAt), day(l.reportedAt), l.issuedById ? names.get(l.issuedById) ?? "" : "", l.note ?? "",
    ]);
    return csvResponse(toCsv([header, ...rows]), `vereinswaffen-ausleihen-${club}-${today}.csv`);
  }

  if (kind === "services") {
    const services = await db.weaponService.findMany({ where: { weapon: { tenantId } }, include: { weapon: { select: { name: true, serialNumber: true } } }, orderBy: [{ date: "desc" }], take: 20_000 });
    const header = ["Datum", "Waffe", "Seriennummer", "Art", "Notiz", "Kosten", "Durch"];
    const rows = services.map((s) => [day(s.date), s.weapon.name, s.weapon.serialNumber ?? "", serviceKindLabel(s.kind), s.note ?? "", s.costCents !== null ? csvAmount(s.costCents) : "", s.byName ?? ""]);
    return csvResponse(toCsv([header, ...rows]), `vereinswaffen-wartung-${club}-${today}.csv`);
  }

  const weapons = await listWeapons(tenantId, { status: "all" }, true);
  const notes = new Map((await db.clubWeapon.findMany({ where: { tenantId }, select: { id: true, notes: true } })).map((w) => [w.id, w.notes]));
  const header = ["Bezeichnung", "Disziplin", "Hersteller", "Modell", "Kaliber", "Seriennummer", "Status", "Sperrgrund", "Schusszähler", "Schuss seit Wartung", "Wartung alle (Schuss)", "Nächste Wartung", "Wartung fällig", "Ausgeliehen an", "Ausgeliehen seit", "Notizen"];
  const rows = weapons.map((w) => [
    w.name, w.discipline ?? "", w.manufacturer ?? "", w.model ?? "", w.caliber ?? "", w.serialNumber ?? "", weaponStatusInfo(w.status).label,
    blockReasonOf(notes.get(w.id)) ?? "", w.shotCount, w.shotsSinceService, w.serviceEveryShots ?? "", day(w.nextServiceAt), w.service.due ? "ja" : "nein",
    w.openLoan?.borrower ?? "", w.openLoan ? dt(w.openLoan.loanedAt) : "", stripBlockReason(notes.get(w.id)) ?? "",
  ]);
  return csvResponse(toCsv([header, ...rows]), `vereinswaffen-${club}-${today}.csv`);
}
