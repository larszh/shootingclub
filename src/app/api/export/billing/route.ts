import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { formatDateZurich, todayZurich } from "@/lib/time";
import { slugify } from "@/lib/utils";
import { formatQrReference } from "@/lib/qr-reference";
import { adminExportContext, csvAmount, csvResponse, toCsv } from "@/modules/billing/csv";
import { feeInvoiceTitle } from "@/modules/billing/fee-title";
import { FEE_INVOICE_STATUS, reminderCount, visiblePaymentNote } from "@/modules/billing/types";

export const dynamic = "force-dynamic";

const day = (d: Date | null) => (d ? formatDateZurich(d, { weekday: undefined }) : "");

/** Beitragsrechnungen eines Jahres als CSV (nur Verwaltung). ?year=YYYY, Standard: aktuelles Jahr. */
export async function GET(req: NextRequest) {
  const res = await adminExportContext("billing");
  if ("error" in res) return res.error;
  const { ctx } = res;
  const raw = req.nextUrl.searchParams.get("year");
  const year = raw && /^\d{4}$/.test(raw) ? Number(raw) : Number(todayZurich().slice(0, 4));
  const invoices = await db.feeInvoice.findMany({
    where: { tenantId: ctx.tenant.id, year },
    include: { membership: { select: { memberNumber: true } }, run: { select: { title: true } } },
    orderBy: [{ number: "asc" }],
  });
  const header = ["Nummer", "Titel", "Mitglied", "Mitglied-Nr.", "E-Mail", "Kategorie", "Betrag", "Währung", "Status", "Ausgestellt", "Fällig", "Bezahlt am", "QR-Referenz", "Mahnungen", "Letzte Mahnung", "Notiz"];
  const rows = invoices.map((i) => [
    i.number,
    feeInvoiceTitle(i, `Mitgliederbeitrag ${i.year}`),
    i.memberName,
    i.membership?.memberNumber ?? "",
    i.memberEmail ?? "",
    i.categoryName,
    csvAmount(i.amountCents),
    i.currency,
    FEE_INVOICE_STATUS[i.status]?.label ?? i.status,
    day(i.issuedAt),
    day(i.dueAt),
    day(i.paidAt),
    i.reference ? formatQrReference(i.reference) : "",
    reminderCount(i.paymentNote, i.remindedAt),
    day(i.remindedAt),
    visiblePaymentNote(i.paymentNote) ?? "",
  ]);
  return csvResponse(toCsv([header, ...rows]), `beitraege-${slugify(ctx.tenant.name) || "verein"}-${year}.csv`);
}
