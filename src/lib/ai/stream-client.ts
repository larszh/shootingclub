/**
 * Client-Hilfe zum Lesen von streamText()-Antworten (fetch → Response.body).
 * Ruft onText mit dem bisher empfangenen Text auf; liefert am Ende Text und Fehlercode.
 */
import { splitAiStream, type AiErrorCode } from "./types";

export async function readAiStream(res: Response, onText?: (textSoFar: string) => void): Promise<{ text: string; error: AiErrorCode | null }> {
  if (!res.body) return splitAiStream(await res.text());
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let full = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      full += dec.decode(value, { stream: true });
      onText?.(splitAiStream(full).text);
    }
    full += dec.decode();
  } catch {
    const partial = splitAiStream(full);
    return { text: partial.text, error: partial.error ?? "network" };
  }
  const out = splitAiStream(full);
  return out.error === "refused" ? { text: "", error: "refused" } : out;
}
