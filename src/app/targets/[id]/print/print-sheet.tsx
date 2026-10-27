"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Minus, Plus, Printer } from "lucide-react";
import { renderTargetSvg } from "@/modules/targets/svg";
import { allowedLayouts, MAX_COPIES, printLayout } from "@/modules/targets/print";
import { PAPER_MM, PRINT_LAYOUTS, type PaperSize, type PrintLayoutKey, type TargetParams, type TargetSubject } from "@/modules/targets/types";
import { cn } from "@/lib/utils";

type PrintTarget = {
  id: string;
  name: string;
  subject: string;
  params: TargetParams;
  paperSizes: PaperSize[];
  mimeType: string | null;
};

type Props = {
  target: PrintTarget;
  footer: string;
  initial: { paper: PaperSize; layout: PrintLayoutKey; copies: number };
  auto: boolean;
};

export function PrintSheet({ target, footer, initial, auto }: Props) {
  const [paper, setPaper] = useState<PaperSize>(initial.paper);
  const [layout, setLayout] = useState<PrintLayoutKey>(initial.layout);
  const [copies, setCopies] = useState(initial.copies);

  const isUpload = target.subject === "UPLOAD";
  const isPdf = target.mimeType === "application/pdf";
  const allowed = allowedLayouts(target.paperSizes, isPdf);
  const sheet = useMemo(() => printLayout(layout, paper), [layout, paper]);

  // SVG pro Stückgrösse nur einmal erzeugen
  const svgs = useMemo(() => {
    const out: Partial<Record<PaperSize, string>> = {};
    if (isUpload) return out;
    for (const p of sheet.pieces) out[p.size] ??= renderTargetSvg(target.subject as TargetSubject, p.size, target.params);
    return out;
  }, [isUpload, sheet.pieces, target.subject, target.params]);

  useEffect(() => {
    if (!auto) return;
    const t = setTimeout(() => window.print(), 500);
    return () => clearTimeout(t);
  }, [auto]);

  function update(next: { paper?: PaperSize; layout?: PrintLayoutKey; copies?: number }) {
    const p = next.paper ?? paper;
    const l = next.layout ?? layout;
    const c = next.copies ?? copies;
    if (next.paper) setPaper(p);
    if (next.layout) setLayout(l);
    if (next.copies !== undefined) setCopies(c);
    try {
      const qs = new URLSearchParams({ size: p, layout: l, copies: String(c) });
      window.history.replaceState(null, "", `?${qs.toString()}`);
    } catch {
      /* URL-Update ist nur Komfort */
    }
  }

  const perSheet = sheet.pieces.length;
  const summary = `${sheet.sheet} ${sheet.orientation === "landscape" ? "quer" : "hoch"} · ${perSheet === 1 ? "1 Scheibe" : `${perSheet} Scheiben`} pro Blatt · ${copies} ${copies === 1 ? "Blatt" : "Blätter"}`;
  const seg = (active: boolean, disabled = false) =>
    cn(
      "press h-10 min-w-11 px-3 rounded-lg text-sm font-medium border transition-colors",
      active ? "bg-neutral-900 text-white border-neutral-900" : "bg-white text-neutral-700 border-neutral-300 hover:border-neutral-500",
      disabled && "opacity-40 pointer-events-none",
    );

  return (
    <div className="min-h-dvh bg-neutral-200 text-neutral-900 print:bg-white">
      <style>{`
@page { size: ${sheet.sheet} ${sheet.orientation}; margin: 0; }
@media print {
  html, body { background: #fff !important; }
  .sheet-wrap { zoom: 1 !important; padding: 0 !important; gap: 0 !important; }
  .sheet { box-shadow: none !important; margin: 0 !important; }
}
@media screen and (max-width: 1180px) { .sheet-wrap.is-landscape { zoom: 0.8; } }
@media screen and (max-width: 860px) { .sheet-wrap { zoom: 0.85; } .sheet-wrap.is-landscape { zoom: 0.6; } }
@media screen and (max-width: 640px) { .sheet-wrap { zoom: 0.6; } .sheet-wrap.is-landscape { zoom: 0.42; } }
@media screen and (max-width: 420px) { .sheet-wrap { zoom: 0.44; } .sheet-wrap.is-landscape { zoom: 0.31; } }
.sheet { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
`}</style>

      <div className="no-print sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-neutral-300 px-4 py-3">
        <div className="mx-auto max-w-5xl flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <Link href={`/targets/${target.id}`} aria-label="Zurück zur Scheibe" className="press inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-neutral-300 bg-white text-neutral-700">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="min-w-0 flex-1">
              <div className="font-semibold truncate">{target.name}</div>
              <div className="text-xs text-neutral-500">{summary}</div>
            </div>
            <button type="button" onClick={() => window.print()} className="press inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-neutral-900 px-5 text-sm font-semibold text-white">
              <Printer className="h-4 w-4" /> Drucken
            </button>
          </div>

          <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
            <fieldset>
              <legend className="mb-1 text-xs font-medium text-neutral-500">Format</legend>
              <div className="flex gap-1.5">
                {target.paperSizes.map((s) => (
                  <button key={s} type="button" aria-pressed={layout === "single" && paper === s} disabled={layout !== "single"} onClick={() => update({ paper: s })} className={seg(layout === "single" && paper === s, layout !== "single")}>{s}</button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-1 text-xs font-medium text-neutral-500">Mehrere pro Blatt</legend>
              <div className="flex flex-wrap gap-1.5">
                {PRINT_LAYOUTS.map((l) => {
                  const ok = allowed.includes(l.key);
                  return (
                    <button key={l.key} type="button" aria-pressed={layout === l.key} disabled={!ok} title={ok ? undefined : isPdf ? "Bei PDF nicht möglich" : "Format nicht freigegeben"} onClick={() => update({ layout: l.key })} className={seg(layout === l.key, !ok)}>{l.label}</button>
                  );
                })}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-1 text-xs font-medium text-neutral-500">Anzahl Blätter</legend>
              <div className="flex items-center gap-1.5">
                <button type="button" aria-label="Weniger" onClick={() => update({ copies: Math.max(1, copies - 1) })} disabled={copies <= 1} className={seg(false, copies <= 1)}><Minus className="mx-auto h-4 w-4" /></button>
                <span className="w-9 text-center text-base font-semibold tabular-nums" aria-live="polite">{copies}</span>
                <button type="button" aria-label="Mehr" onClick={() => update({ copies: Math.min(MAX_COPIES, copies + 1) })} disabled={copies >= MAX_COPIES} className={seg(false, copies >= MAX_COPIES)}><Plus className="mx-auto h-4 w-4" /></button>
              </div>
            </fieldset>
          </div>

          <p className="text-xs text-neutral-500">
            Im Druckdialog <b>«Tatsächliche Grösse»</b> bzw. Skalierung <b>100 %</b> wählen und «An Seite anpassen» ausschalten, sonst stimmen die Masse nicht.
            {perSheet > 1 ? " Entlang der gestrichelten Linien schneiden." : ""}
          </p>
        </div>
      </div>

      <div className={cn("sheet-wrap flex flex-col items-center gap-6 p-4 print:block print:p-0", sheet.orientation === "landscape" && "is-landscape")}>
        {Array.from({ length: copies }, (_, i) => (
          <div
            key={i}
            className="sheet relative overflow-hidden bg-white shadow-lg shrink-0"
            style={{ width: `${sheet.w}mm`, height: `${sheet.h}mm`, breakAfter: i < copies - 1 ? "page" : "auto", pageBreakAfter: i < copies - 1 ? "always" : "auto" }}
          >
            {sheet.pieces.map((p, k) => (
              <Piece key={k} piece={p} target={target} svg={svgs[p.size]} footer={footer} isPdf={isPdf} />
            ))}
            {sheet.cuts.length ? (
              <svg className="absolute inset-0" width={`${sheet.w}mm`} height={`${sheet.h}mm`} viewBox={`0 0 ${sheet.w} ${sheet.h}`} aria-hidden>
                {sheet.cuts.map((c, k) => (
                  <line key={k} x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2} stroke="#9a9a9a" strokeWidth={0.2} strokeDasharray="2 1.5" />
                ))}
              </svg>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function Piece({ piece, target, svg, footer, isPdf }: { piece: { x: number; y: number; size: PaperSize }; target: PrintTarget; svg?: string; footer: string; isPdf: boolean }) {
  const dims = PAPER_MM[piece.size];
  return (
    <div className="absolute" style={{ left: `${piece.x}mm`, top: `${piece.y}mm`, width: `${dims.w}mm`, height: `${dims.h}mm` }}>
      {target.subject === "UPLOAD" ? (
        <div className="absolute" style={{ left: "10mm", top: "10mm", right: "10mm", bottom: "18mm" }}>
          {isPdf ? (
            <iframe src={`/api/files/${target.id}#toolbar=0`} className="h-full w-full" title={target.name} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/files/${target.id}`} alt="" className="h-full w-full object-contain" />
          )}
        </div>
      ) : (
        <div className="absolute inset-0 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg ?? "" }} />
      )}
      <div className="absolute overflow-hidden text-ellipsis whitespace-nowrap text-right text-neutral-500" style={{ right: "6mm", bottom: "5mm", maxWidth: `${dims.w - 12}mm`, fontSize: "2.4mm", lineHeight: 1.2 }}>{footer}</div>
    </div>
  );
}
