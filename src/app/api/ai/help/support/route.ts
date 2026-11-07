import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getRequestLocale } from "@/lib/i18n";
import { aiStreamResponse } from "@/lib/ai";
import { openSupportStream } from "@/modules/ai/help/service";
import { helpErrorJson, plainError, readHelpRequest } from "@/modules/ai/help/http";

export const dynamic = "force-dynamic";

/** Support-Assistent der Plattform (nur Super-Admins, Plattform-Schlüssel). */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return plainError("aihelp.error.signedOut", 401);
  if (!user.isSuperAdmin) return plainError("ai.unavailable.noAccess", 403);
  const input = await readHelpRequest(req);
  if (!input.ok) return input.res;
  const locale = await getRequestLocale();
  try {
    const stream = await openSupportStream({ user, locale, messages: input.messages, signal: req.signal });
    return aiStreamResponse(stream);
  } catch (err) {
    return helpErrorJson("support", err);
  }
}
