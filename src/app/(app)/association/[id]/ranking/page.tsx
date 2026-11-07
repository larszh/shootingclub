import type { Metadata } from "next";
import { Download, Printer } from "lucide-react";
import { todayZurich } from "@/lib/time";
import { Button, Card, EmptyState, Field, Input, LinkButton, PageHeader, Select } from "@/components/ui";
import { formatDay } from "@/modules/federal/types";
import { listAssociationMembers, listRankingPrograms, loadAssociationRanking, requireAssociation, sharingScope } from "@/modules/association/queries";
import { parseRankingParams, rankingQuery } from "@/modules/association/stats";
import { AssociationTabs } from "../tabs";
import { RankingTable } from "./ranking-table";

export const metadata: Metadata = { title: "Verbandsrangliste" };

const KIND_LABEL: Record<string, string> = { OP: "Obligatorisch", FS: "Feldschiessen", QUAL: "Qualifikation" };

export default async function AssociationRankingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ program?: string; from?: string; to?: string; official?: string }> }) {
  const { id } = await params;
  const ctx = await requireAssociation(id);
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
      <PageHeader title="Verbandsrangliste" subtitle={ctx.association.name} back={{ href: "/association", label: "Verband" }} />
      <AssociationTabs id={ctx.association.id} active="ranking" pending={pending} />

      <Card className="animate-rise p-4 mb-4">
        <form method="get" className="space-y-3">
          <Field label="Programm">
            <Select name="program" defaultValue={p.programId ?? ""}>
              {programs.map((x) => <option key={x.id} value={x.id}>{x.name}{x.officialKind ? ` (${KIND_LABEL[x.officialKind] ?? x.officialKind})` : ""}</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Von"><Input type="date" name="from" defaultValue={p.from} required /></Field>
            <Field label="Bis"><Input type="date" name="to" defaultValue={p.to} required /></Field>
          </div>
          <label className="flex items-center gap-3 min-h-11 cursor-pointer">
            <input type="checkbox" name="official" value="1" defaultChecked={p.officialOnly} className="h-5 w-5 accent-[var(--accent)]" />
            <span className="text-sm">Nur bestätigte (amtliche) Resultate</span>
          </label>
          <Button type="submit" variant="secondary">Anzeigen</Button>
        </form>
      </Card>

      {!p.programId || !result ? (
        <EmptyState title="Keine Programme" text="Verbandsranglisten nutzen die globalen Programme, die in allen Vereinen gleich sind." />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="flex-1 min-w-0 text-sm text-ink-3">
              {result.program?.name} · {formatDay(p.from)} – {formatDay(p.to)} · {result.ranking.ranked.length} rangiert
            </div>
            <a href={`/association/${ctx.association.id}/export?kind=ranking&${q}`} className="press inline-flex h-11 items-center gap-2 rounded-control border border-line px-3 text-sm font-medium" download>
              <Download className="h-4 w-4" aria-hidden /> CSV
            </a>
            <LinkButton href={`/association/${ctx.association.id}/ranking/print?${q}`} variant="secondary"><Printer className="h-4 w-4" aria-hidden /> Drucken</LinkButton>
          </div>
          <Card className="animate-rise p-4">
            <RankingTable ranking={result.ranking} decimal={decimal} />
          </Card>
          <p className="mt-3 text-xs text-ink-3">Pro Schütze zählt das beste Resultat im Zeitraum (höheres Total, bei Gleichstand weniger Nuller). Gezählt werden nur aktuelle Mitglieder aktiver Vereine.</p>
        </>
      )}
    </div>
  );
}
