import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Coffee } from "lucide-react";
import { Alert, Badge, Card, EmptyState, LinkButton, PageHeader, SectionTitle, StatCard } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { formatDateTimeZurich, formatDateZurich } from "@/lib/time";
import { requireKiosk } from "@/modules/kiosk/guard";
import { myKiosk } from "@/modules/kiosk/queries";
import { FEE_INVOICE_STATUS } from "@/modules/billing/types";

export const metadata: Metadata = { title: "Meine Konsumationen" };

/** Eigene Konsumationen: offen (noch nicht verrechnet), Rechnungen und Barbezüge. */
export default async function MyKioskPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const ctx = await requireKiosk();
  const sp = await searchParams;
  const { open, openCents, invoices, recentCash } = await myKiosk(ctx.tenant.id, ctx.user.id);
  const seller = ctx.can("kiosk.sell");

  return (
    <div>
      <PageHeader title="Meine Konsumationen" subtitle="Schützenstube" back={seller ? { href: "/kiosk", label: "Theke" } : undefined} />
      {sp.denied ? <Alert className="mb-4">Dafür fehlt dir die Berechtigung.</Alert> : null}

      <div className="mb-4 grid grid-cols-2 gap-3">
        <StatCard label="Offen, noch nicht verrechnet" value={formatMoney(openCents)} tone={openCents ? "warn" : "neutral"} hint={`${open.length} ${open.length === 1 ? "Eintrag" : "Einträge"}`} />
        <StatCard label="Rechnungen" value={invoices.length} href="/payments" hint="unter «Zahlungen»" />
      </div>

      <SectionTitle>Offen</SectionTitle>
      {open.length ? (
        <Card className="animate-rise mb-2 divide-y divide-line overflow-hidden">
          {open.map((e) => (
            <div key={e.id} className="flex min-h-12 items-center gap-3 px-4 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px]"><span className="font-medium tabular-nums">{e.quantity} ×</span> {e.productName}</div>
                <div className="text-xs text-ink-3">{formatDateTimeZurich(e.createdAt)}</div>
              </div>
              <span className="shrink-0 font-medium tabular-nums">{formatMoney(e.totalCents)}</span>
            </div>
          ))}
          <div className="flex min-h-12 items-center justify-between bg-surface-2 px-4 py-2 font-semibold">
            <span>Total offen</span><span className="tabular-nums">{formatMoney(openCents)}</span>
          </div>
        </Card>
      ) : (
        <EmptyState icon={<Coffee className="h-5 w-5" />} title="Nichts offen" text="Konsumationen auf Rechnung erscheinen hier, bis sie verrechnet werden." />
      )}
      {open.length ? <p className="mb-4 text-xs text-ink-3">Offene Konsumationen werden periodisch mit einer QR-Rechnung verrechnet. Diese erscheint dann unter «Zahlungen».</p> : null}

      <SectionTitle action={<Link href="/payments" className="text-sm text-accent">Zahlungen</Link>}>Verrechnet</SectionTitle>
      {invoices.length ? (
        <Card className="animate-rise mb-4 divide-y divide-line overflow-hidden">
          {invoices.map((i) => {
            const st = FEE_INVOICE_STATUS[i.status] ?? { label: i.status, tone: "neutral" as const };
            return (
              <Link key={i.id} href="/payments" className="press flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-surface-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5"><span className="truncate font-medium">{i.categoryName}</span><Badge tone={st.tone}>{st.label}</Badge></div>
                  <div className="text-xs text-ink-3">Nr. {i.number} · {formatDateZurich(i.issuedAt, { weekday: undefined })}{i.status === "OPEN" ? ` · zahlbar bis ${formatDateZurich(i.dueAt, { weekday: undefined })}` : ""}</div>
                </div>
                <span className="shrink-0 font-medium tabular-nums">{formatMoney(i.amountCents, i.currency)}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
              </Link>
            );
          })}
        </Card>
      ) : <p className="mb-4 text-sm text-ink-3">Noch keine Rechnungen der Schützenstube.</p>}

      {recentCash.length ? (
        <>
          <SectionTitle>Bar bezahlt (letzte 90 Tage)</SectionTitle>
          <Card className="animate-rise mb-4 divide-y divide-line overflow-hidden">
            {recentCash.map((e) => (
              <div key={e.id} className="flex min-h-12 items-center gap-3 px-4 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px]"><span className="tabular-nums">{e.quantity} ×</span> {e.productName}</div>
                  <div className="text-xs text-ink-3">{formatDateTimeZurich(e.createdAt)}</div>
                </div>
                <span className="shrink-0 text-sm tabular-nums text-ink-2">{formatMoney(e.totalCents)}</span>
              </div>
            ))}
          </Card>
        </>
      ) : null}

      <LinkButton href="/payments" variant="secondary">Alle Rechnungen und Zahlungen</LinkButton>
    </div>
  );
}
