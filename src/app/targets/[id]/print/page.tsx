import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireModule } from "@/lib/tenant";
import { getTarget } from "@/modules/targets/queries";
import { normalizePrintOptions } from "@/modules/targets/print";
import { printFooterText } from "@/modules/targets/print-footer";
import { PrintSheet } from "./print-sheet";

export const metadata: Metadata = { title: "Drucken" };

type Search = { size?: string; layout?: string; copies?: string; auto?: string };

export default async function PrintTargetPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Search> }) {
  const ctx = await requireModule("targets");
  const { id } = await params;
  const sp = await searchParams;
  const t = await getTarget(ctx, id);
  if (!t) notFound();
  const isPdf = t.subject === "UPLOAD" && t.mimeType === "application/pdf";
  const initial = normalizePrintOptions(sp, t.paperSizes, isPdf);
  const footer = printFooterText(ctx.user.name, ctx.tenant.name);

  return (
    <PrintSheet
      target={{ id: t.id, name: t.name, subject: t.subject, params: t.params, paperSizes: t.paperSizes.length ? t.paperSizes : ["A4"], mimeType: t.mimeType, filePath: t.filePath }}
      footer={footer}
      initial={initial}
      auto={sp.auto === "1"}
    />
  );
}
