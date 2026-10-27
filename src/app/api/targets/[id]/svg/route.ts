import { NextResponse } from "next/server";
import { getAppContext } from "@/lib/tenant";
import { getTarget } from "@/modules/targets/queries";
import { renderTargetSvg } from "@/modules/targets/svg";
import { PAPER_SIZES, type PaperSize, type TargetSubject } from "@/modules/targets/types";

/** Generiertes SVG als Download, z.B. für Weiterverarbeitung. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAppContext();
  if (!ctx.tenant) return new NextResponse("No tenant", { status: 400 });
  if (!ctx.hasModule("targets")) return new NextResponse("Forbidden", { status: 403 });
  const { id } = await params;
  const t = await getTarget(ctx as typeof ctx & { tenant: NonNullable<typeof ctx.tenant> }, id);
  if (!t || t.subject === "UPLOAD") return new NextResponse("Not found", { status: 404 });
  const url = new URL(req.url);
  const size = url.searchParams.get("size") ?? "";
  const paper = (PAPER_SIZES as readonly string[]).includes(size) ? (size as PaperSize) : (t.paperSizes[0] ?? "A4");
  const svg = renderTargetSvg(t.subject as TargetSubject, paper, t.params);
  const disposition = url.searchParams.get("inline") === "1" ? "inline" : "attachment";
  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Content-Disposition": `${disposition}; filename="${encodeURIComponent(t.name)}-${paper}.svg"`,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
