import { requireBillingAdmin } from "@/modules/billing/guard";
import { PageHeader } from "@/components/ui";
import { AdminBillingTabs } from "@/modules/billing/ui/admin-tabs";
import { listCategories } from "@/modules/billing/queries";
import { getBillingProfile } from "@/modules/billing/profile";
import { CategoryManager } from "@/modules/billing/ui/category-form";

export const metadata = { title: "Beitragskategorien" };

export default async function CategoriesPage() {
  const ctx = await requireBillingAdmin();
  const [categories, profile] = await Promise.all([listCategories(ctx.tenant.id, { includeInactive: true }), getBillingProfile(ctx.tenant.id)]);
  return (
    <div>
      <PageHeader title="Kategorien" subtitle="z.B. Aktiv, Passiv, Jungschützen, Ehrenmitglied" back={{ href: "/admin/billing", label: "Mitgliederbeiträge" }} />
      <AdminBillingTabs />
      <CategoryManager categories={categories} currency={profile.currency} />
    </div>
  );
}
