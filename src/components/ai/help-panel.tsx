"use client";

import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui";
import { useT } from "@/components/locale";
import { AiChat } from "./chat";

/** Speicher-Schlüssel des Verlaufs (gleich für Panel auf /help und schwebenden Knopf). */
export const HELP_CHAT_STORAGE_KEY = "sc-ai-help-chat";

/** Hilfe-Assistent als Karte (Seite /help). */
export function HelpAssistantPanel({ suggestions }: { suggestions: string[] }) {
  const t = useT();
  return (
    <Card className="animate-rise mb-6 p-4">
      <h2 className="mb-1 flex items-center gap-2 text-base font-semibold">
        <Sparkles className="h-4 w-4 text-accent" aria-hidden />
        {t("aihelp.panel.title")}
      </h2>
      <p className="mb-3 text-sm text-ink-3">{t("aihelp.panel.subtitle")}</p>
      <AiChat
        endpoint="/api/ai/help"
        storageKey={HELP_CHAT_STORAGE_KEY}
        intro={t("aihelp.chat.intro")}
        suggestions={suggestions}
        className="max-h-[55vh]"
      />
    </Card>
  );
}
