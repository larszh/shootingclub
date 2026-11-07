import type { Metadata } from "next";
import { FileText, Info, Package, Settings } from "lucide-react";
import { requireAmmo } from "@/modules/ammo/guard";
import { getAmmoSettings, listMyOrders, listShopProducts } from "@/modules/ammo/queries";
import { getBillingProfile } from "@/modules/billing/profile";
import { AmmoShop } from "@/modules/ammo/ui/shop";
import { MemberCancelButton } from "@/modules/ammo/ui/order-actions";
import { ORDER_STATUS, PAYMENT_STATUS } from "@/modules/ammo/types";
import { formatRoundsT, orderStatusLabelT, paymentStatusLabelT } from "@/modules/ammo/i18n";
import { Alert, Badge, Card, EmptyState, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { formatDate, getRequestLocale, getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("money.ammo.title") };
}

export default async function AmmoPage() {
  const ctx = await requireAmmo();
  const [settings, products, orders, profile] = await Promise.all([
    getAmmoSettings(ctx.tenant.id),
    listShopProducts(ctx.tenant.id),
    listMyOrders(ctx.tenant.id, ctx.user.id),
    getBillingProfile(ctx.tenant.id, ctx.tenant.name),
  ]);
  const canManage = ctx.can("ammo.manage");
  const locale = await getRequestLocale();
  const t = getT(locale);

  return (
    <div>
      <PageHeader
        title={t("money.ammo.title")}
        subtitle={t("money.ammo.subtitle", { club: ctx.tenant.name })}
        action={canManage ? <LinkButton href="/admin/ammo" variant="secondary" size="sm" className="h-11"><Settings className="h-4 w-4" /> {t("money.ammo.manage")}</LinkButton> : null}
      />

      {settings.note ? (
        <Alert tone="info" icon={<Info className="h-4 w-4" />} title={t("money.ammo.clubNote")} className="mb-4 whitespace-pre-line">{settings.note}</Alert>
      ) : null}

      {products.length ? (
        <AmmoShop products={products} currency={profile.currency} maxRounds={settings.maxRoundsPerOrder} onSiteOnly={settings.onSiteOnly} approvalRequired={settings.approvalRequired} locale={locale} />
      ) : (
        <EmptyState icon={<Package className="h-5 w-5" />} title={t("money.ammo.empty.title")} text={t("money.ammo.empty.text")} />
      )}

      <SectionTitle>{t("money.ammo.myOrders")}</SectionTitle>
      {orders.length ? (
        <div className="stagger space-y-2.5">
          {orders.map((o) => {
            const st = ORDER_STATUS[o.status] ?? ORDER_STATUS.ORDERED!;
            const pay = o.invoiceNumber ? PAYMENT_STATUS[o.paymentStatus] : null;
            const rounds = o.items.reduce((a, i) => a + i.quantity * i.roundsPerUnit, 0);
            const waiting = o.status === "ORDERED" && settings.approvalRequired;
            return (
              <Card key={o.id} className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{formatDate(o.createdAt, locale)} · {formatRoundsT(rounds, locale, t)}</div>
                    <div className="text-xs text-ink-3">{o.items.map((i) => `${i.quantity} × ${i.unitLabel} ${i.productName}`).join(", ")}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-semibold tabular-nums">{formatMoney(o.totalCents, o.currency)}</div>
                    <div className="mt-0.5 flex flex-wrap justify-end gap-1">
                      <Badge tone={st.tone}>{waiting ? t("money.ammo.waiting") : orderStatusLabelT(o.status in ORDER_STATUS ? o.status : "ORDERED", t)}</Badge>
                      {pay ? <Badge tone={pay.tone}>{paymentStatusLabelT(o.paymentStatus, t)}</Badge> : null}
                    </div>
                  </div>
                </div>
                {o.invoiceNumber || o.status === "ORDERED" || o.status === "APPROVED" ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {o.invoiceNumber ? (
                      <LinkButton href={`/ammo/${o.id}/invoice`} target="_blank" variant="secondary" size="sm" className="h-11">
                        <FileText className="h-4 w-4" /> {t("money.ammo.invoice", { number: o.invoiceNumber })}
                      </LinkButton>
                    ) : null}
                    {o.status === "ORDERED" || o.status === "APPROVED" ? <MemberCancelButton orderId={o.id} locale={locale} /> : null}
                  </div>
                ) : null}
                {o.invoiceNumber && o.paymentStatus === "UNPAID" && o.dueAt ? <p className="text-xs text-ink-3">{t("money.ammo.payBy", { date: formatDate(o.dueAt, locale) })}</p> : null}
              </Card>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-ink-3">{t("money.ammo.noOrders")}</p>
      )}

      <p className="mt-6 text-xs text-ink-3">{t("money.ammo.legal")}</p>
    </div>
  );
}
