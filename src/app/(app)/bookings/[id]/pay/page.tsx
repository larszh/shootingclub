import { notFound, redirect } from "next/navigation";
import { requireModule } from "@/lib/tenant";
import { db } from "@/lib/db";
import { startOnlinePayment } from "@/modules/bookings/payment-flow";
import { Alert, LinkButton, PageHeader } from "@/components/ui";

export const metadata = { title: "Bezahlen" };

export default async function PayPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireModule("bookings");
  const { id } = await params;
  const b = await db.booking.findUnique({ where: { id } });
  if (!b || b.tenantId !== ctx.tenant.id || b.userId !== ctx.user.id) notFound();
  if (b.paymentStatus === "PAID" || b.paymentMethod !== "ONLINE" || b.status !== "CONFIRMED") redirect(`/bookings/${id}`);
  const result = await startOnlinePayment(b, ctx.user.email);
  if (result.ok) redirect(result.redirectUrl);
  return (
    <div>
      <PageHeader title="Zahlung nicht möglich" back={{ href: `/bookings/${id}`, label: "Reservation" }} />
      <Alert>{result.error}</Alert>
      <p className="mt-3 text-sm text-ink-3">Die Reservation bleibt 30 Minuten reserviert. Du kannst die Zahlung auf der Reservationsseite erneut starten.</p>
      <div className="mt-4"><LinkButton href={`/bookings/${id}`} variant="secondary">Zur Reservation</LinkButton></div>
    </div>
  );
}
