import type { Metadata } from "next";
import { Badge, Card, PageHeader, ProgressBar, SectionTitle } from "@/components/ui";
import { formatDateTimeZurich } from "@/lib/time";
import { requireRangeAdmin } from "@/modules/range/guard";
import { listRulesVersions, rulesAcceptanceStats } from "@/modules/range/queries";
import { ADMIN_RANGE_TABS } from "@/modules/range/nav";
import { RangeTabs } from "@/modules/range/ui/range-tabs";
import { NewRulesDraftButton, RulesEditor } from "@/modules/range/ui/rules-editor";
import { CHECK_HINT } from "@/modules/range/types";
import { fmtDay } from "@/modules/range/format";

export const metadata: Metadata = { title: "Standordnung verwalten" };

export default async function AdminRangeRulesPage() {
  const ctx = await requireRangeAdmin();
  const versions = await listRulesVersions(ctx.tenant.id);
  const draft = versions.find((v) => !v.publishedAt);
  const active = versions.find((v) => v.isActive);
  const stats = active ? await rulesAcceptanceStats(ctx.tenant.id, active.id) : null;

  return (
    <div className="space-y-4">
      <PageHeader title="Standordnung" subtitle="Versionen und Bestätigungen" back={{ href: "/admin", label: "Einstellungen" }} />
      <RangeTabs tabs={ADMIN_RANGE_TABS} label="Standbetrieb einrichten" />

      {draft ? <RulesEditor key={draft.id} draft={{ id: draft.id, version: draft.version, title: draft.title, body: draft.body }} /> : <NewRulesDraftButton hasActive={!!active} />}

      {active && stats ? (
        <>
          <SectionTitle>Bestätigungen Version {active.version}</SectionTitle>
          <Card className="space-y-3 p-4">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-2xl font-semibold tabular-nums">{stats.done.length} / {stats.total}</span>
              <span className="text-sm text-ink-3">aktive Mitglieder haben bestätigt</span>
            </div>
            <ProgressBar value={stats.done.length} max={Math.max(1, stats.total)} label="Bestätigt" tone="ok" />
            <details className="group">
              <summary className="flex min-h-11 cursor-pointer list-none items-center text-sm font-medium">Noch nicht bestätigt ({stats.missing.length}) <span className="ml-1 transition-transform group-open:rotate-90" aria-hidden>›</span></summary>
              <ul className="mt-1 columns-1 text-sm text-ink-2 sm:columns-2">{stats.missing.map((m) => <li key={m.id} className="py-0.5">{m.name}</li>)}</ul>
            </details>
            <details className="group">
              <summary className="flex min-h-11 cursor-pointer list-none items-center text-sm font-medium">Bestätigt ({stats.done.length}) <span className="ml-1 transition-transform group-open:rotate-90" aria-hidden>›</span></summary>
              <ul className="mt-1 text-sm text-ink-2">{stats.done.map((m) => <li key={m.id} className="flex justify-between gap-2 py-0.5"><span>{m.name}</span><span className="text-ink-3">{formatDateTimeZurich(m.acceptedAt)}</span></li>)}</ul>
            </details>
          </Card>
        </>
      ) : null}

      <SectionTitle>Versionen</SectionTitle>
      {versions.length ? (
        <Card className="divide-y divide-line overflow-hidden">
          {versions.map((v) => (
            <div key={v.id} className="flex min-h-14 items-center gap-3 px-4 py-2.5">
              <span className="w-10 shrink-0 text-sm font-semibold tabular-nums text-ink-3">v{v.version}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{v.title}</div>
                <div className="text-xs text-ink-3">{v.publishedAt ? `veröffentlicht ${fmtDay(v.publishedAt, { weekday: undefined })} · ${v._count.acceptances} Bestätigungen` : "Entwurf"}</div>
              </div>
              {v.isActive ? <Badge tone="ok">gültig</Badge> : v.publishedAt ? <Badge tone="outline">archiviert</Badge> : <Badge tone="accent">Entwurf</Badge>}
            </div>
          ))}
        </Card>
      ) : <p className="text-sm text-ink-3">Noch keine Version erfasst.</p>}

      <p className="text-xs text-ink-3">Die Standordnung legt der Verein fest. Inhalte bitte mit den Vorgaben der Gemeinde, des Kantons und der Verbände abgleichen. {CHECK_HINT}</p>
    </div>
  );
}
