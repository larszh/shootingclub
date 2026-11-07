import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAppContext } from "@/lib/tenant";
import { todayZurich } from "@/lib/time";
import { slugify } from "@/lib/utils";
import { csvResponse, toCsv } from "@/modules/billing/csv";
import { parseSummaryYear } from "@/modules/ammo/stock";
import { stockYearOverview } from "@/modules/ammo/stock-service";
import { fundingLabelT } from "@/modules/ammo/ui/labels";
import { getRequestLocale, getT } from "@/lib/i18n";

export const dynamic = "force-dynamic";

/** Jahresübersicht der Munitionskontrolle als CSV (Semikolon, UTF-8 mit BOM), nur «ammo.manage». ?year=YYYY */
export async function GET(req: NextRequest) {
  const locale = await getRequestLocale();
  const t = getT(locale);
  const user = await getCurrentUser();
  if (!user) return new NextResponse(t("adm1.http.notSignedIn"), { status: 401 });
  const ctx = await getAppContext();
  if (!ctx.tenant) return new NextResponse(t("adm1.http.noClub"), { status: 400 });
  if (!ctx.hasModule("ammo")) return new NextResponse(t("adm1.http.moduleOff"), { status: 403 });
  if (!ctx.can("ammo.manage")) return new NextResponse(t("adm1.http.noPermission"), { status: 403 });
  const year = parseSummaryYear(req.nextUrl.searchParams.get("year"), Number(todayZurich().slice(0, 4)));
  const groups = await stockYearOverview(ctx.tenant.id, year);
  const header = ["year", "funding", "product", "caliber", "unit", "roundsPerUnit", "opening", "receipt", "issue", "sale", "returned", "adjust", "closing", "openingRounds", "receiptRounds", "issueRounds", "saleRounds", "returnedRounds", "adjustRounds", "closingRounds", "tracked"].map((k) => t(`adm1.ammo.ycsv.${k}`));
  const rows = groups.flatMap((g) =>
    g.products.map((p) => {
      const r = p.product.roundsPerUnit;
      return [
        year, fundingLabelT(g.fundingType, t), p.product.name, p.product.caliber, p.product.unitLabel, r,
        p.opening, p.receipt, p.issue, p.sale, p.returned, p.adjust, p.closing,
        p.opening * r, p.receipt * r, p.issue * r, p.sale * r, p.returned * r, p.adjust * r, p.closing * r,
        p.tracked ? t("adm1.common.yes") : t("adm1.common.no"),
      ];
    }),
  );
  return csvResponse(toCsv([header, ...rows]), `${t("adm1.ammo.csv.yearFile")}-${slugify(ctx.tenant.name) || "club"}-${year}.csv`);
}
