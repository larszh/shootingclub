import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FileText, ShieldCheck } from "lucide-react";
import { requireAmmoAdmin } from "@/modules/ammo/guard";
import { getAmmoSettings, getOrder } from "@/modules/ammo/queries";
import { AdminAmmoTabs } from "@/modules/ammo/ui/admin-tabs";
import { ApproveButton, CancelOrderButton, IssueControls, PaymentControls } from "@/modules/ammo/ui/order-actions";
import { formatRounds, ORDER_STATUS, PAYMENT_STATUS } from "@/modules/ammo/types";
import { Avatar, userAvatarUrl } from "@/components/avatar";
import { Badge, Card, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { formatDateTimeZurich, formatDateZurich } from "@/lib/time";
import { formatQrReference } from "@/lib/qr-reference";

export const metadata: Metadata = { title: "Munitionsbestellung" };

export default async function AdminAmmoOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAmmoAdmin();
  const { id } = await params;
  const [order, settings] = await Promise.all([getOrder(ctx.tenant.id, id), getAmmoSettings(ctx.tenant.id)]);
  if (!order) notFound();
  const st = ORDER_STATUS[order.status] ?? ORDER_STATUS.ORDERED!;
  const pay = PAYMENT_STATUS[order.paymentStatus];
  const rounds = order.items.reduce((a, i) => a + i.quantity * i.roundsPerUnit, 0);
  const open = order.status === "ORDERED" || order.status === "APPROVED";
  const hasStock = order.items.some((i) => i.productId);

  return (
    <div>
      <PageHeader title={order.invoiceNumber ? `Bestellung ${order.invoiceNumber}` : "Bestellung"} subtitle={`bestellt ${formatDateTimeZurich(order.createdAt)}`} back={{ href: "/admin/ammo", label: "Bestellungen" }} />
      <AdminAmmoTabs />

      <Card className="animate-rise flex items-center gap-3 p-4">
        <Avatar name={order.user?.name ?? "?"} src={order.user ? userAvatarUrl(order.user) : null} size={44} tone="soft" />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{order.user?.name ?? "Gelöschtes Konto"}</div>
          {order.user ? <div className="truncate text-xs text-ink-3">{order.user.email}</div> : null}
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge tone={st.tone}>{st.label}</Badge>
          {order.invoiceNumber && pay ? <Badge tone={pay.tone}>{pay.label}</Badge> : null}
        </div>
      </Card>

      <SectionTitle>Positionen</SectionTitle>
      <Card className="animate-rise overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-3">
              <th className="px-4 py-2 font-medium">Kaliber / Produkt</th>
              <th className="px-2 py-2 text-right font-medium">Menge</th>
              <th className="px-2 py-2 font-medium">Einheit</th>
              <th className="px-2 py-2 text-right font-medium">Einzelpreis</th>
              <th className="px-4 py-2 text-right font-medium">Total</th>
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
              <td className="px-4 py-3 font-semibold" colSpan={4}>Total · {formatRounds(rounds)}</td>
              <td className="px-4 py-3 text-right text-base font-semibold tabular-nums">{formatMoney(order.totalCents, order.currency)}</td>
            </tr>
          </tfoot>
        </table>
      </Card>
      {order.note ? <p className="mt-2 rounded-control bg-surface-2 px-3 py-2 text-sm">Bemerkung: «{order.note}»</p> : null}

      {open ? (
        <>
          <SectionTitle>Ausgabe</SectionTitle>
          <Card className="space-y-3 p-4">
            {order.status === "ORDERED" && settings.approvalRequired ? <ApproveButton orderId={order.id} /> : null}
            <IssueControls orderId={order.id} requireIdCheck={settings.requireIdCheck} />
            <CancelOrderButton orderId={order.id} issued={false} hasStock={hasStock} />
          </Card>
        </>
      ) : null}

      {order.status === "ISSUED" || order.issuedAt ? (
        <>
          <SectionTitle>Ausgabe</SectionTitle>
          <Card className="space-y-1 p-4 text-sm">
            <div>Ausgegeben {order.issuedAt ? formatDateTimeZurich(order.issuedAt) : "–"}{order.issuedBy ? ` durch ${order.issuedBy.name}` : ""}</div>
            <div className="flex items-center gap-1.5 text-ink-2"><ShieldCheck className="h-4 w-4" aria-hidden /> Berechtigung {order.idChecked ? "geprüft" : "nicht bestätigt"}</div>
          </Card>
        </>
      ) : null}

      {order.invoiceNumber ? (
        <>
          <SectionTitle action={<a href={`/ammo/${order.id}/invoice`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-sm text-ink-2 hover:text-ink">Drucken</a>}>Rechnung</SectionTitle>
          <Card className="mb-3 space-y-1 p-4 text-sm">
            <div className="flex justify-between gap-3"><span className="text-ink-3">Nummer</span><span className="font-medium">{order.invoiceNumber}</span></div>
            {order.invoiceIssuedAt ? <div className="flex justify-between gap-3"><span className="text-ink-3">Datum</span><span>{formatDateZurich(order.invoiceIssuedAt, { weekday: undefined })}</span></div> : null}
            {order.dueAt ? <div className="flex justify-between gap-3"><span className="text-ink-3">Fällig</span><span>{formatDateZurich(order.dueAt, { weekday: undefined })}</span></div> : null}
            {order.reference ? <div className="flex justify-between gap-3"><span className="text-ink-3">QR-Referenz</span><span className="font-mono text-xs">{formatQrReference(order.reference)}</span></div> : null}
            {order.paidAt ? <div className="flex justify-between gap-3"><span className="text-ink-3">Bezahlt am</span><span>{formatDateZurich(order.paidAt, { weekday: undefined })}</span></div> : null}
            <LinkButton href={`/ammo/${order.id}/invoice`} target="_blank" variant="secondary" className="mt-2 w-full"><FileText className="h-4 w-4" /> QR-Rechnung öffnen</LinkButton>
          </Card>
          {order.status === "ISSUED" ? <PaymentControls orderId={order.id} paymentStatus={order.paymentStatus} paymentNote={order.paymentNote} /> : null}
        </>
      ) : null}

      {order.status === "ISSUED" ? (
        <>
          <SectionTitle>Storno</SectionTitle>
          <CancelOrderButton orderId={order.id} issued hasStock={hasStock} />
        </>
      ) : null}
    </div>
  );
}
