import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requireKioskAdmin } from "@/modules/kiosk/guard";
import { listProducts } from "@/modules/kiosk/queries";
import { getBillingProfile } from "@/modules/billing/profile";
import { KioskProductManager } from "@/modules/kiosk/ui/product-manager";

export const metadata: Metadata = { title: "Schützenstube: Sortiment" };

export default async function KioskProductsPage() {
  const ctx = await requireKioskAdmin();
  const [products, profile] = await Promise.all([listProducts(ctx.tenant.id), getBillingProfile(ctx.tenant.id, ctx.tenant.name)]);
  return (
    <div>
      <PageHeader title="Sortiment" subtitle="Produkte und Preise der Schützenstube" back={{ href: "/admin/kiosk", label: "Schützenstube" }} />
      <KioskProductManager products={products} currency={profile.currency} />
    </div>
  );
}
