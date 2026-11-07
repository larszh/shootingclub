import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAppContext } from "@/lib/tenant";
import { audit } from "@/lib/audit";
import { slugify } from "@/lib/utils";
import { csvAmount, csvResponse, toCsv } from "@/modules/billing/csv";
import { getRequestLocale, getT } from "@/lib/i18n";
import { currentSwissYear, hoursOverview } from "@/modules/shifts/queries";

export const dynamic = "force-dynamic";

/** Arbeitsstunden pro Mitglied als CSV (Semikolon, UTF-8 mit BOM), nur für «shifts.manage». */
export async function GET(req: NextRequest) {
  const t = getT(await getRequestLocale());
  const user = await getCurrentUser();
  if (!user) return new NextResponse(t("adm2.common.http.unauthenticated"), { status: 401 });
  const ctx = await getAppContext();
  if (!ctx.tenant) return new NextResponse(t("adm2.common.http.noClub"), { status: 400 });
  if (!ctx.hasModule("shifts")) return new NextResponse(t("adm2.common.http.moduleOff"), { status: 403 });
  if (!ctx.can("shifts.manage")) return new NextResponse(t("adm2.common.http.forbidden"), { status: 403 });
  const c = (k: string) => t(`adm2.shifts.csv.${k}`);
  const thisYear = currentSwissYear();
  const y = Number(req.nextUrl.searchParams.get("year"));
  const year = Number.isInteger(y) && y >= 2000 && y <= thisYear + 1 ? y : thisYear;
  const { rows } = await hoursOverview(ctx.tenant.id, year);
  const num = (n: number) => n.toFixed(2);
  const csv = toCsv([
    ["name", "number", "status", "joined", "months", "exempt", "subject", "shifts", "logs", "pending", "total", "required", "missing", "fee", "invoice", "invoiceStatus"].map(c),
    ...rows.map((r) => [
      r.name, r.memberNumber, t(`members.status.${r.status}`), r.joinedAt ? r.joinedAt.toISOString().slice(0, 10).split("-").reverse().join(".") : "", r.subject ? r.months : "", r.exempt ? c("yes") : c("no"), r.subject ? c("yes") : c("no"),
      num(r.shiftHours), num(r.logHours), num(r.pendingLogHours), num(r.total), num(r.required), num(r.missing), csvAmount(r.amountCents),
      r.invoice?.number ?? "", r.invoice ? (r.invoice.status === "PAID" ? c("paid") : r.invoice.status === "OPEN" ? c("open") : r.invoice.status) : "",
    ]),
  ]);
  await audit({ tenantId: ctx.tenant.id, actorId: user.id, actorName: user.name, action: "shifts.export", entity: "WorkHoursSettings", entityId: ctx.tenant.id, detail: `Arbeitsstunden ${year} (${rows.length} Zeilen)` });
  return csvResponse(csv, `${slugify(ctx.tenant.name) || "verein"}-${c("file")}-${year}.csv`);
}
