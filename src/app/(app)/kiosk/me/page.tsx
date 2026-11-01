import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown, Coffee } from "lucide-react";
import { Alert, Badge, Card, EmptyState, LinkButton, PageHeader, SectionTitle, StatCard } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { formatDateTimeZurich, formatDateZurich } from "@/lib/time";
import { requireKiosk } from "@/modules/kiosk/guard";
import { myKiosk } from "@/modules/kiosk/queries";
import { FEE_INVOICE_STATUS } from "@/modules/billing/types";
import { getBillingProfile } from "@/modules/billing/profile";

export const metadata: Metadata = { title: "Meine Konsumationen" };

/** Eigene Konsumationen: offen (noch nicht verrechnet), Rechnungen und Barbezüge. */
export default async function MyKioskPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const ctx = await requireKiosk();
  const sp = await searchParams;
  const [{ open, openCents, invoices, recentCash }, profile] = await Promise.all([
    myKiosk(ctx.tenant.id, ctx.user.id),
    getBillingProfile(ctx.tenant.id, ctx.tenant.name),
  ]);
  const cur = profile.currency;
  const seller = ctx.can("kiosk.sell");

  return (
    <div>
      <PageHeader title="Meine Konsumationen" subtitle="Schützenstube" back={seller ? { href: "/kiosk", label: "Theke" } : undefined} />
      {sp.denied ? <Alert className="mb-4">Dafür fehlt dir die Berechtigung.</Alert> : null}

      <div className="mb-4 grid grid-cols-2 gap-3">
        <StatCard label="Offen, noch nicht verrechnet" value={formatMoney(openCents, cur)} tone={openCents ? "warn" : "neutral"} hint={`${open.length} ${open.length === 1 ? "Eintrag" : "Einträge"}`} />
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
              <span className="shrink-0 font-medium tabular-nums">{formatMoney(e.totalCents, cur)}</span>
            </div>
          ))}
          <div className="flex min-h-12 items-center justify-between bg-surface-2 px-4 py-2 font-semibold">
            <span>Total offen</span><span className="tabular-nums">{formatMoney(openCents, cur)}</span>
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
              <details key={i.id} className="group">
                <summary className="press flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-2 hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5"><span className="truncate font-medium">{i.categoryName}</span><Badge tone={st.tone}>{st.label}</Badge></div>
                    <div className="text-xs text-ink-3">Nr. {i.number} · {formatDateZurich(i.issuedAt, { weekday: undefined })}{i.status === "OPEN" ? ` · zahlbar bis ${formatDateZurich(i.dueAt, { weekday: undefined })}` : ""} · {i.items.length} {i.items.length === 1 ? "Position" : "Positionen"}</div>
                  </div>
                  <span className="shrink-0 font-medium tabular-nums">{formatMoney(i.amountCents, i.currency)}</span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-ink-3 transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <div className="border-t border-line bg-surface-2/50">
                  {i.items.length ? (
                    <ul className="divide-y divide-line">
                      {i.items.map((e) => (
                        <li key={e.id} className="flex min-h-11 items-center gap-3 px-4 py-1.5">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm"><span className="tabular-nums">{e.quantity} ×</span> {e.productName} <span className="text-ink-3">à {formatMoney(e.unitPriceCents, i.currency)}</span></div>
                            <div className="text-xs text-ink-3">{formatDateTimeZurich(e.createdAt)}</div>
                          </div>
                          <span className="shrink-0 text-sm tabular-nums">{formatMoney(e.totalCents, i.currency)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="px-4 py-2 text-sm text-ink-3">Keine Positionen mehr verknüpft.</p>}
                  <div className="px-4 py-2">
                    <Link href="/payments" className="inline-flex min-h-11 items-center text-sm font-medium text-accent">Bezahlen und QR-Rechnung unter «Zahlungen»</Link>
                  </div>
                </div>
              </details>
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
                <span className="shrink-0 text-sm tabular-nums text-ink-2">{formatMoney(e.totalCents, cur)}</span>
              </div>
            ))}
          </Card>
        </>
      ) : null}

      <LinkButton href="/payments" variant="secondary">Alle Rechnungen und Zahlungen</LinkButton>
    </div>
  );
}
