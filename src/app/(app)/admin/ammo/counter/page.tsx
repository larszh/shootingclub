import type { Metadata } from "next";
import { requireAmmoAdmin } from "@/modules/ammo/guard";
import { counterData, getAmmoSettings, listShopProducts } from "@/modules/ammo/queries";
import { getBillingProfile } from "@/modules/billing/profile";
import { AdminAmmoTabs } from "@/modules/ammo/ui/admin-tabs";
import { Counter, type CounterMember, type CounterOrder } from "@/modules/ammo/ui/counter";
import { userAvatarUrl } from "@/components/avatar";
import { Alert, PageHeader } from "@/components/ui";
import { formatDateTime, getRequestLocale, getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm1.ammo.counter.metaTitle") };
}

export default async function AmmoCounterPage() {
  const ctx = await requireAmmoAdmin();
  const locale = await getRequestLocale();
  const t = getT(locale);
  const [{ members, open }, products, settings, profile] = await Promise.all([
    counterData(ctx.tenant.id),
    listShopProducts(ctx.tenant.id),
    getAmmoSettings(ctx.tenant.id),
    getBillingProfile(ctx.tenant.id, ctx.tenant.name),
  ]);
  const memberList: CounterMember[] = members.map((m) => ({ userId: m.user.id, name: m.user.name, email: m.user.email, avatarUrl: userAvatarUrl(m.user), memberNumber: m.memberNumber }));
  const orders: CounterOrder[] = open.map((o) => ({
    id: o.id, userId: o.userId!, status: o.status, totalCents: o.totalCents, currency: o.currency, createdLabel: formatDateTime(o.createdAt, locale), note: o.note,
    items: o.items.map((i) => ({ id: i.id, productName: i.productName, caliber: i.caliber, quantity: i.quantity, unitLabel: i.unitLabel, roundsPerUnit: i.roundsPerUnit })),
  }));

  return (
    <div>
      <PageHeader title={t("adm1.ammo.tab.counter")} subtitle={t("adm1.ammo.counter.subtitle")} back={{ href: "/admin/ammo", label: t("adm1.ammo.title") }} />
      <AdminAmmoTabs />
      {settings.onSiteOnly ? <Alert tone="warn" className="mb-4">{t("money.ammo.onSite.title")}.</Alert> : null}
      <Counter members={memberList} orders={orders} products={products} requireIdCheck={settings.requireIdCheck} approvalRequired={settings.approvalRequired} maxRounds={settings.maxRoundsPerOrder} currency={profile.currency} />
    </div>
  );
}
