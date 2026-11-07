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

/** Prüft Herkunft und Inhalt; liefert die Nachrichten oder eine Fehlerantwort. */
export async function readHelpRequest(req: NextRequest): Promise<{ ok: true; messages: ChatTurn[] } | { ok: false; res: NextResponse }> {
  if (!sameOrigin(req)) return { ok: false, res: plainError("ai.error.badRequest", 403) };
  if (!(req.headers.get("content-type") ?? "").includes("application/json")) return { ok: false, res: plainError("ai.error.badRequest", 415) };
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { ok: false, res: plainError("ai.error.badRequest", 400) };
  }
  const parsed = helpRequestSchema.safeParse(body);
  if (!parsed.success) return { ok: false, res: plainError("ai.error.badRequest", 400) };
  return { ok: true, messages: parsed.data.messages };
}

