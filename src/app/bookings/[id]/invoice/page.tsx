import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/tenant";
import { getBooking, getBookingSettings } from "@/modules/bookings/queries";
import { getBillingProfile, profileToCreditor } from "@/modules/billing/profile";
import { ensureReference } from "@/modules/billing/reference";
import { renderQrBillSvg } from "@/lib/qr-bill";
import { formatDate, getT, getTenantLocale } from "@/lib/i18n";
import { formatTimeRange } from "@/lib/time";
import { formatDuration } from "@/modules/bookings/types";
import { personsSuffix } from "@/modules/bookings/pricing";
import { InvoiceDocument, PrintShell } from "@/components/invoice-document";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "Rechnung" };

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  // Kein requireModule: das Mitglied eines Partnervereins soll seine Rechnung auch dann öffnen können,
  // wenn der eigene Verein das Modul später ausschaltet. Im eigenen Verein gilt das Modul weiterhin.
  const ctx = await requireTenant();
  const { id } = await params;
  const b = await getBooking(ctx, id);
  if (!b || !b.invoice || (!b.isGuest && !ctx.hasModule("bookings"))) notFound();
  // Rechnungssteller ist immer der Verein, dem die Anlage gehört (auch bei Buchungen über einen
  // Partnerverein). getBooking lässt dabei nur das buchende Mitglied und die Verwaltung des Eigentümers zu.
  const issuer = b.tenant;
  const [s, profile, locale] = await Promise.all([getBookingSettings(issuer.id), getBillingProfile(issuer.id, issuer.name), getTenantLocale(issuer.id)]);
  const t = getT(locale);
  const inv = b.invoice;
  const creditor = profileToCreditor(profile, issuer.name);
  // Ältere Rechnungen erhalten bei QR-IBAN jetzt ihre Referenz (wird gespeichert).
  const reference = inv.status === "OPEN" && profile.qrIban ? await ensureReference("BOOKING", inv, profile.iban) : null;
  const debtor = b.user ? { name: b.user.name, street: b.user.street, zip: b.user.zip, city: b.user.city } : null;
  const qr = inv.status === "OPEN"
    ? await renderQrBillSvg({ amountCents: inv.amountCents, currency: inv.currency, creditor, debtor, message: `${t("invoice.title")} ${inv.number}`, reference, locale })
    : null;
  return (
    <PrintShell title={`${t("invoice.title")} ${inv.number}`} subtitle={`A4 · ${inv.status === "PAID" ? "bezahlt" : inv.status === "CANCELLED" ? "storniert" : "offen"}`} action={<PrintButton />}>
      <InvoiceDocument
        locale={locale}
        number={inv.number} issuedAt={inv.issuedAt} dueAt={inv.dueAt} status={inv.status} currency={inv.currency}
        payee={creditor} debtor={{ name: b.user?.name ?? t("invoice.guest"), email: b.user?.email, street: b.user?.street, zip: b.user?.zip, city: b.user?.city }}
        lines={[{ label: [t("invoice.bookingLine", { resource: b.resource.name }), personsSuffix(b, t)].filter(Boolean).join(" · "), sublabel: `${formatDate(b.startsAt, locale, { weekday: "long" })}, ${formatTimeRange(b.startsAt, b.endsAt)} · ${formatDuration(b.durationMinutes, t)}`, amountCents: b.basePriceCents }]}
        discount={b.discountCents > 0 ? { label: b.discountReason ?? t("invoice.discount"), amountCents: b.discountCents } : null}
        totalCents={inv.amountCents} note={s.invoiceNote} qrSvg={qr} reference={reference}
      />
    </PrintShell>
  );
}
