import type { Metadata } from "next";
import { CheckCircle2, ScrollText } from "lucide-react";
import { ActionButton } from "@/components/ui/action-button";
import { Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { formatDate, formatDateTime, getRequestLocale, getT } from "@/lib/i18n";
import { db } from "@/lib/db";
import { requireRange } from "@/modules/range/guard";
import { getActiveRules } from "@/modules/range/queries";
import { acceptRulesAction } from "@/modules/range/actions";
import { rangeTabs } from "@/modules/range/nav";
import { RangeTabs } from "@/modules/range/ui/range-tabs";
import { RulesBody } from "@/modules/range/ui/rules-body";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("shooting.range.tab./range/rules") };
}

export default async function RangeRulesPage() {
  const ctx = await requireRange();
  const rules = await getActiveRules(ctx.tenant.id);
  const acceptance = rules ? await db.rulesAcceptance.findUnique({ where: { rulesId_userId: { rulesId: rules.id, userId: ctx.user.id } } }) : null;
  const isManager = ctx.can("range.manage");
  const locale = await getRequestLocale();
  const t = getT(locale);
  return (
    <div className="space-y-4">
      <PageHeader title={t("shooting.range.tab./range/rules")} subtitle={ctx.tenant.name} action={isManager ? <LinkButton href="/admin/range/rules" variant="secondary" size="sm" className="h-11">{t("shooting.rules.edit")}</LinkButton> : undefined} />
      <RangeTabs tabs={rangeTabs({ duty: ctx.can("range.duty"), manage: isManager })} locale={locale} />
      {rules ? (
        <>
          <Card className="animate-rise p-4 sm:p-6">
            <div className="mb-3 text-xs text-ink-3">{t("shooting.rules.version", { n: rules.version })}{rules.publishedAt ? t("shooting.rules.validSince", { date: formatDate(rules.publishedAt, locale) }) : ""}</div>
            <h2 className="mb-3 text-xl font-semibold">{rules.title}</h2>
            <RulesBody body={rules.body} />
          </Card>
          {acceptance ? (
            <Card className="flex items-center gap-3 p-4 text-ok"><CheckCircle2 className="h-6 w-6 shrink-0" aria-hidden /><span className="text-sm">{t("shooting.rules.acceptedOn", { date: formatDateTime(acceptance.acceptedAt, locale) })}</span></Card>
          ) : (
            <ActionButton size="lg" className="h-14 w-full" action={acceptRulesAction.bind(null, rules.id)}>{t("shooting.rules.accept")}</ActionButton>
          )}
        </>
      ) : (
        <EmptyState icon={<ScrollText className="h-5 w-5" />} title={t("shooting.rules.none")} text={t(isManager ? "shooting.rules.noneManager" : "shooting.rules.noneMember")} />
      )}
    </div>
  );
}
