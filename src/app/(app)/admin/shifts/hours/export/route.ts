import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAppContext } from "@/lib/tenant";
import { audit } from "@/lib/audit";
import { slugify } from "@/lib/utils";
import { csvAmount, csvResponse, toCsv } from "@/modules/billing/csv";
import { statusLabel } from "@/modules/members/types";
import { currentSwissYear, hoursOverview } from "@/modules/shifts/queries";

export const dynamic = "force-dynamic";

/** Arbeitsstunden pro Mitglied als CSV (Semikolon, UTF-8 mit BOM), nur für «shifts.manage». */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Nicht angemeldet", { status: 401 });
  const ctx = await getAppContext();
  if (!ctx.tenant) return new NextResponse("Kein Verein ausgewählt", { status: 400 });
  if (!ctx.hasModule("shifts")) return new NextResponse("Modul nicht aktiv", { status: 403 });
  if (!ctx.can("shifts.manage")) return new NextResponse("Keine Berechtigung", { status: 403 });
  const thisYear = currentSwissYear();
  const y = Number(req.nextUrl.searchParams.get("year"));
  const year = Number.isInteger(y) && y >= 2000 && y <= thisYear + 1 ? y : thisYear;
  const { rows } = await hoursOverview(ctx.tenant.id, year);
  const num = (n: number) => n.toFixed(2);
  const csv = toCsv([
    ["Name", "Mitgliedernummer", "Status", "Befreit", "Pflichtig", "Einsätze (h)", "Rapporte bewilligt (h)", "Rapporte offen (h)", "Total (h)", "Soll (h)", "Fehlend (h)", "Ersatzabgabe (CHF)", "Rechnung", "Rechnungsstatus"],
    ...rows.map((r) => [
      r.name, r.memberNumber, statusLabel(r.status), r.exempt ? "ja" : "nein", r.subject ? "ja" : "nein",
      num(r.shiftHours), num(r.logHours), num(r.pendingLogHours), num(r.total), num(r.required), num(r.missing), csvAmount(r.amountCents),
      r.invoice?.number ?? "", r.invoice ? (r.invoice.status === "PAID" ? "bezahlt" : r.invoice.status === "OPEN" ? "offen" : r.invoice.status) : "",
    ]),
  ]);
  await audit({ tenantId: ctx.tenant.id, actorId: user.id, actorName: user.name, action: "shifts.export", entity: "WorkHoursSettings", entityId: ctx.tenant.id, detail: `Arbeitsstunden ${year} (${rows.length} Zeilen)` });
  return csvResponse(csv, `${slugify(ctx.tenant.name) || "verein"}-arbeitsstunden-${year}.csv`);
}
