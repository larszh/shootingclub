import type { Metadata } from "next";
import { requireAmmoAdmin } from "@/modules/ammo/guard";
import { listAllProducts } from "@/modules/ammo/queries";
import { getBillingProfile } from "@/modules/billing/profile";
import { AdminAmmoTabs } from "@/modules/ammo/ui/admin-tabs";
import { ProductManager } from "@/modules/ammo/ui/product-manager";
import { PageHeader } from "@/components/ui";
import { getRequestLocale, getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm1.ammo.meta.products") };
}

export default async function AmmoProductsPage() {
  const ctx = await requireAmmoAdmin();
  const t = getT(await getRequestLocale());
  const [products, profile] = await Promise.all([listAllProducts(ctx.tenant.id), getBillingProfile(ctx.tenant.id, ctx.tenant.name)]);
  return (
    <div>
      <PageHeader title={t("adm1.ammo.tab.products")} subtitle={t("adm1.ammo.products.subtitle")} back={{ href: "/admin/ammo", label: t("adm1.ammo.title") }} />
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
