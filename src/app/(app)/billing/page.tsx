import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Printer, Settings } from "lucide-react";
import { requireModule } from "@/lib/tenant";
import { Badge, Card, EmptyState, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { listMyFeeInvoices } from "@/modules/billing/queries";
import { getBillingProfile } from "@/modules/billing/profile";
import { ensureReferences } from "@/modules/billing/reference";
import { FEE_INVOICE_STATUS } from "@/modules/billing/types";
import { CopyField } from "@/modules/billing/ui/copy-field";
import { formatMoney } from "@/lib/money";
import { formatDateZurich } from "@/lib/time";
import { formatIban, formatQrReference } from "@/lib/qr-reference";

export const metadata: Metadata = { title: "Mitgliederbeiträge" };

export default async function BillingPage() {
  const ctx = await requireModule("billing");
  const [all, profile] = await Promise.all([listMyFeeInvoices(ctx), getBillingProfile(ctx.tenant.id, ctx.tenant.name)]);
  const canManage = ctx.can("tenant.manage");
  // Offene Rechnungen erhalten bei QR-IBAN ihre Referenz (ältere Rechnungen werden nachgeführt).
  const open = await ensureReferences("FEE", all.filter((i) => i.status === "OPEN"), ctx.tenant.id);
  const done = all.filter((i) => i.status !== "OPEN");
  const openTotal = open.reduce((a, i) => a + i.amountCents, 0);

  return (
    <div>
      <PageHeader title="Meine Beiträge" subtitle={ctx.tenant.name} action={canManage ? <LinkButton href="/admin/billing" variant="secondary" size="sm"><Settings className="h-4 w-4" /> Verwalten</LinkButton> : null} />

      {open.length ? (
        <>
          <Card className="animate-rise p-4 mb-4 bg-accent-soft/40 border-accent/20">
            <div className="text-sm font-medium">{open.length === 1 ? "Eine offene Rechnung" : `${open.length} offene Rechnungen`} · {formatMoney(openTotal, open[0]!.currency)}</div>
            <p className="text-xs text-ink-3 mt-0.5">Am einfachsten: QR-Rechnung öffnen und mit der Banking- oder TWINT-App scannen. Oder die Angaben unten antippen, um sie ins E-Banking zu kopieren.</p>
          </Card>
          <div className="stagger space-y-3">
            {open.map((i) => (
              <Card key={i.id} className="p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold">{i.run?.title ?? `Mitgliederbeitrag ${i.year}`}</div>
                    <div className="text-xs text-ink-3">{i.number} · {i.categoryName} · fällig {formatDateZurich(i.dueAt, { weekday: undefined })}</div>
                  </div>
                  <div className="text-right shrink-0"><div className="text-lg font-semibold tabular-nums">{formatMoney(i.amountCents, i.currency)}</div><Badge tone="warn">offen</Badge></div>
                </div>
                {profile.iban && profile.qrIban && !i.reference ? (
                  <p className="text-xs text-ink-3">Bitte mit der QR-Rechnung bezahlen (Referenznummer steht dort).</p>
                ) : profile.iban ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <CopyField label={`IBAN · ${profile.payeeName ?? ctx.tenant.name}`} value={profile.iban.replace(/\s+/g, "")} display={formatIban(profile.iban)} />
                    {profile.qrIban && i.reference ? (
                      <CopyField label="Referenznummer" value={i.reference} display={formatQrReference(i.reference)} />
                    ) : (
                      <CopyField label="Zahlungszweck (Mitteilung)" value={`${i.run?.title ?? `Mitgliederbeitrag ${i.year}`} ${i.number}`} mono={false} />
                    )}
                    <CopyField label="Betrag" value={(i.amountCents / 100).toFixed(2)} display={formatMoney(i.amountCents, i.currency)} />
                  </div>
                ) : (
                  <p className="text-xs text-ink-3">Die Zahlungsangaben stehen auf der Rechnung.</p>
                )}
                <LinkButton href={`/billing/invoices/${i.id}/print`} target="_blank" variant="secondary" className="w-full"><Printer className="h-4 w-4" /> QR-Rechnung öffnen</LinkButton>
              </Card>
            ))}
          </div>
        </>
      ) : null}

      {done.length ? (
        <>
          <SectionTitle>{open.length ? "Erledigt" : "Rechnungen"}</SectionTitle>
          <Card className="animate-rise divide-y divide-line overflow-hidden">
            {done.map((i) => {
              const st = FEE_INVOICE_STATUS[i.status]!;
              return (
                <Link key={i.id} href={`/billing/invoices/${i.id}/print`} target="_blank" className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2 min-h-14">
                  <FileText className="h-5 w-5 text-ink-2" />
                  <div className="min-w-0 flex-1"><div className="font-medium">{i.run?.title ?? `Mitgliederbeitrag ${i.year}`}</div><div className="text-xs text-ink-3">{i.number} · {i.categoryName}{i.paidAt ? ` · bezahlt am ${formatDateZurich(i.paidAt, { weekday: undefined })}` : ""}</div></div>
                  <div className="text-right"><div className="font-semibold tabular-nums">{formatMoney(i.amountCents, i.currency)}</div><Badge tone={st.tone}>{st.label}</Badge></div>
                </Link>
              );
            })}
          </Card>
        </>
      ) : null}

      {all.length === 0 ? (
        <EmptyState icon={<FileText className="h-5 w-5" />} title="Noch keine Beitragsrechnung" text="Sobald der Verein die Jahresrechnung erstellt, erscheint sie hier mit QR-Zahlteil." />
      ) : null}
      {!ctx.user.street ? <p className="mt-4 text-xs text-ink-3">Tipp: Hinterlege deine Adresse unter <Link href="/me" className="underline">Mehr → Profil</Link>, dann ist sie auf der Rechnung und im QR-Code vorausgefüllt.</p> : null}
    </div>
  );
}
