import { NextResponse, type NextRequest } from "next/server";
import { slugify } from "@/lib/utils";
import { adminExportContext, csvAmount, csvResponse, toCsv } from "@/modules/billing/csv";
import { loadPartnerReport } from "@/modules/sharing/queries";
import { formatHours } from "@/modules/sharing/logic";
import { parsePeriod } from "@/modules/sharing/period";

export const dynamic = "force-dynamic";

/**
 * Auswertung pro Partnerverein (gemeinsame Anlagen) als CSV, z.B. für die Kostenaufteilung.
 * ?from=YYYY-MM-DD&to=YYYY-MM-DD (beide inklusive). Nur Verwaltung des Eigentümers.
 */
export async function GET(req: NextRequest) {
  const res = await adminExportContext("bookings");
  if ("error" in res) return res.error;
  const { ctx } = res;
  const period = parsePeriod(req.nextUrl.searchParams.get("from"), req.nextUrl.searchParams.get("to"));
  if (!period) return new NextResponse("Ungültiger Zeitraum (max. 3 Jahre)", { status: 400 });
  const report = await loadPartnerReport(ctx.tenant.id, period.from, period.to);
  const header = ["Partnerverein", "Von", "Bis", "Buchungen", "Stunden", "Personen", "Betrag", "davon bezahlt", "offen", "Währung"];
  const rows = report.rows.map((r) => [r.name, period.fromStr, period.toStr, r.bookings, formatHours(r.hours), r.persons, csvAmount(r.amountCents), csvAmount(r.paidCents), csvAmount(r.openCents), report.currency]);
  const t = report.total;
  const totalRow = ["Total", period.fromStr, period.toStr, t.bookings, formatHours(t.hours), t.persons, csvAmount(t.amountCents), csvAmount(t.paidCents), csvAmount(t.openCents), report.currency];
  return csvResponse(toCsv([header, ...rows, totalRow]), `partnervereine-${slugify(ctx.tenant.name) || "verein"}-${period.fromStr}_bis_${period.toStr}.csv`);
}
