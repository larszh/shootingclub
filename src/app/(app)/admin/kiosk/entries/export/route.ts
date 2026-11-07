import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAppContext } from "@/lib/tenant";
import { audit } from "@/lib/audit";
import { slugify } from "@/lib/utils";
import { formatDateTime, getRequestLocale, getT } from "@/lib/i18n";
import { csvAmount, csvResponse, toCsv } from "@/modules/billing/csv";
import { listEntries } from "@/modules/kiosk/queries";
import { entryFiltersFrom } from "@/modules/kiosk/filters";

export const dynamic = "force-dynamic";

/** Einträge der Schützenstube als CSV (Semikolon, UTF-8 mit BOM), nur für «kiosk.manage». */
export async function GET(req: NextRequest) {
  const locale = await getRequestLocale();
  const t = getT(locale);
  const user = await getCurrentUser();
  if (!user) return new NextResponse(t("adm1.http.notSignedIn"), { status: 401 });
  const ctx = await getAppContext();
  if (!ctx.tenant) return new NextResponse(t("adm1.http.noClub"), { status: 400 });
  if (!ctx.hasModule("kiosk")) return new NextResponse(t("adm1.http.moduleOff"), { status: 403 });
  if (!ctx.can("kiosk.manage")) return new NextResponse(t("adm1.http.noPermission"), { status: 403 });
  const sp = Object.fromEntries(req.nextUrl.searchParams.entries());
  const { period, filters } = entryFiltersFrom(sp);
  const { rows } = await listEntries(ctx.tenant.id, filters, 50_000);
  const status = (r: (typeof rows)[number]) => t(r.paidCash ? "adm1.kiosk.badge.cash" : r.billedInvoiceId ? "adm1.kiosk.badge.billed" : "adm1.kiosk.badge.open");
  const invoiceStatus = (s: string) => (s === "PAID" || s === "OPEN" || s === "CANCELLED" ? t(`money.status.${s}`) : s);
  const csv = toCsv([
    ["date", "member", "guest", "product", "quantity", "price", "total", "status", "invoice", "invoiceStatus", "recordedBy"].map((k) => t(`adm1.kiosk.csv.${k}`)),
    ...[...rows].reverse().map((r) => [
      formatDateTime(r.createdAt, locale), r.memberName ?? "", r.guestName ?? "", r.productName, r.quantity, csvAmount(r.unitPriceCents), csvAmount(r.totalCents),
      status(r), r.invoice?.number ?? "", r.invoice ? invoiceStatus(r.invoice.status) : "",
      r.sellerName ?? "",
    ]),
  ]);
  await audit({ tenantId: ctx.tenant.id, actorId: user.id, actorName: user.name, action: "kiosk.export", entity: "KioskEntry", entityId: ctx.tenant.id, detail: `Einträge ${period.from} bis ${period.to} (${rows.length} Zeilen)` });
  return csvResponse(csv, `${slugify(ctx.tenant.name) || "club"}-${t("adm1.kiosk.csv.file")}-${period.from}-${period.to}.csv`);
}
