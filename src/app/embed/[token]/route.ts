import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** /embed/<token> ohne Widget → Kalender (Parameter bleiben erhalten). */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const url = new URL(req.url);
  const { token } = await params;
  return NextResponse.redirect(new URL(`/embed/${encodeURIComponent(token)}/calendar${url.search}`, url), 307);
}
