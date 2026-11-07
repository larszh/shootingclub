import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus, Repeat } from "lucide-react";
import { requirePermission } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { Badge, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { listSeries } from "@/modules/bookings/series-queries";
import { weekdaysLabel } from "@/modules/bookings/series";
import { formatDateZurich } from "@/lib/time";

export const metadata: Metadata = { title: "Serienbuchungen" };

/** Serien des Vereins: Trainer sehen ihre eigenen, die Verwaltung alle. */
export default async function SeriesListPage() {
  const ctx = await requirePermission("bookings.series");
  if (!ctx.hasModule("bookings")) redirect("/?module=bookings");
  const all = ctx.can("tenant.manage");
  const series = await listSeries(ctx.tenant.id, all ? undefined : { userId: ctx.user.id });
  const day = (d: Date) => formatDateZurich(d, { weekday: undefined, timeZone: "UTC" });
  return (
    <div>
      <PageHeader title="Serienbuchungen" subtitle={all ? "Wiederkehrende Reservationen des Vereins" : "Deine wiederkehrenden Reservationen"} back={{ href: "/bookings", label: "Reservationen" }}
        action={<LinkButton href="/bookings/series/new" size="sm"><Plus className="h-4 w-4" /> Neue Serie</LinkButton>} />
      {series.length ? (
        <Card className="animate-rise divide-y divide-line overflow-hidden">
          {series.map((s) => (
            <Link key={s.id} href={`/bookings/series/${s.id}`} className="flex items-center gap-3 px-4 py-3 min-h-14 hover:bg-surface-2">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2"><Repeat className="h-4 w-4 text-ink-2" aria-hidden /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium truncate">{s.resource.name} · {weekdaysLabel(s.weekdays)} {s.startTime}–{s.endTime}</span>
                <span className="block text-xs text-ink-3 truncate">{day(s.fromDate)} – {day(s.untilDate)}{all && s.user ? ` · ${s.user.name}` : ""}{s.note ? ` · ${s.note}` : ""}</span>
              </span>
              {s.status === "CANCELLED" ? <Badge tone="outline">Storniert</Badge> : <Badge tone="ok">{s.upcoming === 1 ? "1 Termin" : `${s.upcoming} Termine`}</Badge>}
              <ChevronRight className="h-4 w-4 text-ink-3 shrink-0" aria-hidden />
            </Link>
          ))}
        </Card>
      ) : (
        <EmptyState icon={<Repeat className="h-5 w-5" />} title="Noch keine Serien" text="Reserviere eine Anlage für regelmässige Trainings, z.B. jeden Dienstag 18–20 Uhr."
          action={<LinkButton href="/bookings/series/new" size="sm">Serie anlegen</LinkButton>} />
      )}
    </div>
  );
}
