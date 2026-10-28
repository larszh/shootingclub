"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/** Mengenwahl mit grossen Knöpfen (44 px), für Shop und Ausgabe. */
export function QuantityStepper({ value, onChange, max, label, className }: { value: number; onChange: (v: number) => void; max?: number | null; label: string; className?: string }) {
  const limit = max ?? 999;
  const btn = "press inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-ink disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
  return (
    <div className={cn("inline-flex items-center gap-1.5", className)} role="group" aria-label={label}>
      <button type="button" className={btn} disabled={value <= 0} onClick={() => onChange(Math.max(0, value - 1))} aria-label={`${label}: eins weniger`}>
        <Minus className="h-4 w-4" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={limit}
        value={value}
        onChange={(e) => {
          const n = Math.floor(Number(e.target.value));
          onChange(Number.isFinite(n) ? Math.max(0, Math.min(limit, n)) : 0);
        }}
        aria-label={`${label}: Menge`}
        className={cn("h-11 w-14 rounded-control border border-line bg-surface text-center text-base font-semibold tabular-nums text-ink focus:outline-none focus:border-ink [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none", value > 0 && "border-ink")}
      />
      <button type="button" className={btn} disabled={value >= limit} onClick={() => onChange(Math.min(limit, value + 1))} aria-label={`${label}: eins mehr`}>
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
