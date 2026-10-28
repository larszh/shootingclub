import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getAppContext } from "@/lib/tenant";
import { formatDateZurich, todayZurich, zurichToUtc, addDays } from "@/lib/time";
import { slugify } from "@/lib/utils";
import { formatQrReference } from "@/lib/qr-reference";
import { csvAmount, csvResponse, toCsv } from "@/modules/billing/csv";
import { ORDER_STATUS, PAYMENT_STATUS } from "@/modules/ammo/types";

export const dynamic = "force-dynamic";

const day = (d: Date | null) => (d ? formatDateZurich(d, { weekday: undefined }) : "");
const isDate = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

/**
 * Munitionsrechnungen als CSV (Semikolon, UTF-8 mit BOM), nur für «ammo.manage».
 * ?from=YYYY-MM-DD&to=YYYY-MM-DD (Rechnungsdatum, Schweizer Kalendertage, inklusive).
 * Standard: laufendes Jahr. Eine Zeile pro Position, damit Kaliber und Mengen auswertbar sind.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Nicht angemeldet", { status: 401 });
  const ctx = await getAppContext();
  if (!ctx.tenant) return new NextResponse("Kein Verein ausgewählt", { status: 400 });
  if (!ctx.hasModule("ammo")) return new NextResponse("Modul nicht aktiv", { status: 403 });
  if (!ctx.can("ammo.manage")) return new NextResponse("Keine Berechtigung", { status: 403 });

  const year = todayZurich().slice(0, 4);
  const rawFrom = req.nextUrl.searchParams.get("from");
  const rawTo = req.nextUrl.searchParams.get("to");
  const from = isDate(rawFrom) ? rawFrom : `${year}-01-01`;
  const to = isDate(rawTo) ? rawTo : `${year}-12-31`;
  if (from > to) return new NextResponse("Ungültiger Zeitraum", { status: 400 });

  const orders = await db.ammoOrder.findMany({
    where: { tenantId: ctx.tenant.id, invoiceNumber: { not: null }, invoiceIssuedAt: { gte: zurichToUtc(from, "00:00"), lt: zurichToUtc(addDays(to, 1), "00:00") } },
    include: { items: true, user: { select: { name: true, email: true } }, issuedBy: { select: { name: true } } },
    orderBy: [{ invoiceIssuedAt: "asc" }, { invoiceNumber: "asc" }],
  });

  const header = ["Rechnungsnummer", "Rechnungsdatum", "Fällig", "Mitglied", "E-Mail", "Kaliber", "Produkt", "Menge", "Einheit", "Schuss", "Einzelpreis", "Positionstotal", "Rechnungstotal", "Währung", "Bestellstatus", "Zahlstatus", "Bezahlt am", "QR-Referenz", "Berechtigung geprüft", "Ausgegeben durch", "Zahlungsnotiz"];
  const rows = orders.flatMap((o) =>
    o.items.map((i) => [
      o.invoiceNumber,
      day(o.invoiceIssuedAt),
      day(o.dueAt),
      o.user?.name ?? "",
      o.user?.email ?? "",
      i.caliber,
      i.productName,
      i.quantity,
      i.unitLabel,
      i.quantity * i.roundsPerUnit,
      csvAmount(i.unitPriceCents),
      csvAmount(i.totalCents),
      csvAmount(o.totalCents),
      o.currency,
      ORDER_STATUS[o.status]?.label ?? o.status,
      PAYMENT_STATUS[o.paymentStatus]?.label ?? o.paymentStatus,
      day(o.paidAt),
      o.reference ? formatQrReference(o.reference) : "",
      o.idChecked ? "ja" : "nein",
      o.issuedBy?.name ?? "",
      o.paymentNote ?? "",
    ]),
  );
  return csvResponse(toCsv([header, ...rows]), `munition-${slugify(ctx.tenant.name) || "verein"}-${from}-${to}.csv`);
}
