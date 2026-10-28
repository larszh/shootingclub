import { notFound } from "next/navigation";
import { requireAmmo } from "@/modules/ammo/guard";
import { getOrder } from "@/modules/ammo/queries";
import { buildAmmoInvoiceDocument } from "@/modules/ammo/render";
import { PAYMENT_STATUS } from "@/modules/ammo/types";
import { InvoiceDocument, PrintShell } from "@/components/invoice-document";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "Munitionsrechnung" };

/** Druckbare Munitionsrechnung mit QR-Zahlteil. Sichtbar für Käufer und Verwaltung («ammo.manage»). */
export default async function AmmoInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAmmo();
  const { id } = await params;
  const order = await getOrder(ctx.tenant.id, id);
  if (!order || !order.invoiceNumber) notFound();
  if (order.userId !== ctx.user.id && !ctx.can("ammo.manage")) notFound();
  const doc = await buildAmmoInvoiceDocument(order, ctx.tenant.name);
  return (
    <PrintShell title={`Munitionsrechnung ${order.invoiceNumber}`} subtitle={`${order.user?.name ?? "Mitglied"} · ${(PAYMENT_STATUS[order.paymentStatus]?.label ?? "").toLowerCase()}`} action={<PrintButton />}>
      <InvoiceDocument {...doc} />
    </PrintShell>
  );
}
