import { requireBillingAdmin } from "@/modules/billing/guard";
import { PageHeader } from "@/components/ui";
import { AdminBillingTabs } from "@/modules/billing/ui/admin-tabs";
import { listCategories } from "@/modules/billing/queries";
import { getBillingProfile } from "@/modules/billing/profile";
import { CategoryManager } from "@/modules/billing/ui/category-form";
import { getRequestLocale, getT } from "@/lib/i18n";

export async function generateMetadata() {
  return { title: getT(await getRequestLocale())("adm1.members.feeCategory") };
}

export default async function CategoriesPage() {
  const ctx = await requireBillingAdmin();
  const t = getT(await getRequestLocale());
  const [categories, profile] = await Promise.all([listCategories(ctx.tenant.id, { includeInactive: true }), getBillingProfile(ctx.tenant.id)]);
  return (
    <div>
      <PageHeader title={t("adm1.bill.tab.categories")} subtitle={t("adm1.bill.categoriesSubtitle")} back={{ href: "/admin/billing", label: t("adm1.module.billing.name") }} />
      <AdminBillingTabs />
      <CategoryManager categories={categories} currency={profile.currency} />
    </div>
  );
}
