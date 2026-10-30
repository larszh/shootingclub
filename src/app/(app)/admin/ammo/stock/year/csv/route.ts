import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAppContext } from "@/lib/tenant";
import { todayZurich } from "@/lib/time";
import { slugify } from "@/lib/utils";
import { csvResponse, toCsv } from "@/modules/billing/csv";
import { parseSummaryYear } from "@/modules/ammo/stock";
import { stockYearOverview } from "@/modules/ammo/stock-service";

export const dynamic = "force-dynamic";

/** Jahresübersicht der Munitionskontrolle als CSV (Semikolon, UTF-8 mit BOM), nur «ammo.manage». ?year=YYYY */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Nicht angemeldet", { status: 401 });
  const ctx = await getAppContext();
  if (!ctx.tenant) return new NextResponse("Kein Verein ausgewählt", { status: 400 });
  if (!ctx.hasModule("ammo")) return new NextResponse("Modul nicht aktiv", { status: 403 });
  if (!ctx.can("ammo.manage")) return new NextResponse("Keine Berechtigung", { status: 403 });
  const year = parseSummaryYear(req.nextUrl.searchParams.get("year"), Number(todayZurich().slice(0, 4)));
  const groups = await stockYearOverview(ctx.tenant.id, year);
  const header = ["Jahr", "Finanzierung", "Produkt", "Kaliber", "Einheit", "Schuss pro Einheit", "Anfangsbestand", "Eingang", "Abgabe", "Verkauf", "Rücknahme", "Korrektur/Inventur", "Endbestand", "Anfangsbestand Schuss", "Eingang Schuss", "Abgabe Schuss", "Verkauf Schuss", "Rücknahme Schuss", "Korrektur Schuss", "Endbestand Schuss", "Bestand geführt"];
  const rows = groups.flatMap((g) =>
    g.products.map((p) => {
      const r = p.product.roundsPerUnit;
      return [
        year, g.label, p.product.name, p.product.caliber, p.product.unitLabel, r,
        p.opening, p.receipt, p.issue, p.sale, p.returned, p.adjust, p.closing,
        p.opening * r, p.receipt * r, p.issue * r, p.sale * r, p.returned * r, p.adjust * r, p.closing * r,
        p.tracked ? "ja" : "nein",
      ];
    }),
  );
  return csvResponse(toCsv([header, ...rows]), `munition-jahresuebersicht-${slugify(ctx.tenant.name) || "verein"}-${year}.csv`);
}
