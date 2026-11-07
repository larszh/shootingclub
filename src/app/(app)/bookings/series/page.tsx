import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus, Repeat } from "lucide-react";
import { requirePermission } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { Badge, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { listSeries } from "@/modules/bookings/series-queries";
import { weekdaysLabelL } from "@/modules/bookings/i18n";
import { formatDate, getRequestLocale, getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("bookings.series.listTitle") };
}

/** Serien des Vereins: Trainer sehen ihre eigenen, die Verwaltung alle. */
export default async function SeriesListPage() {
  const ctx = await requirePermission("bookings.series");
  if (!ctx.hasModule("bookings")) redirect("/?module=bookings");
  const all = ctx.can("tenant.manage");
  const series = await listSeries(ctx.tenant.id, all ? undefined : { userId: ctx.user.id });
  const locale = await getRequestLocale();
  const t = getT(locale);
  const day = (d: Date) => formatDate(d, locale, { timeZone: "UTC" });
  return (
    <div>
      <PageHeader title={t("bookings.series.listTitle")} subtitle={t(all ? "bookings.series.listSubAll" : "bookings.series.listSubOwn")} back={{ href: "/bookings", label: t("bookings.title") }}
        action={<LinkButton href="/bookings/series/new" size="sm"><Plus className="h-4 w-4" /> {t("bookings.series.new")}</LinkButton>} />
      {series.length ? (
        <Card className="animate-rise divide-y divide-line overflow-hidden">
          {series.map((s) => (
            <Link key={s.id} href={`/bookings/series/${s.id}`} className="flex items-center gap-3 px-4 py-3 min-h-14 hover:bg-surface-2">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2"><Repeat className="h-4 w-4 text-ink-2" aria-hidden /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium truncate">{s.resource.name} · {weekdaysLabelL(s.weekdays, locale)} {s.startTime}–{s.endTime}</span>
                <span className="block text-xs text-ink-3 truncate">{day(s.fromDate)} – {day(s.untilDate)}{all && s.user ? ` · ${s.user.name}` : ""}{s.note ? ` · ${s.note}` : ""}</span>
              </span>
              {s.status === "CANCELLED" ? <Badge tone="outline">{t("bookings.status.CANCELLED")}</Badge> : <Badge tone="ok">{t(s.upcoming === 1 ? "bookings.series.dates.one" : "bookings.series.dates.other", { n: s.upcoming })}</Badge>}
              <ChevronRight className="h-4 w-4 text-ink-3 shrink-0" aria-hidden />
            </Link>
          ))}
        </Card>
      ) : (
        <EmptyState icon={<Repeat className="h-5 w-5" />} title={t("bookings.series.emptyTitle")} text={t("bookings.series.emptyText")}
          action={<LinkButton href="/bookings/series/new" size="sm">{t("bookings.series.create")}</LinkButton>} />
      )}
    </div>
  );
}
