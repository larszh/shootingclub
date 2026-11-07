import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { describeAiFailure } from "@/lib/ai";
import { helpRequestSchema, type ChatTurn } from "./history";
import { helpFailureKey, helpFailureStatus, type HelpFailure } from "./limits";

const noStore = { "Cache-Control": "no-store" };

/** JSON-Fehler für den Chat: { error: i18n-Schlüssel, retryAfterSec? } */
export function helpErrorJson(mode: "help" | "support", err: unknown): NextResponse {
  const d = describeAiFailure(err);
  const f: HelpFailure = d.kind === "unavailable" ? { kind: "unavailable", reason: d.reason } : { kind: "error", code: d.code, retryAfterSec: d.retryAfterSec };
  const body: { error: string; retryAfterSec?: number } = { error: helpFailureKey(mode, f) };
  if (d.kind === "error" && d.retryAfterSec != null) body.retryAfterSec = d.retryAfterSec;
  return NextResponse.json(body, { status: helpFailureStatus(f), headers: noStore });
}

export function plainError(key: string, status: number): NextResponse {
  return NextResponse.json({ error: key }, { status, headers: noStore });
}

/** Nur Anfragen von der eigenen Seite (Schutz gegen Cross-Site-Requests). */
export function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * Höchstgrösse des Anfrage-Körpers. Der Browser schickt höchstens HELP_MAX_HISTORY_CHARS Zeichen
 * Verlauf (gekürzt mit trimHistory) – 256 KB lassen viel Reserve für JSON und UTF-8.
 */
export const HELP_MAX_BODY_BYTES = 256 * 1024;

/** Körper lesen, aber nie mehr als `max` Bytes (auch ohne Content-Length, z.B. chunked). null = zu gross. */
async function readBodyCapped(req: NextRequest, max: number): Promise<string | null> {
  const declared = Number(req.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > max) return null;
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let off = 0;
  for (const c of chunks) {
    all.set(c, off);
    off += c.byteLength;
  }
  return new TextDecoder().decode(all);
}

/** Prüft Herkunft, Grösse und Inhalt; liefert die Nachrichten oder eine Fehlerantwort. */
export async function readHelpRequest(req: NextRequest): Promise<{ ok: true; messages: ChatTurn[] } | { ok: false; res: NextResponse }> {
  if (!sameOrigin(req)) return { ok: false, res: plainError("ai.error.badRequest", 403) };
  if (!(req.headers.get("content-type") ?? "").includes("application/json")) return { ok: false, res: plainError("ai.error.badRequest", 415) };
  let body: unknown;
  try {
    const raw = await readBodyCapped(req, HELP_MAX_BODY_BYTES);
    if (raw === null) return { ok: false, res: plainError("ai.error.badRequest", 413) };
    body = JSON.parse(raw);
  } catch {
    return { ok: false, res: plainError("ai.error.badRequest", 400) };
  }
  const parsed = helpRequestSchema.safeParse(body);
  if (!parsed.success) return { ok: false, res: plainError("ai.error.badRequest", 400) };
  return { ok: true, messages: parsed.data.messages };
}

