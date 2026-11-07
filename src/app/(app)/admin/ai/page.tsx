import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Gauge, KeyRound, Sparkles } from "lucide-react";
import { requirePermission } from "@/lib/tenant";
import { getRequestLocale } from "@/lib/i18n";
import { formatDateTime } from "@/lib/i18n/core";
import { LinkTabs, PageHeader, ProgressBar, SectionTitle, StatCard } from "@/components/ui";
import { TENANT_FEATURES } from "@/lib/ai/types";
import { aiT } from "@/modules/ai/settings/i18n";
import { fmtInt } from "@/modules/ai/settings/format";
import { aiAuditLog, tenantAiOverview } from "@/modules/ai/settings/service";
import { AiStatusBadge, aiStatusInfo } from "@/modules/ai/settings/ui/status-badge";
import { AiSettingsForm, ApiKeyCard, ClubSwitchCard } from "@/modules/ai/settings/ui/forms";
import { AiAuditList } from "@/modules/ai/settings/ui/audit-list";
import { limitPercent, pickMonth, recentMonths } from "@/modules/ai/usage/logic";
import { tenantUsageByRole, usageByFeature } from "@/modules/ai/usage/service";
import { UsageTableCard, monthLabel } from "@/modules/ai/usage/ui/usage-table";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: aiT(await getRequestLocale())("aiSet.admin.title") };
}

/**
 * KI-Einstellungen des Vereins. Bewusst ohne requireModule("ai"): Der Schalter auf dieser Seite
 * schaltet das Modul selbst ein (nach Zustimmung und mit gespeichertem Schlüssel).
 */
export default async function AdminAiPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const ctx = await requirePermission("tenant.manage");
  if (!ctx.can("ai.manage")) redirect("/?denied=1");
  const locale = await getRequestLocale();
  const t = aiT(locale);
  const sp = await searchParams;
  const months = recentMonths(6);
  const month = pickMonth(sp.month, new Date(), 5);
  const tenantId = ctx.tenant.id;

  const [overview, byFeature, byRole, auditItems] = await Promise.all([
    tenantAiOverview({ user: { id: ctx.user.id, isSuperAdmin: ctx.user.isSuperAdmin }, tenant: { id: tenantId, role: ctx.tenant.role } }),
    usageByFeature({ scope: "tenant", tenantId }, month),
    tenantUsageByRole(tenantId, month),
    aiAuditLog(tenantId),
  ]);
  const { settings, allowClubs, availability, usedTokens, consentByName } = overview;
  const status = aiStatusInfo(availability, locale);
  const pct = limitPercent(usedTokens, settings.monthlyTokenLimit);
  const enabled = settings.enabled && settings.moduleEnabled;
  const featureLabels = Object.fromEntries(TENANT_FEATURES.map((f) => [f, t(`aiSet.feature.${f}`)]));
  const roleLabels = Object.fromEntries(["OWNER", "ADMIN", "TRAINER", "MEMBER", "NONE"].map((r) => [r, t(`aiSet.role.${r}`)]));
  const monthLabels = Object.fromEntries(months.map((m) => [m, monthLabel(m, locale)]));
  const consentText = settings.consentAt
    ? t("aiSet.privacy.given", { date: formatDateTime(settings.consentAt, locale), name: consentByName ?? t("aiSet.privacy.unknownUser") })
    : null;

  return (
    <div>
      <PageHeader title={t("aiSet.admin.title")} subtitle={t("aiSet.admin.subtitle")} back={{ href: "/admin", label: t("aiSet.back.admin") }} action={<AiStatusBadge availability={availability} locale={locale} />} />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <StatCard className="col-span-2 sm:col-span-1" label={t("aiSet.stat.status")} value={status.label} tone={status.ready ? "ok" : "warn"} icon={<Sparkles className="h-4 w-4" />} hint={status.reason ?? undefined} />
        <StatCard label={t("aiSet.stat.key")} value={settings.keyHint ? `…${settings.keyHint}` : t("aiSet.stat.keyNone")} tone={settings.hasKey ? "neutral" : "warn"} icon={<KeyRound className="h-4 w-4" />} />
        <StatCard
          label={t("aiSet.stat.usage")}
          value={fmtInt(usedTokens, locale)}
          icon={<Gauge className="h-4 w-4" />}
          tone={pct != null && pct >= 90 ? "warn" : "neutral"}
          hint={settings.monthlyTokenLimit ? t("aiSet.usage.limitOf", { used: fmtInt(usedTokens, locale), limit: fmtInt(settings.monthlyTokenLimit, locale) }) : t("aiSet.budget.none")}
        />
      </div>
      {pct != null ? <ProgressBar className="mt-3" value={pct} label={t("aiSet.budget.limitLabel")} tone={pct >= 90 ? "warn" : "accent"} /> : null}

      <SectionTitle>{t("aiSet.club.section")}</SectionTitle>
      <ClubSwitchCard locale={locale} enabled={enabled} allowClubs={allowClubs} hasKey={settings.hasKey} consentGiven={!!settings.consentAt} consentText={consentText} />

      <SectionTitle>{t("aiSet.key.section")}</SectionTitle>
      <ApiKeyCard scope="tenant" hasKey={settings.hasKey} keyHint={settings.keyHint} locale={locale} />

      <SectionTitle>{t("aiSet.settings.section")}</SectionTitle>
      <AiSettingsForm scope="tenant" locale={locale} model={settings.model} features={settings.features} memberAccess={settings.memberAccess} monthlyTokenLimit={settings.monthlyTokenLimit} />

      <SectionTitle>{t("aiSet.usage.section")}</SectionTitle>
      <LinkTabs
        className="mb-3"
        label={t("aiSet.usage.pickMonth")}
        active={month}
        items={months.map((m) => ({ value: m, href: `/admin/ai?month=${m}`, label: monthLabels[m] }))}
      />
      <h3 className="mb-2 text-sm font-medium text-ink-2">{t("aiSet.usage.byFeature")} · {monthLabels[month]}</h3>
      <UsageTableCard table={byFeature} firstColumn={t("aiSet.usage.feature")} labels={featureLabels} locale={locale} />
      <h3 className="mb-2 mt-5 text-sm font-medium text-ink-2">{t("aiSet.usage.byRole")} · {monthLabels[month]}</h3>
      <UsageTableCard table={byRole} firstColumn={t("aiSet.usage.role")} labels={roleLabels} locale={locale} />
      <p className="mt-2 text-xs text-ink-3">{t("aiSet.usage.roleNote")} {t("aiSet.usage.estimateNote")}</p>

      <SectionTitle>{t("aiSet.audit.section")}</SectionTitle>
      <AiAuditList items={auditItems} locale={locale} />
    </div>
  );
}
