import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Printer } from "lucide-react";
import { requireBillingAdmin } from "@/modules/billing/guard";
import { Alert, Card, PageHeader, SectionTitle } from "@/components/ui";
import { AdminBillingTabs } from "@/modules/billing/ui/admin-tabs";
import { getRun, listInvoices } from "@/modules/billing/queries";
import { reminderCount, visiblePaymentNote } from "@/modules/billing/types";
import { isOverdue, nowDate } from "@/modules/billing/dates";
import { MarkRemindedButton } from "@/modules/billing/ui/invoice-actions";
import { RunInvoiceList } from "@/modules/billing/ui/run-invoice-list";
import { formatMoney } from "@/lib/money";
import { formatDate, getRequestLocale, getT } from "@/lib/i18n";

export async function generateMetadata() {
  return { title: getT(await getRequestLocale())("adm1.runpage.title") };
}

export default async function RunDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string; f?: string }> }) {
  const ctx = await requireBillingAdmin();
  const locale = await getRequestLocale();
  const t = getT(locale);
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
  const FILTERS = ["all", "open", "overdue", "reminded", "paid"] as const;

  return (
    <div>
      <PageHeader title={run.title} subtitle={`${t(all.length === 1 ? "money.payments.invoices.one" : "money.payments.invoices.other", { n: all.length })} · ${t("adm1.inv.dueOn", { date: formatDate(run.dueAt, locale) })}`} back={{ href: "/admin/billing", label: t("adm1.module.billing.name") }} />
      <AdminBillingTabs />
      {sp.created ? <div className="mb-4"><Alert tone="ok">{t("adm1.runpage.created", { n: sp.created })}</Alert></div> : null}

      <Card className="animate-rise p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-2xl font-semibold tabular-nums">{share}%</div>
            <div className="text-xs text-ink-3">{t("adm1.runpage.paidShare", { paid: formatMoney(paidCents, currency), total: formatMoney(totalCents, currency) })}</div>
          </div>
          <div className="text-right text-xs text-ink-3">{t("adm1.runpage.paidCount", { paid: counts.paid, total: active.length })}<br />{counts.overdue ? <span className="text-accent">{t("adm1.bill.overdueN", { n: counts.overdue })}</span> : t("adm1.runpage.noneOverdue")}</div>
        </div>
        <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={share} aria-valuemin={0} aria-valuemax={100} aria-label={t("adm1.runpage.shareLabel")}>
          <div className="h-full rounded-full bg-ok transition-[width] duration-700" style={{ width: `${share}%` }} />
        </div>
      </Card>

      <SectionTitle action={<a href={`/api/export/billing?year=${run.year}`} className="inline-flex items-center gap-1 text-xs text-ink-3 hover:text-ink"><Download className="h-3.5 w-3.5" /> CSV</a>}>{t("adm1.runpage.print")}</SectionTitle>
      <div className="animate-rise grid grid-cols-2 gap-2">
        <Link href={`/admin/billing/runs/${run.id}/print?filter=open`} target="_blank" className="press"><Card className="p-3.5 flex items-center gap-2 hover:border-ink/30 min-h-14"><Printer className="h-4 w-4 text-ink-2" /><span className="text-sm font-medium">{t("adm1.runpage.printOpen", { n: counts.open })}</span></Card></Link>
        <Link href={`/admin/billing/runs/${run.id}/print?filter=all`} target="_blank" className="press"><Card className="p-3.5 flex items-center gap-2 hover:border-ink/30 min-h-14"><Printer className="h-4 w-4 text-ink-2" /><span className="text-sm font-medium">{t("adm1.common.all")} ({counts.all})</span></Card></Link>
        <Link href={`/admin/billing/runs/${run.id}/print?reminder=1`} target="_blank" className="press col-span-2"><Card className="p-3.5 flex items-center gap-2 hover:border-ink/30 min-h-14"><Printer className="h-4 w-4 text-ink-2" /><span className="text-sm font-medium flex-1">{t("adm1.runpage.reminders", { n: counts.overdue })}</span><span className="text-xs text-ink-3">{t("adm1.runpage.newTerm")}</span></Card></Link>
      </div>
      {counts.overdue ? <div className="mt-2 flex items-center justify-end gap-2"><span className="text-xs text-ink-3">{t("adm1.runpage.afterSending")}</span><MarkRemindedButton ids={overdueIds} /></div> : null}

      <SectionTitle>{t("money.billing.invoices")}</SectionTitle>
      <div className="animate-fade flex gap-1.5 overflow-x-auto pb-2 -mx-4 px-4 mb-2 [scrollbar-width:none]">
        {FILTERS.map((f) => (
          <Link key={f} href={`/admin/billing/runs/${run.id}?f=${f}`} className={`press shrink-0 h-9 rounded-full px-3.5 text-sm font-medium border flex items-center ${filter === f ? "bg-ink text-bg border-ink" : "bg-surface border-line text-ink-2"}`}>
            {t(`adm1.runpage.filter.${f}`)} ({counts[f]})
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
