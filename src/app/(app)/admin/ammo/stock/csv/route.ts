import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAppContext } from "@/lib/tenant";
import { todayZurich } from "@/lib/time";
import { slugify } from "@/lib/utils";
import { csvResponse, toCsv } from "@/modules/billing/csv";
import { isStockKind } from "@/modules/ammo/stock";
import { fundingLabelT, stockKindLabelT } from "@/modules/ammo/ui/labels";
import { movementDateT } from "@/modules/ammo/ui/dates";
import { getRequestLocale, getT } from "@/lib/i18n";
import { listMovements } from "@/modules/ammo/stock-service";

export const dynamic = "force-dynamic";

const isDay = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

/** Bestandsjournal als CSV (Semikolon, UTF-8 mit BOM), nur «ammo.manage». Gleiche Filter wie die Seite. */
export async function GET(req: NextRequest) {
  const locale = await getRequestLocale();
  const t = getT(locale);
  const user = await getCurrentUser();
  if (!user) return new NextResponse(t("adm1.http.notSignedIn"), { status: 401 });
  const ctx = await getAppContext();
  if (!ctx.tenant) return new NextResponse(t("adm1.http.noClub"), { status: 400 });
  if (!ctx.hasModule("ammo")) return new NextResponse(t("adm1.http.moduleOff"), { status: 403 });
  if (!ctx.can("ammo.manage")) return new NextResponse(t("adm1.http.noPermission"), { status: 403 });
  const p = req.nextUrl.searchParams;
  const product = p.get("product");
  const kind = p.get("kind");
  const rows = await listMovements(ctx.tenant.id, {
    productId: product && product.length <= 40 ? product : undefined,
    kind: kind && isStockKind(kind) ? kind : undefined,
    from: isDay(p.get("from")) ? p.get("from")! : undefined,
    to: isDay(p.get("to")) ? p.get("to")! : undefined,
  }, 50_000);
  const header = ["date", "kind", "product", "caliber", "funding", "units", "unit", "rounds", "source", "invoice", "rangeDay", "note", "createdBy"].map((k) => t(`adm1.ammo.csv.${k}`));
  const data = rows.map((m) => [
    movementDateT(m.date, m.createdAt, locale), stockKindLabelT(m.kind, t), m.product.name, m.product.caliber, fundingLabelT(m.product.fundingType, t),
    m.units, m.product.unitLabel, m.units * m.product.roundsPerUnit, m.source ?? "", m.invoiceNumber ?? "",
    m.rangeDay ? m.rangeDay.date.toISOString().slice(0, 10) : "", m.note ?? "", m.createdByName ?? "",
  ]);
  return csvResponse(toCsv([header, ...data]), `${t("adm1.ammo.csv.journalFile")}-${slugify(ctx.tenant.name) || "club"}-${todayZurich()}.csv`);
}
