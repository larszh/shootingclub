import { formatMoney } from "@/lib/money";
import { formatDateZurich } from "@/lib/time";

export type InvoiceLine = { label: string; sublabel?: string | null; amountCents: number };

export type InvoiceDocumentProps = {
  title?: string;
  number: string;
  issuedAt: Date;
  dueAt: Date;
  status: "OPEN" | "PAID" | "CANCELLED" | string;
  currency: string;
  payee: { name: string; street?: string | null; zip?: string | null; city?: string | null; iban?: string | null };
  debtor: { name: string; email?: string | null; street?: string | null; zip?: string | null; city?: string | null; memberNumber?: string | null };
  lines: InvoiceLine[];
  discount?: { label: string; amountCents: number } | null;
  totalCents: number;
  note?: string | null;
  intro?: string | null;
  qrSvg?: string | null;
};

/** Druckbare A4-Rechnung. Wird als Seite im Druck-Layout verwendet (210 × 297 mm). */
export function InvoiceDocument(p: InvoiceDocumentProps) {
  const title = p.title ?? "Rechnung";
  return (
    <div className="relative bg-white shadow-lg print:shadow-none flex flex-col text-neutral-900 break-after-page" style={{ width: "210mm", minHeight: "297mm" }}>
      <div className="flex-1" style={{ padding: "18mm 20mm 10mm" }}>
        <div className="flex justify-between items-start">
          <div className="text-sm leading-snug">
            <div className="font-semibold text-base">{p.payee.name}</div>
            {p.payee.street ? <div>{p.payee.street}</div> : null}
            {p.payee.zip || p.payee.city ? <div>{p.payee.zip} {p.payee.city}</div> : null}
          </div>
          <div className="text-right text-xs text-neutral-500">
            <div className="text-2xl font-semibold text-neutral-900 tracking-tight">{title}</div>
            <div className="mt-1">Nr. {p.number}</div>
            <div>Datum {formatDateZurich(p.issuedAt, { weekday: undefined })}</div>
            <div>Fällig {formatDateZurich(p.dueAt, { weekday: undefined })}</div>
          </div>
        </div>
        <div className="mt-12 text-sm leading-snug" style={{ minHeight: "22mm" }}>
          <div className="font-medium">{p.debtor.name}</div>
          {p.debtor.street ? <div>{p.debtor.street}</div> : null}
          {p.debtor.zip || p.debtor.city ? <div>{p.debtor.zip} {p.debtor.city}</div> : null}
          {!p.debtor.street && p.debtor.email ? <div className="text-neutral-600">{p.debtor.email}</div> : null}
          {p.debtor.memberNumber ? <div className="text-neutral-500 text-xs mt-1">Mitglied Nr. {p.debtor.memberNumber}</div> : null}
        </div>
        {p.intro ? <p className="mt-6 text-sm text-neutral-700 whitespace-pre-line">{p.intro}</p> : null}
        <table className="w-full mt-8 text-sm">
          <thead><tr className="border-b border-neutral-300 text-left text-xs text-neutral-500"><th className="py-2 font-medium">Leistung</th><th className="py-2 font-medium text-right">Betrag</th></tr></thead>
          <tbody>
            {p.lines.map((l, i) => (
              <tr key={i} className="border-b border-neutral-200">
                <td className="py-3"><div className="font-medium">{l.label}</div>{l.sublabel ? <div className="text-neutral-600">{l.sublabel}</div> : null}</td>
                <td className="py-3 text-right tabular-nums align-top">{formatMoney(l.amountCents, p.currency)}</td>
              </tr>
            ))}
            {p.discount && p.discount.amountCents > 0 ? <tr className="border-b border-neutral-200"><td className="py-2 text-neutral-600">{p.discount.label}</td><td className="py-2 text-right tabular-nums">− {formatMoney(p.discount.amountCents, p.currency)}</td></tr> : null}
            <tr><td className="py-3 font-semibold">Total</td><td className="py-3 text-right font-semibold tabular-nums text-base">{formatMoney(p.totalCents, p.currency)}</td></tr>
          </tbody>
        </table>
        {p.status === "PAID" ? <div className="mt-6 inline-block rounded border border-green-600 px-3 py-1 text-sm font-semibold text-green-700">BEZAHLT</div> : null}
        {p.status === "CANCELLED" ? <div className="mt-6 inline-block rounded border border-red-600 px-3 py-1 text-sm font-semibold text-red-700">STORNIERT</div> : null}
        {p.note ? <p className="mt-8 text-sm text-neutral-600 whitespace-pre-line">{p.note}</p> : null}
        {!p.qrSvg && p.status === "OPEN" ? (
          <div className="mt-8 text-sm">
            <div className="font-medium">Zahlbar bis {formatDateZurich(p.dueAt, { weekday: undefined })}</div>
            {p.payee.iban ? <div>IBAN {p.payee.iban.replace(/(.{4})/g, "$1 ").trim()} · {p.payee.name}</div> : <div className="text-neutral-500">Zahlungsangaben beim Verein erfragen.</div>}
            <div>Zahlungszweck: {title} {p.number}</div>
          </div>
        ) : null}
      </div>
      {p.qrSvg ? <div className="[&>svg]:w-[210mm] [&>svg]:h-auto" dangerouslySetInnerHTML={{ __html: p.qrSvg }} /> : null}
    </div>
  );
}

export function PrintShell({ title, subtitle, children, action }: { title: string; subtitle?: string; children: React.ReactNode; action: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-neutral-200 print:bg-white">
      <style>{`@page { size: A4 portrait; margin: 0; } @media print { html, body { background: #fff !important; } .break-after-page { break-after: page; } }`}</style>
      <div className="no-print sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-neutral-300 px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0"><div className="font-semibold truncate text-neutral-900">{title}</div>{subtitle ? <div className="text-xs text-neutral-500">{subtitle}</div> : null}</div>
        {action}
      </div>
      <div className="flex flex-col items-center gap-4 p-4 print:p-0 print:gap-0 overflow-x-auto">{children}</div>
    </div>
  );
}
