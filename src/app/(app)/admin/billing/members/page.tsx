import { requireBillingAdmin } from "@/modules/billing/guard";
import { PageHeader } from "@/components/ui";
import { AdminBillingTabs } from "@/modules/billing/ui/admin-tabs";
import { currentYear, listCategories, listMembersForBilling } from "@/modules/billing/queries";
import { getBillingProfile } from "@/modules/billing/profile";
import { MemberFeeTable } from "@/modules/billing/ui/member-fee-table";
import { getRequestLocale, getT } from "@/lib/i18n";

export async function generateMetadata() {
  return { title: getT(await getRequestLocale())("adm1.bill.perMember") };
}

export default async function BillingMembersPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const ctx = await requireBillingAdmin();
  const t = getT(await getRequestLocale());
  const year = Number((await searchParams).year) || currentYear();
  const [members, categories, profile] = await Promise.all([listMembersForBilling(ctx.tenant.id, year), listCategories(ctx.tenant.id), getBillingProfile(ctx.tenant.id)]);
  return (
    <div>
      <PageHeader title={t("adm1.members.title")} subtitle={t("adm1.bill.membersSubtitle", { year })} back={{ href: "/admin/billing", label: t("adm1.module.billing.name") }} />
      <AdminBillingTabs />
      <MemberFeeTable members={members} categories={categories.map((c) => ({ id: c.id, name: c.name, amountCents: c.amountCents }))} currency={profile.currency} year={year} />
    </div>
  );
}
