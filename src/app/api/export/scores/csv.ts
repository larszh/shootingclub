import "server-only";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAppContext } from "@/lib/tenant";
import { csvResponseHeaders, formatDay, toCsv } from "@/modules/scores/analytics";
import type { scoreExportRows } from "@/modules/scores/insights";

type Row = Awaited<ReturnType<typeof scoreExportRows>>[number];

/** Angemeldeter Benutzer mit aktivem Tenant und Modul «scores», sonst eine Fehlerantwort. */
export async function exportContext() {
  const user = await getCurrentUser();
  if (!user) return { error: new NextResponse("Nicht angemeldet", { status: 401 }) } as const;
  const ctx = await getAppContext();
  if (!ctx.tenant) return { error: new NextResponse("Kein Verein ausgewählt", { status: 400 }) } as const;
  if (!ctx.hasModule("scores")) return { error: new NextResponse("Modul nicht aktiv", { status: 403 }) } as const;
  return { ctx: ctx as typeof ctx & { tenant: NonNullable<typeof ctx.tenant> } } as const;
}

function num(n: number, decimal: boolean) {
  return decimal ? n.toFixed(1) : String(Math.round(n * 10) / 10);
}

/** CSV mit einer Zeile pro Teilnehmer und Durchgang: Datum; Programm; Teilnehmer; Gast; Serie 1…n; Total. */
export function buildScoresCsv(rows: Row[]) {
  const maxStages = rows.reduce((a, r) => Math.max(a, r.stageTotals.length), 0);
  const header = ["Datum", "Programm", "Titel", "Status", "Teilnehmer", "Gast", ...Array.from({ length: maxStages }, (_, i) => `Serie ${i + 1}`), "Total", "Maximum"];
  const body = rows.map((r) => [
    formatDay(r.date),
    r.program,
    r.title ?? "",
    r.status === "FINISHED" ? "abgeschlossen" : "offen",
    r.participant,
    r.isGuest ? "ja" : "nein",
    ...Array.from({ length: maxStages }, (_, i) => (i < r.stageTotals.length ? num(r.stageTotals[i]!, r.decimal) : "")),
    num(r.total, r.decimal),
    num(r.max, r.decimal),
  ]);
  return toCsv([header, ...body]);
}

export function csvResponse(csv: string, filename: string) {
  return new NextResponse(csv, { headers: csvResponseHeaders(filename) });
}
