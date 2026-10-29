import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser, throttle } from "@/lib/auth";
import { assertPublicEndpoint, deleteSubscription, isPushConfigured, saveSubscription } from "@/lib/push";
import { isBase64Url, MAX_ENDPOINT_LENGTH } from "@/lib/push/endpoint";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noStore = { "Cache-Control": "no-store" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: noStore });

/** Nur Anfragen von der eigenen Seite (Service Worker und App senden dieselbe Herkunft). */
function sameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

const subscribeSchema = z.object({
  endpoint: z.string().min(10).max(MAX_ENDPOINT_LENGTH),
  keys: z.object({
    p256dh: z.string().refine((s) => isBase64Url(s, 80, 120), "Ungültiger Schlüssel"),
    auth: z.string().refine((s) => isBase64Url(s, 16, 40), "Ungültiger Schlüssel"),
  }),
});

const unsubscribeSchema = z.object({ endpoint: z.string().min(10).max(MAX_ENDPOINT_LENGTH) });

async function readJson(req: NextRequest): Promise<unknown> {
  const text = await req.text();
  if (text.length > 8_000) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Gerät für Push-Benachrichtigungen anmelden. */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ error: "Ungültige Herkunft" }, 403);
  const user = await getCurrentUser();
  if (!user) return json({ error: "Nicht angemeldet" }, 401);
  if (!isPushConfigured()) return json({ error: "Push-Benachrichtigungen sind auf diesem Server nicht eingerichtet." }, 503);
  const limited = throttle(`push-sub:${user.id}`, 20, 60 * 60_000);
  if (limited) return json({ error: limited }, 429);

  const parsed = subscribeSchema.safeParse(await readJson(req));
  if (!parsed.success) return json({ error: "Ungültige Anmeldung." }, 400);
  const bad = await assertPublicEndpoint(parsed.data.endpoint);
  if (bad) return json({ error: bad }, 400);

  await saveSubscription(user.id, {
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
    userAgent: req.headers.get("user-agent"),
  });
  return json({ ok: true });
}

/** Gerät abmelden. */
export async function DELETE(req: NextRequest) {
  if (!sameOrigin(req)) return json({ error: "Ungültige Herkunft" }, 403);
  const user = await getCurrentUser();
  if (!user) return json({ error: "Nicht angemeldet" }, 401);
  const parsed = unsubscribeSchema.safeParse(await readJson(req));
  if (!parsed.success) return json({ error: "Ungültige Anfrage." }, 400);
  const removed = await deleteSubscription(user.id, parsed.data.endpoint);
  return json({ ok: true, removed });
}
