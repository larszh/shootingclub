import { notFound } from "next/navigation";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { requireModule } from "@/lib/tenant";
import { db } from "@/lib/db";
import { verifyBookingPayment } from "@/modules/bookings/payment-flow";
import { Card, LinkButton, PageHeader } from "@/components/ui";
import { PayNowButton } from "@/modules/bookings/ui/booking-actions";
import { PaymentStatusPoller } from "@/lib/payments/ui/status-poller";
import { getRequestLocale, getT } from "@/lib/i18n";
import { localizeMessage } from "@/modules/billing/ui/i18n";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("bookings.return.meta") };
}

export default async function ReturnPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireModule("bookings");
  const { id } = await params;
  const b = await db.booking.findUnique({ where: { id } });
  if (!b || b.tenantId !== ctx.tenant.id || (b.userId !== ctx.user.id && !ctx.can("tenant.manage"))) notFound();
  const r = await verifyBookingPayment(id);
  const paid = r.status === "PAID";
  const failed = r.status === "FAILED";
  // Zahlung nach (automatischer) Stornierung: Geld ist da, der Platz aber nicht mehr reserviert.
  const late = paid && (b.status === "CANCELLED" || b.status === "REJECTED");
  const locale = await getRequestLocale();
  const t = getT(locale);
  const state = late ? "late" : paid ? "paid" : failed ? "failed" : "pending";
  return (
    <div>
      <PageHeader title={t(`bookings.return.h.${state}`)} back={{ href: `/bookings/${id}`, label: t("bookings.detail.title") }} />
      <Card className="animate-pop p-8 text-center">
        <div className={`mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full ${paid ? "bg-ok/15 text-ok" : failed ? "bg-accent-soft text-accent" : "bg-surface-2 text-ink-2"}`}>
          {paid ? <CheckCircle2 className="h-8 w-8" /> : failed ? <XCircle className="h-8 w-8" /> : <Clock className="h-8 w-8" />}
        </div>
        <p className="text-ink-2">
          {t(`bookings.return.t.${state}`)}
        </p>
        {"error" in r && r.error ? <p className="mt-2 text-xs text-ink-3">{localizeMessage(r.error, locale)}</p> : null}
        {r.status === "PENDING" && !("needsReview" in r && r.needsReview) ? <PaymentStatusPoller locale={locale} /> : null}
        <div className="mt-5 flex flex-col gap-2 items-center">
          {failed && b.userId === ctx.user.id ? <div className="w-full max-w-xs"><PayNowButton bookingId={id} locale={locale} /></div> : null}
          <LinkButton href={`/bookings/${id}`} variant="secondary">{t("bookings.return.toBooking")}</LinkButton>
        </div>
      </Card>
    </div>
  );
}
