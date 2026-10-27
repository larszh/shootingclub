"use client";

import { useOptimistic, useTransition } from "react";
import { Star } from "lucide-react";
import { toggleTargetFavoriteAction } from "@/modules/targets/actions";
import { cn } from "@/lib/utils";

export function TargetFavoriteButton({ targetId, favorite }: { targetId: string; favorite: boolean }) {
  const [opt, setOpt] = useOptimistic(favorite);
  const [, start] = useTransition();
  return (
    <button type="button" aria-pressed={opt} aria-label={opt ? "Favorit entfernen" : "Als Favorit merken"} title={opt ? "Favorit entfernen" : "Als Favorit merken"}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); start(async () => { setOpt(!opt); await toggleTargetFavoriteAction(targetId); }); }}
      className={cn("press flex h-10 w-10 items-center justify-center rounded-full shadow-sm", opt ? "bg-accent text-accent-ink" : "bg-white/90 text-ink-3 hover:text-ink")}>
      <Star className={cn("h-4 w-4", opt && "fill-current animate-pop")} />
    </button>
  );
}
