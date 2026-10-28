import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, History, ListChecks, Play, Star, Trophy } from "lucide-react";
import { requireModule } from "@/lib/tenant";
import { Card, EmptyState, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { listMatches, listPrograms } from "@/modules/scores/queries";
import { ProgramCard } from "@/modules/scores/ui/program-card";
import { MatchRow } from "@/modules/scores/ui/match-row";

export const metadata: Metadata = { title: "Schiessen" };

export default async function ScoresPage() {
  const ctx = await requireModule("scores");
  const [programs, open, recent] = await Promise.all([
    listPrograms(ctx),
    listMatches(ctx, { status: "OPEN", limit: 10 }),
    listMatches(ctx, { status: "FINISHED", limit: 5 }),
  ]);
  const favorites = programs.filter((p) => p.favorite);

  return (
    <div>
      <PageHeader title="Schiessen" subtitle="Programme, Durchgänge und Resultate" action={ctx.can("match.create") ? <LinkButton href="/scores/matches/new" size="sm"><Play className="h-4 w-4" /> Starten</LinkButton> : null} />

      <nav aria-label="Bereiche" className="stagger grid grid-cols-4 gap-2 mb-2">
        <Tile href="/scores/programs" icon={<ListChecks className="h-5 w-5" />} label="Programme" />
        <Tile href="/scores/matches" icon={<History className="h-5 w-5" />} label="Durchgänge" />
        <Tile href="/scores/leaderboard" icon={<Trophy className="h-5 w-5" />} label="Rangliste" />
        <Tile href="/scores/stats" icon={<BarChart3 className="h-5 w-5" />} label="Statistik" />
      </nav>

      {open.length ? (
        <>
          <SectionTitle>Offen</SectionTitle>
          <div className="stagger space-y-2.5">
            {open.map((m) => <MatchRow key={m.id} m={m} />)}
          </div>
        </>
      ) : null}

      <SectionTitle action={<Link href="/scores/programs" className="text-xs text-ink-3 hover:text-ink">Alle Programme</Link>}>Favoriten</SectionTitle>
      {favorites.length ? (
        <div className="stagger grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {favorites.map((p) => <ProgramCard key={p.id} program={p} href={ctx.can("match.create") && !p.isArchived ? `/scores/matches/new?programId=${p.id}` : `/scores/programs/${p.id}`} />)}
        </div>
      ) : (
        <EmptyState icon={<Star className="h-5 w-5" />} title="Keine Favoriten" text="Markiere Programme mit dem Stern." action={<LinkButton href="/scores/programs" variant="secondary" size="sm">Programme</LinkButton>} />
      )}

      <SectionTitle action={<Link href="/scores/matches" className="text-xs text-ink-3 hover:text-ink">Alle</Link>}>Zuletzt</SectionTitle>
      {recent.length ? (
        <div className="stagger space-y-2.5">
          {recent.map((m) => <MatchRow key={m.id} m={m} againFor={ctx.can("match.create") ? ctx.user.id : undefined} />)}
        </div>
      ) : (
        <p className="text-sm text-ink-3">Noch keine abgeschlossenen Durchgänge.</p>
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
