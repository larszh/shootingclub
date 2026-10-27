import { CalendarDays } from "lucide-react";
import { requirePermission } from "@/lib/tenant";
import { EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { userAvatarUrl } from "@/components/avatar";
import { AdminBookingTabs } from "@/modules/bookings/ui/admin-tabs";
import { AdminBookingForm } from "@/modules/bookings/ui/admin-booking-form";
import { getBookingSettings, listMembersForBooking, listResources } from "@/modules/bookings/queries";
import { todayZurich } from "@/lib/time";

export const metadata = { title: "Buchung erfassen" };

export default async function AdminNewBookingPage({ searchParams }: { searchParams: Promise<{ resourceId?: string; date?: string; userId?: string; duration?: string; time?: string }> }) {
  const ctx = await requirePermission("tenant.manage");
  const sp = await searchParams;
  const [settings, resources, members] = await Promise.all([getBookingSettings(ctx.tenant.id), listResources(ctx.tenant.id), listMembersForBooking(ctx.tenant.id)]);
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : undefined;
  const time = sp.time && /^\d{2}:\d{2}$/.test(sp.time) ? sp.time : undefined;
  const duration = sp.duration && /^\d{1,4}$/.test(sp.duration) ? Number(sp.duration) : undefined;
  return (
    <div>
      <PageHeader title="Buchung erfassen" subtitle="Im Namen eines Mitglieds reservieren" back={{ href: "/admin/bookings/calendar", label: "Kalender" }} />
      <AdminBookingTabs />
      {resources.length ? (
        <AdminBookingForm
          members={members.map((m) => ({ userId: m.userId, name: m.name, email: m.email, memberNumber: m.memberNumber, avatarUrl: userAvatarUrl({ id: m.userId, avatarPath: m.avatarPath, updatedAt: m.updatedAt }) }))}
          resources={resources.map((r) => ({ id: r.id, name: r.name, durationOptions: r.durationOptions }))}
          durationOptions={settings.durationOptions}
          currency={settings.currency}
          today={todayZurich()}
          initial={{ resourceId: sp.resourceId, date, userId: sp.userId, duration, time }}
        />
      ) : (
        <EmptyState icon={<CalendarDays className="h-5 w-5" />} title="Noch keine Ressourcen" text="Lege zuerst eine buchbare Anlage, Bahn oder einen Raum an." action={<LinkButton href="/admin/bookings/resources/new" size="sm">Ressource anlegen</LinkButton>} />
      )}
    </div>
  );
}
