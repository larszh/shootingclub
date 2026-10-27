import Link from "next/link";
import { notFound } from "next/navigation";
import { Printer } from "lucide-react";
import { requirePermission } from "@/lib/tenant";
import { Alert, Badge, Card, PageHeader, SectionTitle } from "@/components/ui";
import { AdminBillingTabs } from "@/modules/billing/ui/admin-tabs";
import { getRun, listInvoices } from "@/modules/billing/queries";
import { FEE_INVOICE_STATUS } from "@/modules/billing/types";
import { FeeInvoiceActions, MarkRemindedButton } from "@/modules/billing/ui/invoice-actions";
import { formatMoney } from "@/lib/money";
import { formatDateZurich } from "@/lib/time";

export const metadata = { title: "Jahresrechnung" };

export default async function RunDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string; f?: string }> }) {
  const ctx = await requirePermission("tenant.manage");
  const { id } = await params;
  const sp = await searchParams;
  const run = await getRun(ctx.tenant.id, id);
  if (!run) notFound();
  const all = await listInvoices(ctx.tenant.id, { runId: run.id });
  const filter = sp.f ?? "all";
  const now = new Date();
  const list = all.filter((i) => (filter === "open" ? i.status === "OPEN" : filter === "overdue" ? i.status === "OPEN" && i.dueAt < now : filter === "paid" ? i.status === "PAID" : true));
  const overdueIds = all.filter((i) => i.status === "OPEN" && i.dueAt < now).map((i) => i.id);
  const counts = { all: all.length, open: all.filter((i) => i.status === "OPEN").length, overdue: overdueIds.length, paid: all.filter((i) => i.status === "PAID").length };

  return (
    <div>
      <PageHeader title={run.title} subtitle={`${all.length} Rechnungen · fällig ${formatDateZurich(run.dueAt, { weekday: undefined })}`} back={{ href: "/admin/billing", label: "Mitgliederbeiträge" }} />
      <AdminBillingTabs />
      {sp.created ? <div className="mb-4"><Alert tone="ok">{sp.created} Rechnungen erstellt.</Alert></div> : null}

      <SectionTitle>Drucken</SectionTitle>
      <div className="animate-rise grid grid-cols-2 gap-2">
        <Link href={`/admin/billing/runs/${run.id}/print?filter=open`} target="_blank" className="press"><Card className="p-3.5 flex items-center gap-2 hover:border-ink/30"><Printer className="h-4 w-4 text-ink-2" /><span className="text-sm font-medium">Alle offenen ({counts.open})</span></Card></Link>
        <Link href={`/admin/billing/runs/${run.id}/print?filter=all`} target="_blank" className="press"><Card className="p-3.5 flex items-center gap-2 hover:border-ink/30"><Printer className="h-4 w-4 text-ink-2" /><span className="text-sm font-medium">Alle ({counts.all})</span></Card></Link>
        <Link href={`/admin/billing/runs/${run.id}/print?reminder=1`} target="_blank" className="press col-span-2"><Card className="p-3.5 flex items-center gap-2 hover:border-ink/30"><Printer className="h-4 w-4 text-ink-2" /><span className="text-sm font-medium flex-1">Zahlungserinnerungen für überfällige ({counts.overdue})</span><span className="text-xs text-ink-3">neue Frist 14 Tage</span></Card></Link>
      </div>
      {counts.overdue ? <div className="mt-2 flex justify-end"><MarkRemindedButton ids={overdueIds} /></div> : null}

      <SectionTitle>Rechnungen</SectionTitle>
      <div className="animate-fade flex gap-1.5 overflow-x-auto pb-2 -mx-4 px-4 mb-2 [scrollbar-width:none]">
        {(["all", "open", "overdue", "paid"] as const).map((f) => (
          <Link key={f} href={`/admin/billing/runs/${run.id}?f=${f}`} className={`press shrink-0 h-9 rounded-full px-3.5 text-sm font-medium border ${filter === f ? "bg-ink text-bg border-ink" : "bg-surface border-line text-ink-2"}`}>
            {f === "all" ? "Alle" : f === "open" ? "Offen" : f === "overdue" ? "Überfällig" : "Bezahlt"} ({counts[f]})
          </Link>
        ))}
      </div>
      <Card className="animate-rise divide-y divide-line overflow-hidden">
        {list.map((i) => {
          const st = FEE_INVOICE_STATUS[i.status]!;
          return (
            <div key={i.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <Link href={`/billing/invoices/${i.id}/print`} target="_blank" className="font-medium hover:underline">{i.memberName}</Link>
                <div className="text-xs text-ink-3">{i.number} · {i.categoryName}{i.remindedAt ? ` · gemahnt ${formatDateZurich(i.remindedAt, { weekday: undefined })}` : ""}{i.paidAt ? ` · bezahlt ${formatDateZurich(i.paidAt, { weekday: undefined })}` : ""}</div>
              </div>
              <div className="text-right"><div className="font-semibold tabular-nums text-sm">{formatMoney(i.amountCents, i.currency)}</div><Badge tone={st.tone}>{st.label}</Badge></div>
              <FeeInvoiceActions id={i.id} status={i.status} />
            </div>
          );
        })}
        {list.length === 0 ? <p className="p-4 text-sm text-ink-3">Keine Rechnungen in dieser Auswahl.</p> : null}
      </Card>
    </div>
  );
}
