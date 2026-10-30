import { notFound } from "next/navigation";
import { PrintShell } from "@/components/invoice-document";
import { PrintButton } from "@/components/print-button";
import { formatDateTimeZurich } from "@/lib/time";
import { requireAmmoAdmin } from "@/modules/ammo/guard";
import { fundingInfo, STOCK_CHECK_HINT } from "@/modules/ammo/stock";
import { inventoryRun } from "@/modules/ammo/stock-service";
import { PrintSheet, printedAt, PrintTable, SignatureLines } from "@/modules/ammo/ui/print-sheet";

export const metadata = { title: "Inventur: Differenzbericht" };

const n = (v: number) => new Intl.NumberFormat("de-CH").format(v);

/** Differenzbericht einer Inventur (alle INVENTORY-Bewegungen mit demselben Zeitpunkt). ?at=<Millisekunden> */
export default async function InventoryPrintPage({ searchParams }: { searchParams: Promise<{ at?: string }> }) {
  const ctx = await requireAmmoAdmin();
  const sp = await searchParams;
  if (!sp.at || !/^\d{10,15}$/.test(sp.at)) notFound();
  const at = new Date(Number(sp.at));
  const { rows, createdByName, note } = await inventoryRun(ctx.tenant.id, at);
  if (!rows.length) notFound();
  const counted = (m: (typeof rows)[number]) => {
    const match = /gezählt (\d+)/.exec(m.source ?? "");
    return match ? Number(match[1]) : null;
  };
  const withDiff = rows.filter((r) => r.units !== 0);
  const roundsDiff = rows.reduce((a, r) => a + r.units * r.product.roundsPerUnit, 0);

  return (
    <PrintShell title="Inventur: Differenzbericht" subtitle={formatDateTimeZurich(at)} action={<PrintButton />}>
      <PrintSheet
        tenantName={ctx.tenant.name}
        title="Inventur Munition – Differenzbericht"
        subtitle={`${formatDateTimeZurich(at)}${createdByName ? ` · erfasst von ${createdByName}` : ""}`}
        footer={<>Erstellt mit Standchef am {printedAt()}. {STOCK_CHECK_HINT}</>}
      >
        <div className="mb-4 grid grid-cols-3 gap-3">
          <div><div className="text-[8pt] uppercase text-neutral-500">Gezählte Produkte</div><div className="text-xl font-semibold">{rows.length}</div></div>
          <div><div className="text-[8pt] uppercase text-neutral-500">Mit Differenz</div><div className="text-xl font-semibold">{withDiff.length}</div></div>
          <div><div className="text-[8pt] uppercase text-neutral-500">Differenz in Schuss</div><div className="text-xl font-semibold">{roundsDiff > 0 ? "+" : ""}{n(roundsDiff)}</div></div>
        </div>
        <PrintTable
          head={["Produkt", "Finanzierung", "Soll", "Gezählt", "Differenz", "Diff. Schuss"]}
          align={["left", "left", "right", "right", "right", "right"]}
          rows={rows.map((r) => {
            const c = counted(r);
            return [
              <span key="p">{r.product.name}<span className="block text-[8pt] text-neutral-500">{r.product.caliber} · {r.product.unitLabel}</span></span>,
              fundingInfo(r.product.fundingType).short,
              c !== null ? n(c - r.units) : "",
              c !== null ? n(c) : "",
              `${r.units > 0 ? "+" : ""}${n(r.units)}`,
              `${r.units > 0 ? "+" : ""}${n(r.units * r.product.roundsPerUnit)}`,
            ];
          })}
        />
        {note ? <p className="mt-3"><span className="text-neutral-500">Bemerkung:</span> {note}</p> : null}
        <div className="mt-4">
          <div className="text-[9pt] text-neutral-600">Begründung der Differenzen:</div>
          <div className="mt-2 h-6 border-b border-neutral-300" />
          <div className="mt-2 h-6 border-b border-neutral-300" />
          <div className="mt-2 h-6 border-b border-neutral-300" />
        </div>
        <SignatureLines labels={["Unterschrift gezählt durch", "Unterschrift kontrolliert durch"]} />
      </PrintSheet>
    </PrintShell>
  );
}
