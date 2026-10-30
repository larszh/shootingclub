import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Download, Pencil, Printer } from "lucide-react";
import { Alert, Badge, Card, EmptyState, LinkButton, LinkTabs, PageHeader, SectionTitle } from "@/components/ui";
import { disciplineLabel } from "@/modules/scores/types";
import { canManageChampionship, canViewChampionship, requireChampionship } from "@/modules/championship/guard";
import { chDay, getChampionship, loadRanking } from "@/modules/championship/queries";
import { findEntry, podium } from "@/modules/championship/ranking";
import { CHAMPIONSHIP_RULES_HINT, formatPoints, formatWeight } from "@/modules/championship/types";
import { ChampionshipAdminButtons, PublishToggle } from "@/modules/championship/ui/admin-actions";
import { MyStanding } from "@/modules/championship/ui/my-standing";
import { RankingList } from "@/modules/championship/ui/ranking-list";

export const metadata: Metadata = { title: "Rangliste" };

export default async function ChampionshipDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ cat?: string }> }) {
  const ctx = await requireChampionship();
  const { id } = await params;
  const sp = await searchParams;
  const c = await getChampionship(ctx.tenant.id, id);
  if (!c || !canViewChampionship(ctx, c)) notFound();
  const manage = canManageChampionship(ctx);
  const { ranking, categoryErrors } = await loadRanking(ctx.tenant.id, c);
  const mine = findEntry(ranking, ctx.user.id);

  const tab = sp.cat === "__nk" ? "__nk" : sp.cat && ranking.categories.some((k) => k.name === sp.cat) ? sp.cat : "all";
  const tabs = [
    { value: "all", label: "Gesamt", href: `/championship/${c.id}`, count: ranking.ranked.length },
    ...(ranking.categories.length > 1 || (ranking.categories.length === 1 && ranking.categories[0]!.name !== "ohne Kategorie")
      ? ranking.categories.map((k) => ({ value: k.name, label: k.name, href: `/championship/${c.id}?cat=${encodeURIComponent(k.name)}`, count: k.entries.length }))
      : []),
    ...(ranking.unclassified.length ? [{ value: "__nk", label: "Nicht klassiert", href: `/championship/${c.id}?cat=__nk`, count: ranking.unclassified.length }] : []),
  ];
  const catRows = tab !== "all" && tab !== "__nk" ? ranking.categories.find((k) => k.name === tab)?.entries ?? [] : [];
  const top = podium(ranking.ranked);

  return (
    <div>
      <PageHeader
        title={c.name}
        subtitle={`${chDay(c.startsOn)} – ${chDay(c.endsOn)}${c.bestOf ? ` · beste ${c.bestOf} pro Programm` : " · alle Resultate zählen"}${c.officialOnly ? " · nur bestätigte" : ""}`}
        back={{ href: "/championship", label: "Meisterschaft" }}
        action={manage ? <LinkButton href={`/championship/${c.id}/edit`} variant="secondary" size="sm"><Pencil className="h-4 w-4" /> Bearbeiten</LinkButton> : undefined}
      />

      {manage ? (
        <Card className="mb-4 space-y-3 p-4">
          <PublishToggle id={c.id} published={c.isPublished} />
          <div className="flex flex-wrap gap-2">
            <LinkButton href={`/championship/${c.id}/print`} variant="secondary" target="_blank"><Printer className="h-4 w-4" /> Drucken für die GV</LinkButton>
            <LinkButton href={`/championship/${c.id}/csv`} variant="secondary" prefetch={false}><Download className="h-4 w-4" /> CSV</LinkButton>
          </div>
          <ChampionshipAdminButtons id={c.id} name={c.name} year={c.year} />
        </Card>
      ) : null}
      {manage && categoryErrors.length ? <Alert tone="warn" className="mb-4" title="Kategorien prüfen">{categoryErrors.join(" ")}</Alert> : null}

      <div className="mb-5">
        <MyStanding championshipId={c.id} entry={mine.entry} categoryRank={mine.categoryRank} totalRanked={ranking.ranked.length} />
      </div>

      {top.length && tab === "all" ? (
        <div className="mb-5 grid grid-cols-3 items-end gap-2" aria-label="Podest">
          {[2, 1, 3].map((place) => {
            const people = top.filter((e) => e.rank === place);
            const h = place === 1 ? "h-28" : place === 2 ? "h-20" : "h-14";
            return (
              <div key={place} className="flex min-w-0 flex-col items-center text-center">
                <div className="mb-1 w-full min-w-0 text-sm font-medium">
                  {people.length ? people.map((p) => <div key={p.userId} className="truncate">{p.name}</div>) : <span className="text-ink-3">–</span>}
                </div>
                <div className="mb-1 text-xs tabular-nums text-ink-3">{people[0] ? formatPoints(people[0].total) : ""}</div>
                <div className={`flex w-full items-start justify-center rounded-t-control pt-2 text-xl font-bold ${h} ${place === 1 ? "bg-[#d4a72c] text-black" : place === 2 ? "bg-[#b8bcc2] text-black" : "bg-[#b07a4a] text-white"}`}>{place}</div>
              </div>
            );
          })}
        </div>
      ) : null}

      {tabs.length > 1 ? <LinkTabs label="Kategorie wählen" className="mb-4" active={tab} items={tabs} /> : null}

      {tab === "__nk" ? (
        <>
          <p className="mb-3 text-sm text-ink-3">Diese Mitglieder haben noch nicht alle Pflichtprogramme geschossen.</p>
          <RankingList rows={ranking.unclassified.map((e) => ({ ...e, shownRank: null }))} championshipId={c.id} meId={ctx.user.id} />
        </>
      ) : tab !== "all" ? (
        <RankingList rows={catRows.map((e) => ({ ...e, shownRank: e.categoryRank }))} championshipId={c.id} meId={ctx.user.id} showCategory={false} />
      ) : ranking.ranked.length ? (
        <RankingList rows={ranking.ranked.map((e) => ({ ...e, shownRank: e.rank }))} championshipId={c.id} meId={ctx.user.id} />
      ) : (
        <EmptyState title="Noch keine Rangierten" text={c.programs.length ? "Sobald Durchgänge mit diesen Programmen abgeschlossen sind, erscheint hier die Rangliste." : "Wähle zuerst die Programme der Meisterschaft."} />
      )}

      <SectionTitle>Programme</SectionTitle>
      <Card className="divide-y divide-line">
        {c.programs.map((p) => (
          <div key={p.programId} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2.5">
            <div className="min-w-0">
              <div className="truncate font-medium">{p.name}</div>
              <div className="text-xs text-ink-3">{disciplineLabel(p.discipline)}</div>
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
              {p.required ? <Badge tone="accent">Pflicht</Badge> : null}
              {p.weight !== 1 ? <Badge>{formatWeight(p.weight)}</Badge> : null}
              <Badge tone="outline">{p.maxCount ?? c.bestOf ? `beste ${p.maxCount ?? c.bestOf}` : "alle"}</Badge>
            </div>
          </div>
        ))}
      </Card>

      {c.rulesText ? (
        <>
          <SectionTitle>Reglement</SectionTitle>
          <Card className="whitespace-pre-wrap p-4 text-sm text-ink-2">{c.rulesText}</Card>
        </>
      ) : null}
      <p className="mt-4 text-xs text-ink-3">
        Gleichstand: zuerst entscheidet das beste Einzelresultat, dann die Anzahl gezählter Resultate. Kategorie nach Jahrgang (Alter am 31.12.{c.year}). {CHAMPIONSHIP_RULES_HINT}
      </p>
    </div>
  );
}
