import { CalendarDays } from "lucide-react";
import { requirePermission } from "@/lib/tenant";
import { EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { userAvatarUrl } from "@/components/avatar";
import { AdminBookingTabs } from "@/modules/bookings/ui/admin-tabs";
import { AdminBookingForm } from "@/modules/bookings/ui/admin-booking-form";
import { getBookingSettings, listMembersForBooking, listResources } from "@/modules/bookings/queries";
import { isCalendarDate } from "@/modules/bookings/types";
import { todayZurich } from "@/lib/time";
import { getRequestLocale, getT } from "@/lib/i18n";

export async function generateMetadata() {
  return { title: getT(await getRequestLocale())("adm1.bk.newTitle") };
}

export default async function AdminNewBookingPage({ searchParams }: { searchParams: Promise<{ resourceId?: string; date?: string; userId?: string; duration?: string; time?: string; persons?: string }> }) {
  const ctx = await requirePermission("tenant.manage");
  const sp = await searchParams;
  const t = getT(await getRequestLocale());
  const [settings, resources, members] = await Promise.all([getBookingSettings(ctx.tenant.id), listResources(ctx.tenant.id), listMembersForBooking(ctx.tenant.id)]);
  const date = isCalendarDate(sp.date) ? sp.date : undefined;
  const time = sp.time && /^\d{2}:\d{2}$/.test(sp.time) ? sp.time : undefined;
  const duration = sp.duration && /^\d{1,4}$/.test(sp.duration) ? Number(sp.duration) : undefined;
  const persons = sp.persons && /^\d{1,3}$/.test(sp.persons) ? Number(sp.persons) : undefined;
  return (
    <div>
      <PageHeader title={t("adm1.bk.newTitle")} subtitle={t("adm1.bk.newSubtitle")} back={{ href: "/admin/bookings/calendar", label: t("adm1.bk.calendar") }} />
      <AdminBookingTabs />
      {resources.length ? (
        <AdminBookingForm
          members={members.map((m) => ({ userId: m.userId, name: m.name, email: m.email, memberNumber: m.memberNumber, avatarUrl: userAvatarUrl({ id: m.userId, avatarPath: m.avatarPath, updatedAt: m.updatedAt }) }))}
          resources={resources.map((r) => ({ id: r.id, name: r.name, kind: r.kind, capacity: r.capacity, maxPersons: r.maxPersons, durationOptions: r.durationOptions }))}
          durationOptions={settings.durationOptions}
          currency={settings.currency}
          today={todayZurich()}
          initial={{ resourceId: sp.resourceId, date, userId: sp.userId, duration, time, persons }}
          personSettings={{ personPricing: settings.personPricing, maxPersons: settings.maxPersons, flatExclusive: settings.flatExclusive, capacityPerPerson: settings.capacityPerPerson }}
        />
      ) : (
        <EmptyState icon={<CalendarDays className="h-5 w-5" />} title={t("adm1.bk.noResources")} text={t("adm1.bk.noResourcesFirst")} action={<LinkButton href="/admin/bookings/resources/new" size="sm">{t("adm1.bk.createResource")}</LinkButton>} />
      )}
    </div>
  );
}
