import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus, ShieldCheck } from "lucide-react";
import { Badge, Card, EmptyState, LinkButton, LinkTabs, PageHeader } from "@/components/ui";
import { formatDateTime, getRequestLocale, getT } from "@/lib/i18n";
import { requireRange } from "@/modules/range/guard";
import { listIncidents } from "@/modules/range/queries";
import { incidentStatusInfo, kindLabel, severityInfo } from "@/modules/range/types";
import { rangeTabs } from "@/modules/range/nav";
import { RangeTabs } from "@/modules/range/ui/range-tabs";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("shooting.range.tab./range/incidents") };
}

export default async function IncidentsPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const ctx = await requireRange();
  const sp = await searchParams;
  const isManager = ctx.can("range.manage");
  const locale = await getRequestLocale();
  const t = getT(locale);
  const filter = isManager ? (sp.f === "closed" ? "closed" : sp.f === "all" ? "all" : "open") : "mine";
  const rows = await listIncidents(ctx.tenant.id, {
    reportedById: isManager ? undefined : ctx.user.id,
    status: filter === "open" ? "OPEN" : filter === "closed" ? "CLOSED" : undefined,
    deletedLabel: t("adm2.common.deletedAccount"),
  });

  return (
    <div className="space-y-4">
      <PageHeader title={t("shooting.range.tab./range/incidents")} subtitle={t(isManager ? "shooting.incident.subtitleAll" : "shooting.incident.subtitleMine")} action={<LinkButton href="/range/incidents/new" size="sm" className="h-11"><Plus className="h-4 w-4" /> {t("shooting.incident.report")}</LinkButton>} />
      <RangeTabs tabs={rangeTabs({ duty: ctx.can("range.duty"), manage: isManager })} locale={locale} />
      {isManager ? (
        <LinkTabs active={filter} label={t("shooting.incident.filter")} items={[{ value: "open", href: "/range/incidents", label: t("shooting.incident.status.OPEN") }, { value: "closed", href: "/range/incidents?f=closed", label: t("shooting.incident.status.CLOSED") }, { value: "all", href: "/range/incidents?f=all", label: t("shooting.incident.filter.all") }]} />
      ) : null}
      {rows.length ? (
        <Card className="animate-rise divide-y divide-line overflow-hidden">
          {rows.map((r) => {
            const sev = severityInfo(r.severity, t);
            const st = incidentStatusInfo(r.status, t);
            return (
              <Link key={r.id} href={`/range/incidents/${r.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-surface-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{kindLabel(r.kind, t)}{r.location ? ` · ${r.location}` : ""}</div>
                  <div className="truncate text-xs text-ink-3">{formatDateTime(r.occurredAt, locale)}{r.reporterName ? ` · ${r.reporterName}` : ""}</div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge tone={sev.tone}>{sev.label}</Badge>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
              </Link>
            );
          })}
        </Card>
      ) : (
        <EmptyState icon={<ShieldCheck className="h-5 w-5" />} title={t("shooting.incident.empty.title")} text={t("shooting.incident.empty.text")} action={<LinkButton href="/range/incidents/new">{t("shooting.incident.new")}</LinkButton>} />
      )}
      <p className="text-xs text-ink-3">{t("shooting.incident.hint")}</p>
    </div>
  );
}
