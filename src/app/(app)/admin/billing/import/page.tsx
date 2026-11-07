import { requireBillingAdmin } from "@/modules/billing/guard";
import { Card, PageHeader } from "@/components/ui";
import { AdminBillingTabs } from "@/modules/billing/ui/admin-tabs";
import { CamtImport } from "@/modules/billing/ui/camt-import";
import { getBillingProfile } from "@/modules/billing/profile";
import { getRequestLocale, getT } from "@/lib/i18n";

export async function generateMetadata() {
  return { title: getT(await getRequestLocale())("adm1.bill.tab.import") };
}

export default async function BillingImportPage() {
  const ctx = await requireBillingAdmin({ orBookings: true, orAmmo: true });
  const billing = ctx.hasModule("billing");
  const t = getT(await getRequestLocale());
  const profile = await getBillingProfile(ctx.tenant.id, ctx.tenant.name);
  return (
    <div>
      <PageHeader title={t("adm1.camt.title")} subtitle={t("adm1.camt.subtitle")} back={billing ? { href: "/admin/billing", label: t("adm1.module.billing.name") } : { href: "/admin/payments", label: t("adm1.home.payments") }} />
      <AdminBillingTabs billing={billing} />
      <Card className="animate-rise p-4 mb-4 text-sm text-ink-2 space-y-1.5">
        <p><span className="font-medium">{t("adm1.camt.howToLabel")}</span> {t("adm1.camt.howTo")}</p>
        <p className="text-ink-3 text-xs">{t(profile.qrIban ? "adm1.camt.matchingQr" : "adm1.camt.matching")}</p>
      </Card>
      <CamtImport />
    </div>
  );
}
