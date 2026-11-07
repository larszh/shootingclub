import type { Metadata } from "next";
import { Download, Printer } from "lucide-react";
import { todayZurich } from "@/lib/time";
import { Button, Card, EmptyState, Field, Input, LinkButton, PageHeader, Select } from "@/components/ui";
import { getRequestLocale, getT } from "@/lib/i18n";
import { dayKeyLabel } from "@/lib/i18n/extra/admin2/msg";
import { officialKindText } from "@/modules/scores/ui/labels";
import { listAssociationMembers, listRankingPrograms, loadAssociationRanking, requireAssociation, sharingScope } from "@/modules/association/queries";
import { parseRankingParams, rankingQuery } from "@/modules/association/stats";
import { AssociationTabs } from "../tabs";
import { RankingTable } from "./ranking-table";
import { localizedProgramName } from "@/modules/scores/preset-i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm2.assoc.r.title") };
}

export default async function AssociationRankingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ program?: string; from?: string; to?: string; official?: string }> }) {
  const { id } = await params;
  const ctx = await requireAssociation(id);
  const locale = await getRequestLocale();
  const t = getT(locale);
  const formatDay = (d: string) => dayKeyLabel(d, locale);
  const sp = await searchParams;
  const programs = await listRankingPrograms();
  const p = parseRankingParams(sp, programs.map((x) => x.id), todayZurich());
  const members = await listAssociationMembers(ctx.association.id);
  const pending = members.filter((m) => m.status === "PENDING" && !m.tenantDeletedAt).length;
  const scope = sharingScope(ctx.access, members);
  const result = p.programId ? await loadAssociationRanking(scope, p.programId, p.from, p.to, p.officialOnly) : null;
  const decimal = result?.program?.scoringMode === "RINGS_DECIMAL";
  const q = rankingQuery(p);

  return (
    <div>
      <PageHeader title={t("adm2.assoc.r.title")} subtitle={ctx.association.name} back={{ href: "/association", label: t("adm2.assoc.a.title") }} />
      <AssociationTabs id={ctx.association.id} active="ranking" pending={pending} />

      <Card className="animate-rise p-4 mb-4">
        <form method="get" className="space-y-3">
          <Field label={t("adm2.assoc.r.program")}>
            <Select name="program" defaultValue={p.programId ?? ""}>
              {programs.map((x) => <option key={x.id} value={x.id}>{localizedProgramName(x.name, locale)}{x.officialKind ? ` (${officialKindText(t, x.officialKind)})` : ""}</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("adm2.common.from")}><Input type="date" name="from" defaultValue={p.from} required /></Field>
            <Field label={t("adm2.common.to")}><Input type="date" name="to" defaultValue={p.to} required /></Field>
          </div>
          <label className="flex items-center gap-3 min-h-11 cursor-pointer">
            <input type="checkbox" name="official" value="1" defaultChecked={p.officialOnly} className="h-5 w-5 accent-[var(--accent)]" />
            <span className="text-sm">{t("adm2.assoc.r.officialOnly")}</span>
          </label>
          <Button type="submit" variant="secondary">{t("adm2.assoc.r.show")}</Button>
        </form>
      </Card>

      {!p.programId || !result ? (
        <EmptyState title={t("adm2.assoc.r.noPrograms")} text={t("adm2.assoc.r.noProgramsText")} />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="flex-1 min-w-0 text-sm text-ink-3">
              {result.program ? localizedProgramName(result.program.name, locale) : ""} · {formatDay(p.from)} – {formatDay(p.to)} · {t("adm2.assoc.r.ranked", { n: result.ranking.ranked.length })}
            </div>
            <a href={`/association/${ctx.association.id}/export?kind=ranking&${q}`} className="press inline-flex h-11 items-center gap-2 rounded-control border border-line px-3 text-sm font-medium" download>
              <Download className="h-4 w-4" aria-hidden /> CSV
            </a>
            <LinkButton href={`/association/${ctx.association.id}/ranking/print?${q}`} variant="secondary"><Printer className="h-4 w-4" aria-hidden /> {t("adm2.assoc.r.print")}</LinkButton>
          </div>
          <Card className="animate-rise p-4">
            <RankingTable ranking={result.ranking} decimal={decimal} t={t} />
          </Card>
          <p className="mt-3 text-xs text-ink-3">{t("adm2.assoc.r.footer")}</p>
        </>
      )}
    </div>
  );
}
