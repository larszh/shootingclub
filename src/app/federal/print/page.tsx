import { PrintShell } from "@/components/invoice-document";
import { PrintButton } from "@/components/print-button";
import { formatDateZurich } from "@/lib/time";
import { officialKindLabel, OFFICIAL_KINDS } from "@/modules/scores/types";
import { currentSwissYear, getClubInfo, listOfficialResults, listOpEvents, nowDate, requireFederalVerifier } from "@/modules/federal/queries";
import { parseYear, SAT_HEADER, satRowCells } from "@/modules/federal/types";

export const metadata = { title: "Resultatliste Bundesübungen" };

/**
 * Druckliste der amtlichen Resultate (pro Jahr, optional pro Anlass und Art) für die Erfassung in SAT-Admin.
 * Ohne AHV-Nummer: eine leere Spalte ist zum Ergänzen von Hand vorgesehen.
 */
export default async function FederalPrintPage({ searchParams }: { searchParams: Promise<{ year?: string; kind?: string; eventId?: string }> }) {
  const ctx = await requireFederalVerifier();
  const sp = await searchParams;
  const now = nowDate();
  const year = parseYear(sp.year, currentSwissYear(now));
  const kind = OFFICIAL_KINDS.some((k) => k.key === sp.kind) ? sp.kind! : "";
  const [events, club] = await Promise.all([listOpEvents(ctx.tenant.id, year), getClubInfo(ctx.tenant.id)]);
  const event = sp.eventId ? events.find((e) => e.id === sp.eventId) : undefined;
  const rows = await listOfficialResults(ctx.tenant.id, year, { kind: kind || undefined, eventId: event?.id });
  const title = `${kind ? officialKindLabel(kind) : "Amtliche Resultate"} ${year}${event ? ` · ${event.title}` : ""}`;

  return (
    <PrintShell title={title} subtitle={`${rows.length} Resultate · A4 quer`} action={<PrintButton />}>
      <style>{`@page { size: A4 landscape; margin: 10mm; } @media print { thead { display: table-header-group; } tr { break-inside: avoid; } }`}</style>
      <div className="bg-white text-neutral-900 shadow-lg print:shadow-none" style={{ width: "277mm", minHeight: "190mm", padding: "8mm" }}>
        <header className="mb-4 flex items-start justify-between gap-6 border-b border-neutral-300 pb-3">
          <div>
            <div className="text-lg font-semibold">{club.name}</div>
            <div className="text-xs text-neutral-600">{[club.street, club.zipCity, club.canton].filter(Boolean).join(" · ")}</div>
          </div>
          <div className="text-right">
            <div className="text-base font-semibold">{title}</div>
            <div className="text-xs text-neutral-600">Erstellt am {formatDateZurich(now, { weekday: undefined })}</div>
          </div>
        </header>
        <table className="w-full border-collapse text-[10px] leading-tight">
          <thead>
            <tr className="bg-neutral-100 text-left">
              <th className="border border-neutral-300 px-1.5 py-1">Nr.</th>
              {SAT_HEADER.map((h) => <th key={h} className="border border-neutral-300 px-1.5 py-1">{h}</th>)}
              <th className="border border-neutral-300 px-1.5 py-1" style={{ minWidth: "32mm" }}>AHV-Nr. (beim Erfassen ergänzen)</th>
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
              <tr><td colSpan={SAT_HEADER.length + 2} className="border border-neutral-300 px-2 py-6 text-center text-neutral-500">Keine amtlich bestätigten Resultate.</td></tr>
            ) : null}
          </tbody>
        </table>
        <footer className="mt-8 grid grid-cols-2 gap-10 text-xs text-neutral-700">
          <div><div className="h-10 border-b border-neutral-500" />Ort, Datum</div>
          <div><div className="h-10 border-b border-neutral-500" />Schützenmeister/in (Name, Unterschrift)</div>
        </footer>
        <p className="mt-4 text-[9px] text-neutral-500">Erstellt mit Standchef. Die AHV-Nummer wird in der App nicht gespeichert. Angaben vor der Meldung bitte prüfen; massgebend sind die aktuellen Vorgaben (VBS/SSV/Kanton).</p>
      </div>
    </PrintShell>
  );
}
