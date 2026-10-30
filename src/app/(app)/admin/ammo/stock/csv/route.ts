import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAppContext } from "@/lib/tenant";
import { formatDateTimeZurich, todayZurich } from "@/lib/time";
import { slugify } from "@/lib/utils";
import { csvResponse, toCsv } from "@/modules/billing/csv";
import { fundingInfo, isStockKind, stockKindInfo } from "@/modules/ammo/stock";
import { listMovements } from "@/modules/ammo/stock-service";

export const dynamic = "force-dynamic";

const isDay = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

/** Bestandsjournal als CSV (Semikolon, UTF-8 mit BOM), nur «ammo.manage». Gleiche Filter wie die Seite. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Nicht angemeldet", { status: 401 });
  const ctx = await getAppContext();
  if (!ctx.tenant) return new NextResponse("Kein Verein ausgewählt", { status: 400 });
  if (!ctx.hasModule("ammo")) return new NextResponse("Modul nicht aktiv", { status: 403 });
  if (!ctx.can("ammo.manage")) return new NextResponse("Keine Berechtigung", { status: 403 });
  const p = req.nextUrl.searchParams;
  const product = p.get("product");
  const kind = p.get("kind");
  const rows = await listMovements(ctx.tenant.id, {
    productId: product && product.length <= 40 ? product : undefined,
    kind: kind && isStockKind(kind) ? kind : undefined,
    from: isDay(p.get("from")) ? p.get("from")! : undefined,
    to: isDay(p.get("to")) ? p.get("to")! : undefined,
  }, 50_000);
  const header = ["Datum", "Art", "Produkt", "Kaliber", "Finanzierung", "Einheiten", "Einheit", "Schuss", "Herkunft/Anlass", "Rechnung", "Standbuch", "Bemerkung", "Erfasst von"];
  const data = rows.map((m) => [
    formatDateTimeZurich(m.date), stockKindInfo(m.kind).label, m.product.name, m.product.caliber, fundingInfo(m.product.fundingType).label,
    m.units, m.product.unitLabel, m.units * m.product.roundsPerUnit, m.source ?? "", m.invoiceNumber ?? "",
    m.rangeDay ? m.rangeDay.date.toISOString().slice(0, 10) : "", m.note ?? "", m.createdByName ?? "",
  ]);
  return csvResponse(toCsv([header, ...data]), `munition-journal-${slugify(ctx.tenant.name) || "verein"}-${todayZurich()}.csv`);
}
