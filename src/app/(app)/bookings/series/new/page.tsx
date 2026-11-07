import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { requirePermission } from "@/lib/tenant";
import { EmptyState, PageHeader } from "@/components/ui";
import { getBookingSettings, listResources } from "@/modules/bookings/queries";
import { maxPersonsFor } from "@/modules/bookings/pricing";
import { SeriesForm } from "@/modules/bookings/ui/series-form";
import { addDays, todayZurich } from "@/lib/time";

export const metadata: Metadata = { title: "Neue Serie" };

export default async function NewSeriesPage() {
  const ctx = await requirePermission("bookings.series");
  if (!ctx.hasModule("bookings")) redirect("/?module=bookings");
  const [settings, resources] = await Promise.all([getBookingSettings(ctx.tenant.id), listResources(ctx.tenant.id)]);
  const today = todayZurich();
  return (
    <div>
      <PageHeader title="Neue Serie" subtitle="Wiederkehrende Reservation, z.B. jeden Dienstag" back={{ href: "/bookings/series", label: "Serien" }} />
      {resources.length ? (
        <>
          <SeriesForm resources={resources.map((r) => ({ id: r.id, name: r.name, maxPersons: maxPersonsFor(r, settings) }))} today={today} defaultUntil={addDays(today, 12 * 7)} />
          <p className="mt-3 px-1 text-xs text-ink-3">Jeder Termin wird einzeln geprüft (Öffnungszeiten, Sperrzeiten, Belegung{ctx.hasModule("range") ? ", Schiesszeiten" : ""}). Belegte Termine werden übersprungen. Serientermine sind bestätigt und kostenlos.</p>
        </>
      ) : (
        <EmptyState icon={<CalendarDays className="h-5 w-5" />} title="Noch keine Ressourcen" text="Die Verwaltung muss zuerst eine Anlage, Bahn oder einen Raum anlegen." />
      )}
    </div>
  );
}
