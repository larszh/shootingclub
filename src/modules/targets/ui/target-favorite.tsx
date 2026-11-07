"use client";

import { useOptimistic, useTransition } from "react";
import { Star } from "lucide-react";
import { toggleTargetFavoriteAction } from "@/modules/targets/actions";
import { isNavigationError, isNetworkError, toast } from "@/lib/ui-feedback";
import { cn } from "@/lib/utils";
import { useT } from "@/components/locale";

export function TargetFavoriteButton({ targetId, favorite }: { targetId: string; favorite: boolean }) {
  const t = useT();
  const [opt, setOpt] = useOptimistic(favorite);
  const [, start] = useTransition();
  return (
    <button type="button" aria-pressed={opt} aria-label={opt ? t("shooting.targets.favRemove") : t("shooting.targets.favAdd")} title={opt ? t("shooting.targets.favRemove") : t("shooting.targets.favAdd")}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        // Bei Fehlern springt der optimistische Zustand am Ende der Transition von selbst zurück.
        start(async () => {
          setOpt(!opt);
          try {
            const r = await toggleTargetFavoriteAction(targetId);
            if (!r.ok) toast.error(r.error);
          } catch (err) {
            if (isNavigationError(err)) throw err;
            toast.error(isNetworkError(err) ? t("shooting.favorite.offline") : t("shooting.favorite.failed"));
          }
        });
      }}
      className={cn("press flex h-11 w-11 items-center justify-center rounded-full shadow-sm", opt ? "bg-accent text-accent-ink" : "bg-white/90 text-ink-3 hover:text-ink")}>
      <Star className={cn("h-4 w-4", opt && "fill-current animate-pop")} />
    </button>
  );
}
