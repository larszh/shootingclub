/**
 * Gesprächsverlauf des Hilfe-Assistenten (rein, client-sicher). Der Verlauf liegt nur im Browser;
 * jede Anfrage schickt die letzten Nachrichten mit, gekürzt nach diesen Grenzen.
 */
import { z } from "zod";

export type ChatTurn = { role: "user" | "assistant"; content: string };

/** Höchstens so viele Nachrichten gehen an Claude (Frage + Antwort = 2). */
export const HELP_MAX_TURNS = 20;
/** Höchstlänge einer einzelnen Frage (Zeichen). */
export const HELP_MAX_QUESTION_CHARS = 2000;
/** Ältere Antworten werden auf diese Länge gekürzt. */
export const HELP_MAX_ANSWER_CHARS = 4000;
/** Gesamtlänge des mitgeschickten Verlaufs (Zeichen). */
export const HELP_MAX_HISTORY_CHARS = 24_000;

function clip(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

/**
 * Bereinigt und kürzt den Verlauf:
 * - leere Nachrichten fallen weg, aufeinanderfolgende Nachrichten derselben Rolle werden zusammengefasst
 * - Fragen und Antworten werden auf ihre Höchstlänge gekürzt
 * - nur die letzten HELP_MAX_TURNS Nachrichten, insgesamt höchstens HELP_MAX_HISTORY_CHARS Zeichen
 * - der Verlauf beginnt immer mit einer Frage (Claude verlangt das)
 * Die letzte Nachricht bleibt, wie sie ist (die aktuelle Frage) – nur gekürzt.
 */
export function trimHistory(turns: readonly ChatTurn[], opts?: { maxTurns?: number; maxChars?: number }): ChatTurn[] {
  const maxTurns = Math.max(1, opts?.maxTurns ?? HELP_MAX_TURNS);
  const maxChars = Math.max(1, opts?.maxChars ?? HELP_MAX_HISTORY_CHARS);
  const merged: ChatTurn[] = [];
  for (const t of turns) {
    if (t.role !== "user" && t.role !== "assistant") continue;
    const content = typeof t.content === "string" ? t.content.trim() : "";
    if (!content) continue;
    const prev = merged.at(-1);
    if (prev && prev.role === t.role) prev.content = `${prev.content}\n\n${content}`;
    else merged.push({ role: t.role, content });
  }
  const clipped = merged.map((t) => ({ role: t.role, content: clip(t.content, t.role === "user" ? HELP_MAX_QUESTION_CHARS : HELP_MAX_ANSWER_CHARS) }));
  let out = clipped.slice(-maxTurns);
  // Von vorne kürzen, bis die Gesamtlänge passt (die letzte Nachricht bleibt immer).
  let total = out.reduce((n, t) => n + t.content.length, 0);
  while (out.length > 1 && total > maxChars) {
    total -= out[0]!.content.length;
    out = out.slice(1);
  }
  while (out.length > 0 && out[0]!.role !== "user") out = out.slice(1);
  return out;
}

/** Basis des Verlauf-Schlüssels der Vereins-Hilfe (gleich für Panel auf /help und schwebenden Knopf). */
export const HELP_CHAT_STORAGE_KEY = "sc-ai-help-chat";
/** Basis des Verlauf-Schlüssels im Plattform-Support. */
export const SUPPORT_CHAT_STORAGE_KEY = "sc-ai-support-chat";

/**
 * Speicher-Schlüssel des Verlaufs im Browser (sessionStorage), pro Person und Verein: «basis:user:tenant».
 * So sieht nach Abmelden oder Vereinswechsel im selben Tab niemand den Verlauf der vorherigen
 * Person, und er geht auch nicht als deren Kontext an Claude. AiChat löscht beim Öffnen alle
 * anderen Verläufe mit derselben Basis.
 */
export function chatStorageKey(base: string, userId: string, tenantId: string | null | undefined): string {
  return `${base}:${userId}:${tenantId ?? "-"}`;
}

/** Basis eines Schlüssels aus chatStorageKey (alles vor dem ersten «:»). */
export function chatStorageBase(key: string): string {
  const i = key.indexOf(":");
  return i < 0 ? key : key.slice(0, i);
}

/** Anfrage an /api/ai/help und /api/ai/help/support. */
export const helpRequestSchema = z
  .object({
    messages: z
      .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(20_000) }).strict())
      .min(1)
      .max(80),
  })
  .strict();

export type HelpRequest = z.infer<typeof helpRequestSchema>;
