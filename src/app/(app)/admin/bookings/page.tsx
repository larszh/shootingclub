import type { Metadata } from "next";
import { CalendarDays, Download, Plus } from "lucide-react";
import { requirePermission } from "@/lib/tenant";
import { Badge, Button, Card, EmptyState, Input, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { partnerNameMap } from "@/modules/sharing/queries";
import { monthRange } from "@/modules/bookings/calendar";
import { AdminBookingTabs } from "@/modules/bookings/ui/admin-tabs";
import { bookingStats, listTenantBookings } from "@/modules/bookings/queries";
import { BookingCard } from "@/modules/bookings/ui/booking-card";
import { DecideButtons } from "@/modules/bookings/ui/booking-actions";
import { formatTimeRange, todayZurich } from "@/lib/time";
import { displayUserName, formatDate, getRequestLocale, getT } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import Link from "next/link";
import { personsSuffix } from "@/modules/bookings/pricing";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm1.bk.manage") };
}

export default async function AdminBookingsPage() {
  const ctx = await requirePermission("tenant.manage");
  const locale = await getRequestLocale();
  const t = getT(locale);
  const [stats, pending, upcoming, openInvoices] = await Promise.all([
    bookingStats(ctx.tenant.id),
    listTenantBookings(ctx.tenant.id, { status: "PENDING" }),
    listTenantBookings(ctx.tenant.id, { status: "CONFIRMED", from: new Date(), limit: 30, order: "asc" }),
    listTenantBookings(ctx.tenant.id, { openInvoice: true, limit: 300 }),
  ]);
  const month = monthRange(todayZurich());
  const partners = await partnerNameMap([...pending, ...upcoming, ...openInvoices].map((b) => b.viaTenantId));
  return (
    <div>
      <PageHeader title={t("adm1.bk.title")} subtitle={ctx.tenant.name} back={{ href: "/me", label: t("adm1.bk.more") }}
        action={<LinkButton href="/admin/bookings/new" size="sm"><Plus className="h-4 w-4" /> {t("adm1.bk.book")}</LinkButton>} />
      <AdminBookingTabs />
      <div className="stagger grid grid-cols-3 gap-2.5">
        <Card className="p-4"><div className="text-2xl font-semibold tabular-nums">{stats.pending}</div><div className="text-xs text-ink-3">{t("adm1.bk.pendingOpen")}</div></Card>
        <Card className="p-4"><div className="text-2xl font-semibold tabular-nums">{stats.upcoming}</div><div className="text-xs text-ink-3">{t("adm1.bk.upcomingShort")}</div></Card>
        <Card className="p-4"><div className="text-2xl font-semibold tabular-nums">{stats.unpaidInvoices}</div><div className="text-xs text-ink-3">{t("adm1.bk.invoicesOpen")}</div></Card>
      </div>

      <SectionTitle>{t("adm1.bk.approvals")}</SectionTitle>
      {pending.length ? (
        <div className="stagger space-y-2.5">
          {pending.map((b) => (
            <Card key={b.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/bookings/${b.id}`} className="font-medium hover:underline">{b.resource.name} · {displayUserName(b.user?.name, t)}</Link>
                  {b.viaTenantId ? <div className="mt-0.5"><Badge tone="outline">{t("adm1.bk.partnerBadge", { name: partners[b.viaTenantId] ?? t("adm1.bk.partnerClub") })}</Badge></div> : null}
                  <div className="text-xs text-ink-3">{formatDate(b.startsAt, locale, { weekday: "short" })} · {formatTimeRange(b.startsAt, b.endsAt)}{personsSuffix(b, t) ? ` · ${personsSuffix(b, t)}` : ""} · {b.totalCents ? formatMoney(b.totalCents, b.currency) : t("bookings.free")}</div>
                  {b.note ? <div className="text-xs text-ink-3 italic mt-0.5">«{b.note}»</div> : null}
                </div>
              </div>
              <div className="mt-3"><DecideButtons bookingId={b.id} /></div>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-sm text-ink-3">{t("adm1.bk.noPending")}</p>
      )}

      <SectionTitle>{t("adm1.bk.openInvoices")}</SectionTitle>
      {openInvoices.length ? <div className="stagger space-y-2.5">{openInvoices.map((b) => <BookingCard key={b.id} b={b} showUser locale={locale} partner={b.viaTenantId ? t("adm1.bk.partnerBadge", { name: partners[b.viaTenantId] ?? t("adm1.bk.partnerClub") }) : null} />)}</div> : <p className="text-sm text-ink-3">{t("adm1.bk.noOpenInvoices")}</p>}

      <SectionTitle action={<Link href="/admin/bookings/calendar" className="inline-flex items-center gap-1 text-xs text-ink-3 hover:text-ink"><CalendarDays className="h-3.5 w-3.5" /> {t("adm1.bk.calendar")}</Link>}>{t("adm1.bk.upcoming")}</SectionTitle>
      {upcoming.length ? <div className="stagger space-y-2.5">{upcoming.map((b) => <BookingCard key={b.id} b={b} showUser locale={locale} partner={b.viaTenantId ? t("adm1.bk.partnerBadge", { name: partners[b.viaTenantId] ?? t("adm1.bk.partnerClub") }) : null} />)}</div> : <EmptyState title={t("adm1.bk.nothingPlanned")} text={t("adm1.bk.nothingPlannedText")} />}

      <SectionTitle>{t("adm1.bk.export")}</SectionTitle>
      <Card className="animate-rise p-4">
        <form action="/api/export/bookings" method="get" className="space-y-3">
          <p className="text-sm text-ink-3">{t("adm1.bk.exportText")}</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="block text-sm font-medium text-ink-2 mb-1.5">{t("adm1.common.from")}</span><Input type="date" name="from" defaultValue={month.from} required /></label>
            <label className="block"><span className="block text-sm font-medium text-ink-2 mb-1.5">{t("adm1.common.to")}</span><Input type="date" name="to" defaultValue={month.to} required /></label>
          </div>
          <Button type="submit" variant="secondary" className="w-full"><Download className="h-4 w-4" /> {t("adm1.bk.csvDownload")}</Button>
        </form>
      </Card>
    </div>
  );
}
