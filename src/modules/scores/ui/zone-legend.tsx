import { cn } from "@/lib/utils";
import type { Zone } from "@/modules/scores/types";

/** Punkte mit Vorzeichen, z.B. «+5», «0», «−10». */
export function formatZonePoints(points: number) {
  if (points > 0) return `+${points}`;
  if (points < 0) return `−${Math.abs(points)}`;
  return "0";
}

/** Farbklassen einer Zone: Strafzonen rot, Nullzone neutral, Punktezonen ruhig. */
export function zoneToneClass(points: number) {
  return points < 0 ? "bg-danger/10 text-danger border-danger/30" : points === 0 ? "bg-surface-2 text-ink-3 border-line" : "bg-surface text-ink border-line";
}

/** Legende der Trefferzonen (Kürzel, Bezeichnung, Punkte). */
export function ZoneLegend({ zones, className, compact }: { zones: Zone[]; className?: string; compact?: boolean }) {
  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)} aria-label="Trefferzonen">
      {zones.map((z, i) => (
        <li key={`${i}-${z.key}`} title={z.penalty ? "Strafe ohne Schuss (belegt keinen Schussplatz)" : undefined} className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs", zoneToneClass(z.points), z.penalty && "border-dashed")}>
          <span className="font-semibold">{z.key}</span>
          {compact ? null : <span className="opacity-80">{z.label}</span>}
          <span className="font-semibold tabular-nums">{formatZonePoints(z.points)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Gleiche Zonen (Reihenfolge egal)? */
export function sameZones(a: Zone[], b: Zone[]) {
  if (a.length !== b.length) return false;
  const key = (zs: Zone[]) => zs.map((z) => `${z.key.trim().toLowerCase()}|${z.label.trim()}|${z.points}|${z.penalty ? 1 : 0}`).sort().join(";");
  return key(a) === key(b);
}

/** Häufigste Zonenliste über alle Serien (= Programm-Zonen), Rest gilt als Abweichung pro Serie. */
export function dominantZones(list: Zone[][]): Zone[] | null {
  let best: { zones: Zone[]; count: number } | null = null;
  for (const zs of list) {
    const count = list.filter((o) => sameZones(o, zs)).length;
    if (!best || count > best.count) best = { zones: zs, count };
  }
  return best?.zones ?? null;
}
