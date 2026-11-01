import Link from "next/link";
import { Button, Input } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { PeriodPreset } from "@/modules/kiosk/logic";

/**
 * Zeitraum wählen: Vorschläge als Pillen und eigener Zeitraum (GET-Formular, funktioniert ohne JS).
 * `extra` sind weitere Suchparameter, die erhalten bleiben (z.B. Filter der Einträge).
 */
export function PeriodPicker({ basePath, presets, current, extra = {} }: { basePath: string; presets: PeriodPreset[]; current: PeriodPreset; extra?: Record<string, string> }) {
  const href = (p: PeriodPreset) => `${basePath}?${new URLSearchParams({ ...extra, from: p.from, to: p.to }).toString()}`;
  return (
    <div className="mb-4 space-y-3">
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {presets.map((p) => {
          const active = p.from === current.from && p.to === current.to;
          return (
            <Link key={p.key} href={href(p)} aria-current={active ? "page" : undefined}
              className={cn("press inline-flex h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium", active ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2")}>
              {p.label}
            </Link>
          );
        })}
      </div>
      <form method="get" action={basePath} className="flex flex-wrap items-end gap-2">
        {Object.entries(extra).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <label className="min-w-36 flex-1">
          <span className="mb-1 block text-xs font-medium text-ink-3">Von</span>
          <Input type="date" name="from" defaultValue={current.from} required />
        </label>
        <label className="min-w-36 flex-1">
          <span className="mb-1 block text-xs font-medium text-ink-3">Bis</span>
          <Input type="date" name="to" defaultValue={current.to} required />
        </label>
        <Button type="submit" variant="secondary">Anzeigen</Button>
      </form>
    </div>
  );
}
