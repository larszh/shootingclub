import { notFound } from "next/navigation";
import { requireModule } from "@/lib/tenant";
import { getFeeInvoice } from "@/modules/billing/queries";
import { buildFeeInvoiceDocument } from "@/modules/billing/render";
import { InvoiceDocument, PrintShell } from "@/components/invoice-document";
import { PrintButton } from "@/components/print-button";
import { db } from "@/lib/db";

export const metadata = { title: "Beitragsrechnung" };

export default async function FeeInvoicePrintPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ reminder?: string }> }) {
  const ctx = await requireModule("billing");
  const { id } = await params;
  const { reminder } = await searchParams;
  const inv = await getFeeInvoice(ctx, id);
  if (!inv) notFound();
  const membership = inv.membershipId ? await db.membership.findUnique({ where: { id: inv.membershipId }, select: { memberNumber: true } }) : null;
  const doc = await buildFeeInvoiceDocument({ ...inv, membership }, ctx.tenant.id, ctx.tenant.name, { reminder: reminder === "1" && ctx.can("tenant.manage") && inv.status === "OPEN" });
  return (
    <PrintShell title={`${doc.title} ${inv.number}`} subtitle={`${inv.memberName} · ${inv.status === "PAID" ? "bezahlt" : inv.status === "CANCELLED" ? "storniert" : "offen"}`} action={<PrintButton />}>
      <InvoiceDocument {...doc} />
    </PrintShell>
  );
}
