import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Download, PackageCheck, Search } from "lucide-react";
import { requireAmmoAdmin } from "@/modules/ammo/guard";
import { listOrders, orderCounts, getAmmoSettings, type OrderFilter } from "@/modules/ammo/queries";
import { getBillingProfile } from "@/modules/billing/profile";
import { AdminAmmoTabs } from "@/modules/ammo/ui/admin-tabs";
import { ORDER_STATUS, PAYMENT_STATUS } from "@/modules/ammo/types";
import { adminOrderStatusT, adminPaymentStatusT, roundsT } from "@/modules/ammo/ui/labels";
import { Avatar, userAvatarUrl } from "@/components/avatar";
import { Badge, Card, EmptyState, Input, LinkButton, LinkTabs, PageHeader, SectionTitle, StatCard } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { todayZurich } from "@/lib/time";
import { formatDate, getRequestLocale, getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm1.ammo.manage") };
}

const FILTERS: Array<{ value: OrderFilter; label: string }> = [
  { value: "open", label: "adm1.ammo.filter.open" },
  { value: "approved", label: "adm1.ammo.filter.approved" },
  { value: "issued", label: "adm1.ammo.filter.issued" },
  { value: "unpaid", label: "adm1.ammo.filter.unpaid" },
  { value: "cancelled", label: "adm1.ammo.filter.cancelled" },
  { value: "all", label: "adm1.common.all" },
];

function isFilter(v: string | undefined): v is OrderFilter {
  return FILTERS.some((f) => f.value === v);
}

export default async function AdminAmmoPage({ searchParams }: { searchParams: Promise<{ f?: string; q?: string }> }) {
  const ctx = await requireAmmoAdmin();
  const sp = await searchParams;
  const locale = await getRequestLocale();
  const t = getT(locale);
  const filter: OrderFilter = isFilter(sp.f) ? sp.f : "open";
  const q = (sp.q ?? "").slice(0, 100);
  const [orders, counts, settings, profile] = await Promise.all([
    listOrders(ctx.tenant.id, filter, q),
    orderCounts(ctx.tenant.id),
    getAmmoSettings(ctx.tenant.id),
    getBillingProfile(ctx.tenant.id, ctx.tenant.name),
  ]);
  const countFor: Record<OrderFilter, number> = { open: counts.open, approved: counts.approved, issued: counts.issued, unpaid: counts.unpaid, cancelled: counts.cancelled, all: counts.all };
  const href = (f: string) => `/admin/ammo?f=${f}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
  const year = todayZurich().slice(0, 4);

  return (
    <div>
      <PageHeader title={t("adm1.ammo.title")} subtitle={ctx.tenant.name} back={{ href: "/admin", label: t("adm1.common.settings") }} action={<LinkButton href="/admin/ammo/counter" size="sm" className="h-11"><PackageCheck className="h-4 w-4" /> {t("adm1.ammo.tab.counter")}</LinkButton>} />
      <AdminAmmoTabs />

      {!profile.qrReady ? (
        <Card className="mb-4 border-warn/40 bg-warn/5 p-4 text-sm">{t("adm1.ammo.profileIncomplete")} <Link href="/admin/billing/settings" className="font-medium underline">{t("adm1.ammo.profileLink")}</Link>{t("adm1.ammo.profileSuffix")}</Card>
      ) : null}

      <div className="stagger grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatCard label={t("adm1.ammo.filter.open")} value={counts.open} href={href("open")} tone={counts.open ? "accent" : "neutral"} />
        <StatCard label={t("adm1.ammo.filter.approved")} value={counts.approved} href={href("approved")} hint={settings.approvalRequired ? t("adm1.ammo.readyToIssue") : undefined} />
        <StatCard label={t("adm1.ammo.filter.unpaid")} value={counts.unpaid} href={href("unpaid")} hint={formatMoney(counts.unpaidCents, profile.currency)} tone={counts.unpaid ? "warn" : "neutral"} />
        <StatCard label={t("adm1.ammo.filter.issued")} value={counts.issued} href={href("issued")} />
      </div>

      <SectionTitle action={<a href={`/api/export/ammo?from=${year}-01-01&to=${year}-12-31`} className="inline-flex min-h-11 items-center gap-1 text-sm text-ink-2 hover:text-ink"><Download className="h-4 w-4" aria-hidden /> CSV {year}</a>}>{t("adm1.ammo.tab.orders")}</SectionTitle>
      <form action="/admin/ammo" className="relative mb-3">
        <input type="hidden" name="f" value={filter} />
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
        <Input type="search" name="q" defaultValue={q} placeholder={t("adm1.ammo.searchPlaceholder")} aria-label={t("adm1.ammo.searchOrders")} className="pl-10" />
      </form>
      <LinkTabs active={filter} label={t("adm1.ammo.filterOrders")} className="mb-3" items={FILTERS.map((f) => ({ value: f.value, href: href(f.value), label: t(f.label), count: countFor[f.value] }))} />

      {orders.length ? (
        <Card className="animate-rise divide-y divide-line overflow-hidden">
          {orders.map((o) => {
            const st = ORDER_STATUS[o.status] ?? ORDER_STATUS.ORDERED!;
            const pay = o.invoiceNumber ? PAYMENT_STATUS[o.paymentStatus] : null;
            const rounds = o.items.reduce((a, i) => a + i.quantity * i.roundsPerUnit, 0);
            return (
              <Link key={o.id} href={`/admin/ammo/orders/${o.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-surface-2">
                <Avatar name={o.user?.name ?? "?"} src={o.user ? userAvatarUrl(o.user) : null} size={36} tone="soft" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{o.user?.name ?? t("adm1.ammo.deletedAccount")}</div>
                  <div className="truncate text-xs text-ink-3">
                    {formatDate(o.createdAt, locale)} · {roundsT(rounds, locale, t)}{o.invoiceNumber ? ` · ${o.invoiceNumber}` : ""}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-semibold tabular-nums">{formatMoney(o.totalCents, o.currency)}</div>
                  <div className="mt-0.5 flex flex-wrap justify-end gap-1">
                    <Badge tone={st.tone}>{adminOrderStatusT(o.status, t)}</Badge>
                    {pay && o.status === "ISSUED" ? <Badge tone={pay.tone}>{adminPaymentStatusT(o.paymentStatus, t)}</Badge> : null}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
              </Link>
            );
          })}
        </Card>
      ) : (
        <EmptyState icon={<PackageCheck className="h-5 w-5" />} title={t("adm1.ammo.noOrders")} text={q ? t("adm1.ammo.noHits") : t("adm1.ammo.nothingToDo")} />
      )}

      <p className="mt-6 text-xs text-ink-3">{t("money.ammo.legal")}</p>
    </div>
  );
}
