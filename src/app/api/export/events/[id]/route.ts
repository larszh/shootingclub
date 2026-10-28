import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { buildAttendanceCsv } from "@/modules/events/feeds";

export const dynamic = "force-dynamic";

/** Anmeldeliste eines Anlasses als CSV (Excel Schweiz: UTF-8 mit BOM, Semikolon). Nur für Verantwortliche. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;
  const res = await buildAttendanceCsv(user, id);
  if (!res) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(res.csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${res.filename}"; filename*=UTF-8''${encodeURIComponent(res.filename)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
