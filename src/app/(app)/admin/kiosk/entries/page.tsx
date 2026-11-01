import type { Metadata } from "next";
import Link from "next/link";
import { Download, ListX } from "lucide-react";
import { Badge, Button, Card, EmptyState, Input, LinkButton, PageHeader, Select } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { formatDateTimeZurich } from "@/lib/time";
import { cn } from "@/lib/utils";
import { requireKioskAdmin } from "@/modules/kiosk/guard";
import { entryMemberOptions, listEntries } from "@/modules/kiosk/queries";
import { periodPresets } from "@/modules/kiosk/logic";
import { getBillingProfile } from "@/modules/billing/profile";
import { PeriodPicker } from "@/modules/kiosk/ui/period-picker";
import { StornoEntryButton } from "@/modules/kiosk/ui/entry-buttons";
import { entryFiltersFrom, type EntrySearchParams } from "@/modules/kiosk/filters";

export const metadata: Metadata = { title: "Schützenstube: Einträge" };

const STATUS = [
  { value: "all", label: "Alle" },
  { value: "open", label: "Offen" },
  { value: "billed", label: "Verrechnet" },
  { value: "cash", label: "Bar" },
] as const;

export default async function KioskEntriesPage({ searchParams }: { searchParams: Promise<EntrySearchParams> }) {
  const ctx = await requireKioskAdmin();
  const sp = await searchParams;
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
      <PageHeader title="Einträge" subtitle="Alle Konsumationen mit Filter, Storno und Export" back={{ href: "/admin/kiosk", label: "Schützenstube" }}
        action={<LinkButton href={`/admin/kiosk/entries/export?${qs({ ...base, status: filters.status })}`} variant="secondary" prefetch={false}><Download className="h-4 w-4" /> CSV</LinkButton>} />

      <PeriodPicker basePath="/admin/kiosk/entries" presets={periodPresets(today)} current={period} extra={extra} />

      <div className="mb-3 -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {STATUS.map((s) => (
          <Link key={s.value} href={`/admin/kiosk/entries?${qs({ ...base, status: s.value })}`} aria-current={filters.status === s.value ? "page" : undefined}
            className={cn("press inline-flex h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium", filters.status === s.value ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2")}>
            {s.label}
          </Link>
        ))}
      </div>

      <form method="get" action="/admin/kiosk/entries" className="mb-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input type="hidden" name="from" value={period.from} />
        <input type="hidden" name="to" value={period.to} />
        <input type="hidden" name="status" value={filters.status} />
        <Select name="user" defaultValue={filters.userId ?? ""} aria-label="Mitglied">
          <option value="">Alle Personen</option>
          {members.map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}
        </Select>
        <Input type="search" name="q" defaultValue={filters.q ?? ""} placeholder="Produkt oder Gast" aria-label="Produkt oder Gast suchen" maxLength={80} />
        <Button type="submit" variant="secondary">Filtern</Button>
      </form>

      <div className="mb-2 flex items-baseline justify-between text-sm">
        <span className="text-ink-3">{count} {count === 1 ? "Eintrag" : "Einträge"}{count > rows.length ? ` (die neuesten ${rows.length} angezeigt, alle im CSV)` : ""}</span>
        <span className="font-semibold tabular-nums">{formatMoney(totalCents, cur)}</span>
      </div>

      {rows.length ? (
        <Card className="animate-rise divide-y divide-line overflow-hidden">
          {rows.map((e) => {
            const who = e.memberName ?? (e.guestName ? `Gast: ${e.guestName}` : "Gast");
            const label = `${e.quantity}× ${e.productName}, ${who}, ${formatMoney(e.totalCents, cur)}`;
            return (
              <div key={e.id} className="flex min-h-14 items-center gap-3 px-4 py-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium">{who}</span>
                    {e.paidCash ? <Badge tone="outline">bar</Badge> : e.invoice ? <Badge tone={e.invoice.status === "PAID" ? "ok" : e.invoice.status === "CANCELLED" ? "outline" : "accent"}>{e.invoice.number}{e.invoice.status === "PAID" ? " bezahlt" : e.invoice.status === "CANCELLED" ? " storniert" : ""}</Badge> : e.billedInvoiceId ? <Badge tone="accent">verrechnet</Badge> : <Badge tone="warn">offen</Badge>}
                  </div>
                  <div className="truncate text-sm text-ink-2"><span className="tabular-nums">{e.quantity} ×</span> {e.productName} à {formatMoney(e.unitPriceCents, cur)}</div>
                  <div className="text-xs text-ink-3">{formatDateTimeZurich(e.createdAt)}{e.sellerName ? ` · erfasst von ${e.sellerName}` : ""}</div>
                </div>
                <span className="shrink-0 font-medium tabular-nums">{formatMoney(e.totalCents, cur)}</span>
                {!e.billedInvoiceId ? <StornoEntryButton id={e.id} label={label} /> : <span className="w-11 shrink-0" aria-hidden />}
              </div>
            );
          })}
        </Card>
      ) : (
        <EmptyState icon={<ListX className="h-5 w-5" />} title="Keine Einträge" text="Anderen Zeitraum oder Filter wählen." />
      )}
    </div>
  );
}
