import type { Metadata } from "next";
import { History, Play, SearchX } from "lucide-react";
import { requireModule } from "@/lib/tenant";
import { EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { listMatches, listPrograms } from "@/modules/scores/queries";
import { MATCH_PERIODS, matchPeriodRange } from "@/modules/scores/analytics";
import { zurichParts } from "@/lib/time";
import { MatchRow } from "@/modules/scores/ui/match-row";
import { MatchFilters } from "@/modules/scores/ui/match-filters";
import { ExportLink } from "@/modules/scores/ui/export-link";

export const metadata: Metadata = { title: "Durchgänge" };

type SP = { q?: string; programId?: string; status?: string; period?: string };

function pick(v: string | string[] | undefined) {
  return (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
}

/** Zeitraum aus dem Filter (ausserhalb der Komponente, damit das Rendern rein bleibt). */
function rangeFor(period: string | undefined) {
  const range = matchPeriodRange(period, new Date());
  // Für den Export als Schweizer Kalendertage, "to" inklusive.
  const exportQs = new URLSearchParams();
  if (range.from) exportQs.set("from", zurichParts(range.from).dateStr);
  if (range.to) exportQs.set("to", zurichParts(new Date(range.to.getTime() - 1)).dateStr);
  return { range, exportQs };
}

export default async function MatchesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireModule("scores");
  const raw = await searchParams;
  const values: SP = {
    q: pick(raw.q)?.slice(0, 60),
    programId: pick(raw.programId),
    status: ["OPEN", "FINISHED"].includes(pick(raw.status) ?? "") ? pick(raw.status) : undefined,
    period: MATCH_PERIODS.some((p) => p.key && p.key === pick(raw.period)) ? pick(raw.period) : undefined,
  };
  const { range, exportQs } = rangeFor(values.period);
  const [matches, programs] = await Promise.all([
    listMatches(ctx, { limit: 100, programId: values.programId, status: values.status, q: values.q, ...range }),
    listPrograms(ctx, { includeArchived: true, includeHidden: true }),
  ]);
  const viewAll = ctx.can("match.viewAll");
  const filtered = Boolean(values.q || values.programId || values.status || values.period);

  return (
    <div>
      <PageHeader title="Durchgänge" subtitle={viewAll ? "Alle Durchgänge im Verein" : "Deine Durchgänge und Wettkämpfe"} back={{ href: "/scores", label: "Schiessen" }}
        action={ctx.can("match.create") ? <LinkButton href="/scores/matches/new" size="sm"><Play className="h-4 w-4" /> Starten</LinkButton> : null} />

      <MatchFilters key={JSON.stringify(values)} values={values} programs={programs.map((p) => ({ id: p.id, name: p.name }))} />

      {matches.length ? (
        <>
          <p className="mb-2 text-xs text-ink-3" aria-live="polite">
            {matches.length === 100 ? "Die neusten 100 Durchgänge" : `${matches.length} ${matches.length === 1 ? "Durchgang" : "Durchgänge"}`}
          </p>
          <div className="stagger space-y-2.5">
            {matches.map((m) => <MatchRow key={m.id} m={m} againFor={ctx.can("match.create") ? ctx.user.id : undefined} />)}
          </div>
        </>
      ) : filtered ? (
        <EmptyState icon={<SearchX className="h-5 w-5" />} title="Nichts gefunden" text="Mit diesen Filtern gibt es keine Durchgänge. Versuche es mit weniger Filtern."
          action={<LinkButton href="/scores/matches" variant="secondary" size="sm">Filter zurücksetzen</LinkButton>} />
      ) : (
        <EmptyState icon={<History className="h-5 w-5" />} title="Noch keine Durchgänge" text={ctx.can("match.create") ? "Starte dein erstes Programm." : "Sobald du an einem Durchgang teilnimmst, erscheint er hier."}
          action={ctx.can("match.create") ? <LinkButton href="/scores/matches/new" size="sm">Durchgang starten</LinkButton> : null} />
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <ExportLink href="/api/export/scores/me">Meine Resultate (CSV)</ExportLink>
        {viewAll ? <ExportLink href={`/api/export/scores/tenant${exportQs.size ? `?${exportQs.toString()}` : ""}`}>Alle Vereinsresultate (CSV)</ExportLink> : null}
      </div>
    </div>
  );
}
