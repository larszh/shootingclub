import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { csvResponse, toCsv } from "@/modules/billing/csv";
import { auditCsvRows } from "../../../admin/audit/audit-view";
import { exportAuditRows, tenantNames } from "../../../admin/audit/queries";

export const dynamic = "force-dynamic";

/** CSV-Export des gesamten Protokolls (nur Super-Admin). */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Nicht angemeldet", { status: 401 });
  if (!user.isSuperAdmin) return new NextResponse("Keine Berechtigung", { status: 403 });
  const sp = new URL(req.url).searchParams;
  const action = (sp.get("action") ?? "").trim().slice(0, 60);
  const actor = (sp.get("actor") ?? "").trim().slice(0, 100);
  const tenant = (sp.get("tenant") ?? "").trim().slice(0, 191);
  const tenantId = tenant === "platform" ? null : tenant || undefined;
  const rows = await exportAuditRows({ tenantId, action: action || undefined, actor: actor || undefined });
  const names = await tenantNames(rows.map((r) => r.tenantId));
  await audit({ actorId: user.id, actorName: user.name, action: "audit.export.all", detail: `${rows.length} Einträge` });
  return csvResponse(toCsv(auditCsvRows(rows, names)), `protokoll-alle-${new Date().toISOString().slice(0, 10)}.csv`);
}
