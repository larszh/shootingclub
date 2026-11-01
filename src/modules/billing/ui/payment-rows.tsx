import Link from "next/link";
import { CalendarDays, ChevronRight, CreditCard, Package, Printer, Receipt } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { CopyButton } from "@/components/ui/controls";
import { formatMoney } from "@/lib/money";
import { formatDate, getT, type Locale } from "@/lib/i18n/core";
import { formatIban, formatQrReference } from "@/lib/qr-reference";
import { cn } from "@/lib/utils";
import { PAYMENT_STATUS_LABEL, type PaymentItem, type PaymentSource } from "../overview";
import { localizePaymentItem } from "./i18n";

/** Gemeinsame Darstellung der Zahlungsübersicht (Mitglied und Verwaltung). Ohne Client-State. */

const SOURCE_ICON: Record<PaymentSource, React.ComponentType<{ className?: string }>> = {
  FEE: Receipt,
  BOOKING: CalendarDays,
  ONLINE: CreditCard,
  AMMO: Package,
};

export function SourceIcon({ source, tone = "neutral" }: { source: PaymentSource; tone?: "neutral" | "warn" | "danger" }) {
  const Icon = SOURCE_ICON[source];
  return (
    <span
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
        tone === "danger" ? "bg-danger/12 text-danger" : tone === "warn" ? "bg-warn/15 text-warn" : "bg-surface-2 text-ink-2",
      )}
      aria-hidden
    >
      <Icon className="h-5 w-5" />
    </span>
  );
}

export function dueText(item: PaymentItem, locale: Locale = "de") {
  const t = getT(locale);
  const day = (d: Date) => formatDate(d, locale);
  if (item.status !== "OPEN") {
    if (item.status === "PAID" && item.paidAt) return t("money.due.paidOn", { date: day(item.paidAt) });
    return null;
  }
  if (!item.dueAt) return t("money.due.open");
  return item.overdue ? t("money.due.overdueSince", { date: day(item.dueAt) }) : t("money.due.payableUntil", { date: day(item.dueAt) });
}

function statusBadge(item: PaymentItem, locale: Locale) {
  const t = getT(locale);
  if (item.overdue) return { label: t("money.status.OVERDUE"), tone: "danger" as const };
  return { label: t(`money.status.${item.status}`), tone: PAYMENT_STATUS_LABEL[item.status].tone };
}

/** Zahlungsangaben eines Vereins für die Kopierknöpfe. */
export type PayeeInfo = { iban: string | null; payeeName: string; qrIban: boolean };

/** Offene Rechnung als Karte mit Kopierknöpfen für IBAN, Referenz bzw. Zahlungszweck und Betrag. */
export function OpenPaymentCard({ item: raw, payee, locale = "de" }: { item: PaymentItem; payee: PayeeInfo; locale?: Locale }) {
  const t = getT(locale);
  const item = localizePaymentItem(raw, locale);
  // Zahlungszweck bleibt im Wortlaut der Rechnung (QR-Mitteilung), nicht übersetzt.
  const purpose = (raw.number && !raw.title.includes(raw.number) ? `${raw.title} ${raw.number}` : raw.title).trim();
  const due = dueText(raw, locale);
  return (
    <Card className={cn("p-4", item.overdue && "border-danger/50")}>
      <div className="flex items-start gap-3">
        <SourceIcon source={item.source} tone={item.overdue ? "danger" : "warn"} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold leading-snug">{item.title}</div>
          <div className="text-xs text-ink-3">
            {[item.number, item.sourceText, item.detail].filter(Boolean).join(" · ")}
          </div>
          {due ? <div className={cn("mt-0.5 text-xs font-medium", item.overdue ? "text-danger" : "text-ink-2")}>{due}</div> : null}
        </div>
        <div className="shrink-0 text-right">
          <div className="text-lg font-semibold tabular-nums">{formatMoney(item.amountCents, item.currency)}</div>
          <Badge tone={item.overdue ? "danger" : "warn"}>{item.overdue ? t("money.status.OVERDUE") : t("money.status.OPEN")}</Badge>
        </div>
      </div>

      {payee.iban ? (
        <div className="mt-3 rounded-control bg-surface-2 p-3 text-sm">
          <div className="text-xs text-ink-3">{t("money.payee.payableTo", { name: payee.payeeName })}</div>
          <div className="mt-0.5 break-all font-mono tabular-nums">{formatIban(payee.iban)}</div>
          {item.reference ? (
            <div className="mt-1.5">
              <div className="text-xs text-ink-3">{t("money.payee.reference")}</div>
              <div className="break-all font-mono tabular-nums">{formatQrReference(item.reference)}</div>
            </div>
          ) : payee.qrIban ? (
            <p className="mt-1.5 text-xs text-ink-3">{t("money.payee.useQrBill")}</p>
          ) : (
            <div className="mt-1.5">
              <div className="text-xs text-ink-3">{t("money.payee.purpose")}</div>
              <div>{purpose}</div>
            </div>
          )}
          <div className="mt-2.5 flex flex-wrap gap-2">
            <CopyButton text={payee.iban.replace(/\s+/g, "")} label={t("money.copy.iban")} copiedMessage={t("money.copy.ibanDone")} className="min-h-11" />
            {item.reference ? (
              <CopyButton text={item.reference} label={t("money.copy.reference")} copiedMessage={t("money.copy.referenceDone")} className="min-h-11" />
            ) : !payee.qrIban ? (
              <CopyButton text={purpose} label={t("money.copy.purpose")} copiedMessage={t("money.copy.purposeDone")} className="min-h-11" />
            ) : null}
            <CopyButton text={(item.amountCents / 100).toFixed(2)} label={t("money.copy.amount")} copiedMessage={t("money.copy.amountDone")} className="min-h-11" />
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-ink-3">{t("money.payee.onInvoice")}</p>
      )}

      <Link
        href={item.href}
        target={item.external ? "_blank" : undefined}
        className="press mt-3 flex h-11 items-center justify-center gap-2 rounded-control border border-line bg-surface text-[15px] font-medium hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <Printer className="h-4 w-4" aria-hidden /> {t("money.qr.open")}
      </Link>
    </Card>
  );
}

/** Kompakte Zeile (erledigte Posten oder Verwaltungsliste). */
export function PaymentRow({ item: raw, showMember, locale = "de" }: { item: PaymentItem; showMember?: boolean; locale?: Locale }) {
  const item = localizePaymentItem(raw, locale);
  const st = statusBadge(raw, locale);
  const due = dueText(raw, locale);
  const sub = [showMember ? item.memberName : null, item.number, item.sourceText, showMember ? null : item.detail].filter(Boolean).join(" · ");
  return (
    <Link
      href={item.href}
      target={item.external ? "_blank" : undefined}
      className={cn("flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent", item.overdue && "bg-danger/5")}
    >
      <SourceIcon source={item.source} tone={item.overdue ? "danger" : item.status === "OPEN" ? "warn" : "neutral"} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{item.title}</div>
        <div className="truncate text-xs text-ink-3">{sub}</div>
        {due ? <div className={cn("text-xs", item.overdue ? "font-medium text-danger" : "text-ink-3")}>{due}</div> : null}
      </div>
      <div className="shrink-0 text-right">
        <div className="font-semibold tabular-nums">{formatMoney(item.amountCents, item.currency)}</div>
        <Badge tone={st.tone}>{st.label}</Badge>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
    </Link>
  );
}

export function formatTotals(totals: Array<{ currency: string; cents: number }>) {
  return totals.map((t) => formatMoney(t.cents, t.currency)).join(" · ");
}
