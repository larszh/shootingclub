import { notFound, redirect } from "next/navigation";
import { requireModule } from "@/lib/tenant";
import { db } from "@/lib/db";
import { startOnlinePayment } from "@/modules/bookings/payment-flow";
import { Alert, LinkButton, PageHeader } from "@/components/ui";
import { getRequestLocale, getT } from "@/lib/i18n";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("bookings.pay.title") };
}

export default async function PayPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireModule("bookings");
  const { id } = await params;
  const b = await db.booking.findUnique({ where: { id } });
  if (!b || b.tenantId !== ctx.tenant.id || b.userId !== ctx.user.id) notFound();
  if (b.paymentStatus === "PAID" || b.paymentMethod !== "ONLINE" || b.status !== "CONFIRMED") redirect(`/bookings/${id}`);
  const result = await startOnlinePayment(b, ctx.user.email);
  if (result.ok) redirect(result.redirectUrl);
  const t = getT(await getRequestLocale());
  return (
    <div>
      <PageHeader title={t("bookings.pay.failedTitle")} back={{ href: `/bookings/${id}`, label: t("bookings.detail.title") }} />
      <Alert>{result.error}</Alert>
      <p className="mt-3 text-sm text-ink-3">{t("bookings.pay.failedText")}</p>
      <div className="mt-4"><LinkButton href={`/bookings/${id}`} variant="secondary">{t("bookings.pay.toBooking")}</LinkButton></div>
    </div>
  );
}
