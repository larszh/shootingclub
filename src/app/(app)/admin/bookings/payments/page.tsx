import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/tenant";
import { Card, LinkTabs, PageHeader, SectionTitle } from "@/components/ui";
import { AdminBookingTabs } from "@/modules/bookings/ui/admin-tabs";
import { listTenantPayments, type TenantPaymentKind } from "@/lib/payments/queries";
import { PaymentProviderList } from "@/lib/payments/ui/provider-list";
import { TenantPaymentsTable } from "@/lib/payments/ui/payments-table";
import { getRequestLocale, getT } from "@/lib/i18n";

export async function generateMetadata() {
  return { title: getT(await getRequestLocale())("adm1.bk.providers") };
}

const KINDS = ["all", "BOOKING", "FEE"] as const;
type KindFilter = (typeof KINDS)[number];

export default async function PaymentProvidersPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const ctx = await requirePermission("tenant.manage");
  if (!ctx.hasModule("bookings") && !ctx.hasModule("billing")) redirect("/?module=bookings");
  const sp = await searchParams;
  const t = getT(await getRequestLocale());
  const kind: KindFilter = KINDS.includes(sp.kind as KindFilter) ? (sp.kind as KindFilter) : "all";
  const payments = await listTenantPayments(ctx.tenant.id, { kind: kind === "all" ? undefined : (kind as TenantPaymentKind), take: 200 });
  const billing = ctx.hasModule("billing");
  return (
    <div>
      <PageHeader title={t("adm1.bk.providers")} subtitle={t("adm1.bk.providersSubtitle")} back={{ href: "/admin/bookings", label: t("adm1.bk.title") }} />
      <AdminBookingTabs />
      <Card className="animate-rise mb-4 space-y-2 p-4 text-sm text-ink-2">
        <p>{t("adm1.bk.providersMoney")}</p>
        <p>
          {t("adm1.bk.providersSetupPrefix")} <Link href="/admin/bookings/settings" className="underline">{t("adm1.common.settings")}</Link> {t("adm1.bk.providersSetupBookings")}
          {billing ? <> {t("adm1.bk.providersSetupAnd")} <Link href="/admin/billing/settings" className="underline">{t("adm1.bk.billingProfile")}</Link> {t("adm1.bk.providersSetupFees")}</> : null}.
        </p>
        <p className="text-xs text-ink-3">{t("adm1.bk.providersAmmo")}</p>
      </Card>

      <PaymentProviderList tenantId={ctx.tenant.id} />

      <SectionTitle>{t("adm1.bk.onlinePayments")}</SectionTitle>
      <LinkTabs
        className="mb-3"
        label={t("adm1.bk.filterPayments")}
        active={kind}
        items={[
          { value: "all", href: "/admin/bookings/payments", label: t("adm1.common.all") },
          { value: "BOOKING", href: "/admin/bookings/payments?kind=BOOKING", label: t("adm1.bk.title") },
          { value: "FEE", href: "/admin/bookings/payments?kind=FEE", label: t("adm1.bk.invoices") },
        ]}
      />
      <TenantPaymentsTable rows={payments} />
      {payments.length >= 200 ? <p className="mt-2 text-xs text-ink-3">{t("adm1.bk.latest200")}</p> : null}
    </div>
  );
}
