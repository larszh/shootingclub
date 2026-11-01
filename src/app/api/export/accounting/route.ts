import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAppContext } from "@/lib/tenant";
import { audit } from "@/lib/audit";
import { slugify } from "@/lib/utils";
import { csvResponse } from "@/modules/billing/csv";
import { getAccountingJournal } from "@/modules/accounting/queries";
import { exportFilename, renderJournal } from "@/modules/accounting/format";
import { validateRange } from "@/modules/accounting/period";
import { EXPORT_FORMATS, isExportFormat } from "@/modules/accounting/types";

export const dynamic = "force-dynamic";

/**
 * Buchhaltungsexport (accounting.export): ?format=banana|bexio|csv&from=YYYY-MM-DD&to=YYYY-MM-DD.
 * Banana als Textdatei mit Tabulatoren, bexio und allgemein als CSV mit Semikolon.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Nicht angemeldet", { status: 401 });
  const ctx = await getAppContext();
  if (!ctx.tenant) return new NextResponse("Kein Verein ausgewählt", { status: 400 });
  if (!ctx.can("accounting.export")) return new NextResponse("Keine Berechtigung", { status: 403 });

  // Client-Router (RSC-Abruf, Prefetch) bekommt keinen Export: sonst läuft er doppelt und wird mehrfach protokolliert.
  if (req.headers.get("rsc") === "1" || req.headers.get("next-router-prefetch") || req.nextUrl.searchParams.has("_rsc")) {
    return new NextResponse(null, { status: 204, headers: { "Cache-Control": "private, no-store" } });
  }

  const sp = req.nextUrl.searchParams;
  const format = sp.get("format") ?? "csv";
  if (!isExportFormat(format)) return new NextResponse("Unbekanntes Format (banana, bexio oder csv).", { status: 400 });
  const range = validateRange(sp.get("from"), sp.get("to"));
  if (!range.ok) return new NextResponse(range.error, { status: 400 });

  const { entries } = await getAccountingJournal(ctx.tenant.id, range.from, range.to);
  const body = renderJournal(format, entries);
  const filename = exportFilename(format, slugify(ctx.tenant.name) || ctx.tenant.slug, range.from, range.to);

  await audit({
    tenantId: ctx.tenant.id,
    actorId: ctx.user.id,
    action: "accounting.export",
    entity: "Tenant",
    entityId: ctx.tenant.id,
    detail: `${EXPORT_FORMATS.find((f) => f.key === format)?.label ?? format}, ${range.from} bis ${range.to}: ${entries.length} Buchungen`,
  });

  if (format !== "banana") return csvResponse(body, filename);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename.replace(/[^\w.-]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
