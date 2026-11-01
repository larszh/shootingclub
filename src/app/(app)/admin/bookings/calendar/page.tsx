import Link from "next/link";
import { Ban, ChevronLeft, ChevronRight, Clock, Handshake, Plus } from "lucide-react";
import { requirePermission } from "@/lib/tenant";
import { Badge, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { partnerNameMap } from "@/modules/sharing/queries";
import { Avatar, userAvatarUrl } from "@/components/avatar";
import { AdminBookingTabs } from "@/modules/bookings/ui/admin-tabs";
import { listCalendarItems, listResources } from "@/modules/bookings/queries";
import { buildWeek, parseWeekParam, type CalendarCellItem } from "@/modules/bookings/calendar";
import { addDays, zurichToUtc } from "@/lib/time";
import { cn } from "@/lib/utils";

/** Kurzform der Personen für die enge Kalenderzelle: «3 P.», «5 P. pauschal». */
function personsShort(it: { persons: number; isFlatRate: boolean }) {
  if (it.isFlatRate) return `${it.persons} P. pauschal`;
  return it.persons > 1 ? `${it.persons} P.` : null;
}

export const metadata = { title: "Belegungskalender" };

export default async function BookingCalendarPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const ctx = await requirePermission("tenant.manage");
  const monday = parseWeekParam((await searchParams).week);
  const from = zurichToUtc(monday, "00:00");
  const to = zurichToUtc(addDays(monday, 7), "00:00");
  const [resources, items] = await Promise.all([listResources(ctx.tenant.id, { includeInactive: true }), listCalendarItems(ctx.tenant.id, from, to)]);
  const used = new Set(items.bookings.map((b) => b.resourceId));
  const shown = resources.filter((r) => r.isActive || used.has(r.id)).map((r) => ({ id: r.id, name: r.name }));
  const partners = await partnerNameMap(items.bookings.map((b) => b.viaTenantId));
  const bookings = items.bookings.map((b) => ({ ...b, partner: b.viaTenantId ? partners[b.viaTenantId] ?? "Partnerverein" : null }));
  const week = buildWeek(monday, shown, bookings, items.blocks);
  const sunday = addDays(monday, 6);
  const range = `${monday.slice(8, 10)}.${monday.slice(5, 7)}. – ${sunday.slice(8, 10)}.${sunday.slice(5, 7)}.${sunday.slice(0, 4)}`;

  return (
    <div>
      <PageHeader title="Kalender" subtitle={`KW ${week.week} · ${range} · ${week.total} ${week.total === 1 ? "Buchung" : "Buchungen"}`} back={{ href: "/admin/bookings", label: "Reservationen" }}
        action={<LinkButton href={`/admin/bookings/new?date=${week.isCurrentWeek ? "" : monday}`} size="sm"><Plus className="h-4 w-4" /> Buchen</LinkButton>} />
      <AdminBookingTabs />

      <div className="animate-fade flex flex-wrap items-center gap-2 mb-4">
        <Link href={`/admin/bookings/calendar?week=${week.prev}`} className="press h-11 w-11 rounded-full border border-line bg-surface flex items-center justify-center" aria-label="Vorherige Woche"><ChevronLeft className="h-5 w-5" /></Link>
        <Link href="/admin/bookings/calendar" className={cn("press h-11 rounded-full px-4 text-sm font-medium border flex items-center", week.isCurrentWeek ? "bg-ink text-bg border-ink" : "bg-surface border-line")}>Heute</Link>
        <Link href={`/admin/bookings/calendar?week=${week.next}`} className="press h-11 w-11 rounded-full border border-line bg-surface flex items-center justify-center" aria-label="Nächste Woche"><ChevronRight className="h-5 w-5" /></Link>
        <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-ok" /> bestätigt</span>
          <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3 text-warn" aria-hidden /> Freigabe offen</span>
          <span className="hidden sm:inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-ink-3" /> gesperrt</span>
          {bookings.some((b) => b.partner) ? <span className="inline-flex items-center gap-1"><Handshake className="h-3 w-3" aria-hidden /> Partnerverein</span> : null}
        </div>
      </div>

      {shown.length === 0 ? (
        <EmptyState title="Noch keine Ressourcen" text="Lege zuerst Anlagen, Bahnen oder Räume an." action={<LinkButton href="/admin/bookings/resources/new" size="sm">Ressource anlegen</LinkButton>} />
      ) : (
        <>
          {/* Grosse Bildschirme: Raster mit fixer Ressourcen-Spalte */}
          <Card className="animate-rise hidden md:block overflow-x-auto">
            <table className="w-full border-collapse text-sm min-w-[900px]">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-surface border-b border-r border-line px-3 py-2 text-left text-xs font-semibold text-ink-3 w-40">Ressource</th>
                  {week.days.map((d) => (
                    <th key={d.date} className={cn("border-b border-line px-2 py-2 text-left text-xs font-semibold capitalize", d.isToday ? "text-accent" : "text-ink-3")}>{d.label}{d.isToday ? " · heute" : ""}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {week.rows.map((row) => (
                  <tr key={row.resource.id} className="align-top">
                    <th scope="row" className="sticky left-0 z-10 bg-surface border-b border-r border-line px-3 py-2 text-left font-medium">{row.resource.name}</th>
                    {row.cells.map((cell, i) => (
                      <td key={week.days[i]!.date} className={cn("border-b border-line p-1.5 min-w-[118px]", week.days[i]!.isToday && "bg-accent-soft/30")}>
                        <div className="space-y-1">
                          {cell.map((it) => <Item key={`${it.type}-${it.id}`} it={it} />)}
                          <Link href={`/admin/bookings/new?resourceId=${row.resource.id}&date=${week.days[i]!.date}`} className="flex h-7 items-center justify-center rounded-md text-ink-3/50 hover:bg-surface-2 hover:text-ink-2" aria-label={`Buchung am ${week.days[i]!.longLabel} erfassen`}><Plus className="h-3.5 w-3.5" /></Link>
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Kleine Bildschirme: Agenda Tag für Tag */}
          <div className="md:hidden space-y-4">
            {week.days.map((d, i) => {
              const entries = week.rows.flatMap((row) => row.cells[i]!.map((it) => ({ it, resource: row.resource }))).sort((a, b) => a.it.sort - b.it.sort);
              return (
                <section key={d.date} className="animate-rise">
                  <div className="flex items-center justify-between mb-1.5">
                    <h2 className={cn("text-sm font-semibold capitalize", d.isToday ? "text-accent" : "text-ink-2")}>{d.longLabel}{d.isToday ? " · heute" : ""}</h2>
                    <Link href={`/admin/bookings/new?date=${d.date}`} className="press inline-flex h-9 items-center gap-1 rounded-full px-3 text-xs font-medium text-ink-2 hover:bg-surface-2"><Plus className="h-3.5 w-3.5" /> Buchen</Link>
                  </div>
                  {entries.length ? (
                    <Card className="divide-y divide-line overflow-hidden">
                      {entries.map(({ it, resource }) => <AgendaRow key={`${it.type}-${it.id}-${resource.id}`} it={it} resourceName={resource.name} />)}
                    </Card>
                  ) : (
                    <p className="text-xs text-ink-3 px-1">Nichts gebucht.</p>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function Item({ it }: { it: CalendarCellItem }) {
  if (it.type === "block") {
    return (
      <div className="rounded-md border border-dashed border-line bg-surface-2 px-2 py-1 text-xs text-ink-3" title={it.reason ?? "Gesperrt"}>
        <div className="font-medium tabular-nums">{it.time}</div>
        <div className="flex min-w-0 items-center gap-1"><Ban className="h-3 w-3 shrink-0" /><span className="truncate">{it.reason ?? "Gesperrt"}</span></div>
      </div>
    );
  }
  return (
    <Link href={`/bookings/${it.id}`} title={it.note ?? undefined}
      className={cn("press block rounded-md border-l-4 px-2 py-1 text-xs hover:brightness-95", it.status === "PENDING" ? "border-warn bg-warn/10" : "border-ok bg-ok/10")}>
      <div className="flex items-center gap-1 font-medium tabular-nums text-ink">
        {it.time}
        {it.status === "PENDING" ? <Clock className="h-3 w-3 shrink-0 text-warn" aria-hidden /> : null}
        {personsShort(it) ? <span className="ml-auto font-normal text-ink-3">{personsShort(it)}</span> : null}
        <span className="sr-only">{it.status === "PENDING" ? "Freigabe offen" : "bestätigt"}</span>
      </div>
      <div className="flex items-center gap-1 min-w-0">
        {it.user ? <Avatar name={it.name} src={userAvatarUrl(it.user)} size={16} tone="soft" /> : null}
        <span className="truncate text-ink-2">{it.name}</span>
        {it.unpaid ? <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-accent" title="nicht bezahlt"><span className="sr-only">nicht bezahlt</span></span> : null}
      </div>
      {it.partner ? <div className="mt-0.5 truncate text-[10px] font-medium text-ink-3" title={`Partnerverein ${it.partner}`}><Handshake className="mr-0.5 inline h-3 w-3" aria-hidden />{it.partner}</div> : null}
    </Link>
  );
}

function AgendaRow({ it, resourceName }: { it: CalendarCellItem; resourceName: string }) {
  if (it.type === "block") {
    return (
      <div className="flex items-center gap-3 px-4 py-3 text-sm text-ink-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2"><Ban className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1"><div className="font-medium text-ink-2">{resourceName} gesperrt</div><div className="text-xs">{it.time}{it.reason ? ` · ${it.reason}` : ""}</div></div>
      </div>
    );
  }
  return (
    <Link href={`/bookings/${it.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2 min-h-14">
      <Avatar name={it.name} src={it.user ? userAvatarUrl(it.user) : null} size={36} tone={it.user ? "soft" : "guest"} />
      <div className="min-w-0 flex-1">
        <div className="font-medium truncate">{it.name}{it.partner ? <Badge tone="outline" className="ml-1.5 align-middle">{it.partner}</Badge> : null}</div>
        <div className="text-xs text-ink-3 truncate"><span className="tabular-nums">{it.time}</span> · {resourceName}{personsShort(it) ? ` · ${personsShort(it)}` : ""}{it.note ? ` · «${it.note}»` : ""}</div>
      </div>
      {it.status === "PENDING"
        ? <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-medium text-warn"><Clock className="h-3.5 w-3.5" aria-hidden /> Freigabe</span>
        : <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-ok" aria-hidden />}
      <span className="sr-only">{it.status === "PENDING" ? "Freigabe offen" : "bestätigt"}</span>
      {it.unpaid ? <span className="text-[10px] font-medium text-accent">offen</span> : null}
    </Link>
  );
}
