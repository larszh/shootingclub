import type { Metadata } from "next";
import { Printer } from "lucide-react";
import { Alert, Card, EmptyState, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { db } from "@/lib/db";
import { formatDateTime, getRequestLocale, getT } from "@/lib/i18n";
import { requireAmmoAdmin } from "@/modules/ammo/guard";
import { fundingShortT, numT } from "@/modules/ammo/ui/labels";
import { recentInventories } from "@/modules/ammo/stock-service";
import { AdminAmmoTabs } from "@/modules/ammo/ui/admin-tabs";
import { InventoryForm } from "@/modules/ammo/ui/inventory-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm1.ammo.meta.inventory") };
}

export default async function AmmoInventoryPage({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  const ctx = await requireAmmoAdmin();
  const sp = await searchParams;
  const locale = await getRequestLocale();
  const t = getT(locale);
  const tenantId = ctx.tenant.id;
  const [products, runs] = await Promise.all([
    db.ammoProduct.findMany({ where: { tenantId, OR: [{ isActive: true }, { stockUnits: { not: null } }] }, orderBy: [{ caliber: "asc" }, { sortOrder: "asc" }, { name: "asc" }] }),
    recentInventories(tenantId),
  ]);
  const done = sp.done && /^\d{10,15}$/.test(sp.done) ? sp.done : null;

  return (
    <div>
      <PageHeader title={t("adm1.ammo.kind.INVENTORY")} subtitle={t("adm1.ammo.inv.subtitle")} back={{ href: "/admin/ammo/stock", label: t("adm1.ammo.tab.stock") }} />
      <AdminAmmoTabs />
      {done ? (
        <Alert tone="ok" className="mb-4" title={t("adm1.ammo.inv.booked")}>
          <div className="mt-2"><LinkButton href={`/admin/ammo/stock/inventory/print?at=${done}`} target="_blank" variant="secondary" size="sm" className="h-11"><Printer className="h-4 w-4" /> {t("adm1.ammo.inv.printReport")}</LinkButton></div>
        </Alert>
      ) : null}
      <p className="mb-3 text-sm text-ink-2">{t("adm1.ammo.inv.intro")}</p>
      {products.length ? (
        <InventoryForm products={products.map((p) => ({ id: p.id, name: p.name, caliber: p.caliber, unitLabel: p.unitLabel, roundsPerUnit: p.roundsPerUnit, stockUnits: p.stockUnits, fundingLabel: fundingShortT(p.fundingType, t), isActive: p.isActive }))} />
      ) : (
        <EmptyState title={t("adm1.ammo.prod.emptyTitle")} text={t("adm1.ammo.stock.emptyText")} action={<LinkButton href="/admin/ammo/products">{t("adm1.ammo.stock.toProducts")}</LinkButton>} />
      )}

      {runs.length ? (
        <>
          <SectionTitle>{t("adm1.ammo.inv.recent")}</SectionTitle>
          <Card className="animate-rise divide-y divide-line overflow-hidden">
            {runs.map((r) => (
              <div key={r.at.getTime()} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{formatDateTime(r.at, locale)}</div>
                  <div className="text-xs text-ink-3">{t(r.count === 1 ? "adm1.ammo.inv.products.one" : "adm1.ammo.inv.products.other", { n: r.count })} · {t("adm1.ammo.inv.netDiff", { n: `${r.net > 0 ? "+" : ""}${numT(r.net, locale)}` })}</div>
                </div>
                <LinkButton href={`/admin/ammo/stock/inventory/print?at=${r.at.getTime()}`} target="_blank" variant="ghost" size="sm" className="h-11" aria-label={t("adm1.ammo.inv.printReport")}><Printer className="h-4 w-4" /></LinkButton>
              </div>
            ))}
          </Card>
        </>
      ) : null}
      <Alert tone="info" className="mt-4">{t("adm1.ammo.stockCheckHint")}</Alert>
    </div>
  );
}
