import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAppContext } from "@/lib/tenant";
import { formatDateZurich, todayZurich } from "@/lib/time";
import { formatQrReference } from "@/lib/qr-reference";
import { slugify } from "@/lib/utils";
import { csvAmount, csvResponse, toCsv } from "@/modules/billing/csv";
import { nowDate } from "@/modules/billing/dates";
import { anyPaymentModule, listOpenItems, PAYMENT_SOURCE_LABEL } from "@/modules/billing/overview";

export const dynamic = "force-dynamic";

const day = (d: Date | null) => (d ? formatDateZurich(d, { weekday: undefined }) : "");

/** Offene Posten aller Bereiche als CSV (nur Verwaltung). ?source=FEE|BOOKING|AMMO, ?overdue=1 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Nicht angemeldet", { status: 401 });
  const ctx = await getAppContext();
  if (!ctx.tenant) return new NextResponse("Kein Verein ausgewählt", { status: 400 });
  if (!ctx.can("tenant.manage")) return new NextResponse("Keine Berechtigung", { status: 403 });
  if (!anyPaymentModule(ctx)) return new NextResponse("Kein Rechnungsmodul aktiv", { status: 403 });
  const tctx = ctx as typeof ctx & { tenant: NonNullable<typeof ctx.tenant> };

  const source = req.nextUrl.searchParams.get("source");
  const overdueOnly = req.nextUrl.searchParams.get("overdue") === "1";
  const data = await listOpenItems(tctx, nowDate());
  const items = data.items.filter((i) => (!source || i.source === source) && (!overdueOnly || i.overdue));

  const header = ["Bereich", "Nummer", "Titel", "Mitglied", "Betrag", "Währung", "Ausgestellt", "Fällig", "Überfällig", "QR-Referenz"];
  const rows = items.map((i) => [
    PAYMENT_SOURCE_LABEL[i.source],
    i.number,
    i.title,
    i.memberName ?? "",
    csvAmount(i.amountCents),
    i.currency,
    day(i.issuedAt),
    day(i.dueAt),
    i.overdue ? "ja" : "nein",
    i.reference ? formatQrReference(i.reference) : "",
  ]);
  return csvResponse(toCsv([header, ...rows]), `offene-posten-${slugify(tctx.tenant.name) || "verein"}-${todayZurich()}.csv`);
}
