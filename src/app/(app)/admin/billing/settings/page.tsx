import { requireBillingAdmin } from "@/modules/billing/guard";
import { db } from "@/lib/db";
import { PageHeader, SectionTitle } from "@/components/ui";
import { AdminBillingTabs } from "@/modules/billing/ui/admin-tabs";
import { getBillingProfile } from "@/modules/billing/profile";
import { BillingProfileForm } from "@/modules/billing/ui/profile-form";
import { listEnabledProviderKeys } from "@/lib/payments";
import { isProviderKey } from "@/lib/payments/catalog";
import { PaymentProviderList } from "@/lib/payments/ui/provider-list";
import { OnlineFeeProviderForm } from "./online-fee-form";

export const metadata = { title: "Rechnungsprofil" };

export default async function BillingSettingsPage() {
  const ctx = await requireBillingAdmin({ orBookings: true, orAmmo: true });
  const billing = ctx.hasModule("billing");
  const bookings = ctx.hasModule("bookings");
  const [profile, row, enabledProviders] = await Promise.all([
    getBillingProfile(ctx.tenant.id, ctx.tenant.name),
    db.billingProfile.findUnique({ where: { tenantId: ctx.tenant.id }, select: { onlineFeeProvider: true } }),
    billing ? listEnabledProviderKeys(ctx.tenant.id) : Promise.resolve([]),
  ]);
  const stored = row?.onlineFeeProvider ?? "NONE";
  // Nur ein eingerichteter und aktivierter Anbieter gilt als gewählt.
  const current = isProviderKey(stored) && enabledProviders.includes(stored) ? stored : "NONE";
  return (
    <div>
      <PageHeader title="Rechnungsprofil" subtitle="Zahlungsempfänger und IBAN für alle Rechnungen" back={billing ? { href: "/admin/billing", label: "Mitgliederbeiträge" } : { href: "/admin/payments", label: "Offene Posten" }} />
      <AdminBillingTabs billing={billing} />
      <BillingProfileForm profile={profile} />
      {billing ? (
        <>
          <SectionTitle>Online-Zahlung</SectionTitle>
          <OnlineFeeProviderForm current={current} enabledProviders={enabledProviders} setupHref={bookings ? "/admin/bookings/payments" : null} />
          {!bookings ? (
            <>
              <SectionTitle>Zahlungsanbieter</SectionTitle>
              <PaymentProviderList tenantId={ctx.tenant.id} />
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
