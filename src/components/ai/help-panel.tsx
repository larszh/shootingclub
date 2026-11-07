"use client";

import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui";
import { useT } from "@/components/locale";
import { AiChat } from "./chat";

/** Hilfe-Assistent als Karte (Seite /help). storageKey: chatStorageKey(HELP_CHAT_STORAGE_KEY, user, tenant). */
export function HelpAssistantPanel({ suggestions, storageKey }: { suggestions: string[]; storageKey: string }) {
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
        storageKey={storageKey}
        mode="help"
        intro={t("aihelp.chat.intro")}
        suggestions={suggestions}
        className="max-h-[55vh]"
      />
    </Card>
  );
}
