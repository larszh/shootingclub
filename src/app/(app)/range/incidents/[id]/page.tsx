import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Printer } from "lucide-react";
import { ActionButton } from "@/components/ui/action-button";
import { Badge, Card, LinkButton, PageHeader } from "@/components/ui";
import { formatDateTimeZurich } from "@/lib/time";
import { requireRange } from "@/modules/range/guard";
import { getIncident } from "@/modules/range/queries";
import { reopenIncidentAction } from "@/modules/range/actions";
import { INCIDENT_HINT, INCIDENT_STATUS, kindLabel, severityInfo } from "@/modules/range/types";
import { IncidentClose } from "@/modules/range/ui/incident-close";

export const metadata: Metadata = { title: "Vorfall" };

export default async function IncidentPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireRange();
  const { id } = await params;
  const inc = await getIncident(ctx.tenant.id, id);
  const isManager = ctx.can("range.manage");
  if (!inc || (!isManager && inc.reportedById !== ctx.user.id)) notFound();
  const sev = severityInfo(inc.severity);
  const st = INCIDENT_STATUS[inc.status] ?? INCIDENT_STATUS.OPEN!;

  return (
    <div className="space-y-4">
      <PageHeader
        title={kindLabel(inc.kind)}
        subtitle={formatDateTimeZurich(inc.occurredAt)}
        back={{ href: "/range/incidents", label: "Vorfälle" }}
        action={<LinkButton href={`/range/incidents/${inc.id}/print`} variant="secondary" size="sm" className="h-11" target="_blank" aria-label="Drucken"><Printer className="h-4 w-4" /></LinkButton>}
      />
      <div className="flex flex-wrap gap-1.5"><Badge tone={sev.tone}>Schwere: {sev.label}</Badge><Badge tone={st.tone}>{st.label}</Badge></div>
      <Card className="space-y-4 p-4 text-[15px]">
        {inc.location ? <Row label="Ort">{inc.location}</Row> : null}
        <Row label="Beschreibung">{inc.description}</Row>
        {inc.persons ? <Row label="Beteiligte Personen">{inc.persons}</Row> : null}
        {inc.measures && !isManager ? <Row label="Massnahmen">{inc.measures}</Row> : null}
        <Row label="Gemeldet von">{inc.reporterName ?? "–"} · {formatDateTimeZurich(inc.createdAt)}</Row>
      </Card>
      {isManager ? (
        <>
          <IncidentClose id={inc.id} measures={inc.measures} closed={inc.status === "CLOSED"} />
          {inc.status === "CLOSED" ? <ActionButton variant="ghost" className="w-full" action={reopenIncidentAction.bind(null, inc.id)}>Wieder öffnen</ActionButton> : null}
        </>
      ) : null}
      <p className="text-xs text-ink-3">{INCIDENT_HINT}</p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-ink-3">{label}</div>
      <div className="whitespace-pre-line">{children}</div>
    </div>
  );
}
