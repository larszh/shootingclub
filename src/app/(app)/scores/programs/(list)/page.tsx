import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { requireModule } from "@/lib/tenant";
import { EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { listPrograms } from "@/modules/scores/queries";
import { programUsageCounts } from "@/modules/scores/insights";
import { ProgramList } from "@/modules/scores/ui/program-list";
import { getRequestLocale, getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("shooting.common.programs") };
}

export default async function ProgramsPage() {
  const ctx = await requireModule("scores");
  const locale = await getRequestLocale();
  const t = getT(locale);
  const canManage = ctx.can("tenant.programs.manage");
  const [programs, usage] = await Promise.all([listPrograms(ctx, { includeHidden: canManage }), programUsageCounts(ctx.tenant.id)]);

  return (
    <div>
      <PageHeader title={t("shooting.common.programs")} subtitle={t("shooting.programs.subtitle")} back={{ href: "/scores", label: t("shooting.common.shooting") }}
        action={canManage ? <LinkButton href="/scores/programs/new" size="sm"><Plus className="h-4 w-4" /> {t("shooting.programs.new")}</LinkButton> : null} />
      {programs.length ? (
        <ProgramList programs={programs} showHidden={canManage} usage={usage} locale={locale} />
      ) : (
        <EmptyState title={t("shooting.programs.none")} text={t("shooting.programs.noneText")} action={canManage ? <LinkButton href="/scores/programs/new" size="sm">{t("shooting.programs.create")}</LinkButton> : null} />
      )}
    </div>
  );
}
