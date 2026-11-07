import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requireKioskAdmin } from "@/modules/kiosk/guard";
import { listProducts } from "@/modules/kiosk/queries";
import { getBillingProfile } from "@/modules/billing/profile";
import { KioskProductManager } from "@/modules/kiosk/ui/product-manager";
import { getRequestLocale, getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = getT(await getRequestLocale());
  return { title: `${t("adm1.home.kiosk")}: ${t("adm1.kiosk.tab.products")}` };
}

export default async function KioskProductsPage() {
  const ctx = await requireKioskAdmin();
  const t = getT(await getRequestLocale());
  const [products, profile] = await Promise.all([listProducts(ctx.tenant.id), getBillingProfile(ctx.tenant.id, ctx.tenant.name)]);
  return (
    <div>
      <PageHeader title={t("adm1.kiosk.tab.products")} subtitle={t("adm1.kiosk.productsSubtitle")} back={{ href: "/admin/kiosk", label: t("adm1.home.kiosk") }} />
      <KioskProductManager products={products} currency={profile.currency} />
    </div>
  );
}
