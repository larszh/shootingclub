import { requireBillingAdmin } from "@/modules/billing/guard";
import { PageHeader } from "@/components/ui";
import { AdminBillingTabs } from "@/modules/billing/ui/admin-tabs";
import { getBillingProfile } from "@/modules/billing/profile";
import { BillingProfileForm } from "@/modules/billing/ui/profile-form";

export const metadata = { title: "Rechnungsprofil" };

export default async function BillingSettingsPage() {
  const ctx = await requireBillingAdmin({ orBookings: true, orAmmo: true });
  const billing = ctx.hasModule("billing");
  const profile = await getBillingProfile(ctx.tenant.id, ctx.tenant.name);
  return (
    <div>
      <PageHeader title="Rechnungsprofil" subtitle="Zahlungsempfänger und IBAN für alle Rechnungen" back={billing ? { href: "/admin/billing", label: "Mitgliederbeiträge" } : { href: "/admin/payments", label: "Offene Posten" }} />
      <AdminBillingTabs billing={billing} />
      <BillingProfileForm profile={profile} />
    </div>
  );
}
