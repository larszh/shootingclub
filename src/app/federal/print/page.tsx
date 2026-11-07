import { PrintShell } from "@/components/invoice-document";
import { PrintButton } from "@/components/print-button";
import { getRequestLocale, getT } from "@/lib/i18n";
import { formatDate } from "@/lib/i18n/core";
import { OFFICIAL_KINDS } from "@/modules/scores/types";
import { officialKindText } from "@/modules/scores/ui/labels";
import { currentSwissYear, getClubInfo, listOfficialResults, listOpEvents, nowDate, requireFederalVerifier } from "@/modules/federal/queries";
import { parseYear, SAT_HEADER, satRowCells } from "@/modules/federal/types";

export async function generateMetadata() {
  return { title: getT(await getRequestLocale())("adm2.federal.pr.meta") };
}

/**
 * Druckliste der amtlichen Resultate (pro Jahr, optional pro Anlass und Art) für die Erfassung in SAT-Admin.
 * Ohne AHV-Nummer: eine leere Spalte ist zum Ergänzen von Hand vorgesehen.
 */
export default async function FederalPrintPage({ searchParams }: { searchParams: Promise<{ year?: string; kind?: string; eventId?: string }> }) {
  const ctx = await requireFederalVerifier();
  const locale = await getRequestLocale();
  const t = getT(locale);
  const sp = await searchParams;
  const now = nowDate();
  const year = parseYear(sp.year, currentSwissYear(now));
  const kind = OFFICIAL_KINDS.some((k) => k.key === sp.kind) ? sp.kind! : "";
  const [events, club] = await Promise.all([listOpEvents(ctx.tenant.id, year), getClubInfo(ctx.tenant.id)]);
  const event = sp.eventId ? events.find((e) => e.id === sp.eventId) : undefined;
  const rows = await listOfficialResults(ctx.tenant.id, year, { kind: kind || undefined, eventId: event?.id });
  const title = `${kind ? officialKindText(t, kind) : t("adm2.federal.pr.official")} ${year}${event ? ` · ${event.title}` : ""}`;

  return (
    <PrintShell title={title} subtitle={t("adm2.federal.pr.subtitle", { n: rows.length })} action={<PrintButton />}>
      <style>{`@page { size: A4 landscape; margin: 10mm; } @media print { thead { display: table-header-group; } tr { break-inside: avoid; } }`}</style>
      <div className="bg-white text-neutral-900 shadow-lg print:shadow-none" style={{ width: "277mm", minHeight: "190mm", padding: "8mm" }}>
        <header className="mb-4 flex items-start justify-between gap-6 border-b border-neutral-300 pb-3">
          <div>
            <div className="text-lg font-semibold">{club.name}</div>
            <div className="text-xs text-neutral-600">{[club.street, club.zipCity, club.canton].filter(Boolean).join(" · ")}</div>
          </div>
          <div className="text-right">
            <div className="text-base font-semibold">{title}</div>
            <div className="text-xs text-neutral-600">{t("adm2.federal.pr.createdOn", { date: formatDate(now, locale) })}</div>
          </div>
        </header>
        <table className="w-full border-collapse text-[10px] leading-tight">
          <thead>
            <tr className="bg-neutral-100 text-left">
              <th className="border border-neutral-300 px-1.5 py-1">{t("adm2.federal.pr.nr")}</th>
              {SAT_HEADER.map((h) => <th key={h} className="border border-neutral-300 px-1.5 py-1">{h}</th>)}
              <th className="border border-neutral-300 px-1.5 py-1" style={{ minWidth: "32mm" }}>{t("adm2.federal.pr.ahv")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id}>
                <td className="border border-neutral-300 px-1.5 py-1 tabular-nums">{i + 1}</td>
                {satRowCells(r).map((c, j) => <td key={j} className="border border-neutral-300 px-1.5 py-1">{c}</td>)}
                <td className="border border-neutral-300 px-1.5 py-1" />
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr><td colSpan={SAT_HEADER.length + 2} className="border border-neutral-300 px-2 py-6 text-center text-neutral-500">{t("adm2.federal.pr.none")}</td></tr>
            ) : null}
          </tbody>
        </table>
        <footer className="mt-8 grid grid-cols-2 gap-10 text-xs text-neutral-700">
          <div><div className="h-10 border-b border-neutral-500" />{t("adm2.common.placeDate")}</div>
          <div><div className="h-10 border-b border-neutral-500" />{t("adm2.federal.pr.sigMaster")}</div>
        </footer>
        <p className="mt-4 text-[9px] text-neutral-500">{t("adm2.federal.pr.footer")}</p>
      </div>
    </PrintShell>
  );
}
