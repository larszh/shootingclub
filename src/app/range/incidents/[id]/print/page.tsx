import { notFound } from "next/navigation";
import { PrintShell } from "@/components/invoice-document";
import { PrintButton } from "@/components/print-button";
import { formatDateTime } from "@/lib/i18n/core";
import { getRequestLocale, getT } from "@/lib/i18n";
import { requireRange } from "@/modules/range/guard";
import { getIncident } from "@/modules/range/queries";
import { printedAtLabel } from "@/modules/range/format";
import { incidentStatusInfo, kindLabel, severityInfo } from "@/modules/range/types";
import { PrintSheet, SignatureLine } from "@/modules/range/ui/print-sheet";

export async function generateMetadata() {
  const t = getT(await getRequestLocale());
  return { title: t("adm2.range.incidentPrint.title") };
}

/** Druckbare Vorfallmeldung (Meldende Person oder «range.manage»). */
export default async function IncidentPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireRange();
  const locale = await getRequestLocale();
  const t = getT(locale);
  const fmt = (d: Date) => formatDateTime(d, locale);
  const { id } = await params;
  const inc = await getIncident(ctx.tenant.id, id, t("adm2.common.deletedAccount"));
  if (!inc || (!ctx.can("range.manage") && inc.reportedById !== ctx.user.id)) notFound();
  const rows: Array<[string, string | null]> = [
    [t("adm2.range.incidentPrint.kind"), kindLabel(inc.kind, t)],
    [t("adm2.range.incidentPrint.severity"), severityInfo(inc.severity, t).label],
    [t("adm2.range.incidentPrint.when"), fmt(inc.occurredAt)],
    [t("adm2.range.incidentPrint.location"), inc.location],
    [t("adm2.range.incidentPrint.description"), inc.description],
    [t("adm2.range.incidentPrint.persons"), inc.persons],
    [t("adm2.range.incidentPrint.measures"), inc.measures],
    [t("adm2.range.incidentPrint.status"), incidentStatusInfo(inc.status, t).label],
    [t("adm2.range.incidentPrint.reportedBy"), `${inc.reporterName ?? "–"}, ${fmt(inc.createdAt)}`],
  ];
  return (
    <PrintShell title={t("adm2.range.incidentPrint.title")} subtitle={kindLabel(inc.kind, t)} action={<PrintButton />}>
      <PrintSheet tenantName={ctx.tenant.name} title={t("adm2.range.incidentPrint.title")} subtitle={`${kindLabel(inc.kind, t)} · ${fmt(inc.occurredAt)}`} footer={<>{t("adm2.common.createdWith", { date: printedAtLabel(locale) })} {t("adm2.range.incidentPrint.hint")}</>}>
        <dl className="space-y-3">
          {rows.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[42mm_1fr] gap-3 border-b border-neutral-200 pb-2">
              <dt className="text-[9pt] font-semibold uppercase tracking-wide text-neutral-500">{k}</dt>
              <dd className="whitespace-pre-line">{v || "–"}</dd>
            </div>
          ))}
        </dl>
        <SignatureLine label={t("adm2.range.incidentPrint.signature")} placeLabel={t("adm2.common.placeDate")} />
      </PrintSheet>
    </PrintShell>
  );
}
