import { NextResponse } from "next/server";
import { vapidPublicKey } from "@/lib/push";

export const dynamic = "force-dynamic";

/** Öffentlicher VAPID-Schlüssel für pushManager.subscribe(). 404, wenn Web Push nicht eingerichtet ist. */
export async function GET() {
  const key = vapidPublicKey();
  if (!key) return NextResponse.json({ configured: false, publicKey: null }, { status: 404, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ configured: true, publicKey: key }, { headers: { "Cache-Control": "public, max-age=3600" } });
}
