import type { Metadata } from "next";
import { requirePermission } from "@/lib/tenant";
import { Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui";
import { AdminBookingTabs } from "@/modules/bookings/ui/admin-tabs";
import { bookingStats, listTenantBookings } from "@/modules/bookings/queries";
import { BookingCard } from "@/modules/bookings/ui/booking-card";
import { DecideButtons } from "@/modules/bookings/ui/booking-actions";
import { formatDateZurich, formatTimeRange } from "@/lib/time";
import { formatMoney } from "@/lib/money";
import Link from "next/link";

export const metadata: Metadata = { title: "Reservationen verwalten" };

export default async function AdminBookingsPage() {
  const ctx = await requirePermission("tenant.manage");
  const [stats, pending, upcoming, openInvoices] = await Promise.all([
    bookingStats(ctx.tenant.id),
    listTenantBookings(ctx.tenant.id, { status: "PENDING" }),
    listTenantBookings(ctx.tenant.id, { status: "CONFIRMED", from: new Date(), limit: 30 }),
    listTenantBookings(ctx.tenant.id, { limit: 300 }).then((all) => all.filter((b) => b.invoice?.status === "OPEN")),
  ]);
  return (
    <div>
      <PageHeader title="Reservationen" subtitle={ctx.tenant.name} back={{ href: "/me", label: "Mehr" }} />
      <AdminBookingTabs />
      <div className="stagger grid grid-cols-3 gap-2.5">
        <Card className="p-4"><div className="text-2xl font-semibold tabular-nums">{stats.pending}</div><div className="text-xs text-ink-3">Freigaben offen</div></Card>
        <Card className="p-4"><div className="text-2xl font-semibold tabular-nums">{stats.upcoming}</div><div className="text-xs text-ink-3">Kommende</div></Card>
        <Card className="p-4"><div className="text-2xl font-semibold tabular-nums">{stats.unpaidInvoices}</div><div className="text-xs text-ink-3">Rechnungen offen</div></Card>
      </div>

      <SectionTitle>Freigaben</SectionTitle>
      {pending.length ? (
        <div className="stagger space-y-2.5">
          {pending.map((b) => (
            <Card key={b.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/bookings/${b.id}`} className="font-medium hover:underline">{b.resource.name} · {b.user?.name}</Link>
                  <div className="text-xs text-ink-3">{formatDateZurich(b.startsAt)} · {formatTimeRange(b.startsAt, b.endsAt)} · {b.totalCents ? formatMoney(b.totalCents, b.currency) : "gratis"}</div>
                  {b.note ? <div className="text-xs text-ink-3 italic mt-0.5">«{b.note}»</div> : null}
                </div>
              </div>
              <div className="mt-3"><DecideButtons bookingId={b.id} /></div>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-sm text-ink-3">Keine offenen Anfragen.</p>
      )}

      <SectionTitle>Offene Rechnungen</SectionTitle>
      {openInvoices.length ? <div className="stagger space-y-2.5">{openInvoices.map((b) => <BookingCard key={b.id} b={b} showUser />)}</div> : <p className="text-sm text-ink-3">Keine offenen Rechnungen.</p>}

      <SectionTitle>Kommende Buchungen</SectionTitle>
      {upcoming.length ? <div className="stagger space-y-2.5">{upcoming.map((b) => <BookingCard key={b.id} b={b} showUser />)}</div> : <EmptyState title="Nichts geplant" text="Sobald Mitglieder reservieren, erscheint es hier." />}
    </div>
  );
}
