import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { requireModule } from "@/lib/tenant";
import { Alert, Badge, Card, PageHeader, SectionTitle } from "@/components/ui";
import { cancellationInfo, getBooking, getBookingSettings } from "@/modules/bookings/queries";
import { BOOKING_STATUS, PAYMENT_METHOD_LABEL, PAYMENT_STATUS, formatDuration, providerLabel } from "@/modules/bookings/types";
import { CancelBookingButton, DecideButtons, PaidToggle, PayNowButton, RefundedButton } from "@/modules/bookings/ui/booking-actions";
import { formatDateTimeZurich, formatDateZurich, formatTimeRange } from "@/lib/time";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Reservation" };

export default async function BookingDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ cancelled?: string }> }) {
  const ctx = await requireModule("bookings");
  const { id } = await params;
  const sp = await searchParams;
  const b = await getBooking(ctx, id);
  if (!b) notFound();
  const settings = await getBookingSettings(ctx.tenant.id);
  const st = BOOKING_STATUS[b.status]!;
  const ps = PAYMENT_STATUS[b.paymentStatus]!;
  const isAdmin = ctx.can("tenant.manage");
  const { active, canCancel } = cancellationInfo(b, settings.cancellationHours, isAdmin);
  const canPay = b.isOwner && b.status === "CONFIRMED" && b.paymentMethod === "ONLINE" && ["UNPAID", "PENDING", "FAILED"].includes(b.paymentStatus);

  return (
    <div>
      <PageHeader title={b.resource.name} subtitle={`${formatDateZurich(b.startsAt, { weekday: "long" })} · ${formatTimeRange(b.startsAt, b.endsAt)} · ${formatDuration(b.durationMinutes)}`} back={{ href: "/bookings", label: "Reservationen" }}
        action={<Badge tone={st.tone}>{st.label}</Badge>} />

      {sp.cancelled ? <div className="mb-4"><Alert tone="info">Zahlung abgebrochen. Du kannst sie unten erneut starten.</Alert></div> : null}
      {b.status === "PENDING" ? <div className="mb-4"><Alert tone="info">Die Verwaltung prüft deine Anfrage. {b.paymentMethod === "ONLINE" ? "Bezahlt wird nach der Freigabe." : ""}</Alert></div> : null}
      {b.status === "REJECTED" ? <div className="mb-4"><Alert>Diese Anfrage wurde abgelehnt.{b.adminNote ? ` Grund: ${b.adminNote}` : ""}</Alert></div> : null}

      <Card className="animate-rise divide-y divide-line overflow-hidden">
        <Row k="Gebucht von" v={b.user?.name ?? "Unbekannt"} />
        <Row k="Preis" v={b.totalCents ? <span className="tabular-nums">{b.discountCents > 0 ? <span className="text-ink-3 line-through mr-2">{formatMoney(b.basePriceCents, b.currency)}</span> : null}{formatMoney(b.totalCents, b.currency)}{b.discountReason ? <span className="text-ok text-xs ml-2">{b.discountReason}</span> : null}</span> : "gratis"} />
        {b.totalCents > 0 ? <Row k="Zahlung" v={<span className="inline-flex items-center gap-2">{PAYMENT_METHOD_LABEL[b.paymentMethod]} <Badge tone={ps.tone}>{ps.label}</Badge></span>} /> : null}
        {b.paidAt ? <Row k="Bezahlt am" v={formatDateTimeZurich(b.paidAt)} /> : null}
        {b.note ? <Row k="Bemerkung" v={b.note} /> : null}
        {isAdmin && b.adminNote ? <Row k="Notiz Verwaltung" v={b.adminNote} /> : null}
        <Row k="Erstellt" v={formatDateTimeZurich(b.createdAt)} />
      </Card>

      {canPay ? <div className="animate-rise [animation-delay:80ms] mt-4"><PayNowButton bookingId={b.id} /></div> : null}

      {b.invoice ? (
        <>
          <SectionTitle>Rechnung</SectionTitle>
          <Link href={`/bookings/${b.id}/invoice`} target="_blank" className="block press">
            <Card className="p-4 flex items-center gap-3 hover:border-ink/30"><FileText className="h-5 w-5 text-ink-2" /><span className="flex-1"><span className="block font-medium">Rechnung {b.invoice.number}</span><span className="block text-xs text-ink-3">Fällig am {formatDateZurich(b.invoice.dueAt)} · {b.invoice.status === "PAID" ? "bezahlt" : b.invoice.status === "CANCELLED" ? "storniert" : "offen"}</span></span><span className="text-sm text-ink-3">Öffnen / Drucken</span></Card>
          </Link>
        </>
      ) : null}

      {b.payments.length && isAdmin ? (
        <>
          <SectionTitle>Zahlungsversuche</SectionTitle>
          <Card className="animate-rise divide-y divide-line overflow-hidden">
            {b.payments.map((p) => <Row key={p.id} k={`${providerLabel(p.provider)} · ${formatDateTimeZurich(p.createdAt)}`} v={<span className="font-mono text-xs break-all">{p.status} · {p.providerRef}</span>} />)}
          </Card>
        </>
      ) : null}

      {(canCancel || isAdmin) ? (
        <>
          <SectionTitle>Aktionen</SectionTitle>
          <div className="animate-rise flex flex-wrap gap-2 items-center">
            {isAdmin && b.status === "PENDING" ? <DecideButtons bookingId={b.id} /> : null}
            {isAdmin && b.totalCents > 0 && b.status !== "CANCELLED" && b.paymentStatus !== "REFUNDED" ? <PaidToggle bookingId={b.id} paid={b.paymentStatus === "PAID"} /> : null}
            {isAdmin && b.status === "CANCELLED" && b.paymentStatus === "PAID" ? <RefundedButton bookingId={b.id} /> : null}
            {canCancel ? <CancelBookingButton bookingId={b.id} /> : null}
          </div>
          {!isAdmin && active && !canCancel ? <p className="text-xs text-ink-3 mt-2">Stornierung nur bis {settings.cancellationHours} Stunden vor Beginn möglich.</p> : null}
        </>
      ) : null}
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3 text-sm"><span className="text-ink-3 shrink-0">{k}</span><span className="text-right font-medium">{v}</span></div>
  );
}
