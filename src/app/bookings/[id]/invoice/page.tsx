import { notFound } from "next/navigation";
import { requireModule } from "@/lib/tenant";
import { getBooking, getBookingSettings } from "@/modules/bookings/queries";
import { getBillingProfile, profileToCreditor } from "@/modules/billing/profile";
import { renderQrBillSvg } from "@/lib/qr-bill";
import { formatDateZurich, formatTimeRange } from "@/lib/time";
import { formatDuration } from "@/modules/bookings/types";
import { InvoiceDocument, PrintShell } from "@/components/invoice-document";
import { PrintButton } from "@/app/targets/[id]/print/print-button";

export const metadata = { title: "Rechnung" };

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireModule("bookings");
  const { id } = await params;
  const b = await getBooking(ctx, id);
  if (!b || !b.invoice) notFound();
  const [s, profile] = await Promise.all([getBookingSettings(ctx.tenant.id), getBillingProfile(ctx.tenant.id, ctx.tenant.name)]);
  const inv = b.invoice;
  const creditor = profileToCreditor(profile, ctx.tenant.name);
  const qr = inv.status === "OPEN" ? await renderQrBillSvg({ amountCents: inv.amountCents, currency: inv.currency, creditor, debtor: b.user ? { name: b.user.name } : null, message: `Rechnung ${inv.number}` }) : null;
  return (
    <PrintShell title={`Rechnung ${inv.number}`} subtitle={`A4 · ${inv.status === "PAID" ? "bezahlt" : inv.status === "CANCELLED" ? "storniert" : "offen"}`} action={<PrintButton />}>
      <InvoiceDocument
        number={inv.number} issuedAt={inv.issuedAt} dueAt={inv.dueAt} status={inv.status} currency={inv.currency}
        payee={creditor} debtor={{ name: b.user?.name ?? "Gast", email: b.user?.email }}
        lines={[{ label: `Reservation ${b.resource.name}`, sublabel: `${formatDateZurich(b.startsAt, { weekday: "long" })}, ${formatTimeRange(b.startsAt, b.endsAt)} · ${formatDuration(b.durationMinutes)}`, amountCents: b.basePriceCents }]}
        discount={b.discountCents > 0 ? { label: b.discountReason ?? "Rabatt", amountCents: b.discountCents } : null}
        totalCents={inv.amountCents} note={s.invoiceNote} qrSvg={qr}
      />
    </PrintShell>
  );
}
