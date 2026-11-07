import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarPlus, FileText, Repeat } from "lucide-react";
import { requireTenant } from "@/lib/tenant";
import { Alert, Badge, Card, PageHeader, SectionTitle } from "@/components/ui";
import { Avatar, userAvatarUrl } from "@/components/avatar";
import { ResourceIcon } from "@/modules/bookings/ui/resource-icon";
import { repeatTarget } from "@/modules/bookings/repeat";
import { formatQrReference } from "@/lib/qr-reference";
import { getBillingProfile } from "@/modules/billing/profile";
import { cancellationInfo, getBooking, getBookingSettings } from "@/modules/bookings/queries";
import { formatDuration, providerLabel } from "@/modules/bookings/types";
import { bookingStatusView, discountReasonLabel, formatDateL, formatDateTimeL, formatTimeRangeL, paymentMethodLabel, paymentStatusViewT } from "@/modules/bookings/i18n";
import { getRequestLocale, getT } from "@/lib/i18n";
import { CancelBookingButton, DecideButtons, PaidToggle, PayNowButton, RefundedButton } from "@/modules/bookings/ui/booking-actions";
import { formatMoney } from "@/lib/money";
import { personsSuffix } from "@/modules/bookings/pricing";
import { partnerNameMap, resolveGuestShare } from "@/modules/sharing/queries";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("bookings.detail.title") };
}

