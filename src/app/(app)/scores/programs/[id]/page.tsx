import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Pencil, Play } from "lucide-react";
import { requireModule } from "@/lib/tenant";
import { Badge, Card, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { getProgram, listMatches } from "@/modules/scores/queries";
import { disciplineLabel, formatDistances, positionLabel, SCORING_MODES } from "@/modules/scores/types";
import { FavoriteButton } from "@/modules/scores/ui/favorite-button";
import { ProgramArchiveButton, ProgramHiddenToggle } from "@/modules/scores/ui/admin-controls";
import { MatchRow } from "../../page";

export const metadata: Metadata = { title: "Programm" };

export default async function ProgramDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireModule("scores");
  const { id } = await params;
  const p = await getProgram(ctx, id);
  if (!p) notFound();
  const canManage = ctx.can("tenant.programs.manage");
  const matches = await listMatches(ctx, { programId: id, limit: 5 });
  const mode = SCORING_MODES.find((m) => m.key === p.scoringMode);

  return (
    <div>
      <PageHeader title={p.name} subtitle={p.description ?? undefined} back={{ href: "/scores/programs", label: "Programme" }} action={<FavoriteButton programId={p.id} favorite={p.favorite} />} />

      <div className="animate-rise flex flex-wrap gap-1.5 mb-4">
        <Badge>{disciplineLabel(p.discipline)}</Badge>
        {p.weaponNote ? <Badge tone="outline">{p.weaponNote}</Badge> : null}
        <Badge tone="outline">{formatDistances(p.totals.distances)}</Badge>
        <Badge tone="outline">{p.totals.shots} Schuss · max. {p.totals.max}</Badge>
        <Badge tone="outline">{mode?.label}</Badge>
        {p.scope === "global" ? <Badge tone="accent">Global</Badge> : <Badge tone="accent">Verein</Badge>}
        {p.hidden ? <Badge tone="warn">Versteckt</Badge> : null}
        {p.isArchived ? <Badge tone="warn">Archiviert</Badge> : null}
      </div>

      {!p.isArchived ? (
        <LinkButton href={`/scores/matches/new?programId=${p.id}`} size="lg" className="w-full animate-rise [animation-delay:80ms]"><Play className="h-5 w-5" /> Durchgang starten</LinkButton>
      ) : null}

      <SectionTitle>Ablauf</SectionTitle>
      <Card className="animate-rise divide-y divide-line overflow-hidden">
        {p.stages.map((s, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold tabular-nums">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="font-medium">{s.name}</div>
              <div className="text-xs text-ink-3">
                {s.distanceM} m · {s.shots} Schuss{p.scoringMode !== "HITS" ? ` · max. ${s.maxPerShot}` : ""}
                {s.position ? ` · ${positionLabel(s.position)}` : ""}{s.timeLimitSec ? ` · ${s.timeLimitSec} s` : ""}
                {s.targetName ? ` · ${s.targetName}` : ""}
              </div>
              {s.note ? <div className="text-xs text-ink-3 italic mt-0.5">{s.note}</div> : null}
            </div>
          </div>
        ))}
      </Card>

      {canManage ? (
        <>
          <SectionTitle>Verwaltung</SectionTitle>
          <div className="animate-rise flex flex-wrap gap-2">
            <ProgramHiddenToggle programId={p.id} hidden={p.hidden} />
            {p.scope === "tenant" ? <LinkButton href={`/scores/programs/${p.id}/edit`} variant="secondary" size="sm"><Pencil className="h-4 w-4" /> Bearbeiten</LinkButton> : null}
            {p.scope === "tenant" ? <ProgramArchiveButton programId={p.id} archived={p.isArchived} /> : null}
          </div>
        </>
      ) : null}

      {matches.length ? (
        <>
          <SectionTitle>Letzte Durchgänge</SectionTitle>
          <div className="stagger space-y-2.5">{matches.map((m) => <MatchRow key={m.id} m={m} />)}</div>
        </>
      ) : null}
    </div>
  );
}
