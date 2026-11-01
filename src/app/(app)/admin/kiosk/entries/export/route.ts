import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAppContext } from "@/lib/tenant";
import { audit } from "@/lib/audit";
import { slugify } from "@/lib/utils";
import { formatDateTimeZurich } from "@/lib/time";
import { csvAmount, csvResponse, toCsv } from "@/modules/billing/csv";
import { listEntries } from "@/modules/kiosk/queries";
import { entryFiltersFrom } from "@/modules/kiosk/filters";

export const dynamic = "force-dynamic";

/** Einträge der Schützenstube als CSV (Semikolon, UTF-8 mit BOM), nur für «kiosk.manage». */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Nicht angemeldet", { status: 401 });
  const ctx = await getAppContext();
  if (!ctx.tenant) return new NextResponse("Kein Verein ausgewählt", { status: 400 });
  if (!ctx.hasModule("kiosk")) return new NextResponse("Modul nicht aktiv", { status: 403 });
  if (!ctx.can("kiosk.manage")) return new NextResponse("Keine Berechtigung", { status: 403 });
  const sp = Object.fromEntries(req.nextUrl.searchParams.entries());
  const { period, filters } = entryFiltersFrom(sp);
  const { rows } = await listEntries(ctx.tenant.id, filters, 50_000);
  const status = (r: (typeof rows)[number]) => (r.paidCash ? "bar" : r.billedInvoiceId ? "verrechnet" : "offen");
  const csv = toCsv([
    ["Datum", "Mitglied", "Gast", "Produkt", "Menge", "Preis (CHF)", "Total (CHF)", "Status", "Rechnung", "Rechnungsstatus", "Erfasst von"],
    ...[...rows].reverse().map((r) => [
      formatDateTimeZurich(r.createdAt), r.memberName ?? "", r.guestName ?? "", r.productName, r.quantity, csvAmount(r.unitPriceCents), csvAmount(r.totalCents),
      status(r), r.invoice?.number ?? "", r.invoice ? (r.invoice.status === "PAID" ? "bezahlt" : r.invoice.status === "OPEN" ? "offen" : r.invoice.status === "CANCELLED" ? "storniert" : r.invoice.status) : "",
      r.sellerName ?? "",
    ]),
  ]);
  await audit({ tenantId: ctx.tenant.id, actorId: user.id, actorName: user.name, action: "kiosk.export", entity: "KioskEntry", entityId: ctx.tenant.id, detail: `Einträge ${period.from} bis ${period.to} (${rows.length} Zeilen)` });
  return csvResponse(csv, `${slugify(ctx.tenant.name) || "verein"}-schuetzenstube-${period.from}-${period.to}.csv`);
}
