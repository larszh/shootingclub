import type { Metadata } from "next";
import Link from "next/link";
import { Download, ListX } from "lucide-react";
import { Badge, Button, Card, EmptyState, Input, LinkButton, PageHeader, Select } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { formatDateTime, getRequestLocale, getT } from "@/lib/i18n";
import { localizePresets } from "@/modules/kiosk/ui/i18n";
import { cn } from "@/lib/utils";
import { requireKioskAdmin } from "@/modules/kiosk/guard";
import { entryMemberOptions, listEntries } from "@/modules/kiosk/queries";
import { periodPresets } from "@/modules/kiosk/logic";
import { getBillingProfile } from "@/modules/billing/profile";
import { PeriodPicker } from "@/modules/kiosk/ui/period-picker";
import { StornoEntryButton } from "@/modules/kiosk/ui/entry-buttons";
import { entryFiltersFrom, type EntrySearchParams } from "@/modules/kiosk/filters";

export async function generateMetadata(): Promise<Metadata> {
  const t = getT(await getRequestLocale());
  return { title: `${t("adm1.home.kiosk")}: ${t("adm1.kiosk.tab.entries")}` };
}

const STATUS = ["all", "open", "billed", "cash"] as const;

export default async function KioskEntriesPage({ searchParams }: { searchParams: Promise<EntrySearchParams> }) {
  const ctx = await requireKioskAdmin();
  const sp = await searchParams;
  const locale = await getRequestLocale();
  const t = getT(locale);
  const tenantId = ctx.tenant.id;
  const { today, period, filters } = entryFiltersFrom(sp);
  const [{ rows, count, totalCents }, members, profile] = await Promise.all([
    listEntries(tenantId, filters),
    entryMemberOptions(tenantId),
    getBillingProfile(tenantId, ctx.tenant.name),
  ]);
  const cur = profile.currency;
  const base: Record<string, string> = { from: period.from, to: period.to };
  if (filters.userId) base.user = filters.userId;
  if (filters.q) base.q = filters.q;
  const extra: Record<string, string> = { status: filters.status };
  if (filters.userId) extra.user = filters.userId;
  if (filters.q) extra.q = filters.q;
  const qs = (o: Record<string, string>) => new URLSearchParams(o).toString();

  return (
    <div>
      <PageHeader title={t("adm1.kiosk.tab.entries")} subtitle={t("adm1.kiosk.entriesSubtitle")} back={{ href: "/admin/kiosk", label: t("adm1.home.kiosk") }}
        action={<LinkButton href={`/admin/kiosk/entries/export?${qs({ ...base, status: filters.status })}`} variant="secondary" prefetch={false}><Download className="h-4 w-4" /> CSV</LinkButton>} />

      <PeriodPicker basePath="/admin/kiosk/entries" presets={localizePresets(t, periodPresets(today))} current={period} extra={extra} />

      <div className="mb-3 -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {STATUS.map((s) => (
          <Link key={s} href={`/admin/kiosk/entries?${qs({ ...base, status: s })}`} aria-current={filters.status === s ? "page" : undefined}
            className={cn("press inline-flex h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium", filters.status === s ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2")}>
            {t(`adm1.kiosk.status.${s}`)}
          </Link>
        ))}
      </div>

      <form method="get" action="/admin/kiosk/entries" className="mb-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input type="hidden" name="from" value={period.from} />
        <input type="hidden" name="to" value={period.to} />
        <input type="hidden" name="status" value={filters.status} />
        <Select name="user" defaultValue={filters.userId ?? ""} aria-label={t("adm1.common.member")}>
          <option value="">{t("adm1.kiosk.allPersons")}</option>
          {members.map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}
        </Select>
        <Input type="search" name="q" defaultValue={filters.q ?? ""} placeholder={t("adm1.kiosk.searchPlaceholder")} aria-label={t("adm1.kiosk.searchLabel")} maxLength={80} />
        <Button type="submit" variant="secondary">{t("adm1.kiosk.filter")}</Button>
      </form>

      <div className="mb-2 flex items-baseline justify-between text-sm">
        <span className="text-ink-3">{t(count === 1 ? "adm1.kiosk.entries.one" : "adm1.kiosk.entries.other", { n: count })}{count > rows.length ? ` ${t("adm1.kiosk.newestShown", { n: rows.length })}` : ""}</span>
        <span className="font-semibold tabular-nums">{formatMoney(totalCents, cur)}</span>
      </div>

      {rows.length ? (
        <Card className="animate-rise divide-y divide-line overflow-hidden">
          {rows.map((e) => {
            const who = e.memberName ?? (e.guestName ? t("adm1.kiosk.guestNamed", { name: e.guestName }) : t("adm1.kiosk.guest"));
            const label = `${e.quantity}× ${e.productName}, ${who}, ${formatMoney(e.totalCents, cur)}`;
            return (
              <div key={e.id} className="flex min-h-14 items-center gap-3 px-4 py-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium">{who}</span>
                    {e.paidCash ? <Badge tone="outline">{t("adm1.kiosk.badge.cash")}</Badge> : e.invoice ? <Badge tone={e.invoice.status === "PAID" ? "ok" : e.invoice.status === "CANCELLED" ? "outline" : "accent"}>{e.invoice.number}{e.invoice.status === "PAID" ? ` ${t("adm1.kiosk.badge.paid")}` : e.invoice.status === "CANCELLED" ? ` ${t("adm1.kiosk.badge.cancelled")}` : ""}</Badge> : e.billedInvoiceId ? <Badge tone="accent">{t("adm1.kiosk.badge.billed")}</Badge> : <Badge tone="warn">{t("adm1.kiosk.badge.open")}</Badge>}
                  </div>
                  <div className="truncate text-sm text-ink-2"><span className="tabular-nums">{e.quantity} ×</span> {e.productName} {t("adm1.kiosk.each", { price: formatMoney(e.unitPriceCents, cur) })}</div>
                  <div className="text-xs text-ink-3">{formatDateTime(e.createdAt, locale)}{e.sellerName ? ` · ${t("adm1.kiosk.recordedBy", { name: e.sellerName })}` : ""}</div>
                </div>
                <span className="shrink-0 font-medium tabular-nums">{formatMoney(e.totalCents, cur)}</span>
                {!e.billedInvoiceId ? <StornoEntryButton id={e.id} label={label} /> : <span className="w-11 shrink-0" aria-hidden />}
              </div>
            );
          })}
        </Card>
      ) : (
        <EmptyState icon={<ListX className="h-5 w-5" />} title={t("adm1.kiosk.noEntries")} text={t("adm1.kiosk.noEntriesText")} />
      )}
    </div>
  );
}
