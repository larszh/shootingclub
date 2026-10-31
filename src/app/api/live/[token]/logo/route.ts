import { NextResponse } from "next/server";
import { serveStoredImage } from "@/app/api/avatars/serve";
import { boardExpired, findBoardByToken } from "@/modules/live/service";

export const dynamic = "force-dynamic";

/** Vereinslogo für die öffentliche Live-Rangliste (nur mit gültigem, nicht abgelaufenem Token). */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const board = await findBoardByToken(token);
  if (!board || boardExpired(board) || !board.logoPath) return new NextResponse("Not found", { status: 404, headers: { "X-Robots-Tag": "noindex" } });
  const res = await serveStoredImage(req, board.logoPath);
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}
