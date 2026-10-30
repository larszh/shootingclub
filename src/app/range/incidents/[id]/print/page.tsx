import { notFound } from "next/navigation";
import { PrintShell } from "@/components/invoice-document";
import { PrintButton } from "@/components/print-button";
import { formatDateTimeZurich } from "@/lib/time";
import { requireRange } from "@/modules/range/guard";
import { getIncident } from "@/modules/range/queries";
import { printedAtLabel } from "@/modules/range/format";
import { INCIDENT_HINT, INCIDENT_STATUS, kindLabel, severityInfo } from "@/modules/range/types";
import { PrintSheet, SignatureLine } from "@/modules/range/ui/print-sheet";

export const metadata = { title: "Vorfallmeldung" };

/** Druckbare Vorfallmeldung (Meldende Person oder «range.manage»). */
export default async function IncidentPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireRange();
  const { id } = await params;
  const inc = await getIncident(ctx.tenant.id, id);
  if (!inc || (!ctx.can("range.manage") && inc.reportedById !== ctx.user.id)) notFound();
  const rows: Array<[string, string | null]> = [
    ["Art", kindLabel(inc.kind)],
    ["Schwere", severityInfo(inc.severity).label],
    ["Zeitpunkt", formatDateTimeZurich(inc.occurredAt)],
    ["Ort", inc.location],
    ["Beschreibung", inc.description],
    ["Beteiligte Personen", inc.persons],
    ["Massnahmen", inc.measures],
    ["Status", INCIDENT_STATUS[inc.status]?.label ?? inc.status],
    ["Gemeldet von", `${inc.reporterName ?? "–"}, ${formatDateTimeZurich(inc.createdAt)}`],
  ];
  return (
    <PrintShell title="Vorfallmeldung" subtitle={kindLabel(inc.kind)} action={<PrintButton />}>
      <PrintSheet tenantName={ctx.tenant.name} title="Vorfallmeldung" subtitle={`${kindLabel(inc.kind)} · ${formatDateTimeZurich(inc.occurredAt)}`} footer={<>Erstellt mit Standchef am {printedAtLabel()}. {INCIDENT_HINT}</>}>
        <dl className="space-y-3">
          {rows.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[42mm_1fr] gap-3 border-b border-neutral-200 pb-2">
              <dt className="text-[9pt] font-semibold uppercase tracking-wide text-neutral-500">{k}</dt>
              <dd className="whitespace-pre-line">{v || "–"}</dd>
            </div>
          ))}
        </dl>
        <SignatureLine label="Unterschrift Schützenmeister / Vorstand" />
      </PrintSheet>
    </PrintShell>
  );
}
