import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAppContext } from "@/lib/tenant";
import { audit } from "@/lib/audit";
import { csvResponse, toCsv } from "@/modules/billing/csv";
import { auditCsvRows } from "../audit-view";
import { exportAuditRows } from "../queries";

export const dynamic = "force-dynamic";

/** CSV-Export des Vereinsprotokolls (Filter wie in der Ansicht). */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Nicht angemeldet", { status: 401 });
  const ctx = await getAppContext();
  if (!ctx.tenant) return new NextResponse("Kein Verein ausgewählt", { status: 400 });
  if (!ctx.can("audit.view")) return new NextResponse("Keine Berechtigung", { status: 403 });
  const sp = new URL(req.url).searchParams;
  const action = (sp.get("action") ?? "").trim().slice(0, 60);
  const actor = (sp.get("actor") ?? "").trim().slice(0, 100);
  const rows = await exportAuditRows({ tenantId: ctx.tenant.id, action: action || undefined, actor: actor || undefined });
  await audit({ tenantId: ctx.tenant.id, actorId: user.id, actorName: user.name, action: "audit.export", detail: `${rows.length} Einträge` });
  return csvResponse(toCsv(auditCsvRows(rows)), `protokoll-${ctx.tenant.slug}-${new Date().toISOString().slice(0, 10)}.csv`);
}
