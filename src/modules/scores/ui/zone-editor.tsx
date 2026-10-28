"use client";

import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { DEFAULT_ZONES, validateZones, ZONE_LIMITS, type Zone } from "@/modules/scores/types";
import { Alert, Button, Input } from "@/components/ui";
import { cn } from "@/lib/utils";

/** Bearbeitbare Zone: Punkte als Text, damit «-» beim Tippen nicht verloren geht. */
export type ZoneDraft = { key: string; label: string; points: string };

export const toDrafts = (zones: Zone[]): ZoneDraft[] => zones.map((z) => ({ key: z.key, label: z.label, points: String(z.points) }));

/** Entwürfe → Zonen (Punkte als Zahl, NaN bei ungültiger Eingabe). */
export function fromDrafts(drafts: ZoneDraft[]): Zone[] {
  return drafts.map((d) => ({ key: d.key.trim(), label: d.label.trim(), points: /^\s*-?\d+\s*$/.test(d.points) ? Number(d.points) : Number.NaN }));
}

/** Fehlermeldung zu den Entwürfen oder null. */
export function draftError(drafts: ZoneDraft[]): string | null {
  const bad = drafts.find((d) => !/^\s*-?\d+\s*$/.test(d.points));
  if (bad) return `Zone «${bad.key || bad.label || "?"}»: Punkte als ganze Zahl eingeben (z.B. 5 oder -10).`;
  return validateZones(fromDrafts(drafts));
}

function nextKey(drafts: ZoneDraft[]) {
  const used = new Set(drafts.map((d) => d.key.trim().toUpperCase()));
  for (const k of ["A", "B", "C", "D", "E", "F", "G", "H", "K", "M", "X"]) if (!used.has(k)) return k;
  return `Z${drafts.length + 1}`;
}

/**
 * Editor für Trefferzonen: Kürzel, Bezeichnung und Punkte (−100 bis 100). Strafzonen (negative
 * Punkte) werden rot markiert. Grosse Bedienelemente für die Bedienung am Stand.
 */
export function ZoneEditor({ zones, onChange, idPrefix }: { zones: ZoneDraft[]; onChange: (next: ZoneDraft[]) => void; idPrefix: string }) {
  const err = draftError(zones);
  const update = (i: number, patch: Partial<ZoneDraft>) => onChange(zones.map((z, idx) => (idx === i ? { ...z, ...patch } : z)));
  const remove = (i: number) => onChange(zones.filter((_, idx) => idx !== i));
  const add = () => onChange([...zones, { key: nextKey(zones), label: "", points: "1" }]);
  const flip = (i: number) => {
    const raw = zones[i]!.points.trim();
    const n = Number(raw);
    if (raw === "" || !Number.isFinite(n)) return update(i, { points: "-" });
    update(i, { points: String(n === 0 ? 0 : -n) });
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[3.5rem_1fr_7.5rem_2.75rem] gap-2 px-0.5 text-[11px] font-medium text-ink-3">
        <span>Kürzel</span><span>Bezeichnung</span><span>Punkte</span><span className="sr-only">Entfernen</span>
      </div>
      {zones.map((z, i) => {
        const n = Number(z.points);
        const penalty = Number.isFinite(n) && n < 0;
        return (
          <div key={i} className={cn("grid grid-cols-[3.5rem_1fr_7.5rem_2.75rem] items-center gap-2 rounded-control", penalty && "bg-danger/5")}>
            <Input aria-label={`Kürzel Zone ${i + 1}`} id={`${idPrefix}-key-${i}`} value={z.key} maxLength={ZONE_LIMITS.keyMax} onChange={(e) => update(i, { key: e.target.value })} className="px-2 text-center font-semibold" />
            <Input aria-label={`Bezeichnung Zone ${i + 1}`} value={z.label} maxLength={ZONE_LIMITS.labelMax} onChange={(e) => update(i, { label: e.target.value })} placeholder="z.B. A-Zone" />
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => flip(i)} aria-label={`Vorzeichen Zone ${i + 1} wechseln`}
                className="press h-11 w-11 shrink-0 rounded-control border border-line bg-surface-2 text-base font-semibold text-ink-2">±</button>
              <Input aria-label={`Punkte Zone ${i + 1}`} value={z.points} inputMode="numeric" onChange={(e) => update(i, { points: e.target.value.replace(/[^\d-]/g, "").slice(0, 4) })}
                className={cn("px-1.5 text-center tabular-nums font-semibold", penalty && "text-danger border-danger/40")} />
            </div>
            <button type="button" onClick={() => remove(i)} disabled={zones.length <= 1} aria-label={`Zone ${z.key || i + 1} entfernen`}
              className="press h-11 w-11 rounded-full text-ink-3 hover:bg-danger/10 hover:text-danger disabled:opacity-30 flex items-center justify-center"><Trash2 className="h-4 w-4" /></button>
          </div>
        );
      })}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={add} disabled={zones.length >= ZONE_LIMITS.maxZones}><Plus className="h-4 w-4" /> Zone hinzufügen</Button>
        <Button type="button" variant="ghost" onClick={() => onChange(toDrafts(DEFAULT_ZONES))}><RotateCcw className="h-4 w-4" /> Standard-Zonen</Button>
      </div>
      <p className="text-[11px] text-ink-3">Negative Punkte sind Strafzonen (z.B. Geisel getroffen −10). Jede Zone braucht einen eigenen Punktwert, höchstens {ZONE_LIMITS.maxZones} Zonen.</p>
      {err ? <Alert tone="warn">{err}</Alert> : null}
    </div>
  );
}
