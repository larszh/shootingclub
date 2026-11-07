import type { Metadata } from "next";
import { Gauge, KeyRound, Sparkles, Wallet } from "lucide-react";
import { requireSuperAdmin } from "@/lib/tenant";
import { getRequestLocale } from "@/lib/i18n";
import { LinkTabs, PageHeader, SectionTitle, StatCard } from "@/components/ui";
import { PLATFORM_FEATURES } from "@/lib/ai/types";
import { aiT } from "@/modules/ai/settings/i18n";
import { fmtChf, fmtInt } from "@/modules/ai/settings/format";
import { aiAuditLog, platformAiOverview } from "@/modules/ai/settings/service";
import { AiStatusBadge, aiStatusInfo } from "@/modules/ai/settings/ui/status-badge";
import { AiSettingsForm, ApiKeyCard, PlatformSwitches } from "@/modules/ai/settings/ui/forms";
import { AiAuditList } from "@/modules/ai/settings/ui/audit-list";
import { chfForTokens, limitPercent, pickMonth, recentMonths } from "@/modules/ai/usage/logic";
import { clubUsageTotals, usageByFeature, usageByMonth } from "@/modules/ai/usage/service";
import { UsageTableCard, monthLabel } from "@/modules/ai/usage/ui/usage-table";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: aiT(await getRequestLocale())("aiSet.super.title") };
}

export default async function SuperAiPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requireSuperAdmin();
  const locale = await getRequestLocale();
  const t = aiT(locale);
  const sp = await searchParams;
  const months = recentMonths(6);
  const month = pickMonth(sp.month, new Date(), 5);

  const [{ settings, availability, usedTokens }, byFeature, byMonth, clubs, auditItems] = await Promise.all([
    platformAiOverview(),
    usageByFeature({ scope: "platform" }, month),
    usageByMonth({ scope: "platform" }, months),
    clubUsageTotals(month),
    aiAuditLog(null),
  ]);
  const status = aiStatusInfo(availability, locale);
  const pct = limitPercent(usedTokens, settings.monthlyTokenLimit);
  const featureLabels = Object.fromEntries(PLATFORM_FEATURES.map((f) => [f, t(`aiSet.feature.${f}`)]));
  const monthLabels = Object.fromEntries(months.map((m) => [m, monthLabel(m, locale)]));
  const clubLabels = Object.fromEntries(clubs.rows.map((c) => [c.tenantId, c.name]));

  return (
    <div>
      <PageHeader title={t("aiSet.super.title")} subtitle={t("aiSet.super.subtitle")} back={{ href: "/super", label: t("aiSet.back.super") }} action={<AiStatusBadge availability={availability} locale={locale} />} />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatCard label={t("aiSet.stat.status")} value={status.label} tone={status.ready ? "ok" : "warn"} icon={<Sparkles className="h-4 w-4" />} hint={status.reason ?? undefined} />
        <StatCard label={t("aiSet.stat.key")} value={settings.keyHint ? `…${settings.keyHint}` : t("aiSet.stat.keyNone")} tone={settings.hasKey ? "neutral" : "warn"} icon={<KeyRound className="h-4 w-4" />} />
        <StatCard label={t("aiSet.stat.usage")} value={fmtInt(usedTokens, locale)} icon={<Gauge className="h-4 w-4" />} hint={pct != null ? `${pct} %` : undefined} tone={pct != null && pct >= 90 ? "warn" : "neutral"} />
        <StatCard
          label={t("aiSet.stat.budget")}
          value={settings.monthlyTokenLimit ? `${t("aiSet.usage.chf")} ${fmtChf(chfForTokens(settings.monthlyTokenLimit, settings.model), locale)}` : t("aiSet.budget.none")}
          hint={settings.monthlyTokenLimit ? t("aiSet.usage.limitOf", { used: fmtInt(usedTokens, locale), limit: fmtInt(settings.monthlyTokenLimit, locale) }) : undefined}
          icon={<Wallet className="h-4 w-4" />}
        />
      </div>

      <SectionTitle>{t("aiSet.platform.section")}</SectionTitle>
      <PlatformSwitches enabled={settings.enabled} allowClubs={settings.allowClubs} locale={locale} />

      <SectionTitle>{t("aiSet.key.section")}</SectionTitle>
      <ApiKeyCard scope="platform" hasKey={settings.hasKey} keyHint={settings.keyHint} locale={locale} />

      <SectionTitle>{t("aiSet.settings.section")}</SectionTitle>
      <AiSettingsForm scope="platform" locale={locale} model={settings.model} features={settings.features} monthlyTokenLimit={settings.monthlyTokenLimit} />

      <SectionTitle>{t("aiSet.usage.section")}</SectionTitle>
      <LinkTabs
        className="mb-3"
        label={t("aiSet.usage.pickMonth")}
        active={month}
        items={months.map((m) => ({ value: m, href: `/super/ai?month=${m}`, label: monthLabels[m] }))}
      />
      <h3 className="mb-2 text-sm font-medium text-ink-2">{t("aiSet.usage.byFeature")} · {monthLabels[month]}</h3>
      <UsageTableCard table={byFeature} firstColumn={t("aiSet.usage.feature")} labels={featureLabels} locale={locale} />

      <h3 className="mb-2 mt-5 text-sm font-medium text-ink-2">{t("aiSet.usage.clubs")} · {monthLabels[month]}</h3>
      <p className="mb-2 text-xs text-ink-3">{t("aiSet.usage.clubsHint")}</p>
      <UsageTableCard
        table={{ rows: clubs.rows.map((c) => ({ key: c.tenantId, requests: c.requests, failed: c.failed, tokens: c.tokens, chf: c.chf })), total: { key: "total", ...clubs.total } }}
        firstColumn={t("aiSet.usage.club")}
        labels={clubLabels}
        locale={locale}
        emptyText={t("aiSet.usage.clubsEmpty")}
      />

      <h3 className="mb-2 mt-5 text-sm font-medium text-ink-2">{t("aiSet.usage.byMonth")}</h3>
      <UsageTableCard table={byMonth} firstColumn={t("aiSet.usage.month")} labels={monthLabels} locale={locale} emptyText={t("aiSet.usage.monthsEmpty")} />
      <p className="mt-2 text-xs text-ink-3">{t("aiSet.usage.estimateNote")}</p>

      <SectionTitle>{t("aiSet.audit.section")}</SectionTitle>
      <AiAuditList items={auditItems} locale={locale} />
    </div>
  );
}
