"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Crosshair } from "lucide-react";
import { Card, Select } from "@/components/ui";
import { useT } from "@/components/locale";
import { toast } from "@/lib/ui-feedback";
import { setWeaponCategoryAction } from "@/modules/federal/awards-actions";

/**
 * Auswahl der Waffenkategorie einer Feldschiessen-Teilnahme (Liste aus den Limiten des Vereins).
 * Für den Schützen selbst oder den Schützenmeister; ohne Kategorien im Einsatz nichts anzeigen.
 */
export function WeaponCategorySelect({ participantId, value, options, name, className }: { participantId: string; value: string | null; options: string[]; name: string; className?: string }) {
  const t = useT();
  const router = useRouter();
  const [current, setCurrent] = useState(value ?? "");
  const [pending, startTransition] = useTransition();
  // Gespeicherter Wert ausserhalb der Liste (z.B. Limiten geändert) bleibt sichtbar.
  const list = current && !options.includes(current) ? [current, ...options] : options;
  if (!options.length && !value) return null;

  function onChange(next: string) {
    const prev = current;
    setCurrent(next);
    startTransition(async () => {
      const r = await setWeaponCategoryAction(participantId, next || null);
      if (!r.ok) {
        setCurrent(prev);
        toast.error(r.error);
        return;
      }
      toast.success(r.message ?? t("misc.weapon.saved"));
      router.refresh();
    });
  }

  // Breite über den Wrapper: Select bringt immer w-full mit, und cn() merged keine Tailwind-Klassen.
  return (
    <div className={className ?? "w-32 shrink-0"}>
      <Select
        value={current}
        disabled={pending}
        onChange={(e) => onChange(e.target.value)}
        aria-label={t("misc.weapon.selectFor", { name })}
        className="h-11"
      >
        <option value="">{t("misc.weapon.none")}</option>
        {list.map((w) => <option key={w} value={w}>{w}</option>)}
      </Select>
    </div>
  );
}

export type WeaponPanelRow = { id: string; name: string; detail: string; weaponCategory: string | null };

/**
 * Waffenkategorien der Teilnahmen eines Programms (Seite «Auszeichnungen»), aufklappbar.
 * Erscheint nur, wenn die Limiten Waffenkategorien verwenden.
 */
export function WeaponCategoryPanel({ rows, options }: { rows: WeaponPanelRow[]; options: string[] }) {
  const t = useT();
  if (!options.length || !rows.length) return null;
  const missing = rows.filter((r) => !r.weaponCategory).length;
  return (
    <details className="mt-3" open={missing > 0}>
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium">
        <Crosshair className="h-4 w-4" aria-hidden /> {t("misc.weapon.title")}
        {missing ? <span className="text-xs font-normal text-ink-3">({missing} × {t("misc.weapon.none")})</span> : null}
      </summary>
      <p className="mb-2 text-xs text-ink-3">{t("misc.weapon.hint")}</p>
      <Card className="animate-rise divide-y divide-line overflow-hidden">
        {rows.map((r) => (
          <div key={r.id} className="flex min-h-14 items-center gap-3 px-4 py-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{r.name}</span>
              <span className="block truncate text-xs text-ink-3">{r.detail}</span>
            </span>
            <WeaponCategorySelect participantId={r.id} value={r.weaponCategory} options={options} name={r.name} />
          </div>
        ))}
      </Card>
    </details>
  );
}
