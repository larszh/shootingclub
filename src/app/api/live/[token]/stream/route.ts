import { NextResponse } from "next/server";
import { LIVE_HEADERS, boardExpired, buildSnapshot, findBoardByToken } from "@/modules/live/service";
import { snapshotKey } from "@/modules/live/logic";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Server fragt die DB alle 5 s ab und sendet nur bei Änderungen. */
const POLL_MS = 5_000;
const HEARTBEAT_MS = 20_000;
/** Danach schliesst der Server; der Browser verbindet neu (Token wird dabei erneut geprüft). */
const MAX_LIFETIME_MS = 30 * 60_000;
/** Schutz gegen Missbrauch eines geteilten Links: gleichzeitige Verbindungen pro Tafel. */
const MAX_CONNECTIONS_PER_BOARD = 25;

const g = globalThis as unknown as { __liveConnections?: Map<string, number> };
const connections = (g.__liveConnections ??= new Map<string, number>());

/**
 * Server-Sent Events für die öffentliche Live-Rangliste (/live/<token>), ohne Anmeldung.
 * Ereignisse: «snapshot» (Stand), «expired» (abgelaufen), «gone» (Token ungültig/neu erzeugt),
 * dazu Heartbeat-Kommentare. Der Token wird bei jeder Abfrage erneut geprüft.
 */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const board = await findBoardByToken(token);
  if (!board) return NextResponse.json({ error: "not_found" }, { status: 404, headers: LIVE_HEADERS });
  if (boardExpired(board)) return NextResponse.json({ error: "expired" }, { status: 410, headers: LIVE_HEADERS });
  const boardId = board.id;
  if ((connections.get(boardId) ?? 0) >= MAX_CONNECTIONS_PER_BOARD) {
    return NextResponse.json({ error: "busy" }, { status: 429, headers: { ...LIVE_HEADERS, "Retry-After": "30" } });
  }

  const encoder = new TextEncoder();
  let stop: () => void = () => {};

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let busy = false;
      let lastKey = "";
      const timers: Array<ReturnType<typeof setInterval>> = [];
      const timeouts: Array<ReturnType<typeof setTimeout>> = [];
      connections.set(boardId, (connections.get(boardId) ?? 0) + 1);

      const close = () => {
        if (closed) return;
        closed = true;
        for (const t of timers) clearInterval(t);
        for (const t of timeouts) clearTimeout(t);
        req.signal.removeEventListener("abort", close);
        const n = (connections.get(boardId) ?? 1) - 1;
        if (n <= 0) connections.delete(boardId);
        else connections.set(boardId, n);
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
      const event = (name: string, data: unknown) => write(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);

      if (req.signal.aborted) return close();
      req.signal.addEventListener("abort", close);

      const tick = async () => {
        if (closed || busy) return;
        busy = true;
        try {
          // Token bei jeder Abfrage prüfen: neu erzeugt, gelöscht oder Verein gelöscht → Ende.
          const current = await findBoardByToken(token);
          if (!current) {
            event("gone", {});
            return close();
          }
          if (boardExpired(current)) {
            event("expired", {});
            return close();
          }
          const snap = await buildSnapshot(current);
          const key = snapshotKey(snap);
          if (key !== lastKey) {
            lastKey = key;
            event("snapshot", snap);
          }
        } catch (e) {
          console.warn("[live/stream] Abfrage fehlgeschlagen:", e instanceof Error ? e.message : e);
        } finally {
          busy = false;
        }
      };

      write("retry: 5000\n\n");
      await tick();
      if (closed) return;
      timers.push(setInterval(() => void tick(), POLL_MS));
      timers.push(setInterval(() => write(`: ping ${Date.now()}\n\n`), HEARTBEAT_MS));
      timeouts.push(setTimeout(close, MAX_LIFETIME_MS));
      if (board.expiresAt) {
        const ms = board.expiresAt.getTime() - Date.now();
        // setTimeout erlaubt höchstens ~24.8 Tage; längere Abläufe fängt die Abfrage ab.
        if (ms > 0 && ms < MAX_LIFETIME_MS) {
          timeouts.push(setTimeout(() => {
            event("expired", {});
            close();
          }, ms + 500));
        }
      }
    },
    cancel() {
      stop();
    },
  });

  return new Response(stream, {
    headers: {
      ...LIVE_HEADERS,
      "Content-Type": "text/event-stream; charset=utf-8",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
