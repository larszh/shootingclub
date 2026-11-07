import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, ClipboardList, Download } from "lucide-react";
import { Alert, Badge, Button, Card, EmptyState, Field, Input, LinkButton, PageHeader, SectionTitle, Select } from "@/components/ui";
import { todayZurich } from "@/lib/time";
import { requireAmmoAdmin } from "@/modules/ammo/guard";
import { isStockKind, STOCK_KINDS, stockKindInfo } from "@/modules/ammo/stock";
import { fundingLabelT, fundingShortT, numT, roundsT, stockKindLabelT } from "@/modules/ammo/ui/labels";
import { movementDateT } from "@/modules/ammo/ui/dates";
import { formatDate, getRequestLocale, getT } from "@/lib/i18n";
import { listMovements, recentRangeDays, type MovementFilter } from "@/modules/ammo/stock-service";
import { AdminAmmoTabs } from "@/modules/ammo/ui/admin-tabs";
import { StockBooking } from "@/modules/ammo/ui/stock-booking";
import { db } from "@/lib/db";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm1.ammo.meta.stock") };
}

const isDay = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

export default async function AmmoStockPage({ searchParams }: { searchParams: Promise<{ product?: string; kind?: string; from?: string; to?: string }> }) {
  const ctx = await requireAmmoAdmin();
  const sp = await searchParams;
  const locale = await getRequestLocale();
  const t = getT(locale);
  const tenantId = ctx.tenant.id;
  const filter: MovementFilter = {
    productId: sp.product && sp.product.length <= 40 ? sp.product : undefined,
    kind: sp.kind && isStockKind(sp.kind) ? sp.kind : undefined,
    from: isDay(sp.from) ? sp.from : undefined,
    to: isDay(sp.to) ? sp.to : undefined,
  };
  const [products, movements, rangeDays] = await Promise.all([
    db.ammoProduct.findMany({ where: { tenantId }, orderBy: [{ isActive: "desc" }, { caliber: "asc" }, { sortOrder: "asc" }, { name: "asc" }] }),
    listMovements(tenantId, filter),
    ctx.hasModule("range") ? recentRangeDays(tenantId) : Promise.resolve([]),
  ]);
  const tracked = products.filter((p) => p.stockUnits !== null);
  const qs = new URLSearchParams(Object.entries({ product: filter.productId, kind: filter.kind, from: filter.from, to: filter.to }).filter((e): e is [string, string] => !!e[1]));
  const today = todayZurich();

  return (
    <div>
      <PageHeader title={t("adm1.ammo.tab.stock")} subtitle={t("adm1.ammo.stock.subtitle")} back={{ href: "/admin/ammo", label: t("adm1.ammo.title") }} />
      <AdminAmmoTabs />

      <div className="mb-4 flex flex-wrap gap-2">
        <LinkButton href="/admin/ammo/stock/inventory" variant="secondary"><ClipboardList className="h-4 w-4" /> {t("adm1.ammo.kind.INVENTORY")}</LinkButton>
        <LinkButton href="/admin/ammo/stock/year" variant="secondary"><BarChart3 className="h-4 w-4" /> {t("adm1.ammo.year.title")}</LinkButton>
      </div>

      {tracked.length ? (
        <>
          <SectionTitle>{t("adm1.ammo.stock.current")}</SectionTitle>
          <Card className="animate-rise mb-4 divide-y divide-line overflow-hidden">
            {tracked.map((p) => (
              <Link key={p.id} href={`/admin/ammo/stock?product=${p.id}`} className="flex min-h-12 items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{p.name}{!p.isActive ? <span className="text-ink-3"> ({t("adm1.ammo.prod.hidden")})</span> : null}</div>
                  <div className="text-xs text-ink-3">{p.caliber} · {fundingLabelT(p.fundingType, t)}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold tabular-nums">{p.stockUnits} {p.unitLabel}</div>
                  <div className="text-xs text-ink-3 tabular-nums">{roundsT((p.stockUnits ?? 0) * p.roundsPerUnit, locale, t)}</div>
                </div>
              </Link>
            ))}
          </Card>
        </>
      ) : null}

      {products.length ? (
        <div className="mb-4">
          <StockBooking
            today={today}
            rangeDays={rangeDays}
            products={products.filter((p) => p.isActive || p.stockUnits !== null).map((p) => ({ id: p.id, name: p.name, caliber: p.caliber, unitLabel: p.unitLabel, roundsPerUnit: p.roundsPerUnit, stockUnits: p.stockUnits, fundingLabel: fundingShortT(p.fundingType, t) }))}
          />
        </div>
      ) : (
        <EmptyState title={t("adm1.ammo.prod.emptyTitle")} text={t("adm1.ammo.stock.emptyText")} action={<LinkButton href="/admin/ammo/products">{t("adm1.ammo.stock.toProducts")}</LinkButton>} className="mb-4" />
      )}

      <SectionTitle action={<LinkButton href={`/admin/ammo/stock/csv${qs.size ? `?${qs}` : ""}`} variant="ghost" size="sm" prefetch={false}><Download className="h-4 w-4" /> CSV</LinkButton>}>{t("adm1.ammo.stock.journal")}</SectionTitle>
      <form method="get" className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Field label={t("adm1.ammo.product")} className="col-span-2 sm:col-span-1">
          <Select name="product" defaultValue={filter.productId ?? ""}>
            <option value="">{t("adm1.common.all")}</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        <Field label={t("adm1.ammo.stock.kind")}>
          <Select name="kind" defaultValue={filter.kind ?? ""}>
            <option value="">{t("adm1.common.all")}</option>
            {STOCK_KINDS.map((k) => <option key={k} value={k}>{stockKindLabelT(k, t)}</option>)}
          </Select>
        </Field>
        <Field label={t("adm1.ammo.stock.from")}><Input type="date" name="from" defaultValue={filter.from ?? ""} /></Field>
        <Field label={t("adm1.ammo.stock.to")}><Input type="date" name="to" defaultValue={filter.to ?? ""} /></Field>
        <div className="flex items-end gap-2">
          <Button type="submit" variant="secondary" className="flex-1">{t("adm1.ammo.stock.filter")}</Button>
          {qs.size ? <LinkButton href="/admin/ammo/stock" variant="ghost">{t("adm1.common.all")}</LinkButton> : null}
        </div>
      </form>

      {movements.length === 0 ? (
        <EmptyState title={t("adm1.ammo.stock.noMovements")} text={qs.size ? t("adm1.ammo.stock.noMovementsFilter") : t("adm1.ammo.stock.noMovementsText")} />
      ) : (
        <Card className="animate-rise divide-y divide-line overflow-hidden">
          {movements.map((m) => {
            const k = stockKindInfo(m.kind);
            return (
              <div key={m.id} className="flex items-start gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={k.tone}>{stockKindLabelT(m.kind, t)}</Badge>
                    <span className="truncate text-sm font-medium">{m.product.name}</span>
                  </div>
                  <div className="text-xs text-ink-3">
                    {movementDateT(m.date, m.createdAt, locale)}
                    {m.source ? ` · ${m.source}` : ""}
                    {m.invoiceNumber ? ` · ${m.invoiceNumber}` : ""}
                    {m.rangeDay ? ` · ${t("adm1.ammo.stock.rangeDay", { date: formatDate(new Date(`${m.rangeDay.date.toISOString().slice(0, 10)}T12:00:00Z`), locale) })}${m.rangeDay.resource ? ` (${m.rangeDay.resource.name})` : ""}` : ""}
                    {m.note ? ` · ${m.note}` : ""}
                    {m.createdByName ? ` · ${m.createdByName}` : ""}
                  </div>
                </div>
                <div className={`shrink-0 text-right tabular-nums ${m.units < 0 ? "text-danger" : m.units > 0 ? "text-ok" : "text-ink-3"}`}>
                  <div className="font-semibold">{m.units > 0 ? "+" : ""}{numT(m.units, locale)}</div>
                  <div className="text-xs">{roundsT(m.units * m.product.roundsPerUnit, locale, t)}</div>
                </div>
              </div>
            );
          })}
        </Card>
      )}
      {movements.length >= 300 ? <p className="mt-2 text-xs text-ink-3">{t("adm1.ammo.stock.limit")}</p> : null}
      <Alert tone="info" className="mt-4">{t("adm1.ammo.stockCheckHint")}</Alert>
    </div>
  );
}
