import { formatScore } from "@/lib/utils";
import { formatDate, getT, type Locale } from "@/lib/i18n/core";

export type ChartPoint = { date: Date; total: number; isBest?: boolean };

const W = 360;
const H = 190;
const PAD = { l: 38, r: 12, t: 14, b: 26 };

function niceStep(range: number) {
  const raw = range / 3;
  const pow = 10 ** Math.floor(Math.log10(raw || 1));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

/**
 * Verlauf der Totale als SVG-Liniendiagramm, ohne Chart-Bibliothek.
 * Mit Bestwert- und Durchschnittslinie, Titel/Beschreibung für Screenreader und Tabelle als Alternative.
 */
export function ProgressChart({ id, title, points, best, avg, max, decimal, locale = "de" }: {
  id: string;
  title: string;
  points: ChartPoint[];
  best: number;
  avg: number;
  max: number;
  decimal: boolean;
  locale?: Locale;
}) {
  if (points.length === 0) return null;
  const t = getT(locale);
  const formatDay = (d: Date) => formatDate(d, locale);
  const values = points.map((p) => p.total);
  let lo = Math.min(...values, avg);
  let hi = Math.max(...values, avg);
  const spread = Math.max(hi - lo, max * 0.05, 1);
  // Nicht unter 0, ausser es gibt negative Totale (Zonenwertung mit Strafpunkten)
  lo = lo < 0 ? lo - spread * 0.2 : Math.max(0, lo - spread * 0.2);
  // Nach oben Luft lassen, aber höchstens bis zum Programm-Maximum – nie unter den grössten Wert.
  hi = Math.max(hi, Math.min(max || hi + spread * 0.2, hi + spread * 0.2));
  if (hi <= lo) hi = lo + 1;
  const step = niceStep(hi - lo);
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  if (hi <= lo) hi = lo + step;

  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => PAD.t + innerH - ((v - lo) / (hi - lo)) * innerH;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(Math.round(v * 10) / 10);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.total).toFixed(1)}`).join(" ");
  const area = `${path} L${x(points.length - 1).toFixed(1)},${(PAD.t + innerH).toFixed(1)} L${x(0).toFixed(1)},${(PAD.t + innerH).toFixed(1)} Z`;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const fmt = (n: number) => formatScore(n, decimal);
  const desc = t("shooting.chart.desc", { n: points.length, from: formatDay(first.date), to: formatDay(last.date), best: fmt(best), avg: fmt(avg), last: fmt(last.total), max });

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-h-72 overflow-visible" role="img" aria-labelledby={`${id}-t ${id}-d`}>
        <title id={`${id}-t`}>{title}</title>
        <desc id={`${id}-d`}>{desc}</desc>
        <defs>
          <linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(tick)} y2={y(tick)} className="stroke-line" strokeWidth={1} />
            <text x={PAD.l - 6} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-ink-3" fontSize={10}>{decimal ? tick.toFixed(1) : Math.round(tick)}</text>
          </g>
        ))}
        <path d={area} fill={`url(#${id}-fill)`} />
        <line x1={PAD.l} x2={W - PAD.r} y1={y(avg)} y2={y(avg)} className="stroke-ink-3" strokeWidth={1.25} strokeDasharray="2 4" />
        <line x1={PAD.l} x2={W - PAD.r} y1={y(best)} y2={y(best)} className="stroke-accent" strokeWidth={1.25} strokeDasharray="6 4" />
        <path d={path} fill="none" className="stroke-ink" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.total)} r={p.isBest ? 5 : points.length > 40 ? 2 : 3.25}
            className={p.isBest ? "fill-accent stroke-surface" : "fill-surface stroke-ink"} strokeWidth={p.isBest ? 2 : 1.75}>
            <title>{`${formatDay(p.date)}: ${fmt(p.total)}`}</title>
          </circle>
        ))}
        <text x={PAD.l} y={H - 6} className="fill-ink-3" fontSize={10}>{formatDay(first.date)}</text>
        {points.length > 1 ? <text x={W - PAD.r} y={H - 6} textAnchor="end" className="fill-ink-3" fontSize={10}>{formatDay(last.date)}</text> : null}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3">
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-0.5 w-5 bg-ink" aria-hidden /> {t("shooting.chart.total")}</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-5 border-t-2 border-dashed border-accent" aria-hidden /> {t("shooting.chart.bestN", { value: fmt(best) })}</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-5 border-t-2 border-dotted border-ink-3" aria-hidden /> {t("shooting.chart.avgN", { value: fmt(avg) })}</span>
      </figcaption>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-ink-3 hover:text-ink select-none">{t("shooting.chart.asTable")}</summary>
        <div className="mt-2 max-h-64 overflow-auto rounded-control border border-line">
          <table className="w-full text-left tabular-nums">
            <caption className="sr-only">{title}</caption>
            <thead className="bg-surface-2 text-xs text-ink-3">
              <tr><th scope="col" className="px-3 py-2 font-medium">{t("shooting.chart.date")}</th><th scope="col" className="px-3 py-2 font-medium text-right">{t("shooting.chart.total")}</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {[...points].reverse().map((p, i) => (
                <tr key={i} className={p.isBest ? "font-semibold" : undefined}>
                  <td className="px-3 py-1.5">{formatDay(p.date)}{p.isBest ? ` · ${t("shooting.chart.best")}` : ""}</td>
                  <td className="px-3 py-1.5 text-right">{fmt(p.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
