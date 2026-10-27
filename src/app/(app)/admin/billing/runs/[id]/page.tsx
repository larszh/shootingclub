import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Printer } from "lucide-react";
import { requirePermission } from "@/lib/tenant";
import { Alert, Card, PageHeader, SectionTitle } from "@/components/ui";
import { AdminBillingTabs } from "@/modules/billing/ui/admin-tabs";
import { getRun, listInvoices } from "@/modules/billing/queries";
import { reminderCount, visiblePaymentNote } from "@/modules/billing/types";
import { isOverdue, nowDate } from "@/modules/billing/dates";
import { MarkRemindedButton } from "@/modules/billing/ui/invoice-actions";
import { RunInvoiceList } from "@/modules/billing/ui/run-invoice-list";
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
  const now = nowDate();
  const filter = sp.f ?? "all";
  const overdue = (i: (typeof all)[number]) => i.status === "OPEN" && isOverdue(i.dueAt, now);
  const list = all.filter((i) => (filter === "open" ? i.status === "OPEN" : filter === "overdue" ? overdue(i) : filter === "paid" ? i.status === "PAID" : filter === "reminded" ? i.status === "OPEN" && !!i.remindedAt : true));
  const overdueIds = all.filter(overdue).map((i) => i.id);
  const counts = {
    all: all.length,
    open: all.filter((i) => i.status === "OPEN").length,
    overdue: overdueIds.length,
    reminded: all.filter((i) => i.status === "OPEN" && !!i.remindedAt).length,
    paid: all.filter((i) => i.status === "PAID").length,
  };
  const active = all.filter((i) => i.status !== "CANCELLED");
  const totalCents = active.reduce((a, i) => a + i.amountCents, 0);
  const paidCents = active.filter((i) => i.status === "PAID").reduce((a, i) => a + i.amountCents, 0);
  const share = totalCents ? Math.round((paidCents / totalCents) * 100) : 0;
  const currency = all[0]?.currency ?? "CHF";
  const FILTERS = [["all", "Alle"], ["open", "Offen"], ["overdue", "Überfällig"], ["reminded", "Gemahnt"], ["paid", "Bezahlt"]] as const;

  return (
    <div>
      <PageHeader title={run.title} subtitle={`${all.length} Rechnungen · fällig ${formatDateZurich(run.dueAt, { weekday: undefined })}`} back={{ href: "/admin/billing", label: "Mitgliederbeiträge" }} />
      <AdminBillingTabs />
      {sp.created ? <div className="mb-4"><Alert tone="ok">{sp.created} Rechnungen erstellt.</Alert></div> : null}

      <Card className="animate-rise p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-2xl font-semibold tabular-nums">{share}%</div>
            <div className="text-xs text-ink-3">bezahlt · {formatMoney(paidCents, currency)} von {formatMoney(totalCents, currency)}</div>
          </div>
          <div className="text-right text-xs text-ink-3">{counts.paid} von {active.length} Rechnungen<br />{counts.overdue ? <span className="text-accent">{counts.overdue} überfällig</span> : "nichts überfällig"}</div>
        </div>
        <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={share} aria-valuemin={0} aria-valuemax={100} aria-label="Anteil bezahlt">
          <div className="h-full rounded-full bg-ok transition-[width] duration-700" style={{ width: `${share}%` }} />
        </div>
      </Card>

      <SectionTitle action={<a href={`/api/export/billing?year=${run.year}`} className="inline-flex items-center gap-1 text-xs text-ink-3 hover:text-ink"><Download className="h-3.5 w-3.5" /> CSV</a>}>Drucken</SectionTitle>
      <div className="animate-rise grid grid-cols-2 gap-2">
        <Link href={`/admin/billing/runs/${run.id}/print?filter=open`} target="_blank" className="press"><Card className="p-3.5 flex items-center gap-2 hover:border-ink/30 min-h-14"><Printer className="h-4 w-4 text-ink-2" /><span className="text-sm font-medium">Alle offenen ({counts.open})</span></Card></Link>
        <Link href={`/admin/billing/runs/${run.id}/print?filter=all`} target="_blank" className="press"><Card className="p-3.5 flex items-center gap-2 hover:border-ink/30 min-h-14"><Printer className="h-4 w-4 text-ink-2" /><span className="text-sm font-medium">Alle ({counts.all})</span></Card></Link>
        <Link href={`/admin/billing/runs/${run.id}/print?reminder=1`} target="_blank" className="press col-span-2"><Card className="p-3.5 flex items-center gap-2 hover:border-ink/30 min-h-14"><Printer className="h-4 w-4 text-ink-2" /><span className="text-sm font-medium flex-1">Zahlungserinnerungen für überfällige ({counts.overdue})</span><span className="text-xs text-ink-3">neue Frist 14 Tage</span></Card></Link>
      </div>
      {counts.overdue ? <div className="mt-2 flex items-center justify-end gap-2"><span className="text-xs text-ink-3">Nach dem Versand:</span><MarkRemindedButton ids={overdueIds} /></div> : null}

      <SectionTitle>Rechnungen</SectionTitle>
      <div className="animate-fade flex gap-1.5 overflow-x-auto pb-2 -mx-4 px-4 mb-2 [scrollbar-width:none]">
        {FILTERS.map(([f, label]) => (
          <Link key={f} href={`/admin/billing/runs/${run.id}?f=${f}`} className={`press shrink-0 h-9 rounded-full px-3.5 text-sm font-medium border flex items-center ${filter === f ? "bg-ink text-bg border-ink" : "bg-surface border-line text-ink-2"}`}>
            {label} ({counts[f]})
          </Link>
        ))}
      </div>
      <RunInvoiceList
        key={filter}
        invoices={list.map((i) => ({
          id: i.id, memberName: i.memberName, number: i.number, categoryName: i.categoryName, amountCents: i.amountCents, currency: i.currency, status: i.status,
          remindedAt: i.remindedAt, paidAt: i.paidAt, reminders: reminderCount(i.paymentNote, i.remindedAt), overdue: overdue(i), note: visiblePaymentNote(i.paymentNote),
        }))}
      />
    </div>
  );
}
