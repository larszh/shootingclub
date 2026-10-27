import { requireModule } from "@/lib/tenant";
import { PageHeader } from "@/components/ui";
import { listMyBookings } from "@/modules/bookings/queries";
import { BookingCard } from "@/modules/bookings/ui/booking-card";

export const metadata = { title: "Meine Reservationen" };

export default async function BookingHistoryPage() {
  const ctx = await requireModule("bookings");
  const mine = await listMyBookings(ctx);
  return (
    <div>
      <PageHeader title="Meine Reservationen" back={{ href: "/bookings", label: "Reservationen" }} />
      <div className="stagger space-y-2.5">{mine.map((b) => <BookingCard key={b.id} b={b} />)}</div>
      {mine.length === 0 ? <p className="text-sm text-ink-3">Noch keine Reservationen.</p> : null}
    </div>
  );
}
