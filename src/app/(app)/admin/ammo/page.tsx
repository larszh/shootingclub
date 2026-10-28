import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Download, PackageCheck, Search } from "lucide-react";
import { requireAmmoAdmin } from "@/modules/ammo/guard";
import { listOrders, orderCounts, getAmmoSettings, type OrderFilter } from "@/modules/ammo/queries";
import { getBillingProfile } from "@/modules/billing/profile";
import { AdminAmmoTabs } from "@/modules/ammo/ui/admin-tabs";
import { formatRounds, LEGAL_HINT, ORDER_STATUS, PAYMENT_STATUS } from "@/modules/ammo/types";
import { Avatar, userAvatarUrl } from "@/components/avatar";
import { Badge, Card, EmptyState, Input, LinkButton, LinkTabs, PageHeader, SectionTitle, StatCard } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { formatDateZurich, todayZurich } from "@/lib/time";

export const metadata: Metadata = { title: "Munition verwalten" };

const FILTERS: Array<{ value: OrderFilter; label: string }> = [
  { value: "open", label: "Offen" },
  { value: "approved", label: "Freigegeben" },
  { value: "issued", label: "Ausgegeben" },
  { value: "unpaid", label: "Unbezahlt" },
  { value: "cancelled", label: "Storniert" },
  { value: "all", label: "Alle" },
];

function isFilter(v: string | undefined): v is OrderFilter {
  return FILTERS.some((f) => f.value === v);
}

export default async function AdminAmmoPage({ searchParams }: { searchParams: Promise<{ f?: string; q?: string }> }) {
  const ctx = await requireAmmoAdmin();
  const sp = await searchParams;
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
      <PageHeader title="Munition" subtitle={ctx.tenant.name} back={{ href: "/admin", label: "Einstellungen" }} action={<LinkButton href="/admin/ammo/counter" size="sm" className="h-11"><PackageCheck className="h-4 w-4" /> Ausgabe</LinkButton>} />
      <AdminAmmoTabs />

      {!profile.qrReady ? (
        <Card className="mb-4 border-warn/40 bg-warn/5 p-4 text-sm">Rechnungsprofil unvollständig. <Link href="/admin/billing/settings" className="font-medium underline">Zahlungsempfänger und IBAN erfassen</Link>, damit Munitionsrechnungen einen QR-Zahlteil erhalten.</Card>
      ) : null}

      <div className="stagger grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatCard label="Offen" value={counts.open} href={href("open")} tone={counts.open ? "accent" : "neutral"} />
        <StatCard label="Freigegeben" value={counts.approved} href={href("approved")} hint={settings.approvalRequired ? "bereit zur Ausgabe" : undefined} />
        <StatCard label="Unbezahlt" value={counts.unpaid} href={href("unpaid")} hint={formatMoney(counts.unpaidCents, profile.currency)} tone={counts.unpaid ? "warn" : "neutral"} />
        <StatCard label="Ausgegeben" value={counts.issued} href={href("issued")} />
      </div>

      <SectionTitle action={<a href={`/api/export/ammo?from=${year}-01-01&to=${year}-12-31`} className="inline-flex min-h-11 items-center gap-1 text-sm text-ink-2 hover:text-ink"><Download className="h-4 w-4" aria-hidden /> CSV {year}</a>}>Bestellungen</SectionTitle>
      <form action="/admin/ammo" className="relative mb-3">
        <input type="hidden" name="f" value={filter} />
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
        <Input type="search" name="q" defaultValue={q} placeholder="Name, E-Mail oder Rechnungsnummer" aria-label="Bestellungen suchen" className="pl-10" />
      </form>
      <LinkTabs active={filter} label="Bestellungen filtern" className="mb-3" items={FILTERS.map((f) => ({ value: f.value, href: href(f.value), label: f.label, count: countFor[f.value] }))} />

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
                  <div className="truncate font-medium">{o.user?.name ?? "Gelöschtes Konto"}</div>
                  <div className="truncate text-xs text-ink-3">
                    {formatDateZurich(o.createdAt, { weekday: undefined })} · {formatRounds(rounds)}{o.invoiceNumber ? ` · ${o.invoiceNumber}` : ""}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-semibold tabular-nums">{formatMoney(o.totalCents, o.currency)}</div>
                  <div className="mt-0.5 flex flex-wrap justify-end gap-1">
                    <Badge tone={st.tone}>{st.label}</Badge>
                    {pay && o.status === "ISSUED" ? <Badge tone={pay.tone}>{pay.label}</Badge> : null}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
              </Link>
            );
          })}
        </Card>
      ) : (
        <EmptyState icon={<PackageCheck className="h-5 w-5" />} title="Keine Bestellungen" text={q ? "Für diese Suche gibt es keine Treffer." : "In dieser Ansicht gibt es nichts zu tun."} />
      )}

      <p className="mt-6 text-xs text-ink-3">{LEGAL_HINT}</p>
    </div>
  );
}
