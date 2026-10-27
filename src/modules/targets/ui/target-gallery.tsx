"use client";

import { useState } from "react";
import type { TargetView } from "@/modules/targets/queries";
import { TargetCard } from "./target-card";
import { cn } from "@/lib/utils";

const FILTERS = [
  { key: "all", label: "Alle" },
  { key: "fav", label: "★ Favoriten" },
  { key: "global", label: "Global" },
  { key: "tenant", label: "Verein" },
  { key: "mine", label: "Meine" },
] as const;

export function TargetGallery({ targets }: { targets: TargetView[] }) {
  const [f, setF] = useState<(typeof FILTERS)[number]["key"]>("all");
  const list = targets.filter((t) => (f === "all" ? true : f === "fav" ? t.favorite : t.scope === f));
  return (
    <div>
      <div className="animate-fade flex gap-1.5 overflow-x-auto pb-2 -mx-4 px-4 mb-2 [scrollbar-width:none]">
        {FILTERS.map((x) => (
          <button key={x.key} type="button" onClick={() => setF(x.key)} className={cn("press shrink-0 h-9 rounded-full px-3.5 text-sm font-medium border transition-colors", f === x.key ? "bg-ink text-bg border-ink" : "bg-surface border-line text-ink-2")}>{x.label}</button>
        ))}
      </div>
      <div className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3">
        {list.map((t) => <TargetCard key={t.id} target={t} href={`/targets/${t.id}`} />)}
      </div>
      {list.length === 0 ? <p className="text-sm text-ink-3 text-center py-8">Nichts in dieser Auswahl.</p> : null}
    </div>
  );
}
