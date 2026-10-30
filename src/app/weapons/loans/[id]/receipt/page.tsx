import { notFound } from "next/navigation";
import { PrintShell } from "@/components/invoice-document";
import { PrintButton } from "@/components/print-button";
import { formatDateTimeZurich, formatDateZurich } from "@/lib/time";
import { PrintSheet, printedAt, SignatureLines } from "@/modules/ammo/ui/print-sheet";
import { requireWeapons } from "@/modules/weapons/guard";
import { getLoan } from "@/modules/weapons/queries";
import { MINOR_HINT, RESPONSIBILITY_HINT } from "@/modules/weapons/types";

export const metadata = { title: "Ausleihquittung" };

/** Ausleihquittung einer Vereinswaffe (A4) mit Bedingungen und Unterschriftsfeldern. */
export default async function LoanReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireWeapons();
  const { id } = await params;
  const loan = await getLoan(ctx.tenant.id, id.slice(0, 40));
  if (!loan) notFound();
  const canManage = ctx.can("weapons.manage");
  const w = loan.weapon;
  const address = loan.user ? [loan.user.street, [loan.user.zip, loan.user.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") : "";
  const line = (label: string, value: React.ReactNode) => (
    <div className="grid grid-cols-[38mm_1fr] gap-2 border-b border-neutral-200 py-1.5">
      <div className="text-neutral-500">{label}</div>
      <div>{value || <span className="inline-block w-full border-b border-dotted border-neutral-400">&nbsp;</span>}</div>
    </div>
  );

  return (
    <PrintShell title="Ausleihquittung" subtitle={`${w.name} · ${loan.borrower}`} action={<PrintButton />}>
      <PrintSheet
        tenantName={ctx.tenant.name}
        title="Ausleihquittung Vereinswaffe"
        subtitle={`Ausgegeben am ${formatDateTimeZurich(loan.loanedAt)}`}
        footer={<>Erstellt mit Standchef am {printedAt()}. {RESPONSIBILITY_HINT}</>}
      >
        <h2 className="mb-1 text-[9pt] font-semibold uppercase tracking-wide text-neutral-600">Waffe</h2>
        {line("Bezeichnung", w.name)}
        {line("Disziplin", w.discipline)}
        {line("Hersteller / Modell", [w.manufacturer, w.model].filter(Boolean).join(" "))}
        {line("Kaliber", w.caliber)}
        {line("Seriennummer", canManage ? w.serialNumber : null)}
        {line("Schusszähler bei Ausgabe", `${new Intl.NumberFormat("de-CH").format(w.shotCount)}`)}

        <h2 className="mb-1 mt-5 text-[9pt] font-semibold uppercase tracking-wide text-neutral-600">Ausleihende Person</h2>
        {line("Name", loan.borrower)}
        {line("Adresse", address)}
        {line("Telefon", loan.user?.phone ?? null)}
        {line("Minderjährig", loan.isMinor ? "ja" : "nein")}

        <h2 className="mb-1 mt-5 text-[9pt] font-semibold uppercase tracking-wide text-neutral-600">Ausleihe</h2>
        {line("Ausgegeben am", formatDateTimeZurich(loan.loanedAt))}
        {line("Ausgegeben durch", loan.issuedByName)}
        {line("Rückgabe bis", loan.dueAt ? formatDateZurich(loan.dueAt, { weekday: undefined }) : loan.onSiteOnly ? "am selben Tag, vor Verlassen des Standes" : null)}
        {loan.note ? line("Bemerkung", loan.note) : null}

        <h2 className="mb-1 mt-5 text-[9pt] font-semibold uppercase tracking-wide text-neutral-600">Bedingungen</h2>
        <ul className="list-disc space-y-1 pl-5">
          {loan.onSiteOnly ? <li>Die Waffe wird nur zum Gebrauch am Schiessstand unter Aufsicht abgegeben und darf den Stand nicht verlassen.</li> : <li>Die Waffe ist sorgfältig, entladen und gesichert zu transportieren und aufzubewahren (Waffe und Munition getrennt).</li>}
          <li>Die ausleihende Person bestätigt den einwandfreien Zustand bei Erhalt und meldet Schäden oder Störungen sofort.</li>
          <li>Die Waffe ist entladen, gereinigt und vollständig (inkl. Zubehör) zurückzugeben.</li>
          <li>Es gelten die Standordnung und die Weisungen der Standaufsicht bzw. des Vereins.</li>
          {loan.isMinor ? <li>{MINOR_HINT}{loan.reportDueAt ? ` Vom Verein vermerkte Frist: ${formatDateZurich(loan.reportDueAt, { weekday: undefined })}.` : ""}</li> : null}
        </ul>

        <SignatureLines labels={[loan.isMinor ? "Unterschrift ausleihende Person bzw. gesetzliche Vertretung" : "Unterschrift ausleihende Person", "Unterschrift Verein (Ausgabe)"]} />

        <h2 className="mb-1 mt-8 text-[9pt] font-semibold uppercase tracking-wide text-neutral-600">Rückgabe</h2>
        {line("Zurück am", loan.returnedAt ? formatDateTimeZurich(loan.returnedAt) : null)}
        {line("Abgegebene Schüsse", loan.shots !== null ? String(loan.shots) : null)}
        {line("Zustand / Bemerkung", null)}
        <SignatureLines labels={["Unterschrift ausleihende Person", "Unterschrift Verein (Rücknahme)"]} />
      </PrintSheet>
    </PrintShell>
  );
}
