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
import { getRequestLocale, getT } from "@/lib/i18n";

export async function generateMetadata() {
  return { title: getT(await getRequestLocale())("adm1.bill.tab.profile") };
}

export default async function BillingSettingsPage() {
  const ctx = await requireBillingAdmin({ orBookings: true, orAmmo: true });
  const billing = ctx.hasModule("billing");
  const t = getT(await getRequestLocale());
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
      <PageHeader title={t("adm1.bill.tab.profile")} subtitle={t("adm1.profile.subtitle")} back={billing ? { href: "/admin/billing", label: t("adm1.module.billing.name") } : { href: "/admin/payments", label: t("adm1.home.payments") }} />
      <AdminBillingTabs billing={billing} />
      <BillingProfileForm profile={profile} />
      {billing ? (
        <>
          <SectionTitle>{t("adm1.online.section")}</SectionTitle>
          <OnlineFeeProviderForm current={current} enabledProviders={enabledProviders} setupHref={bookings ? "/admin/bookings/payments" : null} />
          {!bookings ? (
            <>
              <SectionTitle>{t("adm1.online.provider")}</SectionTitle>
              <PaymentProviderList tenantId={ctx.tenant.id} />
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
