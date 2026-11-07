import type { Metadata } from "next";
import { getRequestLocale, getT } from "@/lib/i18n";
import { Badge, Card, PageHeader, ProgressBar, SectionTitle } from "@/components/ui";
import { formatDateTime } from "@/lib/i18n/core";
import { requireRangeAdmin } from "@/modules/range/guard";
import { listRulesVersions, rulesAcceptanceStats } from "@/modules/range/queries";
import { ADMIN_RANGE_TABS } from "@/modules/range/nav";
import { RangeTabs } from "@/modules/range/ui/range-tabs";
import { NewRulesDraftButton, RulesEditor } from "@/modules/range/ui/rules-editor";
import { fmtDay } from "@/modules/range/format";
import { ContentTranslations } from "@/modules/ai/content/ui/content-translations";

export async function generateMetadata(): Promise<Metadata> {
  const t = getT(await getRequestLocale());
  return { title: t("adm2.range.rules.metaTitle") };
}

export default async function AdminRangeRulesPage() {
  const ctx = await requireRangeAdmin();
  const locale = await getRequestLocale();
  const t = getT(locale);
  const versions = await listRulesVersions(ctx.tenant.id);
  const draft = versions.find((v) => !v.publishedAt);
  const active = versions.find((v) => v.isActive);
  const stats = active ? await rulesAcceptanceStats(ctx.tenant.id, active.id) : null;

  return (
    <div className="space-y-4">
      <PageHeader title={t("adm2.range.tab.rules")} subtitle={t("adm2.range.rules.subtitle")} back={{ href: "/admin", label: t("adm2.common.settings") }} />
      <RangeTabs tabs={ADMIN_RANGE_TABS} label={t("adm2.range.setupTitle")} />

      {draft ? <RulesEditor key={draft.id} draft={{ id: draft.id, version: draft.version, title: draft.title, body: draft.body }} /> : <NewRulesDraftButton hasActive={!!active} />}

      {draft ? <ContentTranslations ctx={ctx} type="rangeRules" id={draft.id} title={t("aicontent.tr.rulesDraftTitle", { n: draft.version })} /> : null}
      {active ? <ContentTranslations ctx={ctx} type="rangeRules" id={active.id} title={t("aicontent.tr.rulesActiveTitle", { n: active.version })} /> : null}

      {active && stats ? (
        <>
          <SectionTitle>{t("adm2.range.rules.confirmations", { n: active.version })}</SectionTitle>
          <Card className="space-y-3 p-4">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-2xl font-semibold tabular-nums">{stats.done.length} / {stats.total}</span>
              <span className="text-sm text-ink-3">{t("adm2.range.rules.haveConfirmed")}</span>
            </div>
            <ProgressBar value={stats.done.length} max={Math.max(1, stats.total)} label={t("adm2.range.rules.confirmed")} tone="ok" />
            <details className="group">
              <summary className="flex min-h-11 cursor-pointer list-none items-center text-sm font-medium">{t("adm2.range.rules.missingN", { n: stats.missing.length })} <span className="ml-1 transition-transform group-open:rotate-90" aria-hidden>›</span></summary>
              <ul className="mt-1 columns-1 text-sm text-ink-2 sm:columns-2">{stats.missing.map((m) => <li key={m.id} className="py-0.5">{m.name}</li>)}</ul>
            </details>
            <details className="group">
              <summary className="flex min-h-11 cursor-pointer list-none items-center text-sm font-medium">{t("adm2.range.rules.confirmedN", { n: stats.done.length })} <span className="ml-1 transition-transform group-open:rotate-90" aria-hidden>›</span></summary>
              <ul className="mt-1 text-sm text-ink-2">{stats.done.map((m) => <li key={m.id} className="flex justify-between gap-2 py-0.5"><span>{m.name}</span><span className="text-ink-3">{formatDateTime(m.acceptedAt, locale)}</span></li>)}</ul>
            </details>
          </Card>
        </>
      ) : null}

      <SectionTitle>{t("adm2.range.rules.versions")}</SectionTitle>
      {versions.length ? (
        <Card className="divide-y divide-line overflow-hidden">
          {versions.map((v) => (
            <div key={v.id} className="flex min-h-14 items-center gap-3 px-4 py-2.5">
              <span className="w-10 shrink-0 text-sm font-semibold tabular-nums text-ink-3">v{v.version}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{v.title}</div>
                <div className="text-xs text-ink-3">{v.publishedAt ? t("adm2.range.rules.publishedInfo", { date: fmtDay(v.publishedAt, { weekday: undefined }, locale), n: v._count.acceptances }) : t("adm2.range.rules.draft")}</div>
              </div>
              {v.isActive ? <Badge tone="ok">{t("adm2.range.rules.valid")}</Badge> : v.publishedAt ? <Badge tone="outline">{t("adm2.range.rules.archived")}</Badge> : <Badge tone="accent">{t("adm2.range.rules.draft")}</Badge>}
            </div>
          ))}
        </Card>
      ) : <p className="text-sm text-ink-3">{t("adm2.range.rules.noVersion")}</p>}

      <p className="text-xs text-ink-3">{t("adm2.range.rules.footer")} {t("adm2.common.checkHint")}</p>
    </div>
  );
}
