"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircleQuestion } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { useT } from "@/components/locale";
import { cn } from "@/lib/utils";
import { AiChat } from "./chat";

/** Seiten ohne schwebenden Knopf (eigene Hilfe oder Vollbild-Ansichten). */
const HIDDEN_PREFIXES = ["/help", "/super/support", "/chat", "/admin/live"];

/**
 * Schwebender «Fragen?»-Knopf, öffnet den Hilfe-Assistenten als Panel (mobil von unten).
 * Nur einbinden, wenn der Assistent verfügbar ist – siehe HelpAssistantMount (Server-Komponente).
 */
export function HelpAssistantButton({ suggestions, storageKey, className }: { suggestions: string[]; storageKey: string; className?: string }) {
  const t = useT();
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  if (HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "press fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 inline-flex h-12 items-center gap-2 rounded-full bg-ink px-4 text-[15px] font-medium text-bg shadow-lg md:bottom-6",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent print:hidden",
          className,
        )}
        aria-haspopup="dialog"
      >
        <MessageCircleQuestion className="h-5 w-5" aria-hidden />
        {t("aihelp.launcher.label")}
      </button>
      {open ? (
        <Dialog open={open} onClose={() => setOpen(false)} title={t("aihelp.panel.title")} description={t("aihelp.panel.subtitle")} size="lg">
          <AiChat
            endpoint="/api/ai/help"
            storageKey={storageKey}
            mode="help"
            intro={t("aihelp.chat.intro")}
            suggestions={suggestions}
            onNavigate={() => setOpen(false)}
            className="max-h-[50vh]"
            autoFocus
          />
        </Dialog>
      ) : null}
    </>
  );
}
