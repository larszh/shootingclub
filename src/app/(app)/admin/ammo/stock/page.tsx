import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, ClipboardList, Download } from "lucide-react";
import { Alert, Badge, Button, Card, EmptyState, Field, Input, LinkButton, PageHeader, SectionTitle, Select } from "@/components/ui";
import { formatDateTimeZurich, todayZurich } from "@/lib/time";
import { requireAmmoAdmin } from "@/modules/ammo/guard";
import { fundingInfo, isStockKind, STOCK_CHECK_HINT, STOCK_KIND, STOCK_KINDS, stockKindInfo } from "@/modules/ammo/stock";
import { listMovements, recentRangeDays, type MovementFilter } from "@/modules/ammo/stock-service";
import { AdminAmmoTabs } from "@/modules/ammo/ui/admin-tabs";
import { StockBooking } from "@/modules/ammo/ui/stock-booking";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Munition: Bestand" };

const isDay = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

export default async function AmmoStockPage({ searchParams }: { searchParams: Promise<{ product?: string; kind?: string; from?: string; to?: string }> }) {
  const ctx = await requireAmmoAdmin();
  const sp = await searchParams;
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
      <PageHeader title="Bestand" subtitle="Munitionskontrolle: Eingänge, Abgaben, Verkäufe, Inventur" back={{ href: "/admin/ammo", label: "Munition" }} />
      <AdminAmmoTabs />

      <div className="mb-4 flex flex-wrap gap-2">
        <LinkButton href="/admin/ammo/stock/inventory" variant="secondary"><ClipboardList className="h-4 w-4" /> Inventur</LinkButton>
        <LinkButton href="/admin/ammo/stock/year" variant="secondary"><BarChart3 className="h-4 w-4" /> Jahresübersicht</LinkButton>
      </div>

      {tracked.length ? (
        <>
          <SectionTitle>Aktueller Bestand</SectionTitle>
          <Card className="animate-rise mb-4 divide-y divide-line overflow-hidden">
            {tracked.map((p) => (
              <Link key={p.id} href={`/admin/ammo/stock?product=${p.id}`} className="flex min-h-12 items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{p.name}{!p.isActive ? <span className="text-ink-3"> (ausgeblendet)</span> : null}</div>
                  <div className="text-xs text-ink-3">{p.caliber} · {fundingInfo(p.fundingType).label}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold tabular-nums">{p.stockUnits} {p.unitLabel}</div>
                  <div className="text-xs text-ink-3 tabular-nums">{(p.stockUnits ?? 0) * p.roundsPerUnit} Schuss</div>
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
            products={products.filter((p) => p.isActive || p.stockUnits !== null).map((p) => ({ id: p.id, name: p.name, caliber: p.caliber, unitLabel: p.unitLabel, roundsPerUnit: p.roundsPerUnit, stockUnits: p.stockUnits, fundingLabel: fundingInfo(p.fundingType).short }))}
          />
        </div>
      ) : (
        <EmptyState title="Noch keine Produkte" text="Lege zuerst im Sortiment die Munition an." action={<LinkButton href="/admin/ammo/products">Zum Sortiment</LinkButton>} className="mb-4" />
      )}

      <SectionTitle action={<LinkButton href={`/admin/ammo/stock/csv${qs.size ? `?${qs}` : ""}`} variant="ghost" size="sm" prefetch={false}><Download className="h-4 w-4" /> CSV</LinkButton>}>Journal</SectionTitle>
      <form method="get" className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Field label="Produkt" className="col-span-2 sm:col-span-1">
          <Select name="product" defaultValue={filter.productId ?? ""}>
            <option value="">Alle</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        <Field label="Art">
          <Select name="kind" defaultValue={filter.kind ?? ""}>
            <option value="">Alle</option>
            {STOCK_KINDS.map((k) => <option key={k} value={k}>{STOCK_KIND[k].label}</option>)}
          </Select>
        </Field>
        <Field label="Von"><Input type="date" name="from" defaultValue={filter.from ?? ""} /></Field>
        <Field label="Bis"><Input type="date" name="to" defaultValue={filter.to ?? ""} /></Field>
        <div className="flex items-end gap-2">
          <Button type="submit" variant="secondary" className="flex-1">Filtern</Button>
          {qs.size ? <LinkButton href="/admin/ammo/stock" variant="ghost">Alle</LinkButton> : null}
        </div>
      </form>

      {movements.length === 0 ? (
        <EmptyState title="Keine Bewegungen" text={qs.size ? "Für diesen Filter gibt es keine Buchungen." : "Eingänge, Abgaben, Verkäufe und Inventuren erscheinen hier."} />
      ) : (
        <Card className="animate-rise divide-y divide-line overflow-hidden">
          {movements.map((m) => {
            const k = stockKindInfo(m.kind);
            return (
              <div key={m.id} className="flex items-start gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={k.tone}>{k.label}</Badge>
                    <span className="truncate text-sm font-medium">{m.product.name}</span>
                  </div>
                  <div className="text-xs text-ink-3">
                    {formatDateTimeZurich(m.date)}
                    {m.source ? ` · ${m.source}` : ""}
                    {m.invoiceNumber ? ` · ${m.invoiceNumber}` : ""}
                    {m.rangeDay ? ` · Standbuch ${m.rangeDay.date.toISOString().slice(0, 10).split("-").reverse().join(".")}${m.rangeDay.resource ? ` (${m.rangeDay.resource.name})` : ""}` : ""}
                    {m.note ? ` · ${m.note}` : ""}
                    {m.createdByName ? ` · ${m.createdByName}` : ""}
                  </div>
                </div>
                <div className={`shrink-0 text-right tabular-nums ${m.units < 0 ? "text-danger" : m.units > 0 ? "text-ok" : "text-ink-3"}`}>
                  <div className="font-semibold">{m.units > 0 ? "+" : ""}{m.units}</div>
                  <div className="text-xs">{m.units * m.product.roundsPerUnit} Schuss</div>
                </div>
              </div>
            );
          })}
        </Card>
      )}
      {movements.length >= 300 ? <p className="mt-2 text-xs text-ink-3">Es werden die neuesten 300 Bewegungen angezeigt. Filter oder CSV für alle.</p> : null}
      <Alert tone="info" className="mt-4">{STOCK_CHECK_HINT}</Alert>
    </div>
  );
}
