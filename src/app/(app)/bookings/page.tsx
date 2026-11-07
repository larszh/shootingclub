import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ChevronRight, Handshake, Repeat, Settings } from "lucide-react";
import { getRequestLocale, getT } from "@/lib/i18n";
import { requireModule } from "@/lib/tenant";
import { Card, EmptyState, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { getBookingSettings, getRepeatSource, listMyBookings, listResources, partitionBookings } from "@/modules/bookings/queries";
import { repeatTarget } from "@/modules/bookings/repeat";
import { placesText, resourceKindLabelT } from "@/modules/bookings/i18n";
import { BookingWizard } from "@/modules/bookings/ui/booking-wizard";
import { BookingCard } from "@/modules/bookings/ui/booking-card";
import { ResourceIcon } from "@/modules/bookings/ui/resource-icon";
import { listSharedResourcesForGuest } from "@/modules/sharing/queries";
import { todayZurich } from "@/lib/time";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("bookings.title") };
}

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ repeat?: string }> }) {
  const ctx = await requireModule("bookings");
  const locale = await getRequestLocale();
  const t = getT(locale);
  const sp = await searchParams;
  const [settings, resources, mine, source, shared] = await Promise.all([
    getBookingSettings(ctx.tenant.id), listResources(ctx.tenant.id), listMyBookings(ctx),
    sp.repeat ? getRepeatSource(ctx, sp.repeat) : Promise.resolve(null),
    // Nur echte Mitglieder (nicht Super-Admins ohne Mitgliedschaft) sehen Anlagen von Partnervereinen.
    ctx.tenant.role ? listSharedResourcesForGuest(ctx.tenant.id) : Promise.resolve([]),
  ]);
  const repeatResource = source ? resources.find((r) => r.id === source.resourceId) : null;
  const prefill = source && repeatResource ? { resourceId: source.resourceId, duration: source.durationMinutes, persons: source.persons, ...repeatTarget(source.startsAt) } : null;
  const { upcoming, past } = partitionBookings(mine);
  const canManage = ctx.can("tenant.manage");
  const canSeries = ctx.can("bookings.series");
  const ownerBadge = (b: { tenantId: string; tenant: { name: string } }) => (b.tenantId !== ctx.tenant.id ? t("bookings.card.ownerBadge", { club: b.tenant.name }) : null);

  return (
    <div>
      <PageHeader title={t("bookings.title")} subtitle={`${ctx.tenant.name}`} action={canManage ? <LinkButton href="/admin/bookings" variant="secondary" size="sm"><Settings className="h-4 w-4" /> {t("bookings.list.manage")}</LinkButton> : canSeries ? <LinkButton href="/bookings/series" variant="secondary" size="sm"><Repeat className="h-4 w-4" /> {t("bookings.list.series")}</LinkButton> : null} />

      {upcoming.length ? (
        <>
          <SectionTitle>{t("bookings.list.upcoming")}</SectionTitle>
          <div className="stagger space-y-2.5 mb-6">{upcoming.map((b) => <BookingCard key={b.id} b={b} partner={ownerBadge(b)} locale={locale} />)}</div>
        </>
      ) : null}

      {resources.length || !shared.length ? <SectionTitle action={canManage && canSeries ? <Link href="/bookings/series" className="inline-flex items-center gap-1 text-xs text-ink-3 hover:text-ink"><Repeat className="h-3.5 w-3.5" /> {t("bookings.list.series")}</Link> : undefined}>{prefill ? t("bookings.list.again") : t("bookings.list.new")}</SectionTitle> : null}
      {prefill && repeatResource ? (
        <Card className="animate-rise mb-3 p-3 flex items-center gap-2 text-sm"><Repeat className="h-4 w-4 text-ink-2 shrink-0" /><span className="flex-1">{t("bookings.list.repeatLead")} <span className="font-medium">{repeatResource.name}</span>{t("bookings.list.repeatTail")}</span><Link href="/bookings" className="text-xs text-ink-3 hover:text-ink">{t("bookings.common.cancel")}</Link></Card>
      ) : sp.repeat ? (
        <p className="mb-3 text-xs text-ink-3">{t("bookings.list.repeatUnavailable")}</p>
      ) : null}
      {resources.length ? (
        <BookingWizard
          resources={resources.map((r) => ({ id: r.id, name: r.name, kind: r.kind, capacity: r.capacity, maxPersons: r.maxPersons, description: r.description, durationOptions: r.durationOptions }))}
          settings={{
            currency: settings.currency, durationOptions: settings.durationOptions, allowInvoice: settings.allowInvoice, allowOnline: settings.allowOnline, onlineProvider: settings.onlineProvider,
            approvalRequired: settings.approvalRequired, lastMinuteDiscountPercent: settings.lastMinuteDiscountPercent, lastMinuteWindowHours: settings.lastMinuteWindowHours,
            maxAdvanceDays: settings.maxAdvanceDays, cancellationHours: settings.cancellationHours,
            personPricing: settings.personPricing, maxPersons: settings.maxPersons, flatExclusive: settings.flatExclusive, capacityPerPerson: settings.capacityPerPerson,
          }}
          today={todayZurich()}
          prefill={prefill}
          key={prefill ? `repeat-${sp.repeat}` : "new"}
          locale={locale}
        />
      ) : !shared.length ? (
        <EmptyState icon={<CalendarDays className="h-5 w-5" />} title={t("bookings.list.emptyTitle")} text={canManage ? t("bookings.list.emptyAdmin") : t("bookings.list.emptyMember")}
          action={canManage ? <LinkButton href="/admin/bookings/resources/new" size="sm">{t("bookings.list.createResource")}</LinkButton> : null} />
      ) : null}

      {shared.map((g) => (
        <section key={g.owner.id}>
          <SectionTitle>{t("bookings.list.sharedTitle", { club: g.owner.name })}</SectionTitle>
          <Card className="animate-rise divide-y divide-line overflow-hidden">
            {g.resources.map((r) => (
              <Link key={r.id} href={`/bookings/partner/${g.owner.slug}?resourceId=${r.id}`} className="flex items-center gap-3 px-4 py-3 min-h-14 hover:bg-surface-2">
                <ResourceIcon kind={r.kind} />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium truncate">{r.name}</span>
                  <span className="block text-xs text-ink-3 truncate">{resourceKindLabelT(r.kind, t)}{r.capacity > 1 ? ` · ${placesText(r.capacity, t)}` : ""}{g.owner.city ? ` · ${g.owner.city}` : ""}{r.priceFactorPercent !== 100 ? ` · ${t("bookings.partnerRate", { percent: r.priceFactorPercent })}` : ""}</span>
                </span>
                <ChevronRight className="h-4 w-4 text-ink-3 shrink-0" aria-hidden />
              </Link>
            ))}
          </Card>
          <p className="mt-1.5 flex items-center gap-1.5 px-1 text-xs text-ink-3"><Handshake className="h-3.5 w-3.5" aria-hidden /> {t("bookings.list.sharedHint", { club: g.owner.name })}</p>
        </section>
      ))}

      {past.length ? (
        <>
          <SectionTitle action={<Link href="/bookings/history" className="text-xs text-ink-3 hover:text-ink">{t("bookings.list.all")}</Link>}>{t("bookings.list.past")}</SectionTitle>
          <div className="stagger space-y-2.5">{past.slice(0, 5).map((b) => <BookingCard key={b.id} b={b} partner={ownerBadge(b)} locale={locale} />)}</div>
        </>
      ) : null}
    </div>
  );
}
