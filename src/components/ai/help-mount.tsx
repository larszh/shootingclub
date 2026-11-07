import "server-only";
import { getAppContext } from "@/lib/tenant";
import { getRequestLocale, getT } from "@/lib/i18n";
import { aiAvailability } from "@/lib/ai";
import { helpSuggestionKeys } from "@/modules/ai/help/suggestions";
import { chatStorageKey, HELP_CHAT_STORAGE_KEY } from "@/modules/ai/help/history";
import { HelpAssistantButton } from "./help-launcher";

/**
 * Server-Komponente für die App-Shell: zeigt den schwebenden «Fragen?»-Knopf nur, wenn der
 * Hilfe-Assistent im aktiven Verein für diese Person verfügbar ist. Fehler blenden ihn aus.
 * Einbinden z.B. in src/app/(app)/layout.tsx: <HelpAssistantMount />
 */
export async function HelpAssistantMount() {
  let suggestions: string[] | null = null;
  let storageKey = "";
  try {
    const ctx = await getAppContext();
    if (ctx.tenant && ctx.hasModule("ai") && ctx.can("ai.use")) {
      const avail = await aiAvailability(ctx, "help");
      if (avail.ok) {
        const t = getT(await getRequestLocale());
        suggestions = helpSuggestionKeys(ctx).map((k) => t(k));
        storageKey = chatStorageKey(HELP_CHAT_STORAGE_KEY, ctx.user.id, ctx.tenant.id);
      }
    }
  } catch {
    suggestions = null;
  }
  return suggestions ? <HelpAssistantButton suggestions={suggestions} storageKey={storageKey} /> : null;
}
