import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { todayZurich } from "@/lib/time";
import { getRequestLocale, getT } from "@/lib/i18n";
import { dayKeyLabel } from "@/lib/i18n/extra/admin2/msg";
import { formatDate } from "@/lib/i18n/core";
import { PrintButton } from "@/components/print-button";
import { listAssociationMembers, listRankingPrograms, loadAssociationRanking, requireAssociation, sharingScope } from "@/modules/association/queries";
import { parseRankingParams } from "@/modules/association/stats";
import { RankingTable } from "../ranking-table";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm2.assoc.r.printMeta") };
}

/**
 * Druckansicht der Verbandsrangliste (A4 hoch). Die Seite liegt im App-Bereich, damit sie dieselbe
 * Zugriffsprüfung nutzt; beim Drucken blendet das Stylesheet alles ausser dem Blatt aus.
 */
export default async function AssociationRankingPrintPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ program?: string; from?: string; to?: string; official?: string }> }) {
  const { id } = await params;
  const ctx = await requireAssociation(id);
  const locale = await getRequestLocale();
  const t = getT(locale);
  const formatDay = (d: string) => dayKeyLabel(d, locale);
  const sp = await searchParams;
  const programs = await listRankingPrograms();
  const p = parseRankingParams(sp, programs.map((x) => x.id), todayZurich());
  if (!p.programId) notFound();
  const members = await listAssociationMembers(ctx.association.id);
  const { program, ranking } = await loadAssociationRanking(sharingScope(ctx.access, members), p.programId, p.from, p.to, p.officialOnly);
  if (!program) notFound();

  return (
    <div>
      <style>{`
        @page { size: A4 portrait; margin: 12mm; }
        @media print {
          body * { visibility: hidden !important; }
          #association-print, #association-print * { visibility: visible !important; }
          #association-print { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; padding: 0 !important; }
          html, body { background: #fff !important; }
          thead { display: table-header-group; }
          tr { break-inside: avoid; }
        }
      `}</style>
      <div className="no-print mb-4 flex items-center justify-between gap-3">
        <a href={`/association/${ctx.association.id}/ranking?${new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === "string")).toString()}`} className="inline-flex h-11 items-center text-sm text-accent">{t("adm2.assoc.r.back")}</a>
        <PrintButton />
      </div>
      <div className="overflow-x-auto">
        <div id="association-print" className="mx-auto bg-white text-neutral-900 shadow-lg" style={{ width: "100%", maxWidth: "210mm", padding: "12mm" }}>
          <header className="mb-5 flex items-start justify-between gap-6 border-b border-neutral-300 pb-3">
            <div>
              <div className="text-sm text-neutral-600">{ctx.association.name}</div>
              <h1 className="text-2xl font-bold leading-tight">{t("adm2.assoc.r.heading", { name: program.name })}</h1>
              <div className="text-xs text-neutral-600">{formatDay(p.from)} – {formatDay(p.to)}{p.officialOnly ? t("adm2.assoc.r.officialSuffix") : ""}</div>
            </div>
            <div className="text-right text-xs text-neutral-600">{t("adm2.assoc.r.asOf", { date: formatDate(new Date(), locale) })}</div>
          </header>
          <RankingTable ranking={ranking} decimal={program.scoringMode === "RINGS_DECIMAL"} print t={t} />
          <footer className="mt-6 text-[8pt] text-neutral-500">{t("adm2.assoc.r.printFooter")}</footer>
        </div>
      </div>
    </div>
  );
}
