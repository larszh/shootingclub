import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { requirePermission } from "@/lib/tenant";
import { EmptyState, PageHeader } from "@/components/ui";
import { getBookingSettings, listResources } from "@/modules/bookings/queries";
import { maxPersonsFor } from "@/modules/bookings/pricing";
import { SeriesForm } from "@/modules/bookings/ui/series-form";
import { addDays, todayZurich } from "@/lib/time";
import { getRequestLocale, getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("bookings.series.new") };
}

export default async function NewSeriesPage() {
  const ctx = await requirePermission("bookings.series");
  if (!ctx.hasModule("bookings")) redirect("/?module=bookings");
  const [settings, resources] = await Promise.all([getBookingSettings(ctx.tenant.id), listResources(ctx.tenant.id)]);
  const today = todayZurich();
  const t = getT(await getRequestLocale());
  return (
    <div>
      <PageHeader title={t("bookings.series.new")} subtitle={t("bookings.series.newSub")} back={{ href: "/bookings/series", label: t("bookings.list.series") }} />
      {resources.length ? (
        <>
          <SeriesForm resources={resources.map((r) => ({ id: r.id, name: r.name, maxPersons: maxPersonsFor(r, settings) }))} today={today} defaultUntil={addDays(today, 12 * 7)} />
          <p className="mt-3 px-1 text-xs text-ink-3">{t(ctx.hasModule("range") ? "bookings.series.checkInfoRange" : "bookings.series.checkInfo")}</p>
        </>
      ) : (
        <EmptyState icon={<CalendarDays className="h-5 w-5" />} title={t("bookings.series.noResources")} text={t("bookings.series.noResourcesText")} />
      )}
    </div>
  );
}
