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
import { getRequestLocale, getT } from "@/lib/i18n";
import { tCount } from "@/modules/scores/ui/labels";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("shooting.common.matches") };
}

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
  const locale = await getRequestLocale();
  const t = getT(locale);
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
      <PageHeader title={t("shooting.common.matches")} subtitle={viewAll ? t("shooting.matches.subtitleAll") : t("shooting.matches.subtitleMine")} back={{ href: "/scores", label: t("shooting.common.shooting") }}
        action={ctx.can("match.create") ? <LinkButton href="/scores/matches/new" size="sm"><Play className="h-4 w-4" /> {t("shooting.common.start")}</LinkButton> : null} />

      <MatchFilters key={JSON.stringify(values)} values={values} programs={programs.map((p) => ({ id: p.id, name: p.name }))} locale={locale} />

      {matches.length ? (
        <>
          <p className="mb-2 text-xs text-ink-3" aria-live="polite">
            {matches.length === 100 ? t("shooting.matches.latest100") : tCount(t, "shooting.board.attempts", matches.length)}
          </p>
          <div className="stagger space-y-2.5">
            {matches.map((m) => <MatchRow key={m.id} m={m} againFor={ctx.can("match.create") ? ctx.user.id : undefined} locale={locale} />)}
          </div>
        </>
      ) : filtered ? (
        <EmptyState icon={<SearchX className="h-5 w-5" />} title={t("shooting.matches.nothing")} text={t("shooting.matches.nothingText")}
          action={<LinkButton href="/scores/matches" variant="secondary" size="sm">{t("shooting.filters.reset")}</LinkButton>} />
      ) : (
        <EmptyState icon={<History className="h-5 w-5" />} title={t("shooting.matches.none")} text={ctx.can("match.create") ? t("shooting.matches.noneCreate") : t("shooting.matches.noneMember")}
          action={ctx.can("match.create") ? <LinkButton href="/scores/matches/new" size="sm">{t("shooting.matches.startMatch")}</LinkButton> : null} />
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <ExportLink href="/api/export/scores/me">{t("shooting.export.mine")}</ExportLink>
        {viewAll ? <ExportLink href={`/api/export/scores/tenant${exportQs.size ? `?${exportQs.toString()}` : ""}`}>{t("shooting.export.tenant")}</ExportLink> : null}
      </div>
    </div>
  );
}
