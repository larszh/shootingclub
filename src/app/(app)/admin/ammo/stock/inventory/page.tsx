import type { Metadata } from "next";
import { Printer } from "lucide-react";
import { Alert, Card, EmptyState, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { db } from "@/lib/db";
import { formatDateTimeZurich } from "@/lib/time";
import { requireAmmoAdmin } from "@/modules/ammo/guard";
import { fundingInfo, STOCK_CHECK_HINT } from "@/modules/ammo/stock";
import { recentInventories } from "@/modules/ammo/stock-service";
import { AdminAmmoTabs } from "@/modules/ammo/ui/admin-tabs";
import { InventoryForm } from "@/modules/ammo/ui/inventory-form";

export const metadata: Metadata = { title: "Munition: Inventur" };

export default async function AmmoInventoryPage({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  const ctx = await requireAmmoAdmin();
  const sp = await searchParams;
  const tenantId = ctx.tenant.id;
  const [products, runs] = await Promise.all([
    db.ammoProduct.findMany({ where: { tenantId, OR: [{ isActive: true }, { stockUnits: { not: null } }] }, orderBy: [{ caliber: "asc" }, { sortOrder: "asc" }, { name: "asc" }] }),
    recentInventories(tenantId),
  ]);
  const done = sp.done && /^\d{10,15}$/.test(sp.done) ? sp.done : null;

  return (
    <div>
      <PageHeader title="Inventur" subtitle="Bestand zählen und Differenzen buchen" back={{ href: "/admin/ammo/stock", label: "Bestand" }} />
      <AdminAmmoTabs />
      {done ? (
        <Alert tone="ok" className="mb-4" title="Inventur gebucht">
          <div className="mt-2"><LinkButton href={`/admin/ammo/stock/inventory/print?at=${done}`} target="_blank" variant="secondary" size="sm" className="h-11"><Printer className="h-4 w-4" /> Differenzbericht drucken</LinkButton></div>
        </Alert>
      ) : null}
      <p className="mb-3 text-sm text-ink-2">Gezählte Menge pro Produkt in Verkaufseinheiten eingeben. Nur ausgefüllte Produkte werden gebucht; der Bestand wird auf die gezählte Menge gesetzt und die Differenz im Journal als «Inventur» festgehalten.</p>
      {products.length ? (
        <InventoryForm products={products.map((p) => ({ id: p.id, name: p.name, caliber: p.caliber, unitLabel: p.unitLabel, roundsPerUnit: p.roundsPerUnit, stockUnits: p.stockUnits, fundingLabel: fundingInfo(p.fundingType).short, isActive: p.isActive }))} />
      ) : (
        <EmptyState title="Noch keine Produkte" text="Lege zuerst im Sortiment die Munition an." action={<LinkButton href="/admin/ammo/products">Zum Sortiment</LinkButton>} />
      )}

      {runs.length ? (
        <>
          <SectionTitle>Letzte Inventuren</SectionTitle>
          <Card className="animate-rise divide-y divide-line overflow-hidden">
            {runs.map((r) => (
              <div key={r.at.getTime()} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{formatDateTimeZurich(r.at)}</div>
                  <div className="text-xs text-ink-3">{r.count} {r.count === 1 ? "Produkt" : "Produkte"} · Differenz total {r.net > 0 ? "+" : ""}{r.net} Einheiten</div>
                </div>
                <LinkButton href={`/admin/ammo/stock/inventory/print?at=${r.at.getTime()}`} target="_blank" variant="ghost" size="sm" className="h-11" aria-label="Differenzbericht drucken"><Printer className="h-4 w-4" /></LinkButton>
              </div>
            ))}
          </Card>
        </>
      ) : null}
      <Alert tone="info" className="mt-4">{STOCK_CHECK_HINT}</Alert>
    </div>
  );
}
