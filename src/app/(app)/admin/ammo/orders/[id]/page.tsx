import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FileText, ShieldCheck } from "lucide-react";
import { requireAmmoAdmin } from "@/modules/ammo/guard";
import { getAmmoSettings, getOrder } from "@/modules/ammo/queries";
import { AdminAmmoTabs } from "@/modules/ammo/ui/admin-tabs";
import { ApproveButton, CancelOrderButton, IssueControls, PaymentControls } from "@/modules/ammo/ui/order-actions";
import { ORDER_STATUS, PAYMENT_STATUS } from "@/modules/ammo/types";
import { adminOrderStatusT, adminPaymentStatusT, roundsT } from "@/modules/ammo/ui/labels";
import { Avatar, userAvatarUrl } from "@/components/avatar";
import { Badge, Card, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDateTime, getRequestLocale, getT } from "@/lib/i18n";
import { formatQrReference } from "@/lib/qr-reference";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm1.ammo.order.metaTitle") };
}

export default async function AdminAmmoOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAmmoAdmin();
  const { id } = await params;
  const locale = await getRequestLocale();
  const t = getT(locale);
  const formatRounds = (n: number) => roundsT(n, locale, t);
  const [order, settings] = await Promise.all([getOrder(ctx.tenant.id, id), getAmmoSettings(ctx.tenant.id)]);
  if (!order) notFound();
  const st = ORDER_STATUS[order.status] ?? ORDER_STATUS.ORDERED!;
  const pay = PAYMENT_STATUS[order.paymentStatus];
  const rounds = order.items.reduce((a, i) => a + i.quantity * i.roundsPerUnit, 0);
  const open = order.status === "ORDERED" || order.status === "APPROVED";
  const hasStock = order.items.some((i) => i.productId);

  return (
    <div>
      <PageHeader title={order.invoiceNumber ? t("adm1.ammo.order.titleNumber", { number: order.invoiceNumber }) : t("adm1.ammo.order.title")} subtitle={t("adm1.ammo.order.orderedAt", { date: formatDateTime(order.createdAt, locale) })} back={{ href: "/admin/ammo", label: t("adm1.ammo.tab.orders") }} />
      <AdminAmmoTabs />

      <Card className="animate-rise flex items-center gap-3 p-4">
        <Avatar name={order.user?.name ?? "?"} src={order.user ? userAvatarUrl(order.user) : null} size={44} tone="soft" />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{order.user?.name ?? t("adm1.ammo.deletedAccount")}</div>
          {order.user ? <div className="truncate text-xs text-ink-3">{order.user.email}</div> : null}
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge tone={st.tone}>{adminOrderStatusT(order.status, t)}</Badge>
          {order.invoiceNumber && pay ? <Badge tone={pay.tone}>{adminPaymentStatusT(order.paymentStatus, t)}</Badge> : null}
        </div>
      </Card>

      <SectionTitle>{t("adm1.ammo.order.items")}</SectionTitle>
      <Card className="animate-rise overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-3">
              <th className="px-4 py-2 font-medium">{t("adm1.ammo.order.caliberProduct")}</th>
              <th className="px-2 py-2 text-right font-medium">{t("adm1.ammo.qty")}</th>
              <th className="px-2 py-2 font-medium">{t("adm1.ammo.order.unit")}</th>
              <th className="px-2 py-2 text-right font-medium">{t("adm1.ammo.order.unitPrice")}</th>
              <th className="px-4 py-2 text-right font-medium">{t("adm1.common.total")}</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((i) => (
              <tr key={i.id} className="border-b border-line last:border-0">
                <td className="px-4 py-2.5"><div className="font-medium">{i.caliber}</div><div className="text-xs text-ink-3">{i.productName} · {formatRounds(i.quantity * i.roundsPerUnit)}</div></td>
                <td className="px-2 py-2.5 text-right tabular-nums">{i.quantity}</td>
                <td className="px-2 py-2.5">{i.unitLabel}</td>
                <td className="px-2 py-2.5 text-right tabular-nums">{formatMoney(i.unitPriceCents, order.currency)}</td>
                <td className="px-4 py-2.5 text-right font-medium tabular-nums">{formatMoney(i.totalCents, order.currency)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="px-4 py-3 font-semibold" colSpan={4}>{t("adm1.common.total")} · {formatRounds(rounds)}</td>
              <td className="px-4 py-3 text-right text-base font-semibold tabular-nums">{formatMoney(order.totalCents, order.currency)}</td>
            </tr>
          </tfoot>
        </table>
      </Card>
      {order.note ? <p className="mt-2 rounded-control bg-surface-2 px-3 py-2 text-sm">{t("adm1.ammo.order.remark", { note: order.note })}</p> : null}

      {open ? (
        <>
          <SectionTitle>{t("adm1.ammo.tab.counter")}</SectionTitle>
          <Card className="space-y-3 p-4">
            {order.status === "ORDERED" && settings.approvalRequired ? <ApproveButton orderId={order.id} /> : null}
            <IssueControls orderId={order.id} requireIdCheck={settings.requireIdCheck} />
            <CancelOrderButton orderId={order.id} issued={false} hasStock={hasStock} />
          </Card>
        </>
      ) : null}

      {order.status === "ISSUED" || order.issuedAt ? (
        <>
          <SectionTitle>{t("adm1.ammo.tab.counter")}</SectionTitle>
          <Card className="space-y-1 p-4 text-sm">
            <div>{t("adm1.ammo.order.issuedAt", { date: order.issuedAt ? formatDateTime(order.issuedAt, locale) : "–" })}{order.issuedBy ? ` ${t("adm1.ammo.order.issuedBy", { name: order.issuedBy.name })}` : ""}</div>
            <div className="flex items-center gap-1.5 text-ink-2"><ShieldCheck className="h-4 w-4" aria-hidden /> {order.idChecked ? t("adm1.ammo.idChecked") : t("adm1.ammo.order.idNotConfirmed")}</div>
          </Card>
        </>
      ) : null}

      {order.invoiceNumber ? (
        <>
          <SectionTitle action={<a href={`/ammo/${order.id}/invoice`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-sm text-ink-2 hover:text-ink">{t("adm1.ammo.order.print")}</a>}>{t("adm1.ammo.set.invoiceTitle")}</SectionTitle>
          <Card className="mb-3 space-y-1 p-4 text-sm">
            <div className="flex justify-between gap-3"><span className="text-ink-3">{t("adm1.ammo.order.number")}</span><span className="font-medium">{order.invoiceNumber}</span></div>
            {order.invoiceIssuedAt ? <div className="flex justify-between gap-3"><span className="text-ink-3">{t("adm1.common.date")}</span><span>{formatDate(order.invoiceIssuedAt, locale)}</span></div> : null}
            {order.dueAt ? <div className="flex justify-between gap-3"><span className="text-ink-3">{t("adm1.ammo.order.due")}</span><span>{formatDate(order.dueAt, locale)}</span></div> : null}
            {order.reference ? <div className="flex justify-between gap-3"><span className="text-ink-3">{t("adm1.ammo.order.qrRef")}</span><span className="font-mono text-xs">{formatQrReference(order.reference)}</span></div> : null}
            {order.paidAt ? <div className="flex justify-between gap-3"><span className="text-ink-3">{t("adm1.ammo.order.paidAt")}</span><span>{formatDate(order.paidAt, locale)}</span></div> : null}
            <LinkButton href={`/ammo/${order.id}/invoice`} target="_blank" variant="secondary" className="mt-2 w-full"><FileText className="h-4 w-4" /> {t("adm1.ammo.order.openQr")}</LinkButton>
          </Card>
          {order.status === "ISSUED" ? <PaymentControls orderId={order.id} paymentStatus={order.paymentStatus} paymentNote={order.paymentNote} /> : null}
        </>
      ) : null}

      {order.status === "ISSUED" ? (
        <>
          <SectionTitle>{t("adm1.ammo.order.cancellation")}</SectionTitle>
          <CancelOrderButton orderId={order.id} issued hasStock={hasStock} />
        </>
      ) : null}
    </div>
  );
}
