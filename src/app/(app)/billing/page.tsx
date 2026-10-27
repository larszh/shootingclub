import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Settings } from "lucide-react";
import { requireModule } from "@/lib/tenant";
import { Badge, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { listMyFeeInvoices } from "@/modules/billing/queries";
import { FEE_INVOICE_STATUS } from "@/modules/billing/types";
import { formatMoney } from "@/lib/money";
import { formatDateZurich } from "@/lib/time";

export const metadata: Metadata = { title: "Mitgliederbeiträge" };

export default async function BillingPage() {
  const ctx = await requireModule("billing");
  const invoices = await listMyFeeInvoices(ctx);
  const canManage = ctx.can("tenant.manage");
  const open = invoices.filter((i) => i.status === "OPEN");
  return (
    <div>
      <PageHeader title="Meine Beiträge" subtitle={ctx.tenant.name} action={canManage ? <LinkButton href="/admin/billing" variant="secondary" size="sm"><Settings className="h-4 w-4" /> Verwalten</LinkButton> : null} />
      {open.length ? (
        <Card className="animate-rise p-4 mb-4 bg-accent-soft/40 border-accent/20">
          <div className="text-sm font-medium">{open.length === 1 ? "Eine offene Rechnung" : `${open.length} offene Rechnungen`} · {formatMoney(open.reduce((a, i) => a + i.amountCents, 0), open[0]!.currency)}</div>
          <p className="text-xs text-ink-3 mt-0.5">Mit der QR-Rechnung per E-Banking oder TWINT-App bezahlen. Die Rechnung kannst du unten öffnen.</p>
        </Card>
      ) : null}
      {invoices.length ? (
        <Card className="animate-rise divide-y divide-line overflow-hidden">
          {invoices.map((i) => {
            const st = FEE_INVOICE_STATUS[i.status]!;
            return (
              <Link key={i.id} href={`/billing/invoices/${i.id}/print`} target="_blank" className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                <FileText className="h-5 w-5 text-ink-2" />
                <div className="min-w-0 flex-1"><div className="font-medium">{i.run?.title ?? `Mitgliederbeitrag ${i.year}`}</div><div className="text-xs text-ink-3">{i.number} · {i.categoryName} · fällig {formatDateZurich(i.dueAt, { weekday: undefined })}</div></div>
                <div className="text-right"><div className="font-semibold tabular-nums">{formatMoney(i.amountCents, i.currency)}</div><Badge tone={st.tone}>{st.label}</Badge></div>
              </Link>
            );
          })}
        </Card>
      ) : (
        <EmptyState icon={<FileText className="h-5 w-5" />} title="Noch keine Beitragsrechnung" text="Sobald der Verein die Jahresrechnung erstellt, erscheint sie hier mit QR-Zahlteil." />
      )}
      {!ctx.user.street ? <p className="mt-4 text-xs text-ink-3">Tipp: Hinterlege deine Adresse unter <Link href="/me" className="underline">Mehr → Profil</Link>, dann ist sie auf der Rechnung und im QR-Code vorausgefüllt.</p> : null}
    </div>
  );
}
