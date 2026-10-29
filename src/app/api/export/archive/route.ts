import { NextResponse } from "next/server";
import { getCurrentUser, throttle } from "@/lib/auth";
import { getAppContext } from "@/lib/tenant";
import { audit } from "@/lib/audit";
import { todayZurich } from "@/lib/time";
import { buildTenantArchiveFiles, zipFiles } from "@/modules/core/privacy";

export const dynamic = "force-dynamic";

/** Vereinsarchiv: CSV-Dateien aller wesentlichen Daten des aktiven Vereins (nur Inhaber oder Super-Admin). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Nicht angemeldet", { status: 401 });
  const ctx = await getAppContext();
  if (!ctx.tenant) return new NextResponse("Kein Verein ausgewählt", { status: 400 });
  if (ctx.tenant.role !== "OWNER" && !user.isSuperAdmin) return new NextResponse("Nur für Inhaber des Vereins", { status: 403 });
  const limited = throttle(`export-archive:${ctx.tenant.id}`, 10, 60 * 60_000);
  if (limited) return new NextResponse(limited, { status: 429 });

  const files = await buildTenantArchiveFiles(ctx.tenant.id);
  if (!Object.keys(files).length) return new NextResponse("Verein nicht gefunden", { status: 404 });
  const zip = zipFiles(files);
  await audit({ tenantId: ctx.tenant.id, actorId: user.id, actorName: user.name, action: "tenant.export.archive", entity: "Tenant", entityId: ctx.tenant.id, detail: `${Object.keys(files).length} Dateien` });
  const filename = `vereinsarchiv-${ctx.tenant.slug}-${todayZurich()}.zip`.replace(/[^\w.-]/g, "_");
  return new NextResponse(Buffer.from(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
