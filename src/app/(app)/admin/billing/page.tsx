import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Printer } from "lucide-react";
import { requirePermission } from "@/lib/tenant";
import { Badge, Card, PageHeader, SectionTitle } from "@/components/ui";
import { AdminBillingTabs } from "@/modules/billing/ui/admin-tabs";
import { currentYear, feeStats, listMembersForBilling, listRuns } from "@/modules/billing/queries";
import { getBillingProfile } from "@/modules/billing/profile";
import { RunForm } from "@/modules/billing/ui/run-form";
import { YearSelect } from "@/modules/billing/ui/year-select";
import { formatMoney } from "@/lib/money";
import { formatDateZurich } from "@/lib/time";

export const metadata: Metadata = { title: "Mitgliederbeiträge verwalten" };

export default async function AdminBillingPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const ctx = await requirePermission("tenant.manage");
  const sp = await searchParams;
  const year = Number(sp.year) || currentYear();
  const [stats, runs, members, profile] = await Promise.all([feeStats(ctx.tenant.id, year), listRuns(ctx.tenant.id), listMembersForBilling(ctx.tenant.id, year), getBillingProfile(ctx.tenant.id, ctx.tenant.name)]);
  const run = runs.find((r) => r.year === year);
  const eligible = members.filter((m) => !m.invoice && (m.effectiveCents ?? 0) > 0).length;
  const last = runs[0];
  const years = [...new Set([currentYear() + 1, currentYear(), currentYear() - 1, ...runs.map((r) => r.year)])].sort((a, b) => b - a);

  return (
    <div>
      <PageHeader title="Mitgliederbeiträge" subtitle={ctx.tenant.name} back={{ href: "/me", label: "Mehr" }}
        action={<YearSelect year={year} years={years} />} />
      <AdminBillingTabs />

      {!profile.qrReady ? <Card className="p-4 mb-4 border-warn/40 bg-warn/5 text-sm">Rechnungsprofil unvollständig. <Link href="/admin/billing/settings" className="underline font-medium">Zahlungsempfänger und IBAN erfassen</Link>, damit Rechnungen einen QR-Zahlteil erhalten.</Card> : null}

      <div className="stagger grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Card className="p-4"><div className="text-2xl font-semibold tabular-nums">{stats.withCategory}<span className="text-sm text-ink-3 font-normal"> / {stats.members}</span></div><div className="text-xs text-ink-3">Mitglieder mit Beitrag</div></Card>
        <Card className="p-4"><div className="text-2xl font-semibold tabular-nums">{stats.invoiced}</div><div className="text-xs text-ink-3">Rechnungen {year}</div></Card>
        <Card className="p-4"><div className="text-2xl font-semibold tabular-nums">{formatMoney(stats.openCents, profile.currency)}</div><div className="text-xs text-ink-3">offen ({stats.open}{stats.overdue ? `, ${stats.overdue} überfällig` : ""})</div></Card>
        <Card className="p-4"><div className="text-2xl font-semibold tabular-nums">{formatMoney(stats.paidCents, profile.currency)}</div><div className="text-xs text-ink-3">bezahlt ({stats.paid})</div></Card>
      </div>

      <SectionTitle>Jahresrechnung {year}</SectionTitle>
      {run ? (
        <Link href={`/admin/billing/runs/${run.id}`} className="block press">
          <Card className="p-4 flex items-center gap-3 hover:border-ink/30">
            <div className="min-w-0 flex-1"><div className="font-medium">{run.title}</div><div className="text-xs text-ink-3">{run.count} Rechnungen · {run.paid} bezahlt · {run.open} offen · fällig {formatDateZurich(run.dueAt, { weekday: undefined })}</div></div>
            <Badge tone={run.open === 0 ? "ok" : "warn"}>{run.open === 0 ? "alle bezahlt" : `${run.open} offen`}</Badge>
            <ChevronRight className="h-4 w-4 text-ink-3" />
          </Card>
        </Link>
      ) : null}
      {eligible > 0 || !run ? (
        <div className="mt-2.5"><RunForm year={year} defaults={{ title: run?.title ?? `Mitgliederbeitrag ${year}`, invoicePrefix: run?.invoicePrefix ?? last?.invoicePrefix ?? "MB-", dueDays: run?.dueDays ?? last?.dueDays ?? 30, note: run?.note ?? last?.note ?? null }} eligible={eligible} alreadyInvoiced={members.filter((m) => m.invoice).length} /></div>
      ) : (
        <p className="mt-2 text-xs text-ink-3">Alle Mitglieder mit Beitrag haben eine Rechnung für {year}. Neue Mitglieder erhalten ihre Rechnung unter «Mitglieder».</p>
      )}

      {runs.length > 1 || (runs.length === 1 && !run) ? (
        <>
          <SectionTitle>Frühere Jahre</SectionTitle>
          <Card className="animate-rise divide-y divide-line overflow-hidden">
            {runs.filter((r) => r.year !== year).map((r) => (
              <Link key={r.id} href={`/admin/billing/runs/${r.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                <div className="min-w-0 flex-1"><div className="font-medium">{r.title}</div><div className="text-xs text-ink-3">{r.count} Rechnungen · {formatMoney(r.paidCents, profile.currency)} von {formatMoney(r.totalCents, profile.currency)} bezahlt</div></div>
                <Printer className="h-4 w-4 text-ink-3" />
              </Link>
            ))}
          </Card>
        </>
      ) : null}
    </div>
  );
}
