import type { Metadata } from "next";
import { CalendarDays, Download, Plus } from "lucide-react";
import { requirePermission } from "@/lib/tenant";
import { Button, Card, EmptyState, Input, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { monthRange } from "@/modules/bookings/calendar";
import { AdminBookingTabs } from "@/modules/bookings/ui/admin-tabs";
import { bookingStats, listTenantBookings } from "@/modules/bookings/queries";
import { BookingCard } from "@/modules/bookings/ui/booking-card";
import { DecideButtons } from "@/modules/bookings/ui/booking-actions";
import { formatDateZurich, formatTimeRange, todayZurich } from "@/lib/time";
import { formatMoney } from "@/lib/money";
import Link from "next/link";
import { personsSuffix } from "@/modules/bookings/pricing";

export const metadata: Metadata = { title: "Reservationen verwalten" };

export default async function AdminBookingsPage() {
  const ctx = await requirePermission("tenant.manage");
  const [stats, pending, upcoming, openInvoices] = await Promise.all([
    bookingStats(ctx.tenant.id),
    listTenantBookings(ctx.tenant.id, { status: "PENDING" }),
    listTenantBookings(ctx.tenant.id, { status: "CONFIRMED", from: new Date(), limit: 30 }),
    listTenantBookings(ctx.tenant.id, { limit: 300 }).then((all) => all.filter((b) => b.invoice?.status === "OPEN")),
  ]);
  const month = monthRange(todayZurich());
  return (
    <div>
      <PageHeader title="Reservationen" subtitle={ctx.tenant.name} back={{ href: "/me", label: "Mehr" }}
        action={<LinkButton href="/admin/bookings/new" size="sm"><Plus className="h-4 w-4" /> Buchen</LinkButton>} />
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
                  <div className="text-xs text-ink-3">{formatDateZurich(b.startsAt)} · {formatTimeRange(b.startsAt, b.endsAt)}{personsSuffix(b) ? ` · ${personsSuffix(b)}` : ""} · {b.totalCents ? formatMoney(b.totalCents, b.currency) : "gratis"}</div>
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

      <SectionTitle action={<Link href="/admin/bookings/calendar" className="inline-flex items-center gap-1 text-xs text-ink-3 hover:text-ink"><CalendarDays className="h-3.5 w-3.5" /> Kalender</Link>}>Kommende Buchungen</SectionTitle>
      {upcoming.length ? <div className="stagger space-y-2.5">{upcoming.map((b) => <BookingCard key={b.id} b={b} showUser />)}</div> : <EmptyState title="Nichts geplant" text="Sobald Mitglieder reservieren, erscheint es hier." />}

      <SectionTitle>Export</SectionTitle>
      <Card className="animate-rise p-4">
        <form action="/api/export/bookings" method="get" className="space-y-3">
          <p className="text-sm text-ink-3">Alle Buchungen eines Zeitraums als Tabelle (CSV für Excel) mit Ressource, Mitglied, Zeiten, Personen, Preis, Status und Zahlung.</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="block text-sm font-medium text-ink-2 mb-1.5">Von</span><Input type="date" name="from" defaultValue={month.from} required /></label>
            <label className="block"><span className="block text-sm font-medium text-ink-2 mb-1.5">Bis</span><Input type="date" name="to" defaultValue={month.to} required /></label>
          </div>
          <Button type="submit" variant="secondary" className="w-full"><Download className="h-4 w-4" /> CSV herunterladen</Button>
        </form>
      </Card>
    </div>
  );
}
