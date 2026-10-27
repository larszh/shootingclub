import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireModule } from "@/lib/tenant";
import { getTarget } from "@/modules/targets/queries";
import { PAPER_MM, PAPER_SIZES, type PaperSize } from "@/modules/targets/types";
import { TargetPreview } from "@/modules/targets/ui/target-preview";
import { formatDate } from "@/lib/utils";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Drucken" };

export default async function PrintTargetPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ size?: string }> }) {
  const ctx = await requireModule("targets");
  const { id } = await params;
  const { size } = await searchParams;
  const t = await getTarget(ctx, id);
  if (!t) notFound();
  const paper: PaperSize = (PAPER_SIZES as readonly string[]).includes(size ?? "") ? (size as PaperSize) : t.paperSizes[0] ?? "A4";
  const { w, h } = PAPER_MM[paper];
  const footer = `${formatDate(new Date())} · ${ctx.user.name} · ${ctx.tenant.name} · Standchef`;

  return (
    <div className="min-h-dvh bg-neutral-200 print:bg-white">
      <style>{`@page { size: ${paper} portrait; margin: 0; } @media print { html, body { background: #fff !important; } }`}</style>
      <div className="no-print sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-neutral-300 px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0"><div className="font-semibold truncate">{t.name}</div><div className="text-xs text-neutral-500">{paper} · Hochformat · Drucken ohne Skalierung (100 %)</div></div>
        <PrintButton />
      </div>
      <div className="flex justify-center p-4 print:p-0 overflow-x-auto">
        <div className="relative bg-white shadow-lg print:shadow-none" style={{ width: `${w}mm`, height: `${h}mm` }}>
          {t.subject === "UPLOAD" ? (
            <div className="absolute" style={{ left: "10mm", top: "10mm", right: "10mm", bottom: "18mm" }}>
              {t.mimeType === "application/pdf" ? (
                <iframe src={`/api/files/${t.id}#toolbar=0`} className="h-full w-full" title={t.name} />
              ) : (
                <TargetPreview target={t} className="h-full w-full object-contain" />
              )}
            </div>
          ) : (
            <TargetPreview target={t} size={paper} className="absolute inset-0 h-full w-full" />
          )}
          <div className="absolute text-neutral-500" style={{ right: "6mm", bottom: "5mm", fontSize: "2.4mm", lineHeight: 1 }}>{footer}</div>
        </div>
      </div>
    </div>
  );
}
