import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { buildSingleEventIcs } from "@/modules/events/feeds";
import { getBaseUrl } from "@/modules/events/queries";
import { icsHeaders } from "@/modules/events/ics";

export const dynamic = "force-dynamic";

/** Einzelner Anlass als .ics-Datei («In Kalender»). Nur für Mitglieder des Vereins. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;
  const res = await buildSingleEventIcs(user, id, await getBaseUrl());
  if (!res) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(res.ics, { headers: { ...icsHeaders(res.filename, true), "Cache-Control": "private, no-store" } });
}
