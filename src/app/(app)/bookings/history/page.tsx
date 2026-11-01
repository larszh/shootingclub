import { requireModule } from "@/lib/tenant";
import { PageHeader } from "@/components/ui";
import { listMyBookings } from "@/modules/bookings/queries";
import { BookingCard } from "@/modules/bookings/ui/booking-card";
import { ownerBadge } from "@/modules/sharing/logic";

export const metadata = { title: "Meine Reservationen" };

export default async function BookingHistoryPage() {
  const ctx = await requireModule("bookings");
  const mine = await listMyBookings(ctx);
  return (
    <div>
      <PageHeader title="Meine Reservationen" subtitle="Im eigenen Verein und auf gemeinsamen Anlagen" back={{ href: "/bookings", label: "Reservationen" }} />
      <div className="stagger space-y-2.5">{mine.map((b) => <BookingCard key={b.id} b={b} partner={ownerBadge(b, ctx.tenant.id)} />)}</div>
      {mine.length === 0 ? <p className="text-sm text-ink-3">Noch keine Reservationen.</p> : null}
    </div>
  );
}
