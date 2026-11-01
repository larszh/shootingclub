import { NextResponse } from "next/server";
import { buildUserFeed, parseFeedToken } from "@/modules/events/feeds";
import { getBaseUrl } from "@/modules/events/queries";
import { icsHeaders } from "@/modules/events/ics";

export const dynamic = "force-dynamic";

/** Persönlicher Kalender (Zusagen, Reservationen, Helfereinsätze, Kurstage). Der Token ist das Geheimnis, kein Login nötig. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const token = parseFeedToken((await params).token);
  if (!token) return new NextResponse("Not found", { status: 404, headers: { "X-Robots-Tag": "noindex" } });
  const feed = await buildUserFeed(token, await getBaseUrl());
  if (!feed) return new NextResponse("Not found", { status: 404, headers: { "X-Robots-Tag": "noindex" } });
  return new NextResponse(feed.ics, { headers: icsHeaders(feed.filename, false) });
}
