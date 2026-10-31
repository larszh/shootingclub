import { PrintShell } from "@/components/invoice-document";
import { PrintButton } from "@/components/print-button";
import { todayZurich } from "@/lib/time";
import { requireAmmoAdmin } from "@/modules/ammo/guard";
import { parseSummaryYear, STOCK_CHECK_HINT, type SummaryRow } from "@/modules/ammo/stock";
import { stockYearOverview } from "@/modules/ammo/stock-service";
import { PrintSheet, printedAt, PrintTable, SignatureLines } from "@/modules/ammo/ui/print-sheet";

export const metadata = { title: "Munition: Jahresübersicht" };

const n = (v: number) => new Intl.NumberFormat("de-CH").format(v);
const KEYS: (keyof SummaryRow)[] = ["opening", "receipt", "issue", "sale", "returned", "adjust", "closing"];
const HEAD = ["Anfang", "Eingang", "Abgabe", "Verkauf", "Rückn.", "Korr.", "Bestand"];

/** Jahresübersicht der Munitionskontrolle (A4) pro Finanzierungsart, in Schuss. ?year=YYYY */
export default async function AmmoYearPrintPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const ctx = await requireAmmoAdmin();
  const sp = await searchParams;
  const year = parseSummaryYear(sp.year, Number(todayZurich().slice(0, 4)));
  const groups = await stockYearOverview(ctx.tenant.id, year);
  const align: ("left" | "right")[] = ["left", ...KEYS.map(() => "right" as const)];

  return (
    <PrintShell title={`Munition: Jahresübersicht ${year}`} subtitle="A4" action={<PrintButton />}>
      <PrintSheet
        tenantName={ctx.tenant.name}
        title={`Munitionskontrolle ${year}`}
        subtitle="Eingang, Abgabe, Verkauf und Bestand pro Finanzierungsart (in Schuss)"
        footer={<>Erstellt mit Standchef am {printedAt()} aus dem Bestandsjournal. {STOCK_CHECK_HINT}</>}
      >
        {groups.map((g) => (
          <div key={g.fundingType} className="mb-6 [break-inside:avoid]">
            <h2 className="mb-1 text-[11pt] font-semibold">{g.label}</h2>
            {g.products.length === 0 ? (
              <p className="text-neutral-500">Keine Produkte.</p>
            ) : (
              <PrintTable
                head={["Produkt", ...HEAD]}
                align={align}
                rows={g.products.map((p) => [
                  <span key="n">{p.product.name}<span className="block text-[8pt] text-neutral-500">{p.product.caliber} · {p.product.unitLabel} à {p.product.roundsPerUnit}</span></span>,
                  ...KEYS.map((k) => n(p[k] * p.product.roundsPerUnit)),
                ])}
                foot={["Total", ...KEYS.map((k) => n(g.rounds[k]))]}
              />
            )}
          </div>
        ))}
        <p className="text-[8.5pt] text-neutral-600">Anfangsbestand = Endbestand minus Bewegungen im Jahr. Abgabe = Abgaben am Stand (z.B. Bundesübungen), Verkauf = Ausgaben auf Rechnung, Korrektur = Inventurdifferenzen und Korrekturen.</p>
        <SignatureLines labels={["Unterschrift Munitionsverwalter/in", "Unterschrift Präsident/in bzw. Kassier/in"]} />
      </PrintSheet>
    </PrintShell>
  );
}
