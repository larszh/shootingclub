import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { activeTenantId, json } from "@/modules/chat/api";
import { subscribeChat, type ChatBusEvent } from "@/modules/chat/bus";
import { POLL_OVERLAP_MS, isChatEnabled, isTenantMember, listChangedMessages } from "@/modules/chat/service";
import type { ChatMessageDTO, ChatStreamEvent } from "@/modules/chat/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const POLL_MS = 5_000;
const HEARTBEAT_MS = 25_000;
/** Danach schliesst der Server; der Browser verbindet neu (prüft dabei die Sitzung erneut). */
const MAX_LIFETIME_MS = 30 * 60_000;
const MAX_REMEMBERED = 1000;

/**
 * Server-Sent Events für den Chat des aktiven Vereins.
 * Quellen: In-Process-Bus (sofort) und DB-Polling alle 5 s (für mehrere Instanzen bzw.
 * verpasste Ereignisse). Doppelte Ereignisse werden pro Verbindung unterdrückt.
 * Es werden nur Ereignisse aus Unterhaltungen weitergeleitet, in denen der Benutzer
 * Mitglied ist, und nur solange er dem Verein angehört.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return json({ error: "Nicht angemeldet" }, 401);
  const tenantId = activeTenantId(req, user);
  if (!tenantId) return json({ error: "Kein Verein" }, 403);
  if (!(await isChatEnabled(tenantId))) return json({ error: "Chat ist nicht aktiv" }, 403);
  const userId = user.id;

  const encoder = new TextEncoder();
  let stop: () => void = () => {};

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const timers: Array<ReturnType<typeof setInterval>> = [];
      let unsubscribe: () => void = () => {};
      const timeouts: Array<ReturnType<typeof setTimeout>> = [];

      const close = () => {
        if (closed) return;
        closed = true;
        for (const t of timers) clearInterval(t);
        for (const t of timeouts) clearTimeout(t);
        unsubscribe();
        req.signal.removeEventListener("abort", close);
        try {
          controller.close();
        } catch {
          // bereits geschlossen
        }
      };
      stop = close;

      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          close();
        }
      };
      const send = (ev: ChatStreamEvent) => write(`data: ${JSON.stringify(ev)}\n\n`);

      if (req.signal.aborted) return close();
      req.signal.addEventListener("abort", close);

      // Mitgliedschaften (Unterhaltung → stumm?) des Benutzers im Verein
      let convs = new Map<string, boolean>();
      const refresh = async () => {
        if (!(await isTenantMember(userId, tenantId))) {
          close();
          return false;
        }
        const rows = await db.chatMember.findMany({ where: { userId, conversation: { tenantId } }, select: { conversationId: true, muted: true } });
        convs = new Map(rows.map((r) => [r.conversationId, r.muted]));
        return true;
      };

      // Bereits gesendete Versionen (gegen Doppelungen aus Bus + Polling)
      const sentMessages = new Map<string, string>();
      const sentReads = new Map<string, string>();
      const remember = (map: Map<string, string>, key: string, value: string) => {
        if (map.get(key) === value) return false;
        map.delete(key);
        map.set(key, value);
        if (map.size > MAX_REMEMBERED) {
          const first = map.keys().next().value;
          if (first !== undefined) map.delete(first);
        }
        return true;
      };

      const forwardMessage = (m: ChatMessageDTO) => {
        const muted = convs.get(m.conversationId);
        if (muted === undefined) return;
        if (!remember(sentMessages, m.id, `${m.editedAt ?? ""}|${m.deletedAt ?? ""}`)) return;
        send({ type: "message", conversationId: m.conversationId, muted, message: m });
      };
      const forwardRead = (conversationId: string, readerId: string, lastReadAt: string) => {
        if (!convs.has(conversationId)) return;
        if (!remember(sentReads, `${conversationId}:${readerId}`, lastReadAt)) return;
        send({ type: "read", conversationId, userId: readerId, lastReadAt });
      };

      try {
        if (!(await refresh())) return;
      } catch {
        return close();
      }
      let lastPoll = new Date();

      write(`retry: 3000\n\n`);
      send({ type: "hello", userId, tenantId });

      // Während Mitgliedschaften neu geladen werden (z.B. jemand wurde entfernt oder wieder
      // aufgenommen), Ereignisse zurückhalten und erst danach mit dem neuen Stand prüfen.
      let pendingRefresh: Promise<unknown> | null = null;
      const afterRefresh = (fn: () => void) => {
        if (pendingRefresh) void pendingRefresh.then(() => !closed && fn());
        else fn();
      };

      unsubscribe = subscribeChat((ev: ChatBusEvent) => {
        if (closed || ev.tenantId !== tenantId) return;
        if (ev.type === "message") {
          const m = ev.message;
          afterRefresh(() => forwardMessage(m));
        } else if (ev.type === "read") {
          const { conversationId, userId: readerId, lastReadAt } = ev;
          afterRefresh(() => forwardRead(conversationId, readerId, lastReadAt));
        } else if (ev.type === "conversation") {
          const wasMember = convs.has(ev.conversationId);
          const p: Promise<unknown> = refresh()
            .then((stillOk) => {
              if (stillOk && (wasMember || convs.has(ev.conversationId))) send({ type: "conversation", conversationId: ev.conversationId });
            })
            .catch(() => undefined)
            .finally(() => {
              if (pendingRefresh === p) pendingRefresh = null;
            });
          pendingRefresh = p;
        }
      });

      let polling = false;
      timers.push(
        setInterval(async () => {
          if (closed || polling) return;
          polling = true;
          try {
            const before = new Set(convs.keys());
            if (!(await refresh())) return;
            for (const id of convs.keys()) if (!before.has(id)) send({ type: "conversation", conversationId: id });
            for (const id of before) if (!convs.has(id)) send({ type: "conversation", conversationId: id });

            const since = new Date(lastPoll.getTime() - POLL_OVERLAP_MS);
            lastPoll = new Date();
            const ids = [...convs.keys()];
            if (!ids.length) return;
            const changed = await listChangedMessages(ids, since);
            for (const m of changed) forwardMessage(m);
            const reads = await db.chatMember.findMany({
              where: { conversationId: { in: ids }, lastReadAt: { gt: since } },
              select: { conversationId: true, userId: true, lastReadAt: true },
            });
            for (const r of reads) if (r.lastReadAt) forwardRead(r.conversationId, r.userId, r.lastReadAt.toISOString());
          } catch {
            // Datenbank kurz nicht erreichbar: beim nächsten Durchlauf erneut versuchen.
          } finally {
            polling = false;
          }
        }, POLL_MS),
      );
      timers.push(setInterval(() => write(`: ping\n\n`), HEARTBEAT_MS));
      timeouts.push(setTimeout(close, MAX_LIFETIME_MS));
    },
    cancel() {
      stop();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      // nginx (CloudPanel): nicht puffern, sonst kommen Ereignisse verzögert an.
      "X-Accel-Buffering": "no",
    },
  });
}
