import { notFound } from "next/navigation";
import { requireModule } from "@/lib/tenant";
import { getBooking, getBookingSettings } from "@/modules/bookings/queries";
import { renderQrBillSvg } from "@/modules/bookings/invoice";
import { formatDateZurich, formatTimeRange } from "@/lib/time";
import { formatMoney } from "@/lib/money";
import { formatDuration } from "@/modules/bookings/types";
import { PrintButton } from "@/app/targets/[id]/print/print-button";

export const metadata = { title: "Rechnung" };

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireModule("bookings");
  const { id } = await params;
  const b = await getBooking(ctx, id);
  if (!b || !b.invoice) notFound();
  const s = await getBookingSettings(ctx.tenant.id);
  const inv = b.invoice;
  const payee = { name: s.payeeName ?? ctx.tenant.name, street: s.payeeStreet ?? "", zip: s.payeeZip ?? "", city: s.payeeCity ?? "", iban: s.iban ?? "" };
  const qr = inv.status !== "CANCELLED" ? await renderQrBillSvg({ amountCents: inv.amountCents, currency: inv.currency, creditor: payee, debtorName: b.user?.name, message: `Rechnung ${inv.number}` }) : null;

  return (
    <div className="min-h-dvh bg-neutral-200 print:bg-white text-neutral-900">
      <style>{`@page { size: A4 portrait; margin: 0; } @media print { html, body { background: #fff !important; } }`}</style>
      <div className="no-print sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-neutral-300 px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0"><div className="font-semibold truncate">Rechnung {inv.number}</div><div className="text-xs text-neutral-500">A4 · {inv.status === "PAID" ? "bezahlt" : inv.status === "CANCELLED" ? "storniert" : "offen"}</div></div>
        <PrintButton />
      </div>
      <div className="flex justify-center p-4 print:p-0 overflow-x-auto">
        <div className="relative bg-white shadow-lg print:shadow-none flex flex-col" style={{ width: "210mm", minHeight: "297mm" }}>
          <div className="flex-1" style={{ padding: "18mm 20mm 10mm" }}>
            <div className="flex justify-between items-start">
              <div className="text-sm leading-snug">
                <div className="font-semibold text-base">{payee.name}</div>
                {payee.street ? <div>{payee.street}</div> : null}
                {payee.zip || payee.city ? <div>{payee.zip} {payee.city}</div> : null}
              </div>
              <div className="text-right text-xs text-neutral-500">
                <div className="text-2xl font-semibold text-neutral-900 tracking-tight">Rechnung</div>
                <div className="mt-1">Nr. {inv.number}</div>
                <div>Datum {formatDateZurich(inv.issuedAt, { weekday: undefined })}</div>
                <div>Fällig {formatDateZurich(inv.dueAt, { weekday: undefined })}</div>
              </div>
            </div>
            <div className="mt-14 text-sm">
              <div className="text-xs text-neutral-500 mb-1">Rechnung an</div>
              <div className="font-medium">{b.user?.name ?? "Gast"}</div>
              {b.user?.email ? <div className="text-neutral-600">{b.user.email}</div> : null}
            </div>
            <table className="w-full mt-10 text-sm">
              <thead><tr className="border-b border-neutral-300 text-left text-xs text-neutral-500"><th className="py-2 font-medium">Leistung</th><th className="py-2 font-medium text-right">Betrag</th></tr></thead>
              <tbody>
                <tr className="border-b border-neutral-200">
                  <td className="py-3">
                    <div className="font-medium">Reservation {b.resource.name}</div>
                    <div className="text-neutral-600">{formatDateZurich(b.startsAt, { weekday: "long" })}, {formatTimeRange(b.startsAt, b.endsAt)} · {formatDuration(b.durationMinutes)}</div>
                  </td>
                  <td className="py-3 text-right tabular-nums align-top">{formatMoney(b.basePriceCents, b.currency)}</td>
                </tr>
                {b.discountCents > 0 ? <tr className="border-b border-neutral-200"><td className="py-2 text-neutral-600">{b.discountReason ?? "Rabatt"}</td><td className="py-2 text-right tabular-nums">− {formatMoney(b.discountCents, b.currency)}</td></tr> : null}
                <tr><td className="py-3 font-semibold">Total</td><td className="py-3 text-right font-semibold tabular-nums text-base">{formatMoney(inv.amountCents, inv.currency)}</td></tr>
              </tbody>
            </table>
            {inv.status === "PAID" ? <div className="mt-6 inline-block rounded border border-green-600 px-3 py-1 text-sm font-semibold text-green-700">BEZAHLT</div> : null}
            {inv.status === "CANCELLED" ? <div className="mt-6 inline-block rounded border border-red-600 px-3 py-1 text-sm font-semibold text-red-700">STORNIERT</div> : null}
            {s.invoiceNote ? <p className="mt-8 text-sm text-neutral-600 whitespace-pre-line">{s.invoiceNote}</p> : null}
            {!qr && inv.status === "OPEN" ? (
              <div className="mt-8 text-sm">
                <div className="font-medium">Zahlbar bis {formatDateZurich(inv.dueAt, { weekday: undefined })}</div>
                {payee.iban ? <div>IBAN {payee.iban.replace(/(.{4})/g, "$1 ").trim()} · {payee.name}</div> : <div className="text-neutral-500">Zahlungsangaben beim Verein erfragen.</div>}
                <div>Zahlungszweck: Rechnung {inv.number}</div>
              </div>
            ) : null}
          </div>
          {qr ? <div className="[&>svg]:w-[210mm] [&>svg]:h-auto" dangerouslySetInnerHTML={{ __html: qr }} /> : null}
        </div>
      </div>
    </div>
  );
}
