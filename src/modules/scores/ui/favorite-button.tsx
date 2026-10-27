"use client";

import { useOptimistic, useTransition } from "react";
import { Star } from "lucide-react";
import { toggleFavoriteAction } from "@/modules/scores/actions";
import { cn } from "@/lib/utils";

export function FavoriteButton({ programId, favorite, className }: { programId: string; favorite: boolean; className?: string }) {
  const [opt, setOpt] = useOptimistic(favorite);
  const [, start] = useTransition();
  return (
    <button type="button" aria-label={opt ? "Favorit entfernen" : "Als Favorit markieren"} aria-pressed={opt}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        start(async () => {
          setOpt(!opt);
          await toggleFavoriteAction(programId);
        });
      }}
      className={cn("press flex h-9 w-9 items-center justify-center rounded-full transition-colors", opt ? "text-accent bg-accent-soft" : "text-ink-3 hover:bg-surface-2", className)}>
      <Star className={cn("h-5 w-5 transition-transform", opt && "fill-current animate-pop")} />
    </button>
  );
}
