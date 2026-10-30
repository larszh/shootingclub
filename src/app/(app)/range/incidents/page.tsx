import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus, ShieldCheck } from "lucide-react";
import { Badge, Card, EmptyState, LinkButton, LinkTabs, PageHeader } from "@/components/ui";
import { formatDateTimeZurich } from "@/lib/time";
import { requireRange } from "@/modules/range/guard";
import { listIncidents } from "@/modules/range/queries";
import { INCIDENT_HINT, INCIDENT_STATUS, kindLabel, severityInfo } from "@/modules/range/types";
import { rangeTabs } from "@/modules/range/nav";
import { RangeTabs } from "@/modules/range/ui/range-tabs";

export const metadata: Metadata = { title: "Vorfälle" };

export default async function IncidentsPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const ctx = await requireRange();
  const sp = await searchParams;
  const isManager = ctx.can("range.manage");
  const filter = isManager ? (sp.f === "closed" ? "closed" : sp.f === "all" ? "all" : "open") : "mine";
  const rows = await listIncidents(ctx.tenant.id, {
    reportedById: isManager ? undefined : ctx.user.id,
    status: filter === "open" ? "OPEN" : filter === "closed" ? "CLOSED" : undefined,
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Vorfälle" subtitle={isManager ? "Alle Meldungen des Vereins" : "Deine Meldungen"} action={<LinkButton href="/range/incidents/new" size="sm" className="h-11"><Plus className="h-4 w-4" /> Melden</LinkButton>} />
      <RangeTabs tabs={rangeTabs({ duty: ctx.can("range.duty"), manage: isManager })} />
      {isManager ? (
        <LinkTabs active={filter} label="Vorfälle filtern" items={[{ value: "open", href: "/range/incidents", label: "Offen" }, { value: "closed", href: "/range/incidents?f=closed", label: "Abgeschlossen" }, { value: "all", href: "/range/incidents?f=all", label: "Alle" }]} />
      ) : null}
      {rows.length ? (
        <Card className="animate-rise divide-y divide-line overflow-hidden">
          {rows.map((r) => {
            const sev = severityInfo(r.severity);
            const st = INCIDENT_STATUS[r.status] ?? INCIDENT_STATUS.OPEN!;
            return (
              <Link key={r.id} href={`/range/incidents/${r.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-surface-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{kindLabel(r.kind)}{r.location ? ` · ${r.location}` : ""}</div>
                  <div className="truncate text-xs text-ink-3">{formatDateTimeZurich(r.occurredAt)}{r.reporterName ? ` · ${r.reporterName}` : ""}</div>
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
        <EmptyState icon={<ShieldCheck className="h-5 w-5" />} title="Keine Vorfälle" text="Beinahe-Unfälle zu melden hilft, Unfälle zu verhindern." action={<LinkButton href="/range/incidents/new">Vorfall melden</LinkButton>} />
      )}
      <p className="text-xs text-ink-3">{INCIDENT_HINT}</p>
    </div>
  );
}
