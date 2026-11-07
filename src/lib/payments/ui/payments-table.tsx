import Link from "next/link";
import { CalendarDays, CreditCard, Receipt } from "lucide-react";
import { Badge, Card, EmptyState } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { displayUserName, getT, INTL_LOCALE, type Locale } from "@/lib/i18n/core";
import { PAYMENT_ROW_STATUS, providerLabel } from "@/lib/payments/catalog";
import type { TenantPaymentRow } from "@/lib/payments/queries";

/** Liste der Online-Zahlungen eines Vereins (Reservationen und Beitragsrechnungen). */
/** Prüfhinweise aus paymentReviewBadge (Deutsch) → Schlüssel. */
const REVIEW_KEY: Record<string, string> = { "Rückerstattung prüfen": "adm1.bk.pay.reviewRefund", "Betrag weicht ab": "adm1.bk.pay.reviewAmount" };

export function TenantPaymentsTable({ rows, locale = "de" }: { rows: TenantPaymentRow[]; locale?: Locale }) {
  const t = getT(locale);
  const fmt = new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeZone: "Europe/Zurich", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  if (!rows.length) {
    return <EmptyState icon={<CreditCard className="h-5 w-5" />} title={t("adm1.bk.pay.emptyTitle")} text={t("adm1.bk.pay.emptyText")} />;
  }
  return (
    <Card className="animate-rise divide-y divide-line overflow-hidden">
      {rows.map((r) => {
        const st = PAYMENT_ROW_STATUS[r.status] ? { ...PAYMENT_ROW_STATUS[r.status]!, label: t(`adm1.bk.pay.status.${r.status}`) } : { label: r.status, tone: "neutral" as const };
        const Icon = r.kind === "FEE" ? Receipt : CalendarDays;
        const inner = (
          <>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-2" aria-hidden><Icon className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{r.title}</div>
              <div className="truncate text-xs text-ink-3">
                {[displayUserName(r.memberName, t), t(r.kind === "FEE" ? "bookings.detail.invoice" : "bookings.detail.title"), providerLabel(r.provider), fmt.format(r.createdAt)].filter(Boolean).join(" · ")}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="font-semibold tabular-nums">{formatMoney(r.amountCents, r.currency)}</div>
              <div className="flex flex-wrap justify-end gap-1">
                {r.review ? <Badge tone={r.review.tone}>{REVIEW_KEY[r.review.label] ? t(REVIEW_KEY[r.review.label]!) : r.review.label}</Badge> : null}
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
