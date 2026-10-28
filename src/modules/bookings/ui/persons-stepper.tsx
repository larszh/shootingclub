"use client";

import { Minus, Plus, Users } from "lucide-react";
import { cn } from "@/lib/utils";

/** Grosser Zähler für die Anzahl Personen (1 … max). */
export function PersonsStepper({ value, max, onChange, className }: { value: number; max: number; onChange: (v: number) => void; className?: string }) {
  const btn = "press h-12 w-12 shrink-0 rounded-full border border-line bg-surface flex items-center justify-center hover:border-ink/40 disabled:opacity-30 disabled:cursor-not-allowed";
  return (
    <div className={cn("flex items-center gap-3", className)} role="group" aria-label="Anzahl Personen">
      <button type="button" className={btn} onClick={() => onChange(Math.max(1, value - 1))} disabled={value <= 1} aria-label="Eine Person weniger"><Minus className="h-5 w-5" /></button>
      <div className="min-w-0 flex-1 text-center" aria-live="polite">
        <div className="inline-flex items-center gap-2 text-2xl font-semibold tabular-nums"><Users className="h-5 w-5 text-ink-3" aria-hidden />{value}</div>
        <div className="text-xs text-ink-3">{value === 1 ? "Person" : "Personen"} · max. {max}</div>
      </div>
      <button type="button" className={btn} onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="Eine Person mehr"><Plus className="h-5 w-5" /></button>
    </div>
  );
}
