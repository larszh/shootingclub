import { NextResponse } from "next/server";
import { serveStoredImage } from "@/app/api/avatars/serve";
import { findEmbedTenant } from "@/modules/embed/service";

export const dynamic = "force-dynamic";

/** Vereinslogo für die Widgets (nur mit gültigem Embed-Token). */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const tenant = await findEmbedTenant((await params).token);
  if (!tenant?.logoPath) return new NextResponse("Not found", { status: 404, headers: { "X-Robots-Tag": "noindex" } });
  const res = await serveStoredImage(req, tenant.logoPath);
  // URL trägt ?v=<updatedAt>; öffentlich cachebar wie die Widgets
  if (res.status === 200 || res.status === 304) res.headers.set("Cache-Control", "public, max-age=86400");
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}
