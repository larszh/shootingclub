import type { Metadata } from "next";
import { requireModule } from "@/lib/tenant";
import { getRequestLocale, getT } from "@/lib/i18n";
import { PageHeader } from "@/components/ui";
import { listMyBookings } from "@/modules/bookings/queries";
import { BookingCard } from "@/modules/bookings/ui/booking-card";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("bookings.history.title") };
}

export default async function BookingHistoryPage() {
  const ctx = await requireModule("bookings");
  const locale = await getRequestLocale();
  const t = getT(locale);
  const mine = await listMyBookings(ctx);
  return (
    <div>
      <PageHeader title={t("bookings.history.title")} subtitle={t("bookings.history.subtitle")} back={{ href: "/bookings", label: t("bookings.title") }} />
      <div className="stagger space-y-2.5">{mine.map((b) => <BookingCard key={b.id} b={b} partner={b.tenantId !== ctx.tenant.id ? t("bookings.card.ownerBadge", { club: b.tenant.name }) : null} locale={locale} />)}</div>
      {mine.length === 0 ? <p className="text-sm text-ink-3">{t("bookings.history.empty")}</p> : null}
    </div>
  );
}
