import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Repeat, Settings } from "lucide-react";
import { requireModule } from "@/lib/tenant";
import { Card, EmptyState, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { getBookingSettings, getRepeatSource, listMyBookings, listResources, partitionBookings } from "@/modules/bookings/queries";
import { repeatTarget } from "@/modules/bookings/repeat";
import { BookingWizard } from "@/modules/bookings/ui/booking-wizard";
import { BookingCard } from "@/modules/bookings/ui/booking-card";
import { todayZurich } from "@/lib/time";

export const metadata: Metadata = { title: "Reservationen" };

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ repeat?: string }> }) {
  const ctx = await requireModule("bookings");
  const sp = await searchParams;
  const [settings, resources, mine, source] = await Promise.all([
    getBookingSettings(ctx.tenant.id), listResources(ctx.tenant.id), listMyBookings(ctx),
    sp.repeat ? getRepeatSource(ctx, sp.repeat) : Promise.resolve(null),
  ]);
  const repeatResource = source ? resources.find((r) => r.id === source.resourceId) : null;
  const prefill = source && repeatResource ? { resourceId: source.resourceId, duration: source.durationMinutes, ...repeatTarget(source.startsAt) } : null;
  const { upcoming, past } = partitionBookings(mine);
  const canManage = ctx.can("tenant.manage");

  return (
    <div>
      <PageHeader title="Reservationen" subtitle={`${ctx.tenant.name}`} action={canManage ? <LinkButton href="/admin/bookings" variant="secondary" size="sm"><Settings className="h-4 w-4" /> Verwalten</LinkButton> : null} />

      {upcoming.length ? (
        <>
          <SectionTitle>Deine nächsten Termine</SectionTitle>
          <div className="stagger space-y-2.5 mb-6">{upcoming.map((b) => <BookingCard key={b.id} b={b} />)}</div>
        </>
      ) : null}

      <SectionTitle>{prefill ? "Nochmals reservieren" : "Neu reservieren"}</SectionTitle>
      {prefill && repeatResource ? (
        <Card className="animate-rise mb-3 p-3 flex items-center gap-2 text-sm"><Repeat className="h-4 w-4 text-ink-2 shrink-0" /><span className="flex-1">Wie letztes Mal: <span className="font-medium">{repeatResource.name}</span>, eine Woche später. Prüfe Zeit und bestätige.</span><Link href="/bookings" className="text-xs text-ink-3 hover:text-ink">Abbrechen</Link></Card>
      ) : sp.repeat ? (
        <p className="mb-3 text-xs text-ink-3">Diese Reservation kann nicht wiederholt werden (Ressource nicht mehr buchbar).</p>
      ) : null}
      {resources.length ? (
        <BookingWizard
          resources={resources.map((r) => ({ id: r.id, name: r.name, kind: r.kind, capacity: r.capacity, description: r.description, durationOptions: r.durationOptions }))}
          settings={{
            currency: settings.currency, durationOptions: settings.durationOptions, allowInvoice: settings.allowInvoice, allowOnline: settings.allowOnline, onlineProvider: settings.onlineProvider,
            approvalRequired: settings.approvalRequired, lastMinuteDiscountPercent: settings.lastMinuteDiscountPercent, lastMinuteWindowHours: settings.lastMinuteWindowHours,
            maxAdvanceDays: settings.maxAdvanceDays, cancellationHours: settings.cancellationHours,
          }}
          today={todayZurich()}
          prefill={prefill}
          key={prefill ? `repeat-${sp.repeat}` : "new"}
        />
      ) : (
        <EmptyState icon={<CalendarDays className="h-5 w-5" />} title="Noch keine Anlagen oder Bahnen erfasst" text={canManage ? "Lege unter «Verwalten» die buchbaren Ressourcen an." : "Die Verwaltung hat noch nichts zum Reservieren freigeschaltet."}
          action={canManage ? <LinkButton href="/admin/bookings/resources/new" size="sm">Ressource anlegen</LinkButton> : null} />
      )}

      {past.length ? (
        <>
          <SectionTitle action={<Link href="/bookings/history" className="text-xs text-ink-3 hover:text-ink">Alle</Link>}>Vergangene</SectionTitle>
          <div className="stagger space-y-2.5">{past.slice(0, 5).map((b) => <BookingCard key={b.id} b={b} />)}</div>
        </>
      ) : null}
    </div>
  );
}