export default async function BookingDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ cancelled?: string; created?: string; outsideWindow?: string }> }) {
  // Kein requireModule: Partnerbuchungen gehören dem Eigentümer; das buchende Mitglied soll sie auch
  // sehen und stornieren können, wenn der eigene Verein das Modul später ausschaltet (wie die Rechnung).
  const ctx = await requireTenant();
  const locale = await getRequestLocale();
  const t = getT(locale);
  const { id } = await params;
  const sp = await searchParams;
  const b = await getBooking(ctx, id);
  if (!b || (!b.isGuest && !ctx.hasModule("bookings"))) {
    if (!ctx.hasModule("bookings")) redirect("/?module=bookings");
    notFound();
  }
  // Regeln und Rechnungsprofil des Vereins, dem die Anlage gehört (bei Partnerbuchungen der Eigentümer).
  // «Wiederholen» bei Partnerbuchungen nur, solange die Anlage für den aktiven Verein buchbar ist
  // und dort das Modul aktiv ist (sonst führt der Link ins Leere).
  const [settings, billingProfile, partnerNames, guestShare] = await Promise.all([
    getBookingSettings(b.tenantId), getBillingProfile(b.tenantId), partnerNameMap([b.viaTenantId]),
    b.isGuest && b.isOwner && b.viaTenantId === ctx.tenant.id && ctx.hasModule("bookings") ? resolveGuestShare(ctx, b.resourceId) : Promise.resolve(null),
  ]);
  const st = bookingStatusView(b.status, t);
  const ps = paymentStatusViewT(b, t);
  const isAdmin = b.isOwnerAdmin;
  const { active, canCancel } = cancellationInfo(b, settings.cancellationHours, isAdmin);
  const canPay = b.isOwner && b.status === "CONFIRMED" && b.paymentMethod === "ONLINE" && ["UNPAID", "PENDING", "FAILED"].includes(b.paymentStatus);
  const again = repeatTarget(b.startsAt);
  // Partnerbuchungen: das Mitglied gehört nicht zum Verein, darum ohne Vorauswahl der Person.
  const adminAgainHref = `/admin/bookings/new?resourceId=${b.resourceId}&date=${again.date}&time=${again.time}&duration=${b.durationMinutes}${b.persons > 1 ? `&persons=${b.persons}` : ""}${b.userId && !b.viaTenantId ? `&userId=${b.userId}` : ""}`;
  const repeatHref = b.isGuest ? `/bookings/partner/${b.tenant.slug}?repeat=${b.id}` : `/bookings?repeat=${b.id}`;
  const canRepeat = b.isOwner && (!b.isGuest || !!guestShare?.ok);
  const partner = b.viaTenantId ? partnerNames[b.viaTenantId] ?? t("bookings.detail.partnerDeleted") : null;
  const longDate = formatDateL(b.startsAt, locale, { weekday: "long" });
  const timeRange = formatTimeRangeL(b.startsAt, b.endsAt, locale);
  const persons = personsSuffix(b, t);

  return (
    <div>
      <PageHeader title={b.resource.name} subtitle={`${longDate} · ${timeRange} · ${formatDuration(b.durationMinutes, t)}`} back={ctx.hasModule("bookings") ? { href: "/bookings", label: t("bookings.title") } : { href: "/", label: t("bookings.detail.home") }}
        action={<Badge tone={st.tone}>{st.label}</Badge>} />

      {sp.created ? <div className="mb-4"><Alert tone="ok">{b.user ? t("bookings.detail.createdFor", { name: b.user.name }) : t("bookings.detail.created")}</Alert></div> : null}
      {sp.created && sp.outsideWindow && isAdmin ? <div className="mb-4"><Alert tone="warn">{t("bookings.detail.outsideWindow")}</Alert></div> : null}
      {sp.cancelled ? <div className="mb-4"><Alert tone="info">{t("bookings.detail.paymentAborted")}</Alert></div> : null}
      {b.isGuest ? <div className="mb-4"><Alert tone="info" title={t("bookings.card.ownerBadge", { club: b.tenant.name })}>{t(partner ? "bookings.detail.guestViaNamed" : "bookings.detail.guestVia", { partner: partner ?? "", owner: b.tenant.name })}{b.invoice || b.paymentMethod === "INVOICE" ? t("bookings.detail.guestInvoice", { owner: b.tenant.name }) : ""}.</Alert></div> : null}
      {b.status === "PENDING" ? <div className="mb-4"><Alert tone="info">{t("bookings.detail.pending")}{b.paymentMethod === "ONLINE" ? ` ${t("bookings.detail.payAfterApproval")}` : ""}</Alert></div> : null}
      {b.status === "REJECTED" ? <div className="mb-4"><Alert>{b.adminNote ? t("bookings.detail.rejectedReason", { reason: b.adminNote }) : t("bookings.detail.rejected")}</Alert></div> : null}
      {b.seriesId ? <div className="mb-4"><Alert tone="info" title={t("bookings.series.badge")}>{t("bookings.detail.seriesInfo")}{ctx.can("bookings.series") && (b.isOwner || isAdmin) ? <> <Link href={`/bookings/series/${b.seriesId}`} className="underline">{t("bookings.detail.seriesOpen")}</Link></> : null}</Alert></div> : null}

      <Card className="animate-rise divide-y divide-line overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <ResourceIcon kind={b.resource.kind} size={40} />
          <div className="min-w-0 flex-1"><div className="font-medium truncate">{b.resource.name}</div><div className="text-xs text-ink-3">{longDate} · <span className="tabular-nums">{timeRange}</span>{persons ? ` · ${persons}` : ""}</div></div>
        </div>
        {isAdmin && partner ? <Row k={t("bookings.detail.partner")} v={<Badge tone="outline">{partner}</Badge>} /> : null}
        {b.isGuest ? <Row k={t("bookings.detail.owner")} v={b.tenant.name} /> : null}
        <Row k={t("bookings.detail.bookedBy")} v={<span className="inline-flex items-center gap-2">{b.user ? <Avatar name={b.user.name} src={userAvatarUrl(b.user)} size={24} tone="soft" /> : null}{b.user?.name ?? t("bookings.detail.unknown")}</span>} />
        {b.persons > 1 || b.isFlatRate ? <Row k={t("bookings.detail.persons")} v={b.isFlatRate ? `${b.persons} · ${t("bookings.wizard.flatPriceShort")}` : String(b.persons)} /> : null}
        <Row k={t("bookings.detail.price")} v={b.totalCents ? <span className="tabular-nums">{b.discountCents > 0 ? <span className="text-ink-3 line-through mr-2">{formatMoney(b.basePriceCents, b.currency)}</span> : null}{formatMoney(b.totalCents, b.currency)}{b.discountReason ? <span className="text-ok text-xs ml-2">{discountReasonLabel(b.discountReason, t)}</span> : null}</span> : t("bookings.free")} />
        {b.totalCents > 0 ? <Row k={t("bookings.detail.payment")} v={<span className="inline-flex items-center gap-2">{paymentMethodLabel(b.paymentMethod, t)} <Badge tone={ps.tone}>{ps.label}</Badge></span>} /> : null}
        {b.paidAt ? <Row k={t("bookings.detail.paidAt")} v={formatDateTimeL(b.paidAt, locale)} /> : null}
        {b.note ? <Row k={t("bookings.detail.note")} v={b.note} /> : null}
        {isAdmin && b.adminNote ? <Row k={t("bookings.detail.adminNote")} v={b.adminNote} /> : null}
        <Row k={t("bookings.detail.createdAt")} v={formatDateTimeL(b.createdAt, locale)} />
      </Card>

      {canPay ? <div className="animate-rise [animation-delay:80ms] mt-4"><PayNowButton bookingId={b.id} locale={locale} /></div> : null}

      {b.invoice ? (
        <>
          <SectionTitle>{t("bookings.detail.invoice")}</SectionTitle>
          <Link href={`/bookings/${b.id}/invoice`} target="_blank" className="block press">
            <Card className="p-4 flex items-center gap-3 hover:border-ink/30"><FileText className="h-5 w-5 text-ink-2" /><span className="flex-1 min-w-0"><span className="block font-medium">{t("bookings.detail.invoiceNumber", { number: b.invoice.number })}</span><span className="block text-xs text-ink-3">{t("bookings.detail.invoiceDue", { date: formatDateL(b.invoice.dueAt, locale) })} · {t(b.invoice.status === "PAID" ? "bookings.invoice.paid" : b.invoice.status === "CANCELLED" ? "bookings.invoice.cancelled" : "bookings.invoice.open")}</span>{b.invoice.reference && b.invoice.status === "OPEN" && billingProfile.qrIban ? <span className="block text-xs text-ink-3 font-mono truncate">{t("bookings.detail.reference")} {formatQrReference(b.invoice.reference)}</span> : null}</span><span className="text-sm text-ink-3">{t("bookings.detail.openPrint")}</span></Card>
          </Link>
        </>
      ) : null}

      <SectionTitle>{t("bookings.detail.appointment")}</SectionTitle>
      <div className="animate-rise grid grid-cols-2 gap-2">
        <a href={`/bookings/${b.id}/ics`} download className="press"><Card className="p-3.5 flex items-center gap-2 hover:border-ink/30 min-h-14"><CalendarPlus className="h-5 w-5 text-ink-2" /><span className="text-sm font-medium">{t("bookings.detail.addCalendar")}</span></Card></a>
        {canRepeat ? (
          <Link href={repeatHref} className="press"><Card className="p-3.5 flex items-center gap-2 hover:border-ink/30 min-h-14"><Repeat className="h-5 w-5 text-ink-2" /><span className="min-w-0"><span className="block text-sm font-medium">{t("bookings.detail.repeat")}</span><span className="block text-xs text-ink-3 truncate">{t("bookings.detail.repeatSame", { date: formatDateL(new Date(`${again.date}T12:00:00Z`), locale, { year: undefined, timeZone: "UTC" }) })}</span></span></Card></Link>
        ) : isAdmin ? (
          <Link href={adminAgainHref} className="press"><Card className="p-3.5 flex items-center gap-2 hover:border-ink/30 min-h-14"><Repeat className="h-5 w-5 text-ink-2" /><span className="text-sm font-medium">{t("bookings.detail.bookAgain")}</span></Card></Link>
        ) : null}
      </div>

      {b.payments.length && isAdmin ? (
        <>
          <SectionTitle>{t("bookings.detail.attempts")}</SectionTitle>
          <Card className="animate-rise divide-y divide-line overflow-hidden">
            {b.payments.map((p) => <Row key={p.id} k={`${providerLabel(p.provider)} · ${formatDateTimeL(p.createdAt, locale)}`} v={<span className="font-mono text-xs break-all">{p.status} · {p.providerRef}</span>} />)}
          </Card>
        </>
      ) : null}

      {(canCancel || isAdmin) ? (
        <>
          <SectionTitle>{t("bookings.detail.actions")}</SectionTitle>
          <div className="animate-rise flex flex-wrap gap-2 items-center">
            {isAdmin && b.status === "PENDING" ? <DecideButtons bookingId={b.id} /> : null}
            {isAdmin && b.totalCents > 0 && (b.status === "PENDING" || b.status === "CONFIRMED") && b.paymentStatus !== "REFUNDED" ? <PaidToggle bookingId={b.id} paid={b.paymentStatus === "PAID"} /> : null}
            {isAdmin && b.status === "CANCELLED" && b.paymentStatus === "PAID" ? <RefundedButton bookingId={b.id} /> : null}
            {canCancel ? <CancelBookingButton bookingId={b.id} locale={locale} /> : null}
          </div>
          {!isAdmin && active && !canCancel ? <p className="text-xs text-ink-3 mt-2">{t("bookings.err.cancelDeadline", { hours: settings.cancellationHours })}</p> : null}
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
