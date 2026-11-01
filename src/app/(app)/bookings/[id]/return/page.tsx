import { notFound } from "next/navigation";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { requireModule } from "@/lib/tenant";
import { db } from "@/lib/db";
import { verifyBookingPayment } from "@/modules/bookings/payment-flow";
import { Card, LinkButton, PageHeader } from "@/components/ui";
import { PayNowButton } from "@/modules/bookings/ui/booking-actions";
import { PaymentStatusPoller } from "@/lib/payments/ui/status-poller";

export const metadata = { title: "Zahlung" };

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
  return (
    <div>
      <PageHeader title={late ? "Zahlung eingegangen" : paid ? "Bezahlt, danke!" : failed ? "Zahlung fehlgeschlagen" : "Zahlung wird geprüft"} back={{ href: `/bookings/${id}`, label: "Reservation" }} />
      <Card className="animate-pop p-8 text-center">
        <div className={`mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full ${paid ? "bg-ok/15 text-ok" : failed ? "bg-accent-soft text-accent" : "bg-surface-2 text-ink-2"}`}>
          {paid ? <CheckCircle2 className="h-8 w-8" /> : failed ? <XCircle className="h-8 w-8" /> : <Clock className="h-8 w-8" />}
        </div>
        <p className="text-ink-2">
          {late ? "Die Zahlung ist eingegangen, die Reservation war aber bereits storniert. Der Verein prüft die Rückerstattung und meldet sich bei dir." : paid ? "Deine Reservation ist bezahlt und bestätigt." : failed ? "Die Zahlung wurde abgebrochen oder abgelehnt. Du kannst es erneut versuchen." : "Der Zahlungsanbieter hat die Zahlung noch nicht bestätigt. Das kann einen Moment dauern."}
        </p>
        {"error" in r && r.error ? <p className="mt-2 text-xs text-ink-3">{r.error}</p> : null}
        {r.status === "PENDING" && !("needsReview" in r && r.needsReview) ? <PaymentStatusPoller /> : null}
        <div className="mt-5 flex flex-col gap-2 items-center">
          {failed && b.userId === ctx.user.id ? <div className="w-full max-w-xs"><PayNowButton bookingId={id} /></div> : null}
          <LinkButton href={`/bookings/${id}`} variant="secondary">Zur Reservation</LinkButton>
        </div>
      </Card>
    </div>
  );
}
