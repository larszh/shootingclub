import type { Metadata } from "next";
import { requireAmmoAdmin } from "@/modules/ammo/guard";
import { listAllProducts } from "@/modules/ammo/queries";
import { getBillingProfile } from "@/modules/billing/profile";
import { AdminAmmoTabs } from "@/modules/ammo/ui/admin-tabs";
import { ProductManager } from "@/modules/ammo/ui/product-manager";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Munition: Sortiment" };

export default async function AmmoProductsPage() {
  const ctx = await requireAmmoAdmin();
  const [products, profile] = await Promise.all([listAllProducts(ctx.tenant.id), getBillingProfile(ctx.tenant.id, ctx.tenant.name)]);
  return (
    <div>
      <PageHeader title="Sortiment" subtitle="Munition, Preise und Bestand" back={{ href: "/admin/ammo", label: "Munition" }} />
      <AdminAmmoTabs />
      <ProductManager
        currency={profile.currency}
        products={products.map((p) => ({
          id: p.id, name: p.name, caliber: p.caliber, manufacturer: p.manufacturer, description: p.description, unitLabel: p.unitLabel,
          roundsPerUnit: p.roundsPerUnit, priceCents: p.priceCents, stockUnits: p.stockUnits, isActive: p.isActive, sortOrder: p.sortOrder, reserved: p.reserved,
          fundingType: p.fundingType,
        }))}
      />
    </div>
  );
}
