import { NextResponse } from "next/server";
import { getAppContext } from "@/lib/tenant";
import { getTarget } from "@/modules/targets/queries";
import { renderTargetSvg } from "@/modules/targets/svg";
import { PAPER_SIZES, type PaperSize, type TargetSubject } from "@/modules/targets/types";

/** Generiertes SVG als Download, z.B. für Weiterverarbeitung. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAppContext();
  if (!ctx.tenant) return new NextResponse("No tenant", { status: 400 });
  const { id } = await params;
  const t = await getTarget(ctx as typeof ctx & { tenant: NonNullable<typeof ctx.tenant> }, id);
  if (!t || t.subject === "UPLOAD") return new NextResponse("Not found", { status: 404 });
  const size = new URL(req.url).searchParams.get("size") ?? "A4";
  const paper = (PAPER_SIZES as readonly string[]).includes(size) ? (size as PaperSize) : "A4";
  const svg = renderTargetSvg(t.subject as TargetSubject, paper, t.params);
  return new NextResponse(svg, { headers: { "Content-Type": "image/svg+xml", "Content-Disposition": `attachment; filename="${encodeURIComponent(t.name)}-${paper}.svg"` } });
}
