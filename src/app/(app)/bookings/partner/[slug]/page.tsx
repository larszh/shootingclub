import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Repeat } from "lucide-react";
import { requireModule } from "@/lib/tenant";
import { Alert, Card, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { getBookingSettings } from "@/modules/bookings/queries";
import { repeatTarget } from "@/modules/bookings/repeat";
import { BookingWizard } from "@/modules/bookings/ui/booking-wizard";
import { getGuestRepeatSource, listSharedResourcesForGuest } from "@/modules/sharing/queries";
import { todayZurich } from "@/lib/time";
import { getRequestLocale, getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("bookings.partner.metaTitle") };
}

/**
 * Reservation auf einer Anlage eines Partnervereins. Zeigt nur Ressourcen, die für den aktiven Verein
 * freigegeben und buchbar sind; alles Weitere des Eigentümers bleibt unsichtbar.
 */
export default async function PartnerBookingPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ resourceId?: string; repeat?: string }> }) {
  const ctx = await requireModule("bookings");
  const locale = await getRequestLocale();
  const t = getT(locale);
  const { slug } = await params;
  const sp = await searchParams;
  if (!/^[\w-]{1,64}$/.test(slug)) notFound();
  if (!ctx.tenant.role) notFound();
  const [group] = await listSharedResourcesForGuest(ctx.tenant.id, { ownerSlug: slug.toLowerCase() });
  if (!group || !group.resources.length) {
    // Wiederholen einer früheren Partnerbuchung, deren Freigabe pausiert oder entfernt wurde:
    // Hinweis statt 404.
    if (!sp.repeat) notFound();
    return (
      <div>
        <PageHeader title={t("bookings.partner.repeatTitle")} subtitle={t("bookings.partner.subtitle", { club: ctx.tenant.name })} back={{ href: "/bookings", label: t("bookings.title") }} />
        <Alert tone="info">{t("bookings.partner.repeatGone")}</Alert>
        <div className="mt-4"><LinkButton href="/bookings" variant="secondary">{t("bookings.partner.toBookings")}</LinkButton></div>
      </div>
    );
  }
  const [settings, source] = await Promise.all([getBookingSettings(group.owner.id), sp.repeat ? getGuestRepeatSource(ctx, sp.repeat) : Promise.resolve(null)]);
  const repeatResource = source ? group.resources.find((r) => r.id === source.resourceId) : null;
  const prefill = source && repeatResource
    ? { resourceId: source.resourceId, duration: source.durationMinutes, persons: source.persons, ...repeatTarget(source.startsAt) }
    : sp.resourceId && group.resources.some((r) => r.id === sp.resourceId)
      ? { resourceId: sp.resourceId, duration: 0, date: "", time: "" }
      : null;

  return (
    <div>
      <PageHeader title={t("bookings.list.sharedTitle", { club: group.owner.name })} subtitle={t("bookings.partner.subtitle", { club: ctx.tenant.name })} back={{ href: "/bookings", label: t("bookings.title") }} />
      {prefill && repeatResource ? (
        <Card className="animate-rise mb-3 p-3 flex items-center gap-2 text-sm"><Repeat className="h-4 w-4 text-ink-2 shrink-0" /><span className="flex-1">{t("bookings.list.repeatLead")} <span className="font-medium">{repeatResource.name}</span>{t("bookings.list.repeatTail")}</span><Link href={`/bookings/partner/${group.owner.slug}`} className="text-xs text-ink-3 hover:text-ink">{t("bookings.common.cancel")}</Link></Card>
      ) : sp.repeat ? (
        <p className="mb-3 text-xs text-ink-3">{t("bookings.partner.repeatUnavailable")}</p>
      ) : null}
      <SectionTitle>{repeatResource ? t("bookings.list.again") : t("bookings.list.new")}</SectionTitle>
      <BookingWizard
        shared={{ ownerName: group.owner.name }}
        resources={group.resources.map((r) => ({ id: r.id, name: r.name, kind: r.kind, capacity: r.capacity, maxPersons: r.maxPersons, description: r.description, durationOptions: r.durationOptions, priceFactorPercent: r.priceFactorPercent, shareNote: r.shareNote }))}
        settings={{
          currency: settings.currency, durationOptions: settings.durationOptions,
          // Partnerbuchungen werden immer über die Rechnung des Eigentümers abgerechnet.
          allowInvoice: settings.allowInvoice, allowOnline: false, onlineProvider: "NONE",
          approvalRequired: settings.approvalRequired, lastMinuteDiscountPercent: settings.lastMinuteDiscountPercent, lastMinuteWindowHours: settings.lastMinuteWindowHours,
          maxAdvanceDays: settings.maxAdvanceDays, cancellationHours: settings.cancellationHours,
          personPricing: settings.personPricing, maxPersons: settings.maxPersons, flatExclusive: settings.flatExclusive, capacityPerPerson: settings.capacityPerPerson,
        }}
        today={todayZurich()}
        prefill={prefill}
        key={`${group.owner.id}-${sp.repeat ?? sp.resourceId ?? "new"}`}
        locale={locale}
      />
      {!settings.allowInvoice ? <p className="mt-3 text-xs text-ink-3">{t("bookings.partner.noInvoice", { club: group.owner.name })}</p> : null}
    </div>
  );
}
