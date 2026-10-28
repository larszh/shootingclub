import type { Metadata } from "next";
import { requireAmmoAdmin } from "@/modules/ammo/guard";
import { counterData, getAmmoSettings, listShopProducts } from "@/modules/ammo/queries";
import { getBillingProfile } from "@/modules/billing/profile";
import { AdminAmmoTabs } from "@/modules/ammo/ui/admin-tabs";
import { Counter, type CounterMember, type CounterOrder } from "@/modules/ammo/ui/counter";
import { ON_SITE_TEXT } from "@/modules/ammo/types";
import { userAvatarUrl } from "@/components/avatar";
import { Alert, PageHeader } from "@/components/ui";
import { formatDateTimeZurich } from "@/lib/time";

export const metadata: Metadata = { title: "Munitionsausgabe" };

export default async function AmmoCounterPage() {
  const ctx = await requireAmmoAdmin();
  const [{ members, open }, products, settings, profile] = await Promise.all([
    counterData(ctx.tenant.id),
    listShopProducts(ctx.tenant.id),
    getAmmoSettings(ctx.tenant.id),
    getBillingProfile(ctx.tenant.id, ctx.tenant.name),
  ]);
  const memberList: CounterMember[] = members.map((m) => ({ userId: m.user.id, name: m.user.name, email: m.user.email, avatarUrl: userAvatarUrl(m.user), memberNumber: m.memberNumber }));
  const orders: CounterOrder[] = open.map((o) => ({
    id: o.id, userId: o.userId!, status: o.status, totalCents: o.totalCents, currency: o.currency, createdLabel: formatDateTimeZurich(o.createdAt), note: o.note,
    items: o.items.map((i) => ({ id: i.id, productName: i.productName, caliber: i.caliber, quantity: i.quantity, unitLabel: i.unitLabel, roundsPerUnit: i.roundsPerUnit })),
  }));

  return (
    <div>
      <PageHeader title="Ausgabe" subtitle="Mitglied suchen, Berechtigung prüfen, ausgeben" back={{ href: "/admin/ammo", label: "Munition" }} />
      <AdminAmmoTabs />
      {settings.onSiteOnly ? <Alert tone="warn" className="mb-4">{ON_SITE_TEXT}.</Alert> : null}
      <Counter members={memberList} orders={orders} products={products} requireIdCheck={settings.requireIdCheck} approvalRequired={settings.approvalRequired} maxRounds={settings.maxRoundsPerOrder} currency={profile.currency} />
    </div>
  );
}
