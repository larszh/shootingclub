import "server-only";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAppContext } from "@/lib/tenant";
import type { ModuleKey } from "@/lib/modules";

type Cell = string | number | null | undefined;

function csvCell(v: Cell) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  // Formel-Injection in Tabellenprogrammen verhindern
  const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d+([.,]\d+)?$/.test(s) ? `'${s}` : s;
  return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** CSV mit Semikolon und UTF-8-BOM (öffnet sich in Excel direkt korrekt). */
export function toCsv(rows: Cell[][]) {
  return "\uFEFF" + rows.map((r) => r.map(csvCell).join(";")).join("\r\n") + "\r\n";
}

export function csvResponse(csv: string, filename: string) {
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename.replace(/[^\w.-]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "private, no-store",
    },
  });
}

/** Betrag in Franken mit Punkt (z.B. 45.00) für Tabellenprogramme. */
export function csvAmount(cents: number) {
  return (cents / 100).toFixed(2);
}

/** Angemeldete Verwaltung (tenant.manage) mit aktivem Modul, sonst eine Fehlerantwort. */
export async function adminExportContext(module: ModuleKey) {
  const user = await getCurrentUser();
  if (!user) return { error: new NextResponse("Nicht angemeldet", { status: 401 }) } as const;
  const ctx = await getAppContext();
  if (!ctx.tenant) return { error: new NextResponse("Kein Verein ausgewählt", { status: 400 }) } as const;
  if (!ctx.hasModule(module)) return { error: new NextResponse("Modul nicht aktiv", { status: 403 }) } as const;
  if (!ctx.can("tenant.manage")) return { error: new NextResponse("Keine Berechtigung", { status: 403 }) } as const;
  return { ctx: ctx as typeof ctx & { tenant: NonNullable<typeof ctx.tenant> } } as const;
}
