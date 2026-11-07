import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAppContext } from "@/lib/tenant";
import { todayZurich } from "@/lib/time";
import { formatDate, getRequestLocale, getT } from "@/lib/i18n";
import { localizePaymentItem } from "@/modules/billing/ui/i18n";
import { formatQrReference } from "@/lib/qr-reference";
import { slugify } from "@/lib/utils";
import { csvAmount, csvResponse, toCsv } from "@/modules/billing/csv";
import { nowDate } from "@/modules/billing/dates";
import { anyPaymentModule, listOpenItems } from "@/modules/billing/overview";

export const dynamic = "force-dynamic";

/** Offene Posten aller Bereiche als CSV (nur Verwaltung). ?source=FEE|BOOKING|AMMO, ?overdue=1 */
export async function GET(req: NextRequest) {
  const locale = await getRequestLocale();
  const t = getT(locale);
  const day = (d: Date | null) => (d ? formatDate(d, locale) : "");
  const user = await getCurrentUser();
  if (!user) return new NextResponse(t("adm1.http.notSignedIn"), { status: 401 });
  const ctx = await getAppContext();
  if (!ctx.tenant) return new NextResponse(t("adm1.http.noClub"), { status: 400 });
  if (!ctx.can("tenant.manage")) return new NextResponse(t("adm1.http.noPermission"), { status: 403 });
  if (!anyPaymentModule(ctx)) return new NextResponse(t("adm1.pay.noModules"), { status: 403 });
  const tctx = ctx as typeof ctx & { tenant: NonNullable<typeof ctx.tenant> };

  const source = req.nextUrl.searchParams.get("source");
  const overdueOnly = req.nextUrl.searchParams.get("overdue") === "1";
  const data = await listOpenItems(tctx, nowDate());
  const items = data.items.filter((i) => (!source || i.source === source) && (!overdueOnly || i.overdue));

  const header = ["source", "number", "title", "member", "amount", "currency", "issued", "due", "overdue", "qrRef"].map((k) => t(`adm1.pay.csv.${k}`));
  const rows = items.map((raw) => localizePaymentItem(raw, locale)).map((i) => [
    i.sourceText,
    i.number,
    i.title,
    i.memberName ?? "",
    csvAmount(i.amountCents),
    i.currency,
    day(i.issuedAt),
    day(i.dueAt),
    i.overdue ? t("adm1.common.yes") : t("adm1.common.no"),
    i.reference ? formatQrReference(i.reference) : "",
  ]);
  return csvResponse(toCsv([header, ...rows]), `${t("adm1.pay.csv.file")}-${slugify(tctx.tenant.name) || "club"}-${todayZurich()}.csv`);
}
