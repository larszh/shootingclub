import type { Metadata } from "next";
import { requireModule } from "@/lib/tenant";
import { PageHeader } from "@/components/ui";
import { listPrograms, listTenantMembers } from "@/modules/scores/queries";
import { MatchSetup } from "@/modules/scores/ui/match-setup";
import { todayZurich } from "@/lib/time";
import { getRequestLocale, getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("shooting.matches.startMatch") };
}

export default async function NewMatchPage({ searchParams }: { searchParams: Promise<{ programId?: string; with?: string }> }) {
  const ctx = await requireModule("scores");
  const locale = await getRequestLocale();
  const t = getT(locale);
  const { programId, with: withRaw } = await searchParams;
  const [programs, members] = await Promise.all([listPrograms(ctx), listTenantMembers(ctx.tenant.id)]);
  // «Nochmals»: Gegner aus dem letzten Durchgang vorauswählen (nur echte Mitglieder dieses Vereins).
  const initialParticipantIds = (typeof withRaw === "string" ? withRaw : "").split(",").filter((id) => id && id !== ctx.user.id && members.some((m) => m.id === id)).slice(0, 19);
  return (
    <div>
      <PageHeader title={t("shooting.matches.startMatch")} subtitle={t("shooting.matches.startSubtitle")} back={{ href: "/scores", label: t("shooting.common.shooting") }} />
      <MatchSetup
        programs={programs.map((p) => ({ id: p.id, name: p.name, discipline: p.discipline, scoringMode: p.scoringMode, stages: p.stages, totals: p.totals, favorite: p.favorite }))}
        members={members.filter((m) => m.id !== ctx.user.id).map((m) => ({ id: m.id, name: m.name, avatarUrl: m.avatarUrl }))}
        me={{ id: ctx.user.id, name: ctx.user.name, avatarUrl: ctx.user.avatarUrl }}
        tenantId={ctx.tenant.id}
        tenantName={ctx.tenant.name}
        today={todayZurich()}
        initialProgramId={programId}
        initialParticipantIds={initialParticipantIds}
        locale={locale}
      />
    </div>
  );
}
