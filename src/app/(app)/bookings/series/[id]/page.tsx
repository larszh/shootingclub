import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePermission } from "@/lib/tenant";
import { Alert, Badge, Card, PageHeader, SectionTitle } from "@/components/ui";
import { getSeries } from "@/modules/bookings/series-queries";
import { cancellableOccurrences, weekdaysLabel } from "@/modules/bookings/series";
import { BOOKING_STATUS } from "@/modules/bookings/types";
import { CancelOccurrenceButton, CancelSeriesButton } from "@/modules/bookings/ui/series-buttons";
import { formatDateZurich, formatTimeRange } from "@/lib/time";

export const metadata: Metadata = { title: "Serie" };

export default async function SeriesDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string; skipped?: string }> }) {
  const ctx = await requirePermission("bookings.series");
  if (!ctx.hasModule("bookings")) redirect("/?module=bookings");
  const { id } = await params;
  const sp = await searchParams;
  const s = await getSeries(ctx.tenant.id, id);
  if (!s || (s.userId !== ctx.user.id && !ctx.can("tenant.manage"))) notFound();
  const now = new Date();
  const cancellable = new Set(cancellableOccurrences(s.bookings, now).map((b) => b.id));
  const upcoming = s.bookings.filter((b) => b.endsAt >= now);
  const past = s.bookings.filter((b) => b.endsAt < now);
  const created = Number(sp.created);
  const skipped = Number(sp.skipped);
  const day = (d: Date) => formatDateZurich(d, { weekday: undefined, timeZone: "UTC" });

  return (
    <div>
      <PageHeader title={`${s.resource.name} · ${weekdaysLabel(s.weekdays)}`} subtitle={`${s.startTime}–${s.endTime} · ${day(s.fromDate)} – ${day(s.untilDate)}`} back={{ href: "/bookings/series", label: "Serien" }}
        action={s.status === "CANCELLED" ? <Badge tone="outline">Storniert</Badge> : <Badge tone="ok">Aktiv</Badge>} />

      {Number.isInteger(created) && created > 0 ? (
        <div className="mb-4"><Alert tone={skipped > 0 ? "warn" : "ok"}>
          {created === 1 ? "1 Termin angelegt" : `${created} Termine angelegt`}{skipped > 0 ? `, ${skipped} wegen Konflikt übersprungen` : ""}.
        </Alert></div>
      ) : null}

      <Card className="animate-rise divide-y divide-line overflow-hidden">
        <Row k="Wochentage" v={weekdaysLabel(s.weekdays, true)} />
        <Row k="Zeit" v={`${s.startTime}–${s.endTime}`} />
        <Row k="Personen" v={String(s.persons)} />
        {s.user ? <Row k="Angelegt von" v={s.user.name} /> : null}
        {s.note ? <Row k="Bemerkung" v={s.note} /> : null}
      </Card>

      <SectionTitle>{upcoming.length === 1 ? "1 kommender Termin" : `${upcoming.length} kommende Termine`}</SectionTitle>
      {upcoming.length ? (
        <Card className="animate-rise divide-y divide-line overflow-hidden">
          {upcoming.map((b) => <Occurrence key={b.id} b={b} canCancel={cancellable.has(b.id)} />)}
        </Card>
      ) : <p className="text-sm text-ink-3">Keine kommenden Termine.</p>}

      {past.length ? (
        <>
          <SectionTitle>Vergangene</SectionTitle>
          <Card className="animate-rise divide-y divide-line overflow-hidden">
            {past.slice(-20).reverse().map((b) => <Occurrence key={b.id} b={b} canCancel={false} />)}
          </Card>
        </>
      ) : null}

      {s.status === "ACTIVE" && cancellable.size ? (
        <>
          <SectionTitle>Aktionen</SectionTitle>
          <CancelSeriesButton seriesId={s.id} upcoming={cancellable.size} />
        </>
      ) : null}
    </div>
  );
}

function Occurrence({ b, canCancel }: { b: { id: string; startsAt: Date; endsAt: Date; status: string }; canCancel: boolean }) {
  const st = BOOKING_STATUS[b.status] ?? { label: b.status, tone: "neutral" as const };
  const label = formatDateZurich(b.startsAt);
  return (
    <div className="flex items-center gap-3 px-4 py-2 min-h-14 text-sm">
      <Link href={`/bookings/${b.id}`} className={`min-w-0 flex-1 hover:underline ${b.status === "CANCELLED" ? "text-ink-3 line-through" : ""}`}>
        <span className="tabular-nums">{label}</span> · <span className="tabular-nums">{formatTimeRange(b.startsAt, b.endsAt)}</span>
      </Link>
      {b.status !== "CONFIRMED" ? <Badge tone={st.tone}>{st.label}</Badge> : null}
      {canCancel ? <CancelOccurrenceButton bookingId={b.id} label={label} /> : null}
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex items-start justify-between gap-4 px-4 py-3 text-sm"><span className="text-ink-3 shrink-0">{k}</span><span className="text-right font-medium">{v}</span></div>;
}
