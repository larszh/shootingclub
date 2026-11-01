import { NextResponse } from "next/server";
import { buildTenantFeed, parseFeedKinds, parseFeedToken } from "@/modules/events/feeds";
import { getBaseUrl } from "@/modules/events/queries";
import { icsHeaders } from "@/modules/events/ics";

export const dynamic = "force-dynamic";

/**
 * Öffentlicher Vereinskalender. Der Token in der URL ist das Geheimnis, kein Login nötig.
 * Optional ?kind=TRAINING,COMPETITION (z.B. für das Kalender-Widget auf der Vereinswebsite).
 */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const token = parseFeedToken((await params).token);
  if (!token) return new NextResponse("Not found", { status: 404, headers: { "X-Robots-Tag": "noindex" } });
  const kinds = parseFeedKinds(new URL(req.url).searchParams.get("kind"));
  const feed = await buildTenantFeed(token, await getBaseUrl(), { kinds });
  if (!feed) return new NextResponse("Not found", { status: 404, headers: { "X-Robots-Tag": "noindex" } });
  return new NextResponse(feed.ics, { headers: icsHeaders(feed.filename, false) });
}
