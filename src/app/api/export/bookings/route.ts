import { NextResponse, type NextRequest } from "next/server";
import { addDays, formatDateZurich, formatTimeRange, todayZurich, zurichToUtc } from "@/lib/time";
import { slugify } from "@/lib/utils";
import { formatQrReference } from "@/lib/qr-reference";
import { adminExportContext, csvAmount, csvResponse, toCsv } from "@/modules/billing/csv";
import { listBookingsForExport } from "@/modules/bookings/queries";
import { BOOKING_STATUS, PAYMENT_METHOD_LABEL, paymentStatusView } from "@/modules/bookings/types";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Reservationen eines Zeitraums als CSV (nur Verwaltung).
 * ?from=YYYY-MM-DD&to=YYYY-MM-DD (Schweizer Kalendertage, beide inklusive). Standard: laufender Monat.
 */
export async function GET(req: NextRequest) {
  const res = await adminExportContext("bookings");
  if ("error" in res) return res.error;
  const { ctx } = res;
  const today = todayZurich();
  const qFrom = req.nextUrl.searchParams.get("from");
  const qTo = req.nextUrl.searchParams.get("to");
  const fromStr = qFrom && DATE_RE.test(qFrom) ? qFrom : `${today.slice(0, 7)}-01`;
  const toStr = qTo && DATE_RE.test(qTo) ? qTo : addDays(addDays(`${today.slice(0, 7)}-01`, 32).slice(0, 7) + "-01", -1);
  if (toStr < fromStr) return new NextResponse("Ungültiger Zeitraum", { status: 400 });
  const from = zurichToUtc(fromStr, "00:00");
  const to = zurichToUtc(addDays(toStr, 1), "00:00");
  if (to.getTime() - from.getTime() > 3 * 366 * 86_400_000) return new NextResponse("Zeitraum zu lang (max. 3 Jahre)", { status: 400 });

  const list = await listBookingsForExport(ctx.tenant.id, from, to);
  const header = ["Datum", "Zeit", "Dauer (Min.)", "Ressource", "Mitglied", "E-Mail", "Status", "Grundpreis", "Rabatt", "Rabattgrund", "Total", "Währung", "Zahlungsart", "Zahlungsstatus", "Bezahlt am", "Rechnung", "QR-Referenz", "Bemerkung", "Notiz Verwaltung", "Erstellt"];
  const rows = list.map((b) => [
    formatDateZurich(b.startsAt, { weekday: undefined }),
    formatTimeRange(b.startsAt, b.endsAt),
    b.durationMinutes,
    b.resource.name,
    b.user?.name ?? "Gast",
    b.user?.email ?? "",
    BOOKING_STATUS[b.status]?.label ?? b.status,
    csvAmount(b.basePriceCents),
    csvAmount(b.discountCents),
    b.discountReason ?? "",
    csvAmount(b.totalCents),
    b.currency,
    PAYMENT_METHOD_LABEL[b.paymentMethod] ?? b.paymentMethod,
    paymentStatusView(b).label,
    b.paidAt ? formatDateZurich(b.paidAt, { weekday: undefined }) : "",
    b.invoice?.number ?? "",
    b.invoice?.reference ? formatQrReference(b.invoice.reference) : "",
    b.note ?? "",
    b.adminNote ?? "",
    formatDateZurich(b.createdAt, { weekday: undefined }),
  ]);
  return csvResponse(toCsv([header, ...rows]), `reservationen-${slugify(ctx.tenant.name) || "verein"}-${fromStr}_bis_${toStr}.csv`);
}
