import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAppContext } from "@/lib/tenant";
import { getRequestLocale } from "@/lib/i18n";
import { aiStreamResponse } from "@/lib/ai";
import { openHelpStream } from "@/modules/ai/help/service";
import { helpErrorJson, plainError, readHelpRequest } from "@/modules/ai/help/http";

export const dynamic = "force-dynamic";

/**
 * Hilfe-Assistent des Vereins: nimmt den (im Browser gehaltenen) Verlauf entgegen und streamt
 * die Antwort als Text. Fehler vor dem Stream als JSON { error: i18n-Schlüssel }.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return plainError("aihelp.error.signedOut", 401);
  const input = await readHelpRequest(req);
  if (!input.ok) return input.res;
  const ctx = await getAppContext();
  const locale = await getRequestLocale();
  try {
    const stream = await openHelpStream({ ctx, locale, messages: input.messages, signal: req.signal });
    return aiStreamResponse(stream);
  } catch (err) {
    return helpErrorJson("help", err);
  }
}
