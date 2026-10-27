import { requirePermission } from "@/lib/tenant";
import { PageHeader } from "@/components/ui";
import { AdminBillingTabs } from "@/modules/billing/ui/admin-tabs";
import { currentYear, listCategories, listMembersForBilling } from "@/modules/billing/queries";
import { getBillingProfile } from "@/modules/billing/profile";
import { MemberFeeTable } from "@/modules/billing/ui/member-fee-table";

export const metadata = { title: "Beiträge pro Mitglied" };

export default async function BillingMembersPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const ctx = await requirePermission("tenant.manage");
  const year = Number((await searchParams).year) || currentYear();
  const [members, categories, profile] = await Promise.all([listMembersForBilling(ctx.tenant.id, year), listCategories(ctx.tenant.id), getBillingProfile(ctx.tenant.id)]);
  return (
    <div>
      <PageHeader title="Mitglieder" subtitle={`Kategorie, individueller Betrag, Mitgliedernummer · Rechnungsstatus ${year}`} back={{ href: "/admin/billing", label: "Mitgliederbeiträge" }} />
      <AdminBillingTabs />
      <MemberFeeTable members={members} categories={categories.map((c) => ({ id: c.id, name: c.name, amountCents: c.amountCents }))} currency={profile.currency} year={year} />
    </div>
  );
}
