import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/tenant";
import { db } from "@/lib/db";
import { getRun, listInvoices } from "@/modules/billing/queries";
import { buildFeeInvoiceDocument } from "@/modules/billing/render";
import { InvoiceDocument, PrintShell } from "@/components/invoice-document";
import { PrintButton } from "@/app/targets/[id]/print/print-button";

export const metadata = { title: "Sammeldruck" };

/** Alle Rechnungen eines Jahreslaufs hintereinander, je eine A4-Seite. ?filter=open|all|overdue, &reminder=1 für Zahlungserinnerungen. */
export default async function RunPrintPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ filter?: string; reminder?: string }> }) {
  const ctx = await requirePermission("tenant.manage");
  const { id } = await params;
  const sp = await searchParams;
  const run = await getRun(ctx.tenant.id, id);
  if (!run) notFound();
  const reminder = sp.reminder === "1";
  let invoices = await listInvoices(ctx.tenant.id, { runId: run.id, status: sp.filter === "all" ? undefined : "OPEN" });
  if (sp.filter === "overdue" || reminder) invoices = invoices.filter((i) => i.status === "OPEN" && i.dueAt < new Date());
  const memberships = await db.membership.findMany({ where: { id: { in: invoices.map((i) => i.membershipId).filter((x): x is string => !!x) } }, select: { id: true, memberNumber: true } });
  const docs = await Promise.all(invoices.map((inv) => buildFeeInvoiceDocument({ ...inv, run, membership: memberships.find((m) => m.id === inv.membershipId) ?? null }, ctx.tenant.id, ctx.tenant.name, { reminder })));
  return (
    <PrintShell title={`${reminder ? "Zahlungserinnerungen" : "Rechnungen"} ${run.title}`} subtitle={`${docs.length} Seiten · A4`} action={<PrintButton />}>
      {docs.length === 0 ? <p className="text-sm text-neutral-600 py-10">Keine passenden Rechnungen.</p> : docs.map((d) => <InvoiceDocument key={d.number} {...d} />)}
    </PrintShell>
  );
}
