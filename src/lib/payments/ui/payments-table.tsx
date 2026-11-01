import Link from "next/link";
import { CalendarDays, CreditCard, Receipt } from "lucide-react";
import { Badge, Card, EmptyState } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { formatDateTimeZurich } from "@/lib/time";
import { PAYMENT_ROW_STATUS, providerLabel } from "@/lib/payments/catalog";
import type { TenantPaymentRow } from "@/lib/payments/queries";

/** Liste der Online-Zahlungen eines Vereins (Reservationen und Beitragsrechnungen). */
export function TenantPaymentsTable({ rows }: { rows: TenantPaymentRow[] }) {
  if (!rows.length) {
    return <EmptyState icon={<CreditCard className="h-5 w-5" />} title="Noch keine Online-Zahlungen" text="Zahlungen über den Zahlungsanbieter erscheinen hier, sobald jemand online bezahlt." />;
  }
  return (
    <Card className="animate-rise divide-y divide-line overflow-hidden">
      {rows.map((r) => {
        const st = PAYMENT_ROW_STATUS[r.status] ?? { label: r.status, tone: "neutral" as const };
        const Icon = r.kind === "FEE" ? Receipt : CalendarDays;
        const inner = (
          <>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-2" aria-hidden><Icon className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{r.title}</div>
              <div className="truncate text-xs text-ink-3">
                {[r.memberName, r.kind === "FEE" ? "Rechnung" : "Reservation", providerLabel(r.provider), formatDateTimeZurich(r.createdAt)].filter(Boolean).join(" · ")}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="font-semibold tabular-nums">{formatMoney(r.amountCents, r.currency)}</div>
              <div className="flex flex-wrap justify-end gap-1">
                {r.review ? <Badge tone={r.review.tone}>{r.review.label}</Badge> : null}
                <Badge tone={st.tone}>{st.label}</Badge>
              </div>
            </div>
          </>
        );
        return r.href ? (
          <Link key={r.id} href={r.href} target={r.kind === "FEE" ? "_blank" : undefined} prefetch={false} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent">
            {inner}
          </Link>
        ) : (
          <div key={r.id} className="flex min-h-14 items-center gap-3 px-4 py-3">{inner}</div>
        );
      })}
    </Card>
  );
}
