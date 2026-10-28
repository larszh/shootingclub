import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { apiConversationAccess, json, sameOrigin } from "@/modules/chat/api";
import { POLL_OVERLAP_MS, createMessage, listChangedMessages, listMessagesPage, listReads } from "@/modules/chat/service";
import { sendMessageSchema, type MessagesResponse } from "@/modules/chat/types";

export const dynamic = "force-dynamic";

const AFTER_LIMIT = 200;

/**
 * GET ?after=<ISO-Cursor>  neue/geänderte Nachrichten seit dem Cursor (Polling-Rückfall)
 * GET ?before=<messageId>  ältere Nachrichten (Blättern nach oben)
 * GET                      neueste Seite
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return json({ error: "Nicht angemeldet" }, 401);
  const { id } = await params;
  const access = await apiConversationAccess(user, id);
  if (!access) return json({ error: "Nicht gefunden" }, 404);

  const sp = req.nextUrl.searchParams;
  const after = sp.get("after");
  const before = sp.get("before");
  const startedAt = Date.now();
  const cursor = new Date(startedAt - POLL_OVERLAP_MS).toISOString();

  let body: MessagesResponse;
  if (after) {
    const since = new Date(after);
    if (Number.isNaN(since.getTime())) return json({ error: "Ungültiger Cursor" }, 400);
    const messages = await listChangedMessages([access.conversation.id], since, AFTER_LIMIT);
    // Volle Seite: nicht bis «jetzt» springen, sondern ab der letzten gelieferten Nachricht
    // weitermachen (hasMore=true), damit nach langer Offline-Zeit nichts verloren geht.
    const full = messages.length >= AFTER_LIMIT;
    const nextCursor = full ? new Date(new Date(messages[messages.length - 1]!.createdAt).getTime() - 1).toISOString() : cursor;
    body = { messages, cursor: nextCursor, hasMore: full, reads: await listReads(access.conversation.id) };
  } else {
    const page = await listMessagesPage(access.conversation.id, before && before.length <= 64 ? before : null);
    body = { messages: page.messages, cursor, hasMore: page.hasMore, reads: await listReads(access.conversation.id) };
  }
  return json(body);
}

/** Nachricht senden. Idempotent über clientId (crypto.randomUUID im Browser). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return json({ error: "Ungültige Herkunft" }, 403);
  if (!(req.headers.get("content-type") ?? "").includes("application/json")) return json({ error: "JSON erwartet" }, 415);
  const user = await getCurrentUser();
  if (!user) return json({ error: "Nicht angemeldet" }, 401);
  const { id } = await params;
  const access = await apiConversationAccess(user, id);
  if (!access) return json({ error: "Diese Unterhaltung ist nicht mehr verfügbar." }, 404);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json({ error: "Ungültige Anfrage" }, 400);
  }
  const parsed = sendMessageSchema.safeParse(raw);
  if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? "Ungültige Nachricht" }, 400);
  if (!parsed.data.body) return json({ error: "Die Nachricht ist leer." }, 400);

  const res = await createMessage({ userId: user.id, access, clientId: parsed.data.clientId, body: parsed.data.body });
  if (!res.ok) return json({ error: res.error }, res.status);
  return json({ message: res.data.message }, res.data.created ? 201 : 200);
}
