import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, FileInput, History, ListChecks, Play, Star, Trophy } from "lucide-react";
import { requireModule } from "@/lib/tenant";
import { Card, EmptyState, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { listMatches, listPrograms } from "@/modules/scores/queries";
import { ProgramCard } from "@/modules/scores/ui/program-card";
import { MatchRow } from "@/modules/scores/ui/match-row";
import { getRequestLocale, getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("shooting.common.shooting") };
}

export default async function ScoresPage() {
  const ctx = await requireModule("scores");
  const locale = await getRequestLocale();
  const t = getT(locale);
  const [programs, open, recent] = await Promise.all([
    listPrograms(ctx),
    listMatches(ctx, { status: "OPEN", limit: 10 }),
    listMatches(ctx, { status: "FINISHED", limit: 5 }),
  ]);
  const favorites = programs.filter((p) => p.favorite);
  // Resultat-Import schreibt Resultate anderer Mitglieder: nur Trainer und Vorstand
  const canImport = ctx.can("match.viewAll") || ctx.can("tenant.programs.manage");

  return (
    <div>
      <PageHeader title={t("shooting.common.shooting")} subtitle={t("shooting.overview.subtitle")} action={
          ctx.can("match.create") || canImport ? (
            <div className="flex gap-2">
              {canImport ? <LinkButton href="/scores/import" variant="secondary" size="sm" aria-label={t("shooting.overview.importAria")}><FileInput className="h-4 w-4" /> <span className="hidden sm:inline">{t("shooting.overview.import")}</span></LinkButton> : null}
              {ctx.can("match.create") ? <LinkButton href="/scores/matches/new" size="sm"><Play className="h-4 w-4" /> {t("shooting.common.start")}</LinkButton> : null}
            </div>
          ) : null
        } />

      <nav aria-label={t("shooting.overview.areas")} className="stagger grid grid-cols-4 gap-2 mb-2">
        <Tile href="/scores/programs" icon={<ListChecks className="h-5 w-5" />} label={t("shooting.common.programs")} />
        <Tile href="/scores/matches" icon={<History className="h-5 w-5" />} label={t("shooting.common.matches")} />
        <Tile href="/scores/leaderboard" icon={<Trophy className="h-5 w-5" />} label={t("shooting.common.leaderboard")} />
        <Tile href="/scores/stats" icon={<BarChart3 className="h-5 w-5" />} label={t("shooting.common.stats")} />
      </nav>

      {open.length ? (
        <>
          <SectionTitle>{t("shooting.common.open")}</SectionTitle>
          <div className="stagger space-y-2.5">
            {open.map((m) => <MatchRow key={m.id} m={m} locale={locale} />)}
          </div>
        </>
      ) : null}

      <SectionTitle action={<Link href="/scores/programs" className="text-xs text-ink-3 hover:text-ink">{t("shooting.filters.allPrograms")}</Link>}>{t("shooting.programs.favorites")}</SectionTitle>
      {favorites.length ? (
        <div className="stagger grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {favorites.map((p) => <ProgramCard key={p.id} program={p} href={ctx.can("match.create") && !p.isArchived ? `/scores/matches/new?programId=${p.id}` : `/scores/programs/${p.id}`} locale={locale} />)}
        </div>
      ) : (
        <EmptyState icon={<Star className="h-5 w-5" />} title={t("shooting.overview.noFavorites")} text={t("shooting.overview.noFavoritesText")} action={<LinkButton href="/scores/programs" variant="secondary" size="sm">{t("shooting.common.programs")}</LinkButton>} />
      )}

      <SectionTitle action={<Link href="/scores/matches" className="text-xs text-ink-3 hover:text-ink">{t("shooting.common.all")}</Link>}>{t("shooting.overview.recent")}</SectionTitle>
      {recent.length ? (
        <div className="stagger space-y-2.5">
          {recent.map((m) => <MatchRow key={m.id} m={m} againFor={ctx.can("match.create") ? ctx.user.id : undefined} locale={locale} />)}
        </div>
      ) : (
        <p className="text-sm text-ink-3">{t("shooting.overview.noRecent")}</p>
      )}
    </div>
  );
}

function Tile({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="press">
      <Card className="flex h-full flex-col items-center justify-center gap-1 px-1 py-3.5 text-center hover:border-ink/30">
        <span className="text-ink-2" aria-hidden>{icon}</span>
        <span className="text-[11px] font-medium leading-tight sm:text-xs">{label}</span>
      </Card>
    </Link>
  );
}
