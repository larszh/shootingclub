import { requirePermission } from "@/lib/tenant";
import { PageHeader } from "@/components/ui";
import { AdminBillingTabs } from "@/modules/billing/ui/admin-tabs";
import { getBillingProfile } from "@/modules/billing/profile";
import { BillingProfileForm } from "@/modules/billing/ui/profile-form";

export const metadata = { title: "Rechnungsprofil" };

export default async function BillingSettingsPage() {
  const ctx = await requirePermission("tenant.manage");
  const profile = await getBillingProfile(ctx.tenant.id, ctx.tenant.name);
  return (
    <div>
      <PageHeader title="Rechnungsprofil" subtitle="Zahlungsempfänger und IBAN für alle Rechnungen" back={{ href: "/admin/billing", label: "Mitgliederbeiträge" }} />
      <AdminBillingTabs />
      <BillingProfileForm profile={profile} />
    </div>
  );
}
