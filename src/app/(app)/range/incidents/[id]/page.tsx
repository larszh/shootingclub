import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Printer } from "lucide-react";
import { ActionButton } from "@/components/ui/action-button";
import { Badge, Card, LinkButton, PageHeader } from "@/components/ui";
import { formatDateTime, getRequestLocale, getT } from "@/lib/i18n";
import { requireRange } from "@/modules/range/guard";
import { getIncident } from "@/modules/range/queries";
import { reopenIncidentAction } from "@/modules/range/actions";
import { incidentStatusInfo, kindLabel, severityInfo } from "@/modules/range/types";
import { IncidentClose } from "@/modules/range/ui/incident-close";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("shooting.incident.single") };
}

export default async function IncidentPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireRange();
  const { id } = await params;
  const locale = await getRequestLocale();
  const t = getT(locale);
  const inc = await getIncident(ctx.tenant.id, id, t("adm2.common.deletedAccount"));
  const isManager = ctx.can("range.manage");
  if (!inc || (!isManager && inc.reportedById !== ctx.user.id)) notFound();
  const sev = severityInfo(inc.severity, t);
  const st = incidentStatusInfo(inc.status, t);

  return (
    <div className="space-y-4">
      <PageHeader
        title={kindLabel(inc.kind, t)}
        subtitle={formatDateTime(inc.occurredAt, locale)}
        back={{ href: "/range/incidents", label: t("shooting.range.tab./range/incidents") }}
        action={<LinkButton href={`/range/incidents/${inc.id}/print`} variant="secondary" size="sm" className="h-11" target="_blank" aria-label={t("shooting.range.print")}><Printer className="h-4 w-4" /></LinkButton>}
      />
      <div className="flex flex-wrap gap-1.5"><Badge tone={sev.tone}>{t("shooting.incident.severityLabel", { label: sev.label })}</Badge><Badge tone={st.tone}>{st.label}</Badge></div>
      <Card className="space-y-4 p-4 text-[15px]">
        {inc.location ? <Row label={t("shooting.incident.field.location")}>{inc.location}</Row> : null}
        <Row label={t("shooting.incident.field.descriptionShort")}>{inc.description}</Row>
        {inc.persons ? <Row label={t("shooting.incident.field.personsShort")}>{inc.persons}</Row> : null}
        {inc.measures && !isManager ? <Row label={t("shooting.incident.field.measuresShort")}>{inc.measures}</Row> : null}
        <Row label={t("shooting.incident.field.reportedBy")}>{inc.reporterName ?? "–"} · {formatDateTime(inc.createdAt, locale)}</Row>
      </Card>
      {isManager ? (
        <>
          <IncidentClose id={inc.id} measures={inc.measures} closed={inc.status === "CLOSED"} />
          {inc.status === "CLOSED" ? <ActionButton variant="ghost" className="w-full" action={reopenIncidentAction.bind(null, inc.id)}>{t("shooting.incident.reopen")}</ActionButton> : null}
        </>
      ) : null}
      <p className="text-xs text-ink-3">{t("shooting.incident.hint")}</p>
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
