import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePermission } from "@/lib/tenant";
import { Alert, Badge, Card, PageHeader, SectionTitle } from "@/components/ui";
import { getSeries } from "@/modules/bookings/series-queries";
import { cancellableOccurrences } from "@/modules/bookings/series";
import { bookingStatusView, formatDateL, formatTimeRangeL, weekdaysLabelL } from "@/modules/bookings/i18n";
import { CancelOccurrenceButton, CancelSeriesButton } from "@/modules/bookings/ui/series-buttons";
import { displayUserName, formatDate, getRequestLocale, getT, type Locale, type TFunction } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("bookings.series.badge") };
}

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
  const locale = await getRequestLocale();
  const t = getT(locale);
  const day = (d: Date) => formatDate(d, locale, { timeZone: "UTC" });

  return (
    <div>
      <PageHeader title={`${s.resource.name} · ${weekdaysLabelL(s.weekdays, locale)}`} subtitle={`${s.startTime}–${s.endTime} · ${day(s.fromDate)} – ${day(s.untilDate)}`} back={{ href: "/bookings/series", label: t("bookings.list.series") }}
        action={s.status === "CANCELLED" ? <Badge tone="outline">{t("bookings.status.CANCELLED")}</Badge> : <Badge tone="ok">{t("bookings.series.active")}</Badge>} />

      {Number.isInteger(created) && created > 0 ? (
        <div className="mb-4"><Alert tone={skipped > 0 ? "warn" : "ok"}>
          {t(created === 1 ? "bookings.series.created.one" : "bookings.series.created.other", { n: created })}{skipped > 0 ? `, ${t("bookings.series.createdSkipped", { n: skipped })}` : ""}.
        </Alert></div>
      ) : null}

      <Card className="animate-rise divide-y divide-line overflow-hidden">
        <Row k={t("bookings.series.f.weekdays")} v={weekdaysLabelL(s.weekdays, locale, true)} />
        <Row k={t("bookings.series.time")} v={`${s.startTime}–${s.endTime}`} />
        <Row k={t("bookings.detail.persons")} v={String(s.persons)} />
        {s.user ? <Row k={t("bookings.series.createdBy")} v={displayUserName(s.user.name, t)} /> : null}
        {s.note ? <Row k={t("bookings.detail.note")} v={s.note} /> : null}
      </Card>

      <SectionTitle>{t(upcoming.length === 1 ? "bookings.series.upcoming.one" : "bookings.series.upcoming.other", { n: upcoming.length })}</SectionTitle>
      {upcoming.length ? (
        <Card className="animate-rise divide-y divide-line overflow-hidden">
          {upcoming.map((b) => <Occurrence key={b.id} b={b} canCancel={cancellable.has(b.id)} locale={locale} t={t} />)}
        </Card>
      ) : <p className="text-sm text-ink-3">{t("bookings.series.noUpcoming")}</p>}

      {past.length ? (
        <>
          <SectionTitle>{t("bookings.series.past")}</SectionTitle>
          <Card className="animate-rise divide-y divide-line overflow-hidden">
            {past.slice(-20).reverse().map((b) => <Occurrence key={b.id} b={b} canCancel={false} locale={locale} t={t} />)}
          </Card>
        </>
      ) : null}

      {s.status === "ACTIVE" && cancellable.size ? (
        <>
          <SectionTitle>{t("bookings.series.actions")}</SectionTitle>
          <CancelSeriesButton seriesId={s.id} upcoming={cancellable.size} />
        </>
      ) : null}
    </div>
  );
}

function Occurrence({ b, canCancel, locale, t }: { b: { id: string; startsAt: Date; endsAt: Date; status: string }; canCancel: boolean; locale: Locale; t: TFunction }) {
  const st = bookingStatusView(b.status, t);
  const label = formatDateL(b.startsAt, locale);
  return (
    <div className="flex items-center gap-3 px-4 py-2 min-h-14 text-sm">
      <Link href={`/bookings/${b.id}`} className={`min-w-0 flex-1 hover:underline ${b.status === "CANCELLED" ? "text-ink-3 line-through" : ""}`}>
        <span className="tabular-nums">{label}</span> · <span className="tabular-nums">{formatTimeRangeL(b.startsAt, b.endsAt, locale)}</span>
      </Link>
      {b.status !== "CONFIRMED" ? <Badge tone={st.tone}>{st.label}</Badge> : null}
      {canCancel ? <CancelOccurrenceButton bookingId={b.id} label={label} /> : null}
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex items-start justify-between gap-4 px-4 py-3 text-sm"><span className="text-ink-3 shrink-0">{k}</span><span className="text-right font-medium">{v}</span></div>;
}
