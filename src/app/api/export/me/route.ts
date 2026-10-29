import { NextResponse } from "next/server";
import { getCurrentUser, throttle } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { todayZurich } from "@/lib/time";
import { buildPersonalExportZip } from "@/modules/core/privacy";

export const dynamic = "force-dynamic";

/** Datenauskunft (revDSG): alle eigenen Daten als JSON in einer ZIP-Datei. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Nicht angemeldet", { status: 401 });
  const limited = throttle(`export-me:${user.id}`, 10, 60 * 60_000);
  if (limited) return new NextResponse(limited, { status: 429 });
  const zip = await buildPersonalExportZip(user.id);
  if (!zip) return new NextResponse("Konto nicht gefunden", { status: 404 });
  await audit({ actorId: user.id, actorName: user.name, action: "user.export.self", entity: "User", entityId: user.id });
  const filename = `standchef-meine-daten-${todayZurich()}.zip`;
  return new NextResponse(Buffer.from(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
