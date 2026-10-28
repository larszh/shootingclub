"use client";

import { useOptimistic, useTransition } from "react";
import { Star } from "lucide-react";
import { toggleFavoriteAction } from "@/modules/scores/actions";
import { isNavigationError, isNetworkError, toast } from "@/lib/ui-feedback";
import { cn } from "@/lib/utils";

export function FavoriteButton({ programId, favorite, className }: { programId: string; favorite: boolean; className?: string }) {
  const [opt, setOpt] = useOptimistic(favorite);
  const [, start] = useTransition();
  return (
    <button type="button" aria-label={opt ? "Favorit entfernen" : "Als Favorit markieren"} aria-pressed={opt}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        // Bei Fehlern springt der optimistische Zustand am Ende der Transition von selbst zurück.
        start(async () => {
          setOpt(!opt);
          try {
            const r = await toggleFavoriteAction(programId);
            if (!r.ok) toast.error(r.error);
          } catch (err) {
            if (isNavigationError(err)) throw err;
            toast.error(isNetworkError(err) ? "Keine Verbindung. Bitte versuche es nochmals, sobald du wieder online bist." : "Das hat nicht geklappt. Bitte nochmals versuchen.");
          }
        });
      }}
      className={cn("press flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors", opt ? "text-accent bg-accent-soft" : "text-ink-3 hover:bg-surface-2", className)}>
      <Star className={cn("h-5 w-5 transition-transform", opt && "fill-current animate-pop")} />
    </button>
  );
}
