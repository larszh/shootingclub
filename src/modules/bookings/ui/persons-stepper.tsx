"use client";

import { Minus, Plus, Users } from "lucide-react";
import { getT, type Locale } from "@/lib/i18n/core";
import { cn } from "@/lib/utils";

/** Grosser Zähler für die Anzahl Personen (1 … max). */
export function PersonsStepper({ value, max, onChange, className, locale = "de" }: { value: number; max: number; onChange: (v: number) => void; className?: string; locale?: Locale }) {
  const t = getT(locale);
  const btn = "press h-12 w-12 shrink-0 rounded-full border border-line bg-surface flex items-center justify-center hover:border-ink/40 disabled:opacity-30 disabled:cursor-not-allowed";
  return (
    <div className={cn("flex items-center gap-3", className)} role="group" aria-label={t("bookings.stepper.label")}>
      <button type="button" className={btn} onClick={() => onChange(Math.max(1, value - 1))} disabled={value <= 1} aria-label={t("bookings.stepper.less")}><Minus className="h-5 w-5" /></button>
      <div className="min-w-0 flex-1 text-center" aria-live="polite">
        <div className="inline-flex items-center gap-2 text-2xl font-semibold tabular-nums"><Users className="h-5 w-5 text-ink-3" aria-hidden />{value}</div>
        <div className="text-xs text-ink-3">{t(value === 1 ? "bookings.stepper.person" : "bookings.stepper.persons", { max })}</div>
      </div>
      <button type="button" className={btn} onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={t("bookings.stepper.more")}><Plus className="h-5 w-5" /></button>
    </div>
  );
}
